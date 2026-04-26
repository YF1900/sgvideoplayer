(() => {
  'use strict';

  const STORAGE_KEY = 'hihaho-qr-history-v1';
  const THUMBS_KEY = 'hihaho-qr-thumbs-v1';
  const MAX_HISTORY = 200;
  const META_FETCH_TIMEOUT_MS = 8000;
  const THUMB_FETCH_TIMEOUT_MS = 12000;
  const THUMB_MAX_W = 320;
  const THUMB_MAX_H = 180;
  const THUMB_QUALITY = 0.72;
  // 取得失敗の再試行間隔 (24h)
  const META_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

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
    const existing = history.find((item) => item.uuid === uuid);
    const filtered = history.filter((item) => item.uuid !== uuid);
    filtered.unshift({
      uuid,
      version: version || null,
      addedAt: Date.now(),
      // 既存レコードのタイトル/取得状況は保持
      title: existing ? existing.title || null : null,
      metaTriedAt: existing ? existing.metaTriedAt || null : null,
    });
    saveHistory(filtered);
  }

  function removeFromHistory(uuid) {
    const filtered = loadHistory().filter((item) => item.uuid !== uuid);
    saveHistory(filtered);
    removeThumb(uuid);
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(THUMBS_KEY);
  }

  function updateHistoryItem(uuid, patch) {
    const history = loadHistory();
    const idx = history.findIndex((h) => h.uuid === uuid);
    if (idx < 0) return null;
    history[idx] = { ...history[idx], ...patch };
    saveHistory(history);
    return history[idx];
  }

  // ----- サムネイルキャッシュ (localStorage に dataURL で保存) -----
  function loadThumbs() {
    try {
      const raw = localStorage.getItem(THUMBS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveThumbs(map) {
    try {
      localStorage.setItem(THUMBS_KEY, JSON.stringify(map));
    } catch {
      // QuotaExceeded など → 履歴に存在する分だけ残して再保存
      try {
        const validUuids = new Set(loadHistory().map((h) => h.uuid));
        const trimmed = {};
        for (const [uuid, val] of Object.entries(map)) {
          if (validUuids.has(uuid)) trimmed[uuid] = val;
        }
        localStorage.setItem(THUMBS_KEY, JSON.stringify(trimmed));
      } catch {}
    }
  }

  function getThumb(uuid) {
    return loadThumbs()[uuid] || null;
  }

  function setThumb(uuid, dataUrl) {
    const map = loadThumbs();
    map[uuid] = dataUrl;
    saveThumbs(map);
  }

  function removeThumb(uuid) {
    const map = loadThumbs();
    if (uuid in map) {
      delete map[uuid];
      saveThumbs(map);
    }
  }

  // ----- hihaho メタデータ取得 -----
  // hihaho 自身は player.hihaho.com に CORS ヘッダを返さないため、
  // r.jina.ai の HTML プロキシ経由で og:title / og:image を取得する。
  function fetchWithTimeout(url, opts, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...(opts || {}), signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  function decodeHtmlEntities(s) {
    if (!s) return s;
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }

  function pickMeta(html, prop) {
    // <meta property="og:title" content="..."> と
    // <meta content="..." property="og:title"> の両形式に対応
    const re1 = new RegExp(
      'property=["\']' + prop + '["\'][^>]*content=["\']([^"\']+)["\']',
      'i'
    );
    const re2 = new RegExp(
      'content=["\']([^"\']+)["\'][^>]*property=["\']' + prop + '["\']',
      'i'
    );
    const m = html.match(re1) || html.match(re2);
    return m ? decodeHtmlEntities(m[1]) : null;
  }

  async function fetchHihahoMetadata(item) {
    const embedUrl = buildEmbedUrl(item);
    // r.jina.ai 経由で raw HTML を取得 (CORS OK, og タグを取り出すため)
    const proxyUrl = 'https://r.jina.ai/' + embedUrl;
    const res = await fetchWithTimeout(
      proxyUrl,
      { headers: { 'X-Return-Format': 'html', Accept: 'text/html' } },
      META_FETCH_TIMEOUT_MS
    );
    if (!res.ok) throw new Error('metadata fetch failed: ' + res.status);
    const html = await res.text();
    let title = pickMeta(html, 'og:title');
    if (!title) {
      const tm = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (tm) title = decodeHtmlEntities(tm[1]);
    }
    // hihaho の <title> は "hihaho - <Title>" 形式。プレフィックス除去
    if (title) title = title.replace(/^\s*hihaho\s*[-–—:]\s*/i, '').trim();
    let image = pickMeta(html, 'og:image');
    if (image && image.startsWith('//')) image = 'https:' + image;
    return { title: title || null, thumbnailUrl: image || null };
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image decode failed'));
      };
      img.src = url;
    });
  }

  async function fetchThumbnailDataUrl(srcUrl) {
    const res = await fetchWithTimeout(srcUrl, { mode: 'cors' }, THUMB_FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error('thumb fetch failed: ' + res.status);
    const blob = await res.blob();
    const { img, url: objUrl } = await loadImageFromBlob(blob);
    try {
      const ratio = Math.min(THUMB_MAX_W / img.width, THUMB_MAX_H / img.height, 1);
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }

  // 1 件分のメタデータ + サムネイルを取得して保存。
  // すでに揃っていれば何もしない。何かしら更新したら true。
  async function ensureMetadata(item, { force = false } = {}) {
    const hasTitle = !!item.title;
    const hasThumb = !!getThumb(item.uuid);
    if (!force && hasTitle && hasThumb) return false;
    if (
      !force &&
      item.metaTriedAt &&
      Date.now() - item.metaTriedAt < META_RETRY_INTERVAL_MS &&
      hasTitle === !!item.title // 直近で試して状況に変化なし
    ) {
      // 直近で試して失敗 → しばらくは再試行しない
      if (!hasTitle || !hasThumb) return false;
    }

    let updated = false;
    try {
      const meta = await fetchHihahoMetadata(item);
      const patch = { metaTriedAt: Date.now() };
      if (meta.title && !item.title) {
        patch.title = meta.title;
        updated = true;
      }
      const next = updateHistoryItem(item.uuid, patch);
      if (next) Object.assign(item, next);

      if (meta.thumbnailUrl && (!hasThumb || force)) {
        try {
          const dataUrl = await fetchThumbnailDataUrl(meta.thumbnailUrl);
          setThumb(item.uuid, dataUrl);
          updated = true;
        } catch {
          // サムネイル取得失敗は許容
        }
      }
    } catch {
      updateHistoryItem(item.uuid, { metaTriedAt: Date.now() });
    }
    return updated;
  }

  // 履歴全体に対して順次バックフィル (リクエスト集中を避けるため逐次実行)
  let metadataBackfillRunning = false;
  async function backfillMissingMetadata() {
    if (metadataBackfillRunning) return;
    metadataBackfillRunning = true;
    try {
      let anyUpdated = false;
      const list = loadHistory();
      for (const item of list) {
        if (item.title && getThumb(item.uuid)) continue;
        if (
          item.metaTriedAt &&
          Date.now() - item.metaTriedAt < META_RETRY_INTERVAL_MS
        ) {
          continue;
        }
        const updated = await ensureMetadata(item);
        if (updated) {
          anyUpdated = true;
          renderHistory();
        }
      }
      if (anyUpdated) renderHistory();
    } finally {
      metadataBackfillRunning = false;
    }
  }

  // ----- アイコン (Material Symbols) -----
  function makeIcon(name) {
    const el = document.createElement('span');
    el.className = 'material-symbols-outlined';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = name;
    return el;
  }

  // ----- 履歴の描画 -----
  const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // ----- 検索 -----
  let searchQuery = '';
  const EMPTY_DEFAULT_HTML =
    'まだ視聴履歴はありません。<br />「QRコードをスキャン」から始めましょう。';

  function getFilteredHistory() {
    const all = loadHistory();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => {
      const title = (item.title || '').toLowerCase();
      const uuid = item.uuid.toLowerCase();
      const version = (item.version ? String(item.version) : '').toLowerCase();
      return title.includes(q) || uuid.includes(q) || version.includes(q);
    });
  }

  function renderHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-message');
    const clearBtn = document.getElementById('clear-all-btn');
    const allHistory = loadHistory();
    const history = getFilteredHistory();
    list.innerHTML = '';

    if (allHistory.length === 0) {
      empty.classList.remove('hidden');
      empty.innerHTML = EMPTY_DEFAULT_HTML;
      clearBtn.classList.add('hidden');
      return;
    }
    clearBtn.classList.remove('hidden');

    if (history.length === 0) {
      empty.classList.remove('hidden');
      empty.textContent = '該当する動画がありません。';
      return;
    }
    empty.classList.add('hidden');

    const frag = document.createDocumentFragment();
    for (const item of history) {
      const li = document.createElement('li');
      li.className = 'history-item';

      const thumb = document.createElement('div');
      thumb.className = 'history-thumb';
      const cachedThumb = getThumb(item.uuid);
      if (cachedThumb) {
        const imgEl = document.createElement('img');
        imgEl.src = cachedThumb;
        imgEl.alt = '';
        imgEl.loading = 'lazy';
        thumb.classList.add('with-image');
        thumb.appendChild(imgEl);
      } else {
        thumb.appendChild(makeIcon('play_arrow'));
      }

      const info = document.createElement('div');
      info.className = 'history-info';
      info.setAttribute('role', 'button');
      info.setAttribute('tabindex', '0');

      const titleEl = document.createElement('div');
      titleEl.className = 'history-title';
      if (item.title) {
        titleEl.textContent = item.title;
      } else {
        titleEl.textContent = '(タイトル未取得)';
        titleEl.classList.add('placeholder');
      }
      titleEl.title = item.uuid;

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

      info.appendChild(titleEl);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'icon-btn';
      playBtn.setAttribute('aria-label', '再生');
      playBtn.appendChild(makeIcon('play_arrow'));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn danger';
      delBtn.setAttribute('aria-label', '削除');
      delBtn.appendChild(makeIcon('delete'));

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
    fetchMetaForRecent(parsed.uuid);
    playVideo(parsed);
  }

  // 直近に追加した 1 件についてメタデータ + サムネイルを取得し、
  // 取得できたら履歴を再描画する。バックフィルとは別レーンで動かす。
  async function fetchMetaForRecent(uuid) {
    const item = loadHistory().find((h) => h.uuid === uuid);
    if (!item) return;
    const updated = await ensureMetadata(item);
    if (updated) renderHistory();
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

  // ----- プレーヤー スケーリング -----
  // CSS のメディアクエリで iframe を 1280×720 固定にしている画面サイズでは、
  // window の実サイズに合わせて transform: scale() の倍率を計算する。
  const PLAYER_DESIGN_W = 1280;
  const PLAYER_DESIGN_H = 720;
  const PLAYER_SCALE_MIN_W = 1024;
  const PLAYER_SCALE_MIN_H = 600;

  function updatePlayerScale() {
    const container = document.getElementById('player-container');
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    if (w < PLAYER_SCALE_MIN_W || h < PLAYER_SCALE_MIN_H) {
      // メディアクエリ非適用 → iframe は 100%×100% なのでスケール不要
      document.documentElement.style.removeProperty('--player-scale');
      return;
    }
    const scale = Math.min(w / PLAYER_DESIGN_W, h / PLAYER_DESIGN_H);
    document.documentElement.style.setProperty('--player-scale', String(scale));
  }

  // ----- プレーヤー -----
  async function playVideo(item) {
    const url = buildEmbedUrl(item);
    const iframe = document.getElementById('player-iframe');
    const loading = document.getElementById('player-loading');
    const error = document.getElementById('player-error');
    const errorUrl = document.getElementById('player-error-url');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    errorUrl.textContent = url;

    // 一定時間内に load イベントが来なければエラー表示
    let loaded = false;
    const onLoad = () => {
      loaded = true;
      loading.classList.add('hidden');
    };
    iframe.addEventListener('load', onLoad, { once: true });

    setTimeout(() => {
      if (!loaded) {
        loading.classList.add('hidden');
        error.classList.remove('hidden');
      }
    }, 8000);

    iframe.src = url;
    showScreen('player-screen');

    const container = document.getElementById('player-container');
    requestAnimationFrame(() => {
      tryEnterFullscreen(document.documentElement);
      tryEnterFullscreen(container);
      tryLockOrientation();
      updatePlayerScale();
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
    document.getElementById('player-loading').classList.add('hidden');
    document.getElementById('player-error').classList.add('hidden');
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
    // 既存履歴のうちタイトル/サムネイルが揃っていないものを後追いで取得
    backfillMissingMetadata();

    document.getElementById('scan-btn').addEventListener('click', startScanner);

    document.getElementById('scan-cancel').addEventListener('click', async () => {
      await stopScanner();
      showScreen('home-screen');
    });

    document.getElementById('player-back').addEventListener('click', closePlayer);

    document.getElementById('player-error-open').addEventListener('click', () => {
      const url = document.getElementById('player-error-url').textContent;
      if (url) window.open(url, '_blank', 'noopener');
    });

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
      fetchMetaForRecent(parsed.uuid);
      input.value = '';
      playVideo(parsed);
    });

    document.getElementById('clear-all-btn').addEventListener('click', () => {
      if (confirm('すべての履歴を削除しますか?')) {
        clearHistory();
        renderHistory();
      }
    });

    // 検索バー
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    const searchForm = document.getElementById('search-form');

    function syncSearchUi() {
      searchClear.classList.toggle('hidden', !searchInput.value);
    }

    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      syncSearchUi();
      renderHistory();
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      syncSearchUi();
      renderHistory();
      searchInput.focus();
    });

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      searchInput.blur();
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

    // プレーヤーの拡大率をウィンドウサイズに応じて更新
    updatePlayerScale();
    window.addEventListener('resize', updatePlayerScale);
    document.addEventListener('fullscreenchange', updatePlayerScale);
    document.addEventListener('webkitfullscreenchange', updatePlayerScale);

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
