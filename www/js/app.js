(() => {
  'use strict';

  const STORAGE_KEY = 'hihaho-qr-history-v1';
  const THUMBS_KEY = 'hihaho-qr-thumbs-v1';
  const TRASH_KEY = 'hihaho-qr-trash-v1';
  const LANG_KEY = 'hihaho-qr-lang';
  const SORT_KEY = 'hihaho-qr-sort';
  const SORT_MODES = ['date_desc', 'date_asc', 'name_asc', 'name_desc', 'custom'];
  const DEFAULT_SORT = 'date_desc';
  const CLOSE_POS_KEY = 'hihaho-qr-close-pos';
  const CLOSE_POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
  const DEFAULT_CLOSE_POS = 'top-right';
  const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 日

  // ----- 国際化 -----
  const I18N = {
    ja: {
      'app.title': 'QR動画',
      'app.scan': 'QRコードをスキャン',
      'app.manualInput': 'URL または UUID を直接入力',
      'app.urlPlaceholder': 'URL または UUID',
      'app.play': '再生',
      'app.history': '視聴履歴',
      'app.clearAll': 'すべて削除',
      'app.emptyHistory':
        'まだ視聴履歴はありません。<br />「QRコードをスキャン」から始めましょう。',
      'app.noResults': '該当する動画がありません。',
      'app.untitled': '(タイトル未取得)',
      'history.playCount': '{n}回再生',
      'app.invalidUrl': 'hihaho の有効な URL を入力してください。',
      'app.confirmDeleteOne': 'この動画を履歴から削除しますか?',
      'app.confirmDeleteAll': 'すべての履歴を削除しますか?',
      'app.searchPlaceholder': 'タイトル・UUIDで検索',
      'menu.menu': 'メニュー',
      'menu.language': '言語',
      'menu.langJa': '日本語',
      'menu.langEn': 'English',
      'menu.sort': '並び替え',
      'sort.dateDesc': '日付 (新しい順)',
      'sort.dateAsc': '日付 (古い順)',
      'sort.nameAsc': '名前 (A→Z)',
      'sort.nameDesc': '名前 (Z→A)',
      'sort.custom': 'カスタム順 (ドラッグ)',
      'menu.data': 'データ',
      'data.hint': '視聴履歴を JSON ファイルで書き出し / 取り込みできます。',
      'data.export': '履歴を書き出す',
      'data.import': '履歴を取り込む',
      'data.exported': '履歴を書き出しました',
      'data.imported': '{added}件を追加、{skipped}件をスキップしました',
      'data.importEmpty': '取り込めるデータがありません。',
      'data.importError': 'ファイルを読み込めませんでした。',
      'data.importParseError': 'JSON の解析に失敗しました。',
      'data.importInvalid': '対応していない形式のファイルです。',
      'data.qrExport': 'QRコードで共有',
      'qr.exportTitle': 'QRコードで履歴を共有',
      'qr.exportHint':
        'もう一台のアプリで QR スキャンすると履歴が取り込まれます。共有されるのは UUID のみで、タイトル / 再生回数 / 並び替えは引き継がれません。',
      'qr.exportItemCount': '{n}件の動画',
      'qr.tooManyItems': 'QRコードに収められる件数 ({max}件) を超えています。JSON ファイル書き出しをご利用ください。',
      'qr.exportFailed': 'QRコードの生成に失敗しました。',
      'qr.exportEmpty': '履歴が空です。',
      'qr.imported': 'QRコードから {n} 件の履歴を取り込みました。',
      'qr.close': '閉じる',
      'menu.closeButtonPos': '動画を閉じるボタンの位置',
      'pos.topLeft': '左上',
      'pos.topRight': '右上',
      'pos.bottomLeft': '左下',
      'pos.bottomRight': '右下',
      'menu.trash': 'ゴミ箱',
      'trash.title': 'ゴミ箱',
      'trash.empty': 'ゴミ箱は空です。',
      'trash.viewItems': 'ゴミ箱を見る',
      'trash.emptyAction': 'ゴミ箱を空にする',
      'trash.confirmEmpty': 'ゴミ箱を空にしますか? (元に戻せません)',
      'trash.confirmPermDelete': 'この動画を完全に削除しますか? (元に戻せません)',
      'trash.daysLeft': '{n}日後に自動削除',
      'trash.daysLeftZero': '間もなく自動削除',
      'trash.retentionHint': '削除した動画は30日間ゴミ箱に保管されます。',
      'install.heading': 'アプリとして使う',
      'install.ios':
        'Safari の「共有」ボタンから「ホーム画面に追加」を選ぶと、URLバーなしの全画面アプリとして使えます。',
      'install.android':
        'Chrome のメニューから「アプリをインストール」または「ホーム画面に追加」を選ぶと、独立したアプリとして起動できます。',
      'install.generic':
        'ホーム画面に追加するとアプリのように起動できます。',
      'install.install': 'インストール',
      'aria.fullscreen': '全画面表示',
      'aria.update': 'アプリを更新',
      'aria.close': '閉じる',
      'aria.searchClear': '検索をクリア',
      'aria.menu': 'メニュー',
      'aria.delete': '削除',
      'aria.playItem': '再生',
      'aria.restore': '復元',
      'aria.permDelete': '完全に削除',
      'aria.back': '戻る',
      'aria.share': '共有',
      'share.title': '共有',
      'share.line': 'LINE',
      'share.mail': 'メール',
      'share.copy': 'URLをコピー',
      'share.more': 'その他のアプリ',
      'share.cancel': 'キャンセル',
      'share.copied': 'URLをコピーしました',
      'scan.title': 'QRコードをスキャン',
      'scan.hint': 'hihaho の QRコードをカメラに向けてください',
      'scan.libError':
        'QRスキャナの読み込みに失敗しました。ネットワーク接続を確認してください。',
      'scan.unsupported': 'このブラウザはカメラの取得に対応していません。',
      'scan.cameraError':
        'カメラを起動できませんでした。ブラウザの設定でカメラの使用を許可してください。',
      'scan.notHihaho': 'hihaho の URL ではありません。別のQRコードをお試しください。',
      'player.loading': '動画を読み込み中…',
      'player.errorTitle': '動画を表示できませんでした',
      'player.errorBody':
        'hihaho の動画設定で、このアプリのドメインが「埋め込み許可ドメイン」に追加されているかご確認ください。',
      'player.openInBrowser': 'ブラウザで開く',
    },
    en: {
      'app.title': 'QR Video',
      'app.scan': 'Scan QR Code',
      'app.manualInput': 'Enter URL or UUID directly',
      'app.urlPlaceholder': 'URL or UUID',
      'app.play': 'Play',
      'app.history': 'History',
      'app.clearAll': 'Clear all',
      'app.emptyHistory':
        'No history yet.<br />Tap "Scan QR Code" to start.',
      'app.noResults': 'No matching videos.',
      'app.untitled': '(Title unavailable)',
      'history.playCountOne': '1 play',
      'history.playCountMany': '{n} plays',
      'app.invalidUrl': 'Please enter a valid hihaho URL.',
      'app.confirmDeleteOne': 'Remove this video from history?',
      'app.confirmDeleteAll': 'Remove all history?',
      'app.searchPlaceholder': 'Search title or UUID',
      'menu.menu': 'Menu',
      'menu.language': 'Language',
      'menu.langJa': '日本語',
      'menu.langEn': 'English',
      'menu.sort': 'Sort',
      'sort.dateDesc': 'Date (newest)',
      'sort.dateAsc': 'Date (oldest)',
      'sort.nameAsc': 'Name (A→Z)',
      'sort.nameDesc': 'Name (Z→A)',
      'sort.custom': 'Custom (drag)',
      'menu.data': 'Data',
      'data.hint': 'Export or import the history as a JSON file.',
      'data.export': 'Export history',
      'data.import': 'Import history',
      'data.exported': 'History exported',
      'data.imported': 'Added {added}, skipped {skipped}',
      'data.importEmpty': 'No items to import.',
      'data.importError': 'Failed to read the file.',
      'data.importParseError': 'Failed to parse JSON.',
      'data.importInvalid': 'Unsupported file format.',
      'data.qrExport': 'Share via QR',
      'qr.exportTitle': 'Share history via QR',
      'qr.exportHint':
        'Scan this QR with the app on another device to import the list. Only UUIDs are transferred; titles, play counts and ordering are not preserved.',
      'qr.exportItemCount': '{n} items',
      'qr.tooManyItems': 'Too many items for one QR code (max {max}). Please use the JSON file export instead.',
      'qr.exportFailed': 'Failed to generate the QR code.',
      'qr.exportEmpty': 'No history to share.',
      'qr.imported': 'Imported {n} entries from QR.',
      'qr.close': 'Close',
      'menu.closeButtonPos': 'Close button position',
      'pos.topLeft': 'Top left',
      'pos.topRight': 'Top right',
      'pos.bottomLeft': 'Bottom left',
      'pos.bottomRight': 'Bottom right',
      'menu.trash': 'Trash',
      'trash.title': 'Trash',
      'trash.empty': 'Trash is empty.',
      'trash.viewItems': 'View trash',
      'trash.emptyAction': 'Empty trash',
      'trash.confirmEmpty': 'Empty the trash? This cannot be undone.',
      'trash.confirmPermDelete': 'Permanently delete this video? This cannot be undone.',
      'trash.daysLeft': '{n} day(s) until auto-delete',
      'trash.daysLeftZero': 'Will be auto-deleted soon',
      'trash.retentionHint': 'Deleted videos stay in the trash for 30 days.',
      'install.heading': 'Install as app',
      'install.ios':
        'Use Safari\'s Share button > "Add to Home Screen" to install this site as a fullscreen app.',
      'install.android':
        'Use Chrome\'s menu > "Install app" or "Add to Home Screen" to launch this site as a standalone app.',
      'install.generic': 'Add to your home screen to launch this site like an app.',
      'install.install': 'Install',
      'aria.fullscreen': 'Toggle fullscreen',
      'aria.update': 'Update app',
      'aria.close': 'Close',
      'aria.searchClear': 'Clear search',
      'aria.menu': 'Menu',
      'aria.delete': 'Delete',
      'aria.playItem': 'Play',
      'aria.restore': 'Restore',
      'aria.permDelete': 'Delete permanently',
      'aria.back': 'Back',
      'aria.share': 'Share',
      'share.title': 'Share',
      'share.line': 'LINE',
      'share.mail': 'Mail',
      'share.copy': 'Copy URL',
      'share.more': 'Other apps',
      'share.cancel': 'Cancel',
      'share.copied': 'URL copied',
      'scan.title': 'Scan QR Code',
      'scan.hint': 'Aim the camera at the hihaho QR code',
      'scan.libError':
        'Failed to load the QR scanner. Check your network connection.',
      'scan.unsupported': 'This browser does not support camera access.',
      'scan.cameraError':
        'Could not start the camera. Please allow camera access in your browser settings.',
      'scan.notHihaho': 'Not a hihaho URL. Please try another QR code.',
      'player.loading': 'Loading video…',
      'player.errorTitle': 'Could not display the video',
      'player.errorBody':
        'Make sure this app\'s domain is added to "Allowed embed domains" in the hihaho video settings.',
      'player.openInBrowser': 'Open in browser',
    },
  };

  function getLang() {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'ja' || stored === 'en') return stored;
    return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
  }

  function t(key) {
    const lang = getLang();
    return (I18N[lang] && I18N[lang][key]) || I18N.ja[key] || key;
  }

  function applyTranslations() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.title = t('app.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  function setLang(lang) {
    if (lang !== 'ja' && lang !== 'en') return;
    localStorage.setItem(LANG_KEY, lang);
    applyTranslations();
    // 動的に生成しているコンテンツも再描画
    renderHistory();
    refreshInstallBannerHint();
    refreshLangActive();
  }

  function getDateFormatter() {
    const locale = getLang() === 'ja' ? 'ja-JP' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
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
  //   <UUID>                     ← URL 抜きの単体形式も許容
  //   <UUID>?v=<VERSION>
  // クエリ文字列に v 以外のパラメータが含まれていてもよい。
  const HIHAHO_REGEX =
    /^https?:\/\/player\.hihaho\.com\/(?:embed\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#].*)?$/i;
  const UUID_ONLY_REGEX =
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\?(.*))?$/i;

  function parseHihahoUrl(input) {
    if (!input) return null;
    const trimmed = String(input).trim();

    let uuid = null;
    let queryString = '';

    const urlMatch = trimmed.match(HIHAHO_REGEX);
    if (urlMatch) {
      uuid = urlMatch[1].toLowerCase();
      const qIdx = trimmed.indexOf('?');
      if (qIdx >= 0) queryString = trimmed.slice(qIdx + 1);
    } else {
      const uuidMatch = trimmed.match(UUID_ONLY_REGEX);
      if (!uuidMatch) return null;
      uuid = uuidMatch[1].toLowerCase();
      queryString = uuidMatch[2] || '';
    }

    let version = null;
    if (queryString) {
      const params = new URLSearchParams(queryString);
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
    // ゴミ箱に同 UUID があれば取り出して、メタデータを引き継ぐ
    const trash = loadTrash();
    const trashed = trash.find((t) => t.uuid === uuid);
    if (trashed) {
      saveTrash(trash.filter((t) => t.uuid !== uuid));
    }

    const history = loadHistory();
    const existing = history.find((item) => item.uuid === uuid);
    const filtered = history.filter((item) => item.uuid !== uuid);
    filtered.unshift({
      uuid,
      version: version || null,
      addedAt: Date.now(),
      // 既存 (履歴) → ゴミ箱 → null の優先順でタイトル/取得状況を引き継ぐ
      title:
        (existing && existing.title) ||
        (trashed && trashed.title) ||
        null,
      metaTriedAt:
        (existing && existing.metaTriedAt) ||
        (trashed && trashed.metaTriedAt) ||
        null,
      // 再生回数も引き継ぐ (再スキャンでカウントがリセットされない)
      playCount:
        (existing && existing.playCount) ||
        (trashed && trashed.playCount) ||
        0,
    });
    saveHistory(filtered);
  }

  function removeFromHistory(uuid) {
    // ハード削除ではなくゴミ箱へ移動 (30 日後に自動削除)
    moveToTrash(uuid);
  }

  function clearHistory() {
    // 全削除もゴミ箱へ。30 日以内ならゴミ箱画面から復元可能。
    moveAllToTrash();
  }

  function updateHistoryItem(uuid, patch) {
    const history = loadHistory();
    const idx = history.findIndex((h) => h.uuid === uuid);
    if (idx < 0) return null;
    history[idx] = { ...history[idx], ...patch };
    saveHistory(history);
    return history[idx];
  }

  // 履歴のレコードに紐づいた再生回数を 1 増やす。再生開始時に呼ぶ。
  function bumpPlayCount(uuid) {
    const history = loadHistory();
    const idx = history.findIndex((h) => h.uuid === uuid);
    if (idx < 0) return;
    const next = (history[idx].playCount || 0) + 1;
    history[idx] = {
      ...history[idx],
      playCount: next,
      lastPlayedAt: Date.now(),
    };
    saveHistory(history);
  }

  function formatPlayCount(n) {
    if (getLang() === 'ja') {
      return t('history.playCount').replace('{n}', String(n));
    }
    if (n === 1) return t('history.playCountOne');
    return t('history.playCountMany').replace('{n}', String(n));
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

  // ----- ゴミ箱 (削除した動画を 30 日間ソフト保管) -----
  function loadTrash() {
    try {
      const raw = localStorage.getItem(TRASH_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveTrash(items) {
    try {
      localStorage.setItem(TRASH_KEY, JSON.stringify(items));
    } catch {
      // QuotaExceeded — 古いものから半分削って再試行
      try {
        const trimmed = items.slice(0, Math.floor(items.length / 2));
        localStorage.setItem(TRASH_KEY, JSON.stringify(trimmed));
      } catch {}
    }
  }

  // 30 日経過したものをハード削除する。サムネイルも一緒に消す。
  function autoPurgeTrash() {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const trash = loadTrash();
    const expired = trash.filter((t) => !t.deletedAt || t.deletedAt < cutoff);
    if (expired.length === 0) return;
    expired.forEach((t) => removeThumb(t.uuid));
    const remaining = trash.filter((t) => t.deletedAt && t.deletedAt >= cutoff);
    saveTrash(remaining);
  }

  function moveToTrash(uuid) {
    const history = loadHistory();
    const item = history.find((h) => h.uuid === uuid);
    if (!item) return;
    saveHistory(history.filter((h) => h.uuid !== uuid));
    const trash = loadTrash().filter((t) => t.uuid !== uuid);
    trash.unshift({ ...item, deletedAt: Date.now() });
    saveTrash(trash);
  }

  function moveAllToTrash() {
    const history = loadHistory();
    if (history.length === 0) return;
    const now = Date.now();
    const trash = loadTrash();
    const existingUuids = new Set(trash.map((t) => t.uuid));
    for (const item of history) {
      if (existingUuids.has(item.uuid)) {
        // 既にゴミ箱にある UUID は履歴側を捨てるだけ
        continue;
      }
      trash.unshift({ ...item, deletedAt: now });
    }
    saveTrash(trash);
    saveHistory([]);
  }

  function restoreFromTrash(uuid) {
    const trash = loadTrash();
    const item = trash.find((t) => t.uuid === uuid);
    if (!item) return;
    saveTrash(trash.filter((t) => t.uuid !== uuid));
    const { deletedAt: _del, ...rest } = item;
    void _del;
    const history = loadHistory();
    const filtered = history.filter((h) => h.uuid !== uuid);
    filtered.unshift(rest);
    saveHistory(filtered);
  }

  function permanentlyDeleteFromTrash(uuid) {
    const trash = loadTrash();
    saveTrash(trash.filter((t) => t.uuid !== uuid));
    removeThumb(uuid);
  }

  function emptyTrash() {
    const trash = loadTrash();
    trash.forEach((t) => removeThumb(t.uuid));
    saveTrash([]);
  }

  // ----- 履歴のエクスポート / インポート (JSON ファイル一括) -----
  const EXPORT_SCHEMA = 'qr-video-history-v1';

  function isValidHihahoUuid(s) {
    return (
      typeof s === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    );
  }

  function buildExportPayload() {
    const history = loadHistory();
    return {
      schema: EXPORT_SCHEMA,
      exportedAt: new Date().toISOString(),
      items: history.map((h) => ({
        uuid: h.uuid,
        version: h.version || null,
        title: h.title || null,
        addedAt: h.addedAt,
        playCount: h.playCount || 0,
        lastPlayedAt: h.lastPlayedAt || null,
      })),
    };
  }

  async function exportHistory() {
    const payload = buildExportPayload();
    const json = JSON.stringify(payload, null, 2);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `qr-video-history-${today}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    // 1) Web Share API でファイル共有 (iOS / Android の OS 共有シート経由で
    //    AirDrop / Files / メール / メッセージ / Drive 等に送れる)
    if (
      typeof File !== 'undefined' &&
      typeof navigator.canShare === 'function'
    ) {
      try {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          showToast(t('data.exported'));
          return;
        }
      } catch {
        // ユーザーキャンセル or 非対応 → 下のダウンロードへフォールバック
      }
    }

    // 2) <a download> でローカルダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast(t('data.exported'));
  }

  // ----- QRコード経由の一括共有 -----
  // フォーマット (QR alphanumeric モードに最適化):
  //   "QRVHIST1:" + (大文字16進UUID)*N
  //   各 UUID はハイフンを除いた 32 桁。区切りなし。
  // タイトルや再生回数は転送せず、UUID のみ。受信側で backfill によって
  // タイトル/サムネイルを再取得する。
  const QR_EXPORT_MARKER = 'QRVHIST1:';
  // 上限は ECC M で v32 (145 モジュール) に収まる程度に絞り、生成 QR を
  // カメラデコード可能な密度に保つ。これ以上のサイズは JSON ファイル書き出しへ。
  const QR_EXPORT_MAX_ITEMS = 50;

  function buildQrPayload(items) {
    let s = QR_EXPORT_MARKER;
    for (const item of items) {
      s += item.uuid.replace(/-/g, '').toUpperCase();
    }
    return s;
  }

  function parseQrImportPayload(text) {
    if (typeof text !== 'string') return null;
    if (!text.startsWith(QR_EXPORT_MARKER)) return null;
    const data = text.slice(QR_EXPORT_MARKER.length).trim();
    if (data.length === 0 || data.length % 32 !== 0) return null;
    if (!/^[0-9A-F]+$/.test(data)) return null;
    const uuids = [];
    for (let i = 0; i < data.length; i += 32) {
      const hex = data.slice(i, i + 32).toLowerCase();
      const uuid =
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20, 32);
      if (!isValidHihahoUuid(uuid)) return null;
      uuids.push(uuid);
    }
    return uuids;
  }

  function exportHistoryAsQr() {
    const history = loadHistory();
    if (history.length === 0) {
      alert(t('qr.exportEmpty'));
      return;
    }
    if (history.length > QR_EXPORT_MAX_ITEMS) {
      alert(
        t('qr.tooManyItems').replace('{max}', String(QR_EXPORT_MAX_ITEMS))
      );
      return;
    }
    if (typeof qrcode !== 'function') {
      alert(t('qr.exportFailed'));
      return;
    }

    const payload = buildQrPayload(history);
    const imgEl = document.getElementById('qr-export-image');
    const countEl = document.getElementById('qr-export-count');
    if (!imgEl) return;

    let dataUrl;
    try {
      // typeNumber 0 = ライブラリが必要な QR バージョンを自動選択。
      // M = 誤り訂正レベル M (Safari のカメラデコードを安定させるため
      // L から引き上げ。容量は 50 件 + 9 バイトプレフィックスで十分収まる)。
      // payload は uppercase hex + ':' のみなので alphanumeric モードに収まる。
      const qr = qrcode(0, 'M');
      qr.addData(payload, 'Alphanumeric');
      qr.make();
      // セルサイズ 8px、外周マージン 4 セル → 大きめに描画して
      // CSS でリサイズしても 1 モジュールあたりのピクセル数を確保する
      dataUrl = qr.createDataURL(8, 4);
    } catch (err) {
      console.error('qr generation failed', err);
      alert(t('qr.exportFailed'));
      return;
    }

    imgEl.src = dataUrl;

    if (countEl) {
      countEl.textContent = t('qr.exportItemCount').replace(
        '{n}',
        String(history.length)
      );
    }

    const modal = document.getElementById('qr-export-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeQrExportModal() {
    const modal = document.getElementById('qr-export-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  // QR から取り込んだ UUID 配列を履歴にマージ (重複は skip、ゴミ箱からは復活)
  function importUuidsAsHistory(uuids) {
    const existing = loadHistory();
    const existingUuids = new Set(existing.map((h) => h.uuid));
    const trash = loadTrash();
    const trashMap = new Map(trash.map((tr) => [tr.uuid, tr]));
    const merged = existing.slice();
    let added = 0;
    let skipped = 0;
    let restored = 0;
    const restoredUuids = new Set();
    const now = Date.now();

    for (const uuid of uuids) {
      if (!isValidHihahoUuid(uuid)) {
        skipped++;
        continue;
      }
      if (existingUuids.has(uuid)) {
        skipped++;
        continue;
      }
      if (trashMap.has(uuid)) {
        const tr = trashMap.get(uuid);
        restoredUuids.add(uuid);
        // 元の addedAt / title / playCount を引き継ぐ
        merged.push({
          uuid: tr.uuid,
          version: tr.version || null,
          title: tr.title || null,
          addedAt: tr.addedAt || now,
          metaTriedAt: tr.metaTriedAt || null,
          playCount: tr.playCount || 0,
          lastPlayedAt: tr.lastPlayedAt || null,
        });
        restored++;
      } else {
        merged.push({
          uuid,
          version: null,
          title: null,
          addedAt: now,
          metaTriedAt: null,
          playCount: 0,
          lastPlayedAt: null,
        });
      }
      existingUuids.add(uuid);
      added++;
    }

    if (restoredUuids.size > 0) {
      saveTrash(trash.filter((tr) => !restoredUuids.has(tr.uuid)));
    }
    merged.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    saveHistory(merged);
    return { added, skipped, restored };
  }

  async function importHistoryFromFile(file) {
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch {
      alert(t('data.importError'));
      return;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      alert(t('data.importParseError'));
      return;
    }
    if (
      !data ||
      typeof data !== 'object' ||
      data.schema !== EXPORT_SCHEMA ||
      !Array.isArray(data.items)
    ) {
      alert(t('data.importInvalid'));
      return;
    }
    if (data.items.length === 0) {
      alert(t('data.importEmpty'));
      return;
    }

    // 既存履歴とマージ (同 UUID はスキップ)。インポートしたものは
    // ゴミ箱からも復活させる (削除済み UUID を再取り込みした場合)。
    const existing = loadHistory();
    const existingUuids = new Set(existing.map((h) => h.uuid));
    const trash = loadTrash();
    const trashUuids = new Set(trash.map((t) => t.uuid));
    const merged = existing.slice();
    let added = 0;
    let skipped = 0;
    let restoredFromTrash = 0;

    for (const raw of data.items) {
      if (!raw || !isValidHihahoUuid(raw.uuid)) {
        skipped++;
        continue;
      }
      if (existingUuids.has(raw.uuid)) {
        skipped++;
        continue;
      }
      if (trashUuids.has(raw.uuid)) {
        // ゴミ箱から取り出してインポート扱いに
        const idx = trash.findIndex((tr) => tr.uuid === raw.uuid);
        if (idx >= 0) trash.splice(idx, 1);
        trashUuids.delete(raw.uuid);
        restoredFromTrash++;
      }
      merged.push({
        uuid: raw.uuid,
        version:
          raw.version != null && /^\d+$/.test(String(raw.version))
            ? String(raw.version)
            : null,
        title: typeof raw.title === 'string' ? raw.title : null,
        addedAt:
          typeof raw.addedAt === 'number' && raw.addedAt > 0
            ? raw.addedAt
            : Date.now(),
        metaTriedAt: null,
        playCount:
          typeof raw.playCount === 'number' && raw.playCount >= 0
            ? Math.floor(raw.playCount)
            : 0,
        lastPlayedAt:
          typeof raw.lastPlayedAt === 'number' && raw.lastPlayedAt > 0
            ? raw.lastPlayedAt
            : null,
      });
      existingUuids.add(raw.uuid);
      added++;
    }

    // ゴミ箱からの取り出しを反映
    if (restoredFromTrash > 0) saveTrash(trash);

    // 並び替え (デフォルト = addedAt 降順)
    merged.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    saveHistory(merged);

    renderHistory();
    refreshTrashUi();
    // タイトル / サムネイルが無いものは後追いで取得
    backfillMissingMetadata();

    showToast(
      t('data.imported')
        .replace('{added}', String(added))
        .replace('{skipped}', String(skipped))
    );
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

  // ----- 検索 + 並び替え -----
  let searchQuery = '';

  function getSortMode() {
    const stored = localStorage.getItem(SORT_KEY);
    return SORT_MODES.includes(stored) ? stored : DEFAULT_SORT;
  }

  function setSortMode(mode) {
    if (!SORT_MODES.includes(mode)) return;
    localStorage.setItem(SORT_KEY, mode);
    refreshSortActive();
    renderHistory();
  }

  function applySort(items) {
    const mode = getSortMode();
    if (mode === 'custom') return items.slice();
    const sorted = items.slice();
    if (mode === 'date_asc') {
      sorted.sort((a, b) => a.addedAt - b.addedAt);
    } else if (mode === 'date_desc') {
      sorted.sort((a, b) => b.addedAt - a.addedAt);
    } else if (mode === 'name_asc' || mode === 'name_desc') {
      const collator = new Intl.Collator(getLang() === 'ja' ? 'ja' : 'en', {
        sensitivity: 'base',
        numeric: true,
      });
      sorted.sort((a, b) => {
        const an = a.title || a.uuid;
        const bn = b.title || b.uuid;
        const cmp = collator.compare(an, bn);
        return mode === 'name_asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }

  function getFilteredHistory() {
    const all = applySort(loadHistory());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((item) => {
      const title = (item.title || '').toLowerCase();
      const uuid = item.uuid.toLowerCase();
      const version = (item.version ? String(item.version) : '').toLowerCase();
      return title.includes(q) || uuid.includes(q) || version.includes(q);
    });
  }

  // ドラッグ&ドロップ後に history-list の DOM 上の順序を localStorage に反映する。
  // 検索でフィルタ中の場合は、表示されている要素群だけを並び替えて、非表示の
  // 要素は元のインデックス位置に保ったままにする。
  function saveCustomOrder() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    const visibleUuids = Array.from(listEl.querySelectorAll('[data-uuid]')).map(
      (el) => el.dataset.uuid
    );
    const history = loadHistory();
    if (visibleUuids.length === history.length) {
      const map = new Map(history.map((h) => [h.uuid, h]));
      const reordered = visibleUuids
        .map((uuid) => map.get(uuid))
        .filter(Boolean);
      saveHistory(reordered);
      return;
    }
    const visibleSet = new Set(visibleUuids);
    const visibleOriginalIndices = [];
    history.forEach((h, i) => {
      if (visibleSet.has(h.uuid)) visibleOriginalIndices.push(i);
    });
    const visibleMap = new Map(
      history.filter((h) => visibleSet.has(h.uuid)).map((h) => [h.uuid, h])
    );
    const newOrderItems = visibleUuids
      .map((uuid) => visibleMap.get(uuid))
      .filter(Boolean);
    const result = history.slice();
    visibleOriginalIndices.forEach((origIdx, k) => {
      if (newOrderItems[k]) result[origIdx] = newOrderItems[k];
    });
    saveHistory(result);
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
      empty.innerHTML = t('app.emptyHistory');
      clearBtn.classList.add('hidden');
      return;
    }
    clearBtn.classList.remove('hidden');

    if (history.length === 0) {
      empty.classList.remove('hidden');
      empty.textContent = t('app.noResults');
      return;
    }
    empty.classList.add('hidden');

    const frag = document.createDocumentFragment();
    for (const item of history) {
      // 行ラッパー (li) → 赤い削除背景 + 中身 (中身だけ translateX で動く)
      const row = document.createElement('li');
      row.className = 'history-row';
      row.dataset.uuid = item.uuid;

      // 右スワイプで露出する共有用 (左寄せ icon)
      const bgShare = document.createElement('div');
      bgShare.className = 'history-row-bg history-row-bg-share';
      bgShare.setAttribute('aria-hidden', 'true');
      bgShare.appendChild(makeIcon('share'));

      // 左スワイプで露出する削除用 (右寄せ icon)
      const bgDelete = document.createElement('div');
      bgDelete.className = 'history-row-bg history-row-bg-delete';
      bgDelete.setAttribute('aria-hidden', 'true');
      bgDelete.appendChild(makeIcon('delete'));

      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';

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
        titleEl.textContent = t('app.untitled');
        titleEl.classList.add('placeholder');
      }
      titleEl.title = item.uuid;

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const dateSpan = document.createElement('span');
      dateSpan.textContent = getDateFormatter().format(new Date(item.addedAt));
      meta.appendChild(dateSpan);
      if (item.version) {
        const verSpan = document.createElement('span');
        verSpan.textContent = `v=${item.version}`;
        meta.appendChild(verSpan);
      }

      info.appendChild(titleEl);
      info.appendChild(meta);

      if (item.playCount && item.playCount > 0) {
        const playCountEl = document.createElement('div');
        playCountEl.className = 'history-play-count';
        playCountEl.textContent = formatPlayCount(item.playCount);
        info.appendChild(playCountEl);
      }

      // ゴミ箱アイコンは廃止。再生ボタンのみ表示。
      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'icon-btn';
      playBtn.setAttribute('aria-label', t('aria.playItem'));
      playBtn.appendChild(makeIcon('play_arrow'));

      actions.appendChild(playBtn);

      itemEl.appendChild(thumb);
      itemEl.appendChild(info);
      itemEl.appendChild(actions);

      row.appendChild(bgShare);
      row.appendChild(bgDelete);
      row.appendChild(itemEl);

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

      attachRowSwipe(row, itemEl, item);

      frag.appendChild(row);
    }
    list.appendChild(frag);
  }

  // ----- スワイプ操作 (左 = 削除 / 右 = 共有) -----
  // history-list の各行に取り付けるポインタハンドラ。
  // 横方向の大きなスワイプ (行幅の 60% 以上) で確定:
  //   左方向 (dx < 0) → moveToTrash
  //   右方向 (dx > 0) → 共有シートを開く
  // 縦方向のスクロールや長押しドラッグ (Sortable) との競合は touch-action と
  // 方向ロックで吸収する。
  const SWIPE_AXIS_THRESHOLD = 6;
  const SWIPE_COMMIT_RATIO = 0.6;
  const SWIPE_COMMIT_MIN_PX = 140;

  function attachRowSwipe(rowEl, itemEl, item) {
    let startX = 0;
    let startY = 0;
    let pointerId = null;
    let active = false;
    let swiping = false;
    let direction = 0; // -1 = 左 (削除), 1 = 右 (共有)
    let suppressNextClick = false;

    const handleDown = (e) => {
      if (!e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // 再生ボタン等の上では起動しない
      if (e.target.closest('button, .icon-btn')) return;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      active = true;
      swiping = false;
      direction = 0;
    };

    const handleMove = (e) => {
      if (!active || pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!swiping) {
        // 方向ロック
        if (
          Math.abs(dx) > SWIPE_AXIS_THRESHOLD &&
          Math.abs(dx) > Math.abs(dy) * 1.3
        ) {
          swiping = true;
          direction = dx > 0 ? 1 : -1;
          rowEl.classList.add('swiping', direction > 0 ? 'swipe-right' : 'swipe-left');
          suppressNextClick = true;
          try { rowEl.setPointerCapture(e.pointerId); } catch {}
        } else if (Math.abs(dy) > SWIPE_AXIS_THRESHOLD) {
          // 縦方向 → スクロール / Sortable に明け渡す
          active = false;
          return;
        }
      }

      if (swiping) {
        e.preventDefault();
        // スワイプ開始した方向と同じ符号の dx だけ追従させる
        const constrained = direction > 0 ? Math.max(0, dx) : Math.min(0, dx);
        itemEl.style.transform = `translateX(${constrained}px)`;
      }
    };

    const finishSwipe = (commit) => {
      rowEl.classList.remove('swiping');
      if (commit) {
        const sign = direction;
        const offset = (rowEl.offsetWidth + 60) * sign;
        itemEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
        itemEl.style.transform = `translateX(${offset}px)`;
        itemEl.style.opacity = '0';
        setTimeout(() => {
          if (sign < 0) {
            // 左スワイプ確定 → ゴミ箱へ
            removeFromHistory(item.uuid);
            renderHistory();
            refreshTrashUi();
          } else {
            // 右スワイプ確定 → 共有シート + アイテムを元位置にリセット
            itemEl.style.transition = '';
            itemEl.style.transform = '';
            itemEl.style.opacity = '';
            rowEl.classList.remove('swipe-right', 'swipe-left');
            openShareSheet(item);
          }
        }, 220);
      } else {
        itemEl.style.transition = 'transform 0.18s ease';
        itemEl.style.transform = '';
        setTimeout(() => {
          itemEl.style.transition = '';
          rowEl.classList.remove('swipe-right', 'swipe-left');
        }, 200);
      }
      swiping = false;
      direction = 0;
    };

    const handleUp = (e) => {
      if (!active || (pointerId !== null && pointerId !== e.pointerId)) return;
      active = false;
      pointerId = null;
      if (!swiping) return;
      const dx = e.clientX - startX;
      const threshold = Math.max(
        SWIPE_COMMIT_MIN_PX,
        rowEl.offsetWidth * SWIPE_COMMIT_RATIO
      );
      finishSwipe(Math.abs(dx) >= threshold && Math.sign(dx) === direction);
    };

    const handleCancel = (e) => {
      if (!active || (pointerId !== null && pointerId !== e.pointerId)) return;
      active = false;
      pointerId = null;
      if (swiping) finishSwipe(false);
    };

    rowEl.addEventListener('pointerdown', handleDown);
    rowEl.addEventListener('pointermove', handleMove);
    rowEl.addEventListener('pointerup', handleUp);
    rowEl.addEventListener('pointercancel', handleCancel);

    // スワイプ後に発生する click を抑制 (capture phase で他リスナーより先に止める)
    rowEl.addEventListener(
      'click',
      (e) => {
        if (suppressNextClick) {
          suppressNextClick = false;
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );
  }

  // ----- ゴミ箱画面の描画 -----
  function formatTrashRemaining(item) {
    const remainingMs = TRASH_RETENTION_MS - (Date.now() - (item.deletedAt || 0));
    const days = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    if (days <= 0) return t('trash.daysLeftZero');
    return t('trash.daysLeft').replace('{n}', String(days));
  }

  function renderTrash() {
    const list = document.getElementById('trash-list');
    const empty = document.getElementById('trash-empty');
    const emptyAllBtn = document.getElementById('trash-empty-all');
    if (!list || !empty || !emptyAllBtn) return;
    const trash = loadTrash().slice().sort(
      (a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)
    );
    list.innerHTML = '';

    if (trash.length === 0) {
      empty.classList.remove('hidden');
      emptyAllBtn.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    emptyAllBtn.classList.remove('hidden');

    const frag = document.createDocumentFragment();
    for (const item of trash) {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.uuid = item.uuid;

      const thumb = document.createElement('div');
      thumb.className = 'history-thumb';
      const cached = getThumb(item.uuid);
      if (cached) {
        const imgEl = document.createElement('img');
        imgEl.src = cached;
        imgEl.alt = '';
        imgEl.loading = 'lazy';
        thumb.classList.add('with-image');
        thumb.appendChild(imgEl);
      } else {
        thumb.appendChild(makeIcon('play_arrow'));
      }

      const info = document.createElement('div');
      info.className = 'history-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'history-title';
      if (item.title) {
        titleEl.textContent = item.title;
      } else {
        titleEl.textContent = t('app.untitled');
        titleEl.classList.add('placeholder');
      }
      titleEl.title = item.uuid;

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      const remainingSpan = document.createElement('span');
      remainingSpan.textContent = formatTrashRemaining(item);
      meta.appendChild(remainingSpan);

      info.appendChild(titleEl);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'icon-btn';
      restoreBtn.setAttribute('aria-label', t('aria.restore'));
      restoreBtn.appendChild(makeIcon('restore_from_trash'));
      restoreBtn.addEventListener('click', () => {
        restoreFromTrash(item.uuid);
        renderTrash();
        renderHistory();
        refreshTrashUi();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-btn danger';
      delBtn.setAttribute('aria-label', t('aria.permDelete'));
      delBtn.appendChild(makeIcon('delete_forever'));
      delBtn.addEventListener('click', () => {
        if (confirm(t('trash.confirmPermDelete'))) {
          permanentlyDeleteFromTrash(item.uuid);
          renderTrash();
          refreshTrashUi();
        }
      });

      actions.appendChild(restoreBtn);
      actions.appendChild(delBtn);

      li.appendChild(thumb);
      li.appendChild(info);
      li.appendChild(actions);
      frag.appendChild(li);
    }
    list.appendChild(frag);
  }

  // メニュー側のバッジ + ボタン状態を最新に
  function refreshTrashUi() {
    const count = loadTrash().length;
    document.querySelectorAll('.menu-trash-count').forEach((el) => {
      el.textContent = count > 0 ? String(count) : '';
    });
    const emptyBtn = document.getElementById('menu-trash-empty');
    if (emptyBtn) emptyBtn.classList.toggle('disabled', count === 0);
  }

  // ----- 画面切替 -----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ----- QRスキャナ (getUserMedia + jsQR の自前実装) -----
  // html5-qrcode は内部で DOM やストリームを抱え込み、停止/再開のサイクルで
  // 残留状態が原因の不具合 (2 回目以降に映像が下半分しか出ない等) が起こる。
  // ストリーム取得とフレーム解析を完全に自前で行うことで、再利用される DOM を
  // 自分達の <video> に固定できるためライフサイクルが追跡しやすくなる。
  let scanLocked = false; // 1 回検出したら以降のフレーム解析を無視
  let scannerStarting = false; // 多重起動防止
  let activeStream = null;
  let scanRafId = null;
  let scanCanvas = null;
  let scanCtx = null;

  function showScanError(msg) {
    const el = document.getElementById('scan-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function clearScanError() {
    document.getElementById('scan-error').classList.add('hidden');
  }

  async function startScanner() {
    if (scannerStarting) return;
    scannerStarting = true;
    try {
      clearScanError();
      if (!isStandalone() && !isCapacitorNative()) {
        tryEnterFullscreen(document.documentElement);
      }
      showScreen('scan-screen');
      scanLocked = false;

      if (typeof jsQR === 'undefined') {
        showScanError(t('scan.libError'));
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showScanError(t('scan.unsupported'));
        return;
      }

      // 前回の実行が残っている場合は完全に停止してカメラを解放
      await stopScanner();

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        console.error('getUserMedia failed', err);
        showScanError(t('scan.cameraError'));
        return;
      }

      activeStream = stream;
      const video = document.getElementById('qr-video');
      // iOS Safari でインライン再生させるための属性 (HTML 側にも書いているが
      // 二重に確実に設定しておく)
      video.setAttribute('playsinline', '');
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // autoplay 属性で再生されるため明示 play は失敗しても良い
      }

      startScanLoop(video);
    } finally {
      scannerStarting = false;
    }
  }

  function startScanLoop(video) {
    if (!scanCanvas) {
      scanCanvas = document.createElement('canvas');
      scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    }

    const tick = () => {
      scanRafId = null;
      if (!activeStream) return; // 既に停止
      if (scanLocked) return;
      if (video.readyState < video.HAVE_ENOUGH_DATA) {
        scanRafId = requestAnimationFrame(tick);
        return;
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        scanRafId = requestAnimationFrame(tick);
        return;
      }

      // QR の検出は中央正方領域だけで十分。
      // 履歴インポート用の高密度 QR (v30 前後) を Safari でも安定して
      // デコードできるよう、サンプリング解像度を 720px まで上げる。
      const cropSize = Math.min(vw, vh);
      const cropX = (vw - cropSize) / 2;
      const cropY = (vh - cropSize) / 2;
      const targetSize = Math.min(cropSize, 720);

      if (scanCanvas.width !== targetSize) scanCanvas.width = targetSize;
      if (scanCanvas.height !== targetSize) scanCanvas.height = targetSize;

      scanCtx.drawImage(
        video,
        cropX, cropY, cropSize, cropSize,
        0, 0, targetSize, targetSize
      );
      const imgData = scanCtx.getImageData(0, 0, targetSize, targetSize);
      const code = jsQR(imgData.data, targetSize, targetSize, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        onScanSuccess(code.data);
        return; // 検出後はループを止める (onScanSuccess が stopScanner を呼ぶ)
      }
      scanRafId = requestAnimationFrame(tick);
    };

    scanRafId = requestAnimationFrame(tick);
  }

  async function onScanSuccess(decodedText) {
    if (scanLocked) return;

    // 先に QR インポート ペイロードを判定 (QRVHIST1: で始まる)
    const importUuids = parseQrImportPayload(decodedText);
    if (importUuids) {
      scanLocked = true;
      clearScanError();
      await stopScanner();
      const result = importUuidsAsHistory(importUuids);
      showScreen('home-screen');
      renderHistory();
      refreshTrashUi();
      backfillMissingMetadata();
      showToast(
        t('qr.imported').replace('{n}', String(result.added))
      );
      return;
    }

    const parsed = parseHihahoUrl(decodedText);
    if (!parsed) {
      // hihaho の URL ではない → スキャンを継続
      showScanError(t('scan.notHihaho'));
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
    if (scanRafId) {
      cancelAnimationFrame(scanRafId);
      scanRafId = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      activeStream = null;
    }
    const video = document.getElementById('qr-video');
    if (video) {
      try {
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
        if (typeof video.load === 'function') video.load();
      } catch {}
    }
  }

  // ----- プレーヤー -----
  async function playVideo(item) {
    bumpPlayCount(item.uuid);
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
      // iframe 自身を Fullscreen API でフルスクリーン化すると hihaho 内部の
      // ネスト iframe / 双方向コンテンツとも競合し、X 閉じるボタンも隠れて
      // しまうため採用しない。親文書側を fullscreen にして URL バーだけ隠し、
      // iframe は素直に 100%×100% で hihaho の自然なレイアウトに任せる。
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

  function refreshInstallBannerHint() {
    const hint = document.getElementById('install-banner-hint');
    if (!hint) return;
    if (isIOS()) {
      hint.textContent = t('install.ios');
    } else if (isAndroid()) {
      hint.textContent = t('install.android');
    } else {
      hint.textContent = t('install.generic');
    }
  }

  function setupInstallBanner() {
    const banner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');
    const dismissBtn = document.getElementById('install-dismiss');

    // 既にインストール済み or Capacitor ネイティブ実行中はバナー不要
    if (isStandalone() || isCapacitorNative()) return;
    if (localStorage.getItem(INSTALL_DISMISS_KEY) === '1') return;

    refreshInstallBannerHint();
    if (isIOS() || isAndroid()) {
      banner.classList.remove('hidden');
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
  // ----- トースト (URL コピー完了などの軽い通知) -----
  let toastTimer = null;

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    // 直後に visible を付与してフェードイン
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 1800);
  }

  // ----- 共有シート -----
  let currentShareItem = null;

  function openShareSheet(item) {
    currentShareItem = item;
    const sheet = document.getElementById('share-sheet');
    if (!sheet) return;
    // navigator.share が無いブラウザでは「その他のアプリ」ボタンを隠す
    const moreBtn = document.getElementById('share-option-more');
    if (moreBtn) {
      moreBtn.classList.toggle('hidden', typeof navigator.share !== 'function');
    }
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeShareSheet() {
    const sheet = document.getElementById('share-sheet');
    if (!sheet) return;
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
    currentShareItem = null;
  }

  function buildShareData(item) {
    const url = buildEmbedUrl(item);
    const title = item.title || url;
    return { title, url, text: title };
  }

  async function performShare(action) {
    if (!currentShareItem) return;
    const { title, url, text } = buildShareData(currentShareItem);
    try {
      switch (action) {
        case 'line': {
          const lineUrl =
            'https://line.me/R/msg/text/?' +
            encodeURIComponent(`${title}\n${url}`);
          window.open(lineUrl, '_blank', 'noopener,noreferrer');
          break;
        }
        case 'mail': {
          const mailto =
            'mailto:?subject=' +
            encodeURIComponent(title) +
            '&body=' +
            encodeURIComponent(`${title}\n${url}`);
          window.location.href = mailto;
          break;
        }
        case 'copy': {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            // execCommand フォールバック (古い iOS など)
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch {}
            document.body.removeChild(ta);
          }
          showToast(t('share.copied'));
          break;
        }
        case 'more': {
          if (typeof navigator.share === 'function') {
            try {
              await navigator.share({ title, text, url });
            } catch {
              // ユーザーがキャンセルした場合等は無視
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('share failed', err);
    }
  }

  function setupShareSheet() {
    const sheet = document.getElementById('share-sheet');
    if (!sheet) return;

    const backdrop = sheet.querySelector('.share-sheet-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeShareSheet);

    const cancelBtn = document.getElementById('share-sheet-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeShareSheet);

    sheet.querySelectorAll('.share-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.share;
        await performShare(action);
        closeShareSheet();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sheet.classList.contains('hidden')) {
        closeShareSheet();
      }
    });
  }

  // ----- メニュー (ドロワー) -----
  function refreshLangActive() {
    const current = getLang();
    document.querySelectorAll('.menu-lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === current);
    });
  }

  function refreshSortActive() {
    const current = getSortMode();
    document.querySelectorAll('.menu-sort-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sort === current);
    });
  }

  // ----- 動画を閉じるボタンの位置 -----
  function getClosePos() {
    const stored = localStorage.getItem(CLOSE_POS_KEY);
    return CLOSE_POSITIONS.includes(stored) ? stored : DEFAULT_CLOSE_POS;
  }

  function applyClosePos() {
    const btn = document.getElementById('player-back');
    if (!btn) return;
    CLOSE_POSITIONS.forEach((p) => btn.classList.remove(`pos-${p}`));
    btn.classList.add(`pos-${getClosePos()}`);
  }

  function setClosePos(pos) {
    if (!CLOSE_POSITIONS.includes(pos)) return;
    localStorage.setItem(CLOSE_POS_KEY, pos);
    applyClosePos();
    refreshClosePosActive();
  }

  function refreshClosePosActive() {
    const current = getClosePos();
    document.querySelectorAll('.menu-pos-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.pos === current);
    });
  }

  function closeMenu() {
    const overlay = document.getElementById('menu-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function openTrashScreen() {
    closeMenu();
    renderTrash();
    showScreen('trash-screen');
  }

  function setupMenu() {
    const menuBtn = document.getElementById('menu-btn');
    const overlay = document.getElementById('menu-overlay');
    const closeBtn = document.getElementById('menu-close');
    if (!menuBtn || !overlay || !closeBtn) return;

    function openMenu() {
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      refreshLangActive();
      refreshSortActive();
      refreshClosePosActive();
      refreshTrashUi();
    }

    menuBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        closeMenu();
      }
    });

    document.querySelectorAll('.menu-lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (lang) setLang(lang);
      });
    });

    document.querySelectorAll('.menu-sort-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.sort;
        if (mode) {
          setSortMode(mode);
          closeMenu();
        }
      });
    });

    // 閉じるボタン位置の選択 (メニューは閉じずにチェックマーク更新で即フィードバック)
    document.querySelectorAll('.menu-pos-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pos = btn.dataset.pos;
        if (pos) setClosePos(pos);
      });
    });

    // データ書き出し / 取り込み
    const exportBtn = document.getElementById('menu-export');
    const importBtn = document.getElementById('menu-import');
    const importFile = document.getElementById('menu-import-file');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        await exportHistory();
        closeMenu();
      });
    }
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => {
        // 同じファイルを連続選択しても change が発火するように value を空に
        importFile.value = '';
        importFile.click();
      });
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        await importHistoryFromFile(file);
        closeMenu();
      });
    }

    // QRコード共有
    const qrExportBtn = document.getElementById('menu-qr-export');
    if (qrExportBtn) {
      qrExportBtn.addEventListener('click', () => {
        exportHistoryAsQr();
        // メニューはモーダル裏で閉じる
        closeMenu();
      });
    }
    const qrModal = document.getElementById('qr-export-modal');
    const qrCloseBtn = document.getElementById('qr-export-close');
    const qrBackdrop = qrModal && qrModal.querySelector('.qr-modal-backdrop');
    if (qrCloseBtn) qrCloseBtn.addEventListener('click', closeQrExportModal);
    if (qrBackdrop) qrBackdrop.addEventListener('click', closeQrExportModal);
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'Escape' &&
        qrModal &&
        !qrModal.classList.contains('hidden')
      ) {
        closeQrExportModal();
      }
    });

    const trashViewBtn = document.getElementById('menu-trash-view');
    if (trashViewBtn) {
      trashViewBtn.addEventListener('click', openTrashScreen);
    }
    const trashEmptyBtn = document.getElementById('menu-trash-empty');
    if (trashEmptyBtn) {
      trashEmptyBtn.addEventListener('click', () => {
        if (loadTrash().length === 0) return;
        if (confirm(t('trash.confirmEmpty'))) {
          emptyTrash();
          refreshTrashUi();
          renderTrash();
        }
      });
    }
  }


  // ----- 長押しドラッグ&ドロップ並び替え -----
  function setupSortable() {
    const list = document.getElementById('history-list');
    if (!list || typeof Sortable === 'undefined') return;
    new Sortable(list, {
      // モバイルは長押し (500ms) してから初めてドラッグ開始。
      // PC は遅延なしで通常のドラッグ。
      delay: 500,
      delayOnTouchOnly: true,
      // 待機中に 5px 以上動いたら遅延ドラッグをキャンセル → 横スワイプ削除と
      // 縦スクロールが Sortable に奪われないようにする。
      touchStartThreshold: 5,
      animation: 180,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      // 再生ボタンと削除背景レイヤーを長押ししてもドラッグは開始しない
      filter: '.history-actions, .history-actions *, .history-row-bg, .history-row-bg *',
      preventOnFilter: false,
      onEnd: () => {
        saveCustomOrder();
        // ドラッグで並び替えた瞬間にカスタム順モードへ切り替え (date_desc 等のソートが
        // 適用されたままだと次の renderHistory で順序が戻ってしまうため)
        setSortMode('custom');
      },
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    applyClosePos();
    autoPurgeTrash();
    setupMenu();
    renderHistory();
    refreshTrashUi();
    setupSortable();
    setupShareSheet();
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

    // ゴミ箱画面のヘッダー
    const trashBack = document.getElementById('trash-back');
    if (trashBack) {
      trashBack.addEventListener('click', () => {
        showScreen('home-screen');
        renderHistory();
      });
    }
    const trashEmptyAll = document.getElementById('trash-empty-all');
    if (trashEmptyAll) {
      trashEmptyAll.addEventListener('click', () => {
        if (loadTrash().length === 0) return;
        if (confirm(t('trash.confirmEmpty'))) {
          emptyTrash();
          refreshTrashUi();
          renderTrash();
        }
      });
    }

    document.getElementById('player-error-open').addEventListener('click', () => {
      const url = document.getElementById('player-error-url').textContent;
      if (url) window.open(url, '_blank', 'noopener');
    });

    document.getElementById('manual-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('manual-url');
      const parsed = parseHihahoUrl(input.value);
      if (!parsed) {
        alert(t('app.invalidUrl'));
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
      if (confirm(t('app.confirmDeleteAll'))) {
        clearHistory();
        renderHistory();
        refreshTrashUi();
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

    // Service Worker 登録 + 更新ボタンの配線
    setupServiceWorkerAndUpdate();
  });

  // ----- Service Worker / 更新 -----
  let updating = false;

  function setupServiceWorkerAndUpdate() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => performUpdate(updateBtn));
    }

    if (!('serviceWorker' in navigator)) {
      // SW 未対応なら素のリロードに退化
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});

      // controllerchange (新 SW が claim したタイミング) で 1 回だけ再読込
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }

  async function performUpdate(btn) {
    if (updating) return;
    updating = true;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('spinning');
    }
    try {
      // 既存 SW を最新にチェック (新 SW があればここでインストールされる)
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update().catch(() => {})));
          // waiting 状態の SW があれば skipWaiting を依頼
          for (const r of regs) {
            if (r.waiting) {
              r.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        } catch {}
      }

      // 既存キャッシュを破棄して、次回ナビゲーションでネットワークから取り直す
      if (window.caches) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
        } catch {}
      }
    } finally {
      // controllerchange でリロードされなかった場合に備え、最終的に必ず再読込
      window.location.reload();
    }
  }

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
