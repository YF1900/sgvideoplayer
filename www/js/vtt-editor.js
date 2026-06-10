/* VTT 字幕エディタ
 * - WebVTT の読込/出力（出力時に番号を 1 から振り直し）
 * - 行のマージ、分割、削除、追加、並べ替え
 * - 単語レベルの置換（正規表現/単語境界/大文字小文字オプション）
 * - 用語集（localStorage に永続化、JSON エクスポート/インポート）
 */
(function () {
  'use strict';

  const STORAGE_KEY_GLOSSARY = 'vtt_glossary_v1';
  const STORAGE_KEY_DOC = 'vtt_doc_autosave_v1';

  /** @type {{ id: number, idText: string, start: number, end: number, text: string, settings: string }[]} */
  let cues = [];
  let nextLocalId = 1;
  /** @type {{ id: number, from: string, to: string, caseSensitive: boolean, wholeWord: boolean, regex: boolean, enabled: boolean }[]} */
  let glossary = [];
  let nextGlossaryId = 1;
  let currentFileName = 'subtitles.vtt';
  let filterQuery = '';
  let cpsThreshold = 20;
  let videoEl = null;
  let followPlayback = true;
  let lastPlayingCueId = -1;

  // ========== Undo/Redo 履歴 ==========
  const HISTORY_LIMIT = 100;
  /** @type {{ cues: any[] }[]} */
  let history = [];
  let historyIndex = -1;
  let textEditTimer = null;

  function cloneCues(src) {
    return src.map((c) => ({
      id: c.id,
      idText: c.idText,
      start: c.start,
      end: c.end,
      settings: c.settings,
      text: c.text,
    }));
  }

  function pushHistory() {
    // 未来履歴を切り捨て
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
    }
    history.push({ cues: cloneCues(cues) });
    if (history.length > HISTORY_LIMIT) {
      history.shift();
    }
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function restoreFromHistory(idx) {
    const snap = history[idx];
    if (!snap) return;
    cues = cloneCues(snap.cues);
    historyIndex = idx;
    updateHistoryButtons();
    autosave();
    renderCues();
  }

  function undo() {
    if (historyIndex <= 0) return;
    restoreFromHistory(historyIndex - 1);
    toast('元に戻しました');
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    restoreFromHistory(historyIndex + 1);
    toast('やり直しました');
  }

  function updateHistoryButtons() {
    const u = document.getElementById('vtt-undo-btn');
    const r = document.getElementById('vtt-redo-btn');
    if (u) u.disabled = historyIndex <= 0;
    if (r) r.disabled = historyIndex >= history.length - 1;
  }

  function debouncedPushHistory() {
    if (textEditTimer) clearTimeout(textEditTimer);
    textEditTimer = setTimeout(() => {
      pushHistory();
    }, 500);
  }

  // ========== 時間文字列 ↔ 秒変換 ==========
  function parseTime(str) {
    if (!str) return NaN;
    const s = String(str).trim();
    // HH:MM:SS.mmm or MM:SS.mmm
    const m = s.match(/^(?:(\d+):)?([0-5]?\d):([0-5]?\d)[.,](\d{1,3})$/);
    if (!m) return NaN;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    const ms = parseInt(m[4].padEnd(3, '0').slice(0, 3), 10);
    return h * 3600 + mm * 60 + ss + ms / 1000;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const total = Math.round(seconds * 1000);
    const ms = total % 1000;
    const totalSec = Math.floor(total / 1000);
    const ss = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const mm = totalMin % 60;
    const hh = Math.floor(totalMin / 60);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}.${pad(ms, 3)}`;
  }

  // ========== VTT パーサ ==========
  function parseVtt(text) {
    if (!text) return [];
    // BOM 除去・改行を統一
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    // ヘッダ "WEBVTT" をスキップ（あれば）
    if (i < lines.length && /^WEBVTT/.test(lines[i])) {
      i++;
      // ヘッダ後の説明〜空行までスキップ
      while (i < lines.length && lines[i].trim() !== '') i++;
    }

    while (i < lines.length) {
      // 空行スキップ
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i >= lines.length) break;

      // NOTE / STYLE / REGION ブロックはスキップ
      if (/^(NOTE|STYLE|REGION)\b/.test(lines[i])) {
        while (i < lines.length && lines[i].trim() !== '') i++;
        continue;
      }

      let idText = '';
      // タイミング行を探す（最大1行先まで先読み）
      let timingLine = null;
      if (lines[i] && lines[i].includes('-->')) {
        timingLine = lines[i];
        i++;
      } else if (i + 1 < lines.length && lines[i + 1] && lines[i + 1].includes('-->')) {
        idText = lines[i].trim();
        i++;
        timingLine = lines[i];
        i++;
      } else {
        // タイミング行がなければ1行飛ばして次へ
        i++;
        continue;
      }

      const tm = timingLine.match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)\s*(.*)$/);
      if (!tm) continue;
      const start = parseTime(tm[1]);
      const end = parseTime(tm[2]);
      const settings = (tm[3] || '').trim();

      const textLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }

      if (!isFinite(start) || !isFinite(end)) continue;

      result.push({
        id: nextLocalId++,
        idText,
        start,
        end,
        settings,
        text: textLines.join('\n'),
      });
    }
    return result;
  }

  // ========== SRT パーサ ==========
  function parseSrt(text) {
    if (!text) return [];
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const blocks = text.split(/\n\n+/);
    const result = [];
    blocks.forEach((block) => {
      const lines = block.split('\n').filter((l, i) => !(i === 0 && /^\d+\s*$/.test(l))); // 先頭の番号行をスキップ
      // 最初の行が番号でなかった場合の保険
      let startLine = 0;
      if (/^\d+\s*$/.test((block.split('\n')[0] || ''))) {
        // すでにスキップ済み
      } else if (lines.length > 0 && /^\d+\s*$/.test(lines[0])) {
        startLine = 1;
      }
      const timing = lines[startLine];
      if (!timing || !timing.includes('-->')) return;
      const m = timing.match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
      if (!m) return;
      const start = parseTime(m[1]);
      const end = parseTime(m[2]);
      if (!isFinite(start) || !isFinite(end)) return;
      const textLines = lines.slice(startLine + 1);
      result.push({
        id: nextLocalId++,
        idText: '',
        start,
        end,
        settings: '',
        text: textLines.join('\n').trim(),
      });
    });
    return result;
  }

  function buildSrt(cueList) {
    const out = [];
    cueList.forEach((c, idx) => {
      out.push(String(idx + 1));
      const fmt = (s) => formatTime(s).replace('.', ',');
      out.push(fmt(c.start) + ' --> ' + fmt(c.end));
      out.push(c.text || '');
      out.push('');
    });
    return out.join('\n');
  }

  // ========== VTT 出力 ==========
  function buildVtt(cueList) {
    const out = ['WEBVTT', ''];
    cueList.forEach((c, idx) => {
      out.push(String(idx + 1)); // 番号は 1 から振り直し
      const timing =
        formatTime(c.start) +
        ' --> ' +
        formatTime(c.end) +
        (c.settings ? ' ' + c.settings : '');
      out.push(timing);
      out.push(c.text || '');
      out.push('');
    });
    return out.join('\n');
  }

  // ========== ストレージ ==========
  function loadGlossary() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GLOSSARY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((e) => normalizeGlossaryEntry(e))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveGlossary() {
    try {
      localStorage.setItem(
        STORAGE_KEY_GLOSSARY,
        JSON.stringify(
          glossary.map((e) => ({
            from: e.from,
            to: e.to,
            caseSensitive: !!e.caseSensitive,
            wholeWord: !!e.wholeWord,
            regex: !!e.regex,
            enabled: !!e.enabled,
          }))
        )
      );
    } catch {}
  }

  function normalizeGlossaryEntry(e) {
    if (!e || typeof e !== 'object') return null;
    if (typeof e.from !== 'string') return null;
    return {
      id: nextGlossaryId++,
      from: e.from,
      to: typeof e.to === 'string' ? e.to : '',
      caseSensitive: !!e.caseSensitive,
      wholeWord: !!e.wholeWord,
      regex: !!e.regex,
      enabled: e.enabled !== false,
    };
  }

  function autosave() {
    try {
      localStorage.setItem(
        STORAGE_KEY_DOC,
        JSON.stringify({
          fileName: currentFileName,
          cues: cues.map((c) => ({
            idText: c.idText,
            start: c.start,
            end: c.end,
            settings: c.settings,
            text: c.text,
          })),
        })
      );
    } catch {}
  }

  function loadAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOC);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.cues)) return false;
      currentFileName = parsed.fileName || 'subtitles.vtt';
      cues = parsed.cues.map((c) => ({
        id: nextLocalId++,
        idText: c.idText || '',
        start: Number(c.start) || 0,
        end: Number(c.end) || 0,
        settings: c.settings || '',
        text: c.text || '',
      }));
      return cues.length > 0;
    } catch {
      return false;
    }
  }

  // ========== 描画 ==========
  const els = {};
  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    els.cuesContainer = $('vtt-cues');
    els.empty = $('vtt-empty');
    els.status = $('vtt-status');
    els.toast = $('vtt-toast');
    els.template = $('vtt-cue-template');
    els.glossaryList = $('vtt-glossary-list');
    els.replaceResult = $('vtt-replace-result');

    glossary = loadGlossary();
    if (glossary.length === 0) {
      // 空状態でもエクスポート/インポートのために配列を保持
    }
    if (loadAutosave()) {
      // 自動復元成功
    }

    // 初期スナップショット
    history = [{ cues: cloneCues(cues) }];
    historyIndex = 0;

    bindUI();
    renderCues();
    renderGlossary();
    updateHistoryButtons();
    // URL ハッシュからタブを選択（例: #replace, #glossary, #split）
    const hash = (location.hash || '').replace('#', '');
    if (hash) {
      const tab = document.querySelector('.vtt-tab[data-tab="' + hash + '"]');
      if (tab) tab.click();
    }
  }

  function bindUI() {
    // タブ
    document.querySelectorAll('.vtt-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.vtt-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.vtt-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById('vtt-panel-' + tab.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });

    // ヘッダ
    $('vtt-load-btn').addEventListener('click', () => $('vtt-load-input').click());
    $('vtt-load-input').addEventListener('change', onFileSelected);
    $('vtt-save-btn').addEventListener('click', () => downloadVtt(cues, currentFileName));

    // 字幕一覧ツールバー
    $('vtt-new-btn').addEventListener('click', () => {
      if (cues.length > 0 && !confirm('現在の字幕を破棄して新規作成しますか？')) return;
      cues = [];
      currentFileName = 'subtitles.vtt';
      pushHistory();
      autosave();
      renderCues();
    });
    $('vtt-add-cue-btn').addEventListener('click', () => addCueAt(cues.length));
    $('vtt-select-all-btn').addEventListener('click', toggleSelectAll);
    $('vtt-merge-btn').addEventListener('click', mergeSelected);
    $('vtt-delete-btn').addEventListener('click', deleteSelected);

    // Undo/Redo
    $('vtt-undo-btn').addEventListener('click', undo);
    $('vtt-redo-btn').addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      const tag = (e.target && e.target.tagName) || '';
      const isText = tag === 'INPUT' || tag === 'TEXTAREA';
      const key = e.key.toLowerCase();
      if (key === 'z') {
        // テキスト入力中の Ctrl+Z はブラウザのネイティブ undo を優先
        if (isText) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        if (isText) return;
        e.preventDefault();
        redo();
      } else if (key === 's') {
        e.preventDefault();
        downloadVtt(cues, currentFileName);
      }
    });

    // 検索フィルタ
    $('vtt-filter').addEventListener('input', (e) => {
      filterQuery = e.target.value || '';
      applyFilter();
    });

    // 時間シフト
    $('vtt-shift-apply').addEventListener('click', applyTimeShift);

    // ポップアップメニュー
    const moreBtn = $('vtt-more-btn');
    const moreMenu = $('vtt-more-menu');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      moreMenu.classList.toggle('hidden');
      moreBtn.setAttribute('aria-expanded', String(!moreMenu.classList.contains('hidden')));
    });
    document.addEventListener('click', (e) => {
      if (!moreMenu.contains(e.target) && e.target !== moreBtn) {
        moreMenu.classList.add('hidden');
        moreBtn.setAttribute('aria-expanded', 'false');
      }
    });
    $('vtt-export-srt').addEventListener('click', () => {
      moreMenu.classList.add('hidden');
      downloadSrt();
    });
    $('vtt-import-srt').addEventListener('click', () => {
      moreMenu.classList.add('hidden');
      $('vtt-load-srt-input').click();
    });
    $('vtt-load-srt-input').addEventListener('change', onFileSelected);
    $('vtt-auto-fix').addEventListener('click', () => {
      moreMenu.classList.add('hidden');
      autoFix();
    });
    $('vtt-renumber').addEventListener('click', () => {
      moreMenu.classList.add('hidden');
      renumberIds();
    });

    // CPS しきい値
    const cpsInput = $('vtt-cps-threshold');
    if (cpsInput) {
      cpsInput.addEventListener('change', () => {
        const v = parseInt(cpsInput.value, 10);
        if (isFinite(v) && v >= 5 && v <= 40) {
          cpsThreshold = v;
          recomputeAllBadges();
        }
      });
    }

    // 動画プレビュー
    setupVideoPreview();

    // 置換
    $('vtt-replace-preview').addEventListener('click', () => runReplace(true));
    $('vtt-replace-apply').addEventListener('click', () => runReplace(false));
    $('vtt-replace-add-glossary').addEventListener('click', addReplaceToGlossary);

    // 用語集
    $('vtt-glossary-add').addEventListener('click', () => {
      glossary.push({
        id: nextGlossaryId++,
        from: '',
        to: '',
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        enabled: true,
      });
      saveGlossary();
      renderGlossary();
    });
    $('vtt-glossary-apply').addEventListener('click', applyGlossary);
    $('vtt-glossary-export').addEventListener('click', exportGlossary);
    $('vtt-glossary-import').addEventListener('click', () => $('vtt-glossary-import-input').click());
    $('vtt-glossary-import-input').addEventListener('change', importGlossary);

    // 分割
    $('vtt-split-by-index').addEventListener('click', splitByIndex);
    $('vtt-split-by-time').addEventListener('click', splitByTime);

    // ドラッグ＆ドロップで VTT 読込
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadFile(file);
    });
  }

  function onFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 同名ファイル再選択用
    if (file) loadFile(file);
  }

  function loadFile(file) {
    const reader = new FileReader();
    const isSrt = /\.srt$/i.test(file.name) ||
      (file.type === 'application/x-subrip') ||
      (file.type === '' && /\.srt$/i.test(file.name));
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        const looksLikeSrt = isSrt || (!/^WEBVTT/.test(raw.trim()) && /\d+\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/m.test(raw));
        const parsed = looksLikeSrt ? parseSrt(raw) : parseVtt(raw);
        cues = parsed;
        currentFileName = (file.name || 'subtitles.vtt').replace(/\.srt$/i, '.vtt');
        if (!/\.vtt$/i.test(currentFileName)) currentFileName += '.vtt';
        // 履歴をリセット
        history = [{ cues: cloneCues(cues) }];
        historyIndex = 0;
        updateHistoryButtons();
        autosave();
        renderCues();
        toast(`${parsed.length} 件の字幕を読み込みました`);
      } catch (err) {
        toast('読み込みに失敗しました: ' + (err && err.message ? err.message : err));
      }
    };
    reader.onerror = () => toast('ファイル読み込みに失敗しました');
    reader.readAsText(file, 'utf-8');
  }

  function downloadVtt(cueList, fileName) {
    if (cueList.length === 0) {
      toast('保存する字幕がありません');
      return;
    }
    const text = buildVtt(cueList);
    const blob = new Blob([text], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'subtitles.vtt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('保存しました: ' + (fileName || 'subtitles.vtt'));
  }

  function downloadSrt() {
    if (cues.length === 0) {
      toast('保存する字幕がありません');
      return;
    }
    const text = buildSrt(cues);
    const blob = new Blob([text], { type: 'application/x-subrip;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (currentFileName || 'subtitles.vtt').replace(/\.vtt$/i, '.srt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('SRT として保存しました');
  }

  // ========== 字幕一覧の描画 ==========
  function renderCues() {
    els.cuesContainer.innerHTML = '';
    if (cues.length === 0) {
      els.empty.style.display = 'block';
      els.status.textContent = '字幕: 0 件';
      return;
    }
    els.empty.style.display = 'none';

    const frag = document.createDocumentFragment();
    cues.forEach((c, idx) => {
      const node = els.template.content.firstElementChild.cloneNode(true);
      node.dataset.id = String(c.id);
      node.querySelector('.vtt-cue-num').textContent = String(idx + 1);
      const startInput = node.querySelector('.vtt-cue-start');
      const endInput = node.querySelector('.vtt-cue-end');
      const idInput = node.querySelector('.vtt-cue-id');
      const textArea = node.querySelector('.vtt-cue-text');
      startInput.value = formatTime(c.start);
      endInput.value = formatTime(c.end);
      idInput.value = c.idText || '';
      textArea.value = c.text || '';

      validateCueDom(node, c);

      startInput.addEventListener('change', () => {
        const v = parseTime(startInput.value);
        if (isFinite(v)) c.start = v;
        startInput.value = formatTime(c.start);
        validateCueDom(node, c);
        pushHistory();
        autosave();
      });
      endInput.addEventListener('change', () => {
        const v = parseTime(endInput.value);
        if (isFinite(v)) c.end = v;
        endInput.value = formatTime(c.end);
        validateCueDom(node, c);
        pushHistory();
        autosave();
      });
      idInput.addEventListener('change', () => {
        c.idText = idInput.value.trim();
        pushHistory();
        autosave();
      });
      textArea.addEventListener('input', () => {
        c.text = textArea.value;
        autosave();
        debouncedPushHistory();
        updateCueBadges(node, c, idx);
        // 統計の更新はやや遅延
        if (textEditTimer) clearTimeout(textEditTimer);
      });
      // テキスト高さの自動調整
      autoResize(textArea);
      textArea.addEventListener('input', () => {
        autoResize(textArea);
        clearTimeout(textArea._statTimer);
        textArea._statTimer = setTimeout(updateStatusBar, 400);
      });

      const check = node.querySelector('.vtt-cue-check');
      check.addEventListener('change', () => {
        node.classList.toggle('selected', check.checked);
      });

      node.querySelector('.vtt-cue-merge-next').addEventListener('click', () => mergeWithNext(c.id));
      node.querySelector('.vtt-cue-insert-after').addEventListener('click', () => addCueAt(idx + 1));
      node.querySelector('.vtt-cue-up').addEventListener('click', () => moveCue(c.id, -1));
      node.querySelector('.vtt-cue-down').addEventListener('click', () => moveCue(c.id, +1));
      node.querySelector('.vtt-cue-del').addEventListener('click', () => deleteCue(c.id));

      const seekBtn = node.querySelector('.vtt-cue-seek');
      const setStartBtn = node.querySelector('.vtt-cue-set-start');
      const setEndBtn = node.querySelector('.vtt-cue-set-end');
      seekBtn.addEventListener('click', () => seekVideoTo(c.start));
      setStartBtn.addEventListener('click', () => {
        if (!videoEl || !isFinite(videoEl.currentTime)) { toast('動画を読み込んでください'); return; }
        c.start = videoEl.currentTime;
        if (c.end < c.start) c.end = c.start + 1;
        startInput.value = formatTime(c.start);
        endInput.value = formatTime(c.end);
        updateCueBadges(node, c, idx);
        pushHistory();
        autosave();
      });
      setEndBtn.addEventListener('click', () => {
        if (!videoEl || !isFinite(videoEl.currentTime)) { toast('動画を読み込んでください'); return; }
        c.end = Math.max(c.start, videoEl.currentTime);
        endInput.value = formatTime(c.end);
        updateCueBadges(node, c, idx);
        pushHistory();
        autosave();
      });

      updateCueBadges(node, c, idx);
      frag.appendChild(node);
    });
    els.cuesContainer.appendChild(frag);
    els.status.textContent = `字幕: ${cues.length} 件`;
    applyFilter();
    updateIssuesSummary();
    updateStatusBar();
  }

  function applyFilter() {
    const q = filterQuery.trim().toLowerCase();
    const nodes = els.cuesContainer.querySelectorAll('.vtt-cue');
    let shown = 0;
    nodes.forEach((node) => {
      if (!q) {
        node.classList.remove('filtered');
        shown++;
        return;
      }
      const text = (node.querySelector('.vtt-cue-text') || {}).value || '';
      const idText = (node.querySelector('.vtt-cue-id') || {}).value || '';
      if (text.toLowerCase().includes(q) || idText.toLowerCase().includes(q)) {
        node.classList.remove('filtered');
        shown++;
      } else {
        node.classList.add('filtered');
      }
    });
    if (q) {
      els.status.textContent = `字幕: ${cues.length} 件（表示 ${shown} 件）`;
    } else {
      els.status.textContent = `字幕: ${cues.length} 件`;
    }
  }

  function autoResize(textArea) {
    textArea.style.height = 'auto';
    textArea.style.height = Math.max(44, textArea.scrollHeight) + 'px';
  }

  function validateCueDom(node, c) {
    const invalid = !(c.end > c.start);
    node.classList.toggle('invalid', invalid);
  }

  function updateCueBadges(node, c, idx) {
    const container = node.querySelector('.vtt-cue-badges');
    if (!container) return;
    container.innerHTML = '';
    const duration = c.end - c.start;

    // Duration
    const durBadge = document.createElement('span');
    durBadge.className = 'vtt-badge';
    durBadge.textContent = duration > 0 ? `${duration.toFixed(2)}s` : '0s';
    if (duration > 0 && duration < 0.8) durBadge.classList.add('vtt-badge-warn');
    if (duration <= 0) durBadge.classList.add('vtt-badge-danger');
    container.appendChild(durBadge);

    // CPS（改行と空白を除いた文字数 / 秒）
    if (duration > 0 && c.text) {
      const chars = c.text.replace(/\s+/g, '').length;
      const cps = chars / duration;
      const cpsBadge = document.createElement('span');
      cpsBadge.className = 'vtt-badge';
      cpsBadge.textContent = `${cps.toFixed(1)} CPS`;
      if (cps > cpsThreshold * 1.4) cpsBadge.classList.add('vtt-badge-danger');
      else if (cps > cpsThreshold) cpsBadge.classList.add('vtt-badge-warn');
      cpsBadge.title = '文字/秒 — 読み速度の目安';
      container.appendChild(cpsBadge);
    }

    // Overlap with previous
    if (idx > 0) {
      const prev = cues[idx - 1];
      if (prev && c.start < prev.end - 0.001) {
        const ov = document.createElement('span');
        ov.className = 'vtt-badge vtt-badge-danger';
        ov.textContent = '重複';
        ov.title = `前の字幕 (#${idx}) と ${(prev.end - c.start).toFixed(2)}s 重なっています`;
        container.appendChild(ov);
      }
    }

    // Line length warning（1行あたり 42 文字を超える場合、放送字幕の一般的基準）
    if (c.text) {
      const longest = c.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
      if (longest > 42) {
        const lb = document.createElement('span');
        lb.className = 'vtt-badge vtt-badge-warn';
        lb.textContent = `${longest}字/行`;
        lb.title = '1 行が 42 文字を超えています（放送字幕の一般的な上限）';
        container.appendChild(lb);
      }
    }
  }

  function recomputeAllBadges() {
    const nodes = els.cuesContainer.querySelectorAll('.vtt-cue');
    nodes.forEach((node, idx) => {
      const c = cues[idx];
      if (c) updateCueBadges(node, c, idx);
    });
    updateIssuesSummary();
    updateStatusBar();
  }

  // ========== 検証サマリ ==========
  function computeIssues() {
    const issues = [];
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      const duration = c.end - c.start;
      if (duration <= 0) {
        issues.push({ idx: i, severity: 'danger', tag: '不正な尺', msg: '終了時刻が開始以下です' });
      } else if (duration < 0.8) {
        issues.push({ idx: i, severity: 'warn', tag: '短すぎ', msg: `${duration.toFixed(2)} 秒` });
      }
      if (i > 0) {
        const prev = cues[i - 1];
        if (prev && c.start < prev.end - 0.001) {
          issues.push({
            idx: i,
            severity: 'danger',
            tag: '重複',
            msg: `前の字幕と ${(prev.end - c.start).toFixed(2)} 秒重複`,
          });
        }
      }
      if (c.text) {
        const chars = c.text.replace(/\s+/g, '').length;
        if (duration > 0 && chars / duration > cpsThreshold * 1.4) {
          issues.push({
            idx: i,
            severity: 'warn',
            tag: '速い',
            msg: `${(chars / duration).toFixed(1)} CPS（しきい値の 1.4 倍超）`,
          });
        }
        const longest = c.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0);
        if (longest > 42) {
          issues.push({ idx: i, severity: 'warn', tag: '長い行', msg: `${longest} 文字/行` });
        }
      }
    }
    return issues;
  }

  function updateIssuesSummary() {
    const root = document.getElementById('vtt-issues');
    const summary = document.getElementById('vtt-issues-summary');
    const list = document.getElementById('vtt-issues-list');
    if (!root || !summary || !list) return;
    const issues = computeIssues();
    list.innerHTML = '';
    if (issues.length === 0) {
      summary.textContent = '問題なし';
      root.removeAttribute('data-severity');
      root.open = false;
      return;
    }
    const dangerCount = issues.filter((x) => x.severity === 'danger').length;
    const warnCount = issues.length - dangerCount;
    summary.textContent = `問題 ${issues.length} 件（重大 ${dangerCount} / 警告 ${warnCount}） — クリックで一覧`;
    root.setAttribute('data-severity', dangerCount > 0 ? 'danger' : 'warn');
    issues.forEach((iss) => {
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'vtt-issue-num';
      num.textContent = '#' + (iss.idx + 1);
      const tag = document.createElement('span');
      tag.className = 'vtt-issue-tag' + (iss.severity === 'danger' ? ' danger' : '');
      tag.textContent = iss.tag;
      const msg = document.createElement('span');
      msg.textContent = iss.msg;
      li.appendChild(num);
      li.appendChild(tag);
      li.appendChild(msg);
      li.addEventListener('click', () => scrollToCueIndex(iss.idx));
      list.appendChild(li);
    });
  }

  function scrollToCueIndex(idx) {
    const c = cues[idx];
    if (!c) return;
    const node = els.cuesContainer.querySelector(`.vtt-cue[data-id="${c.id}"]`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('playing');
      setTimeout(() => node.classList.remove('playing'), 1200);
    }
  }

  // ========== ステータスバー ==========
  function updateStatusBar() {
    const fileEl = document.getElementById('vtt-stat-file');
    const cueEl = document.getElementById('vtt-stat-cues');
    const durEl = document.getElementById('vtt-stat-duration');
    const warnEl = document.getElementById('vtt-stat-warnings');
    if (!fileEl) return;
    fileEl.textContent = currentFileName;
    cueEl.textContent = `${cues.length} 件`;
    const total = cues.length > 0 ? cues[cues.length - 1].end : 0;
    durEl.textContent = formatTime(total).replace(/\.\d+$/, '');
    const issues = computeIssues();
    const danger = issues.filter((x) => x.severity === 'danger').length;
    warnEl.textContent = `警告 ${issues.length}`;
    warnEl.classList.toggle('has-danger', danger > 0);
    warnEl.classList.toggle('has-warn', issues.length > 0 && danger === 0);
  }

  // ========== 動画プレビュー ==========
  function setupVideoPreview() {
    videoEl = document.getElementById('vtt-video');
    const panel = document.getElementById('vtt-video-panel');
    const toggle = document.getElementById('vtt-video-toggle');
    const pick = document.getElementById('vtt-video-pick');
    const input = document.getElementById('vtt-video-input');
    const close = document.getElementById('vtt-video-close');
    const timeLbl = document.getElementById('vtt-video-time');
    const followCb = document.getElementById('vtt-follow-playback');
    if (!videoEl || !panel || !toggle) return;

    toggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });
    close.addEventListener('click', () => panel.classList.add('hidden'));
    pick.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const url = URL.createObjectURL(f);
      videoEl.src = url;
      videoEl.load();
    });
    followCb.addEventListener('change', () => {
      followPlayback = followCb.checked;
    });
    videoEl.addEventListener('timeupdate', () => {
      const t = videoEl.currentTime || 0;
      timeLbl.textContent = formatTime(t);
      highlightPlayingCue(t);
    });
  }

  function seekVideoTo(seconds) {
    if (!videoEl) return;
    if (!videoEl.src) { toast('動画を読み込んでください'); return; }
    document.getElementById('vtt-video-panel').classList.remove('hidden');
    videoEl.currentTime = Math.max(0, seconds);
    videoEl.play().catch(() => {});
  }

  function highlightPlayingCue(t) {
    let activeId = -1;
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (t >= c.start && t < c.end) { activeId = c.id; break; }
    }
    if (activeId === lastPlayingCueId) return;
    lastPlayingCueId = activeId;
    const nodes = els.cuesContainer.querySelectorAll('.vtt-cue');
    nodes.forEach((n) => n.classList.remove('playing'));
    if (activeId < 0) return;
    const target = els.cuesContainer.querySelector(`.vtt-cue[data-id="${activeId}"]`);
    if (target) {
      target.classList.add('playing');
      if (followPlayback) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // ========== 自動修正 / ID振り直し ==========
  function autoFix() {
    if (cues.length === 0) { toast('字幕がありません'); return; }
    if (!confirm('重複の解消・最小尺の確保を一括適用します。続行しますか？')) return;
    const MIN_DURATION = 0.8;
    const GAP = 0.04;
    let fixed = 0;
    // 開始時刻昇順で並べ替え
    cues.sort((a, b) => a.start - b.start);
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      // 最小尺
      if (c.end - c.start < MIN_DURATION) {
        c.end = c.start + MIN_DURATION;
        fixed++;
      }
      const next = cues[i + 1];
      if (next && c.end > next.start - GAP) {
        c.end = Math.max(c.start + 0.1, next.start - GAP);
        fixed++;
      }
    }
    pushHistory();
    autosave();
    renderCues();
    toast(`${fixed} 件を調整しました`);
  }

  function renumberIds() {
    cues.forEach((c, i) => { c.idText = String(i + 1); });
    pushHistory();
    autosave();
    renderCues();
    toast('ID を 1 から振り直しました');
  }

  function getSelectedIds() {
    return Array.from(els.cuesContainer.querySelectorAll('.vtt-cue.selected'))
      .map((n) => Number(n.dataset.id));
  }

  function getSelectedCues() {
    const ids = new Set(getSelectedIds());
    return cues.filter((c) => ids.has(c.id));
  }

  function toggleSelectAll() {
    const checks = els.cuesContainer.querySelectorAll('.vtt-cue-check');
    if (checks.length === 0) return;
    const allChecked = Array.from(checks).every((cb) => cb.checked);
    checks.forEach((cb) => {
      cb.checked = !allChecked;
      cb.closest('.vtt-cue').classList.toggle('selected', cb.checked);
    });
  }

  function addCueAt(index) {
    const prev = index > 0 ? cues[index - 1] : null;
    const next = index < cues.length ? cues[index] : null;
    const start = prev ? prev.end : (next ? Math.max(0, next.start - 2) : 0);
    const end = next ? next.start : start + 2;
    const cue = {
      id: nextLocalId++,
      idText: '',
      start,
      end,
      settings: '',
      text: '',
    };
    cues.splice(index, 0, cue);
    pushHistory();
    autosave();
    renderCues();
  }

  function deleteCue(id) {
    const idx = cues.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cues.splice(idx, 1);
      pushHistory();
      autosave();
      renderCues();
    }
  }

  function deleteSelected() {
    const ids = new Set(getSelectedIds());
    if (ids.size === 0) {
      toast('削除する字幕を選択してください');
      return;
    }
    if (!confirm(`${ids.size} 件の字幕を削除しますか？`)) return;
    cues = cues.filter((c) => !ids.has(c.id));
    pushHistory();
    autosave();
    renderCues();
  }

  function moveCue(id, delta) {
    const idx = cues.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= cues.length) return;
    const [c] = cues.splice(idx, 1);
    cues.splice(target, 0, c);
    pushHistory();
    autosave();
    renderCues();
  }

  function mergeWithNext(id) {
    const idx = cues.findIndex((c) => c.id === id);
    if (idx < 0 || idx >= cues.length - 1) return;
    const a = cues[idx];
    const b = cues[idx + 1];
    const sep = $('vtt-merge-newline').checked ? '\n' : ' ';
    a.end = Math.max(a.end, b.end);
    a.start = Math.min(a.start, b.start);
    a.text = [a.text, b.text].filter((s) => s && s.length > 0).join(sep);
    cues.splice(idx + 1, 1);
    pushHistory();
    autosave();
    renderCues();
  }

  // ========== 時間シフト ==========
  function applyTimeShift() {
    const v = parseFloat($('vtt-shift-amount').value);
    if (!isFinite(v) || v === 0) {
      toast('シフト秒数を入力してください');
      return;
    }
    const onlySelected = $('vtt-shift-selected').checked;
    const targetCues = onlySelected ? getSelectedCues() : cues;
    if (targetCues.length === 0) {
      toast('対象の字幕がありません');
      return;
    }
    // 負方向シフトで開始が 0 を下回るかチェック
    const minStart = Math.min(...targetCues.map((c) => c.start));
    if (minStart + v < 0) {
      if (!confirm('開始時刻が 0 を下回ります。0 にクランプして続行しますか？')) return;
    }
    targetCues.forEach((c) => {
      c.start = Math.max(0, c.start + v);
      c.end = Math.max(c.start, c.end + v);
    });
    pushHistory();
    autosave();
    renderCues();
    toast(`${targetCues.length} 件を ${v >= 0 ? '+' : ''}${v.toFixed(3)} 秒シフト`);
  }

  function mergeSelected() {
    const selectedIds = getSelectedIds();
    if (selectedIds.length < 2) {
      toast('結合するには 2 件以上を選択してください');
      return;
    }
    // 出現順インデックスでソート
    const indexes = selectedIds
      .map((id) => cues.findIndex((c) => c.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const sep = $('vtt-merge-newline').checked ? '\n' : ' ';
    const selected = indexes.map((i) => cues[i]);
    const start = Math.min(...selected.map((c) => c.start));
    const end = Math.max(...selected.map((c) => c.end));
    const text = selected.map((c) => c.text).filter((s) => s && s.length > 0).join(sep);
    const merged = {
      id: nextLocalId++,
      idText: selected[0].idText || '',
      start,
      end,
      settings: selected[0].settings || '',
      text,
    };
    // 後ろから削除（インデックスズレ防止）
    for (let i = indexes.length - 1; i >= 0; i--) cues.splice(indexes[i], 1);
    // 元の最初の位置に挿入
    cues.splice(indexes[0], 0, merged);
    pushHistory();
    autosave();
    renderCues();
    toast(`${selected.length} 件を結合しました`);
  }

  // ========== 置換 ==========
  function buildRegexFromOptions(pattern, opts) {
    if (!pattern) return null;
    let source = pattern;
    if (!opts.regex) {
      source = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (opts.wholeWord) {
      source = '\\b' + source + '\\b';
    }
    let flags = 'g';
    if (!opts.caseSensitive) flags += 'i';
    try {
      return new RegExp(source, flags);
    } catch (e) {
      throw new Error('正規表現が不正です: ' + e.message);
    }
  }

  function runReplace(previewOnly) {
    const find = $('vtt-find').value;
    const replace = $('vtt-replace').value;
    const opts = {
      caseSensitive: $('vtt-opt-case').checked,
      wholeWord: $('vtt-opt-word').checked,
      regex: $('vtt-opt-regex').checked,
    };
    const onlySelected = $('vtt-opt-selected').checked;
    if (!find) {
      toast('検索文字列を入力してください');
      return;
    }
    let regex;
    try {
      regex = buildRegexFromOptions(find, opts);
    } catch (e) {
      toast(e.message);
      return;
    }
    const targetCues = onlySelected ? getSelectedCues() : cues;
    if (onlySelected && targetCues.length === 0) {
      toast('選択中の字幕がありません');
      return;
    }
    let matchCount = 0;
    let cueAffected = 0;
    const previewLines = [];
    targetCues.forEach((c, idx) => {
      const original = c.text;
      regex.lastIndex = 0;
      const matches = original.match(regex);
      if (!matches || matches.length === 0) return;
      cueAffected++;
      matchCount += matches.length;
      const replaced = original.replace(regex, replace);
      if (previewOnly) {
        previewLines.push(`#${cues.indexOf(c) + 1}: "${truncate(original)}" → "${truncate(replaced)}" (${matches.length}件)`);
      } else {
        c.text = replaced;
      }
    });
    if (previewOnly) {
      els.replaceResult.classList.add('show');
      if (cueAffected === 0) {
        els.replaceResult.textContent = '一致する字幕はありません。';
      } else {
        els.replaceResult.textContent =
          `${cueAffected} 件の字幕で ${matchCount} 件一致します。\n\n` + previewLines.join('\n');
      }
    } else {
      if (matchCount > 0) pushHistory();
      autosave();
      renderCues();
      els.replaceResult.classList.add('show');
      els.replaceResult.textContent = `${cueAffected} 件の字幕で ${matchCount} 件を置換しました。`;
      toast(`${matchCount} 件を置換`);
    }
  }

  function truncate(s, n = 60) {
    s = s.replace(/\n/g, '↵');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function addReplaceToGlossary() {
    const find = $('vtt-find').value;
    const replace = $('vtt-replace').value;
    if (!find) {
      toast('検索文字列を入力してください');
      return;
    }
    glossary.push({
      id: nextGlossaryId++,
      from: find,
      to: replace,
      caseSensitive: $('vtt-opt-case').checked,
      wholeWord: $('vtt-opt-word').checked,
      regex: $('vtt-opt-regex').checked,
      enabled: true,
    });
    saveGlossary();
    renderGlossary();
    toast('用語集に登録しました');
  }

  // ========== 用語集 ==========
  function renderGlossary() {
    els.glossaryList.innerHTML = '';
    if (glossary.length === 0) {
      const div = document.createElement('div');
      div.className = 'vtt-glossary-empty';
      div.textContent = '用語集はまだ空です。「エントリ追加」または「置換」タブから登録できます。';
      els.glossaryList.appendChild(div);
      return;
    }
    const frag = document.createDocumentFragment();
    glossary.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'vtt-glossary-row' + (entry.enabled ? '' : ' disabled');

      const enable = document.createElement('input');
      enable.type = 'checkbox';
      enable.className = 'vtt-glossary-enable';
      enable.checked = !!entry.enabled;
      enable.title = '有効';
      enable.addEventListener('change', () => {
        entry.enabled = enable.checked;
        row.classList.toggle('disabled', !entry.enabled);
        saveGlossary();
      });

      const fromInput = document.createElement('input');
      fromInput.type = 'text';
      fromInput.className = 'vtt-glossary-from';
      fromInput.placeholder = '検索文字列';
      fromInput.value = entry.from;
      fromInput.addEventListener('change', () => {
        entry.from = fromInput.value;
        saveGlossary();
      });

      const toInput = document.createElement('input');
      toInput.type = 'text';
      toInput.className = 'vtt-glossary-to';
      toInput.placeholder = '置換後';
      toInput.value = entry.to;
      toInput.addEventListener('change', () => {
        entry.to = toInput.value;
        saveGlossary();
      });

      const opts = document.createElement('div');
      opts.className = 'vtt-glossary-options';
      opts.appendChild(makeGlossaryOption('Aa', '大小区別', 'caseSensitive', entry));
      opts.appendChild(makeGlossaryOption('W', '単語', 'wholeWord', entry));
      opts.appendChild(makeGlossaryOption('.*', '正規表現', 'regex', entry));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'vtt-glossary-del';
      del.title = '削除';
      del.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">delete</span>';
      del.addEventListener('click', () => {
        if (!confirm('この用語集エントリを削除しますか？')) return;
        glossary = glossary.filter((e) => e.id !== entry.id);
        saveGlossary();
        renderGlossary();
      });

      row.appendChild(enable);
      row.appendChild(fromInput);
      row.appendChild(toInput);
      row.appendChild(opts);
      row.appendChild(del);
      frag.appendChild(row);
    });
    els.glossaryList.appendChild(frag);
  }

  function makeGlossaryOption(label, title, key, entry) {
    const wrap = document.createElement('label');
    wrap.title = title;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!entry[key];
    cb.addEventListener('change', () => {
      entry[key] = cb.checked;
      saveGlossary();
    });
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(cb);
    wrap.appendChild(span);
    return wrap;
  }

  function applyGlossary() {
    const enabled = glossary.filter((e) => e.enabled && e.from);
    if (enabled.length === 0) {
      toast('有効な用語集エントリがありません');
      return;
    }
    const onlySelected = $('vtt-glossary-apply-selected').checked;
    const targetCues = onlySelected ? getSelectedCues() : cues;
    if (onlySelected && targetCues.length === 0) {
      toast('選択中の字幕がありません');
      return;
    }
    let totalMatches = 0;
    let cueAffected = 0;
    const errors = [];
    targetCues.forEach((c) => {
      let text = c.text;
      let cueChanged = false;
      enabled.forEach((entry) => {
        let regex;
        try {
          regex = buildRegexFromOptions(entry.from, entry);
        } catch (e) {
          errors.push(`「${entry.from}」: ${e.message}`);
          return;
        }
        if (!regex) return;
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          totalMatches += matches.length;
          text = text.replace(regex, entry.to);
          cueChanged = true;
        }
      });
      if (cueChanged) {
        cueAffected++;
        c.text = text;
      }
    });
    if (errors.length > 0) {
      toast('エラー: ' + errors[0]);
    }
    if (totalMatches > 0) pushHistory();
    autosave();
    renderCues();
    toast(`${cueAffected} 件の字幕で ${totalMatches} 件を置換`);
  }

  function exportGlossary() {
    const data = JSON.stringify(
      glossary.map((e) => ({
        from: e.from,
        to: e.to,
        caseSensitive: !!e.caseSensitive,
        wholeWord: !!e.wholeWord,
        regex: !!e.regex,
        enabled: !!e.enabled,
      })),
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vtt-glossary.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importGlossary(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(parsed)) throw new Error('JSON 配列ではありません');
        const replace = confirm(
          `${parsed.length} 件のエントリを取り込みます。\n[OK] 既存を置き換え / [キャンセル] 末尾に追加`
        );
        const normalized = parsed.map(normalizeGlossaryEntry).filter(Boolean);
        if (replace) {
          glossary = normalized;
        } else {
          glossary = glossary.concat(normalized);
        }
        saveGlossary();
        renderGlossary();
        toast(`${normalized.length} 件を取り込みました`);
      } catch (err) {
        toast('取り込みに失敗: ' + (err && err.message ? err.message : err));
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ========== 分割 ==========
  function baseName() {
    return currentFileName.replace(/\.vtt$/i, '') || 'subtitles';
  }

  function splitByIndex() {
    if (cues.length === 0) {
      toast('字幕がありません');
      return;
    }
    const v = parseInt($('vtt-split-index').value, 10);
    if (!isFinite(v) || v < 2 || v > cues.length) {
      toast(`分割位置は 2〜${cues.length} の範囲で指定してください`);
      return;
    }
    const part1 = cues.slice(0, v - 1);
    const part2 = cues.slice(v - 1);
    const base = baseName();
    downloadVtt(part1, `${base}_part1.vtt`);
    setTimeout(() => downloadVtt(part2, `${base}_part2.vtt`), 250);
  }

  function splitByTime() {
    if (cues.length === 0) {
      toast('字幕がありません');
      return;
    }
    const t = parseTime($('vtt-split-time').value);
    if (!isFinite(t)) {
      toast('時刻は HH:MM:SS.mmm の形式で入力してください');
      return;
    }
    // 最初に start >= t になる字幕を境界とする
    const splitIdx = cues.findIndex((c) => c.start >= t);
    if (splitIdx <= 0) {
      toast('指定時刻で分割できません（範囲外）');
      return;
    }
    const part1 = cues.slice(0, splitIdx);
    const part2 = cues.slice(splitIdx);
    const base = baseName();
    downloadVtt(part1, `${base}_part1.vtt`);
    setTimeout(() => downloadVtt(part2, `${base}_part2.vtt`), 250);
  }

  // ========== トースト ==========
  let toastTimer = null;
  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    requestAnimationFrame(() => els.toast.classList.add('show'));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => els.toast.classList.add('hidden'), 250);
    }, 2200);
  }

  // 起動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
