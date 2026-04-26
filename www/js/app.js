(() => {
  'use strict';

  const STORAGE_KEY = 'hihaho-qr-history-v1';
  const MAX_HISTORY = 200;

  // hihaho URL を解析する。許容する形式:
  //   https://player.hihaho.com/<UUID>
  //   https://player.hihaho.com/embed/<UUID>
  //   https://player.hihaho.com/embed/<UUID>?v=<VERSION>
  // クエリ文字列に v 以外のパラメータが含まれていてもよい。
  const HIHAHO_REGEX =
    /^https?:\/\/player\.hihaho\.com\/(?:embed\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#].*)?$/i;

  function parseHihahoUrl(input) {
    if (!input) return null;
    const url = String(input).trim();
    const match = url.match(HIHAHO_REGEX);
    if (!match) return null;
    const uuid = match[1].toLowerCase();

    // バージョン (?v=...) はクエリから個別に抽出
    let version = null;
    const qIdx = url.indexOf('?');
    if (qIdx >= 0) {
      const params = new URLSearchParams(url.slice(qIdx + 1));
      const v = params.get('v');
      if (v && /^\d+$/.test(v)) version = v;
    }
    return { uuid, version };
  }

  function buildEmbedUrl({ uuid, version }) {
    let url = `https://player.hihaho.com/embed/${uuid}`;
    if (version) url += `?v=${encodeURIComponent(version)}`;
    return url;
  }

  // ----- localStorage 履歴 -----
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
    } catch {
      // QuotaExceeded など。古いものを削って再試行
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
      } catch {}
    }
  }

  function addToHistory({ uuid, version }) {
    const history = loadHistory();
    const filtered = history.filter((item) => item.uuid !== uuid);
    filtered.unshift({
      uuid,
      version: version || null,
      addedAt: Date.now(),
    });
    saveHistory(filtered);
  }

  function removeFromHistory(uuid) {
    const filtered = loadHistory().filter((item) => item.uuid !== uuid);
    saveHistory(filtered);
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ----- 履歴の描画 -----
  const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  function renderHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-message');
    const clearBtn = document.getElementById('clear-all-btn');
    const history = loadHistory();
    list.innerHTML = '';

    if (history.length === 0) {
      empty.classList.remove('hidden');
      clearBtn.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    clearBtn.classList.remove('hidden');

    const frag = document.createDocumentFragment();
    for (const item of history) {
      const li = document.createElement('li');
      li.className = 'history-item';

      const thumb = document.createElement('div');
      thumb.className = 'history-thumb';
      thumb.textContent = '▶';

      const info = document.createElement('div');
      info.className = 'history-info';
      info.setAttribute('role', 'button');
      info.setAttribute('tabindex', '0');

      const uuidEl = document.createElement('div');
      uuidEl.className = 'history-uuid';
      uuidEl.textContent = item.uuid;

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const dateSpan = document.createElement('span');
      dateSpan.textContent = dateFormatter.format(new Date(item.addedAt));
      meta.appendChild(dateSpan);
      if (item.version) {
        const verSpan = document.createElement('span');
        verSpan.textContent = `v=${item.version}`;
        meta.appendChild(verSpan);
      }

      info.appendChild(uuidEl);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'icon-btn';
      playBtn.setAttribute('aria-label', '再生');
      playBtn.textContent = '▶';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn danger';
      delBtn.setAttribute('aria-label', '削除');
      delBtn.textContent = '🗑';

      actions.appendChild(playBtn);
      actions.appendChild(delBtn);

      li.appendChild(thumb);
      li.appendChild(info);
      li.appendChild(actions);

      const onPlay = () => playVideo(item);
      info.addEventListener('click', onPlay);
      info.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay();
        }
      });
      thumb.addEventListener('click', onPlay);
      playBtn.addEventListener('click', onPlay);
      delBtn.addEventListener('click', () => {
        if (confirm('この動画を履歴から削除しますか?')) {
          removeFromHistory(item.uuid);
          renderHistory();
        }
      });

      frag.appendChild(li);
    }
    list.appendChild(frag);
  }

  // ----- 画面切替 -----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ----- QRスキャナ -----
  let qrScanner = null;
  let scanLocked = false; // 1回読み取れば以降の連続コールバックを無視

  function showScanError(msg) {
    const el = document.getElementById('scan-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearScanError() {
    document.getElementById('scan-error').classList.add('hidden');
  }

  async function startScanner() {
    clearScanError();
    // ユーザー操作直後に全画面化してブラウザのURLバーを隠す
    tryEnterFullscreen(document.documentElement);
    showScreen('scan-screen');
    scanLocked = false;

    if (typeof Html5Qrcode === 'undefined') {
      showScanError('QRスキャナの読み込みに失敗しました。ネットワーク接続を確認してください。');
      return;
    }

    qrScanner = new Html5Qrcode('qr-reader', { verbose: false });

    const config = {
      fps: 10,
      qrbox: (vw, vh) => {
        const min = Math.min(vw, vh);
        const size = Math.floor(min * 0.7);
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
    };

    try {
      await qrScanner.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        () => {} // スキャン中の失敗は無視
      );
    } catch (err) {
      showScanError(
        'カメラを起動できませんでした。ブラウザの設定でカメラの使用を許可してください。'
      );
      console.error(err);
    }
  }

  async function onScanSuccess(decodedText) {
    if (scanLocked) return;
    const parsed = parseHihahoUrl(decodedText);
    if (!parsed) {
      // hihaho の URL ではない → スキャンを継続
      showScanError('hihaho の URL ではありません。別のQRコードをお試しください。');
      return;
    }
    scanLocked = true;
    clearScanError();
    await stopScanner();
    addToHistory(parsed);
    playVideo(parsed);
  }

  async function stopScanner() {
    if (!qrScanner) return;
    try {
      if (qrScanner.isScanning) {
        await qrScanner.stop();
      }
    } catch {}
    try {
      qrScanner.clear();
    } catch {}
    qrScanner = null;
  }

  // ----- プレーヤー -----
  async function playVideo(item) {
    const url = buildEmbedUrl(item);
    const iframe = document.getElementById('player-iframe');
    iframe.src = url;
    showScreen('player-screen');

    // 端末が許せば全画面に切替 (iOS Safari は要素の全画面化を許可しないが
    // PWA / 画面遷移自体でビューポート全体を占有するので問題なし)
    const container = document.getElementById('player-container');
    requestAnimationFrame(() => {
      // まずページ全体を全画面化 (Android Chrome など)、次にプレーヤー要素も試す
      tryEnterFullscreen(document.documentElement);
      tryEnterFullscreen(container);
      tryLockOrientation();
    });
  }

  function tryEnterFullscreen(el) {
    const target = el || document.documentElement;
    const req =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.mozRequestFullScreen ||
      target.msRequestFullscreen;
    if (!req) return false;
    if (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    ) {
      return true; // 既に全画面
    }
    try {
      const result = req.call(target, { navigationUI: 'hide' });
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  function isFullscreenSupported() {
    const el = document.documentElement;
    return !!(
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen
    );
  }

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isCapacitorNative() {
    return !!(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform()
    );
  }

  function tryExitFullscreen() {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (!exit) return;
    if (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    ) {
      try {
        const result = exit.call(document);
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
      } catch {}
    }
  }

  function tryLockOrientation() {
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  function tryUnlockOrientation() {
    if (screen.orientation && typeof screen.orientation.unlock === 'function') {
      try {
        screen.orientation.unlock();
      } catch {}
    }
  }

  function closePlayer() {
    const iframe = document.getElementById('player-iframe');
    iframe.src = 'about:blank';
    tryExitFullscreen();
    tryUnlockOrientation();
    showScreen('home-screen');
    renderHistory();
  }

  // ----- インストール / 全画面 案内 -----
  let deferredInstallPrompt = null;
  const INSTALL_DISMISS_KEY = 'hihaho-install-dismissed';

  function setupInstallBanner() {
    const banner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('install-dismiss');
    const hint = document.getElementById('install-banner-hint');

    // 既にインストール済み or Capacitor ネイティブ実行中はバナー不要
    if (isStandalone() || isCapacitorNative()) return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;

    if (isIOS()) {
      hint.textContent =
        'Safari の「共有」ボタンから「ホーム画面に追加」を選ぶと、URLバーなしの全画面アプリとして使えます。';
      banner.classList.remove('hidden');
    } else if (isAndroid()) {
      hint.textContent =
        'Chrome のメニューから「アプリをインストール」または「ホーム画面に追加」を選ぶと、独立したアプリとして起動できます。';
      banner.classList.remove('hidden');
    } else {
      hint.textContent = 'ホーム画面に追加するとアプリのように起動できます。';
    }

    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      try {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      banner.classList.add('hidden');
    });

    dismissBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    });
  }

  function setupFullscreenToggle() {
    const btn = document.getElementById('fullscreen-toggle');
    if (isStandalone() || isCapacitorNative() || !isFullscreenSupported()) return;
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => {
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      ) {
        tryExitFullscreen();
      } else {
        tryEnterFullscreen(document.documentElement);
      }
    });
  }

  // ----- イベント登録 -----
  document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
    setupInstallBanner();
    setupFullscreenToggle();

    document.getElementById('scan-btn').addEventListener('click', startScanner);

    document.getElementById('scan-cancel').addEventListener('click', async () => {
      await stopScanner();
      showScreen('home-screen');
    });

    document.getElementById('player-back').addEventListener('click', closePlayer);

    document.getElementById('manual-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('manual-url');
      const parsed = parseHihahoUrl(input.value);
      if (!parsed) {
        alert('hihaho の有効な URL を入力してください。');
        return;
      }
      // フォーム submit はユーザー操作なので全画面化を試みる
      tryEnterFullscreen(document.documentElement);
      addToHistory(parsed);
      input.value = '';
      playVideo(parsed);
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
      if (confirm('すべての履歴を削除しますか?')) {
        clearHistory();
        renderHistory();
      }
    });

    // ハードウェア戻るボタン (Android) でプレーヤーを閉じられるように
    window.addEventListener('popstate', () => {
      const player = document.getElementById('player-screen');
      const scan = document.getElementById('scan-screen');
      if (player.classList.contains('active')) {
        closePlayer();
      } else if (scan.classList.contains('active')) {
        stopScanner();
        showScreen('home-screen');
      }
    });

    // Service Worker 登録
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  });

  // PWA インストールプロンプトをキャプチャ
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (isStandalone()) return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;
    document.getElementById('install-banner').classList.remove('hidden');
    document.getElementById('install-btn').classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    document.getElementById('install-banner').classList.add('hidden');
    deferredInstallPrompt = null;
  });

  // 開発用: コンソールから動作確認できるよう公開
  window.__hihaho = { parseHihahoUrl, buildEmbedUrl };
})();
