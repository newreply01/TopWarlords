'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Level 1 無雙切入演出模組 (musou-cutin.js)
   ===================================================== */
(function () {
  const STORAGE_KEY = 'wl15_musou_mode'; // 'full' | 'lite' | 'off'
  const VALID_MODES = ['full', 'lite', 'off'];
  const MODE_LABELS = { full: '大招：完整', lite: '大招：精簡', off: '大招：關閉' };

  const ARCHETYPE_PALETTES = {
    fire_storm:      { primary: '#f97316', accent: '#fde047', dark: '#7c2d12', border: '#ef4444', icon: '🔥' },
    thunder_strike:  { primary: '#38bdf8', accent: '#e0f2fe', dark: '#0c4a6e', border: '#0284c7', icon: '⚡' },
    bagua_array:     { primary: '#f59e0b', accent: '#fef3c7', dark: '#78350f', border: '#d97706', icon: '☯️' },
    overlord_cleave: { primary: '#e11d48', accent: '#fbbf24', dark: '#4c0519', border: '#f43f5e', icon: '💥' },
    piercing_volley: { primary: '#fbbf24', accent: '#fef08a', dark: '#713f12', border: '#d97706', icon: '🏹' },
    tidal_surge:     { primary: '#06b6d4', accent: '#ecfeff', dark: '#083344', border: '#0284c7', icon: '🌊' },
    aegis_command:   { primary: '#10b981', accent: '#fef3c7', dark: '#064e3b', border: '#d97706', icon: '🛡️' },
    shadow_ambush:   { primary: '#a855f7', accent: '#f3e8ff', dark: '#3b0764', border: '#9333ea', icon: '🌑' }
  };

  let mode = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return VALID_MODES.includes(saved) ? saved : 'full';
    } catch (_) {
      return 'full';
    }
  })();

  let queue = [];
  let activeItem = null;
  let activeTimers = [];
  let playedThisBattle = new Set();

  function getMode() {
    return mode;
  }

  function setMode(nextMode) {
    mode = VALID_MODES.includes(nextMode) ? nextMode : 'full';
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {}
    syncModeButton();
    if (mode === 'off') clearAll();
    return mode;
  }

  function cycleMode() {
    const idx = VALID_MODES.indexOf(mode);
    return setMode(VALID_MODES[(idx + 1) % VALID_MODES.length]);
  }

  function syncModeButton() {
    const btn = document.getElementById('btnBattleMusou');
    if (!btn) return;
    btn.textContent = MODE_LABELS[mode] || MODE_LABELS.full;
    btn.setAttribute('aria-pressed', String(mode !== 'off'));
    btn.dataset.musouMode = mode;
  }

  function isPlaying() {
    return Boolean(activeItem);
  }

  function resetBattle() {
    playedThisBattle.clear();
    clearAll();
  }

  function clearTimers() {
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
  }

  function removeOverlayDom() {
    document.querySelectorAll('.musou-cutin-overlay').forEach(el => el.remove());
  }

  function unfreezeEngine() {
    try {
      window.Battle3DEngine?.setCutinFreeze?.(false, null);
    } catch (_) {}
  }

  function clearAll() {
    clearTimers();
    removeOverlayDom();
    unfreezeEngine();
    if (activeItem) {
      const resolve = activeItem.resolve;
      activeItem = null;
      resolve?.();
    }
    while (queue.length) {
      const item = queue.shift();
      item.resolve?.();
    }
  }

  function computeDurationMs(tempo = 1, isQueuedThirdOrMore = false) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 600;
    }
    let base = (mode === 'lite' || isQueuedThirdOrMore) ? 900 : 1500;
    if (tempo >= 3) base = Math.min(base, 750);
    else if (tempo >= 2) base = Math.min(base, 1000);
    return base;
  }

  function computeSafeTopPx(wrapper) {
    const wrapRect = wrapper.getBoundingClientRect();
    let minTop = 12;
    const selectors = ['#holoRadarStrip', '.log-header-hud', '.battle-3d-overlay-hud'];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Only avoid if element overlaps horizontally & vertically with wrapper top area
      const overlapsX = r.right > wrapRect.left && r.left < wrapRect.right;
      const inUpperZone = r.bottom > wrapRect.top && r.top < wrapRect.top + wrapRect.height * 0.45;
      if (overlapsX && inUpperZone) {
        minTop = Math.max(minTop, Math.round(r.bottom - wrapRect.top + 8));
      }
    });
    const maxSafe = Math.max(12, Math.round(wrapRect.height * 0.42));
    return Math.min(minTop, maxSafe);
  }

  function buildCharSpans(text, charDelayMs) {
    const frag = document.createDocumentFragment();
    const chars = Array.from(text || '');
    chars.forEach((ch, idx) => {
      const span = document.createElement('span');
      span.className = 'musou-cutin-char';
      span.textContent = ch;
      span.style.animationDelay = `${Math.round(idx * charDelayMs)}ms`;
      frag.appendChild(span);
    });
    return frag;
  }

  function runItem(item) {
    activeItem = item;
    const { uid, side = 'A', fxKey = 'overlord_cleave', tempo = 1, focusToken = null, queuePos = 0, resolve } = item;

    const wrapper = document.getElementById('battle3DWrapper');
    if (!wrapper || mode === 'off') {
      activeItem = null;
      resolve();
      pumpQueue();
      return;
    }

    const unit = (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[uid]) ? UNIT_MAP[uid] : null;
    const meta = (typeof UNIT_META !== 'undefined' && UNIT_META[uid]) ? UNIT_META[uid] : null;
    const move = (typeof getMusouMove === 'function') ? getMusouMove(uid) : null;
    const pal = ARCHETYPE_PALETTES[fxKey] || ARCHETYPE_PALETTES.overlord_cleave;

    const duration = computeDurationMs(tempo, queuePos >= 2);
    const scale = duration / 1500;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 凍結戰鬥時鐘 & 鏡頭推近 + 播放音效
    try {
      window.Battle3DEngine?.setCutinFreeze?.(true, focusToken);
      if (meta?.sfx) window.SoundEngine?.play?.(meta.sfx);
    } catch (_) {}

    removeOverlayDom();
    const overlay = document.createElement('div');
    overlay.className = `musou-cutin-overlay side-${side === 'B' ? 'b' : 'a'}${reduced ? ' is-reduced' : ''}${isLight ? ' is-light' : ''}`;
    overlay.style.setProperty('--musou-dur', `${duration}ms`);
    overlay.style.setProperty('--musou-primary', pal.primary);
    overlay.style.setProperty('--musou-accent', pal.accent);
    overlay.style.setProperty('--musou-dark', pal.dark);
    overlay.style.setProperty('--musou-border', isLight ? '#f59e0b' : pal.border);

    const vignette = document.createElement('div');
    vignette.className = 'musou-cutin-vignette';

    const flash = document.createElement('div');
    flash.className = 'musou-cutin-flash';

    const band = document.createElement('div');
    band.className = 'musou-cutin-band';
    const safeTop = computeSafeTopPx(wrapper);
    const idealTop = Math.round(wrapper.clientHeight * 0.28);
    band.style.top = `${Math.max(safeTop, idealTop)}px`;

    const speedlines = document.createElement('div');
    speedlines.className = 'musou-cutin-speedlines';
    band.appendChild(speedlines);

    const inner = document.createElement('div');
    inner.className = 'musou-cutin-inner';

    const portraitWrap = document.createElement('div');
    portraitWrap.className = 'musou-cutin-portrait-wrap';

    const img = document.createElement('img');
    img.className = 'musou-cutin-portrait';
    img.alt = unit?.name || uid;
    img.src = meta?.img || `assets/warlords/${uid}.jpg`;
    img.onerror = () => { img.style.display = 'none'; };
    portraitWrap.appendChild(img);

    if (meta?.flag) {
      const flag = document.createElement('span');
      flag.className = 'musou-cutin-flag';
      flag.textContent = meta.flag;
      portraitWrap.appendChild(flag);
    }

    const textCol = document.createElement('div');
    textCol.className = 'musou-cutin-text';

    const titleRow = document.createElement('div');
    titleRow.className = 'musou-cutin-title-row';

    const titleEl = document.createElement('div');
    titleEl.className = 'musou-cutin-title';
    const moveText = move?.name || unit?.title || '無雙奧義';
    const charCount = Array.from(moveText).length;
    if (charCount >= 11) titleEl.classList.add('is-long');
    const charDelay = Math.max(24, Math.min(60, Math.round((560 * scale) / Math.max(1, charCount))));
    if (reduced) {
      titleEl.textContent = moveText;
    } else {
      titleEl.appendChild(buildCharSpans(moveText, charDelay));
    }

    const seal = document.createElement('span');
    seal.className = 'musou-cutin-seal';
    seal.textContent = pal.icon;
    seal.style.animationDelay = `${Math.round(900 * scale)}ms`;

    titleRow.appendChild(titleEl);
    titleRow.appendChild(seal);

    const subEl = document.createElement('div');
    subEl.className = 'musou-cutin-sub';
    const sideLabel = side === 'B' ? '敵將無雙' : '我軍無雙';
    subEl.textContent = `${sideLabel}｜${unit?.name || uid}・${move?.tag || '名將奧義'}`;

    textCol.appendChild(titleRow);
    textCol.appendChild(subEl);

    if (side === 'B') {
      inner.appendChild(textCol);
      inner.appendChild(portraitWrap);
    } else {
      inner.appendChild(portraitWrap);
      inner.appendChild(textCol);
    }

    band.appendChild(inner);
    overlay.appendChild(vignette);
    overlay.appendChild(band);
    overlay.appendChild(flash);

    const finishNow = () => {
      if (activeItem !== item) return;
      clearTimers();
      overlay.remove();
      unfreezeEngine();
      activeItem = null;
      resolve();
      pumpQueue();
    };

    overlay.addEventListener('click', finishNow);
    wrapper.appendChild(overlay);

    // 觸發進場狀態
    requestAnimationFrame(() => {
      if (activeItem !== item) return;
      overlay.classList.add('is-enter');
    });

    if (!reduced) {
      // 1100ms (scaled) 開始斜向擦除退場 + 閃光
      const exitAt = Math.round(1100 * scale);
      activeTimers.push(setTimeout(() => {
        if (activeItem !== item) return;
        overlay.classList.add('is-exit');
      }, exitAt));
    }

    activeTimers.push(setTimeout(finishNow, duration));
  }

  function pumpQueue() {
    if (activeItem || !queue.length) return;
    const next = queue.shift();
    runItem(next);
  }

  function play({ uid, side = 'A', fxKey = 'overlord_cleave', tempo = 1, focusToken = null } = {}) {
    if (!uid || mode === 'off') return Promise.resolve();
    if (playedThisBattle.has(uid)) return Promise.resolve();
    // 檢查 app.js 全域 skip
    const btnSkip = document.getElementById('btnSkip');
    if (btnSkip && btnSkip.disabled) return Promise.resolve();

    playedThisBattle.add(uid);
    return new Promise(resolve => {
      const queuePos = (activeItem ? 1 : 0) + queue.length;
      queue.push({ uid, side, fxKey, tempo, focusToken, queuePos, resolve });
      pumpQueue();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      syncModeButton();
      const btn = document.getElementById('btnBattleMusou');
      if (btn) btn.addEventListener('click', cycleMode);
      const skipBtn = document.getElementById('btnSkip');
      if (skipBtn) skipBtn.addEventListener('click', clearAll);
    });
  }

  window.MusouCutin = {
    play,
    clearAll,
    resetBattle,
    isPlaying,
    getMode,
    setMode,
    cycleMode,
    syncModeButton
  };
})();
