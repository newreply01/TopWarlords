'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   Level 1 無雙側邊切入演出模組 (musou-cutin.js)
   於戰場左／右側邊緣呈現，保留中央 3D 戰場視野
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

  let activeBySide = { A: null, B: null };
  let playStats = new Map(); // uid -> { count, lastAt }
  const MAX_CUTINS_PER_UNIT = 3;
  const CUTIN_UNIT_COOLDOWN_MS = 2500;

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
    return Boolean(activeBySide.A || activeBySide.B);
  }

  function resetBattle() {
    playStats.clear();
    clearAll();
  }

  function removeSideDom(sideKey) {
    document.querySelectorAll(`.musou-cutin-card.side-${sideKey.toLowerCase()}`).forEach(el => el.remove());
  }

  function clearSide(sideKey) {
    const cur = activeBySide[sideKey];
    if (cur) {
      cur.timers.forEach(t => clearTimeout(t));
      cur.timers = [];
      cur.el?.remove();
      activeBySide[sideKey] = null;
      cur.resolve?.();
    } else {
      removeSideDom(sideKey);
    }
  }

  function clearAll() {
    clearSide('A');
    clearSide('B');
    document.querySelectorAll('.musou-cutin-overlay, .musou-cutin-card').forEach(el => el.remove());
    try {
      window.Battle3DEngine?.setCutinFreeze?.(false, null);
    } catch (_) {}
  }

  function computeDurationMs(tempo = 1, activeCount = 0) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { total: 900, lead: 200 };
    }
    let total = (mode === 'lite' || activeCount >= 2) ? 1600 : 2400;
    let lead = (mode === 'lite' || activeCount >= 2) ? 260 : 420;
    if (tempo >= 3) {
      total = Math.min(total, 1300);
      lead = Math.min(lead, 220);
    } else if (tempo >= 2) {
      total = Math.min(total, 1750);
      lead = Math.min(lead, 300);
    }
    return { total, lead };
  }

  function computeSideTopPx(wrapper) {
    const wrapRect = wrapper.getBoundingClientRect();
    let minTop = 48;
    const selectors = ['#battleSkillTickerA', '#battleSkillTickerB', '.battle-3d-overlay-hud', '#holoRadarStrip', '.log-header-hud'];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const inTopHalf = r.bottom > wrapRect.top && r.top < wrapRect.top + wrapRect.height * 0.55;
      if (inTopHalf) {
        minTop = Math.max(minTop, Math.round(r.bottom - wrapRect.top + 8));
      }
    });
    const maxTop = Math.max(48, Math.round(wrapRect.height - 132));
    return Math.min(minTop, maxTop);
  }

  function buildCharSpans(text, charDelayMs) {
    const frag = document.createDocumentFragment();
    Array.from(text || '').forEach((ch, idx) => {
      const span = document.createElement('span');
      span.className = 'musou-cutin-char';
      span.textContent = ch;
      span.style.animationDelay = `${Math.round(idx * charDelayMs)}ms`;
      frag.appendChild(span);
    });
    return frag;
  }

  function runItem(item) {
    const { uid, side = 'A', fxKey = 'overlord_cleave', tempo = 1, focusToken = null, activeCount = 0, resolve } = item;
    const sideKey = side === 'B' ? 'B' : 'A';
    const wrapper = document.getElementById('battle3DWrapper');
    if (!wrapper || mode === 'off') {
      resolve();
      return;
    }

    if (activeBySide[sideKey]) clearSide(sideKey);

    const unit = (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[uid]) ? UNIT_MAP[uid] : null;
    const meta = (typeof UNIT_META !== 'undefined' && UNIT_META[uid]) ? UNIT_META[uid] : null;
    const move = (typeof getMusouMove === 'function') ? getMusouMove(uid) : null;
    const pal = ARCHETYPE_PALETTES[fxKey] || ARCHETYPE_PALETTES.overlord_cleave;

    const { total, lead } = computeDurationMs(tempo, activeCount);
    const scale = total / 1500;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    try {
      window.Battle3DEngine?.setCutinFreeze?.(true, focusToken);
      if (window.SoundEngine?.playSkillActivation) {
        window.SoundEngine.playSkillActivation(fxKey, sideKey, meta?.sfx);
      } else if (meta?.sfx) {
        window.SoundEngine?.play?.(meta.sfx, sideKey);
      }
    } catch (_) {}

    const card = document.createElement('div');
    card.className = `musou-cutin-card side-${sideKey.toLowerCase()}${reduced ? ' is-reduced' : ''}${isLight ? ' is-light' : ''}`;
    card.style.top = `${computeSideTopPx(wrapper)}px`;
    card.style.setProperty('--musou-primary', pal.primary);
    card.style.setProperty('--musou-accent', pal.accent);
    card.style.setProperty('--musou-dark', pal.dark);
    card.style.setProperty('--musou-border', isLight ? '#f59e0b' : pal.border);

    const speedlines = document.createElement('div');
    speedlines.className = 'musou-cutin-speedlines';
    card.appendChild(speedlines);

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

    const textCol = document.createElement('div');
    textCol.className = 'musou-cutin-text';

    const subEl = document.createElement('div');
    subEl.className = 'musou-cutin-sub';
    const sideLabel = sideKey === 'B' ? '敵將無雙' : '我軍無雙';
    subEl.textContent = `${sideLabel} · ${unit?.name || uid}｜${move?.tag || '名將奧義'}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'musou-cutin-title-row';

    const titleEl = document.createElement('div');
    titleEl.className = 'musou-cutin-title';
    const moveText = move?.name || unit?.title || '無雙奧義';
    const charCount = Array.from(moveText).length;
    if (charCount >= 11) titleEl.classList.add('is-long');
    const charDelay = Math.max(18, Math.min(45, Math.round((420 * scale) / Math.max(1, charCount))));
    if (reduced) {
      titleEl.textContent = moveText;
    } else {
      titleEl.appendChild(buildCharSpans(moveText, charDelay));
    }

    const seal = document.createElement('span');
    seal.className = 'musou-cutin-seal';
    seal.textContent = pal.icon;
    seal.style.animationDelay = `${Math.round(480 * scale)}ms`;

    titleRow.appendChild(titleEl);
    titleRow.appendChild(seal);
    textCol.appendChild(subEl);
    textCol.appendChild(titleRow);

    if (sideKey === 'B') {
      inner.appendChild(textCol);
      inner.appendChild(portraitWrap);
    } else {
      inner.appendChild(portraitWrap);
      inner.appendChild(textCol);
    }
    card.appendChild(inner);

    const state = { el: card, timers: [], resolve, resolved: false };
    activeBySide[sideKey] = state;

    const resolveLead = () => {
      if (state.resolved) return;
      state.resolved = true;
      try {
        window.Battle3DEngine?.setCutinFreeze?.(false, null);
      } catch (_) {}
      resolve();
    };

    const finishCard = () => {
      state.timers.forEach(t => clearTimeout(t));
      state.timers = [];
      card.remove();
      if (activeBySide[sideKey] === state) activeBySide[sideKey] = null;
      resolveLead();
    };

    card.addEventListener('click', finishCard);
    wrapper.appendChild(card);

    requestAnimationFrame(() => {
      if (activeBySide[sideKey] !== state) return;
      card.classList.add('is-enter');
    });

    state.timers.push(setTimeout(resolveLead, lead));

    if (!reduced) {
      state.timers.push(setTimeout(() => {
        if (activeBySide[sideKey] !== state) return;
        card.classList.add('is-exit');
      }, Math.max(lead + 200, total - 320)));
    }

    state.timers.push(setTimeout(finishCard, total));
  }

  function play({ uid, side = 'A', fxKey = 'overlord_cleave', tempo = 1, focusToken = null, cooldownKey = null } = {}) {
    if (!uid || mode === 'off') return Promise.resolve();
    const now = performance.now();
    const statKey = cooldownKey || `${side}:${uid}`;
    const st = playStats.get(statKey) || { count: 0, lastAt: 0 };
    if (st.count >= MAX_CUTINS_PER_UNIT) return Promise.resolve();
    if (st.lastAt > 0 && now - st.lastAt < CUTIN_UNIT_COOLDOWN_MS) return Promise.resolve();
    const btnSkip = document.getElementById('btnSkip');
    if (btnSkip && btnSkip.disabled) return Promise.resolve();

    playStats.set(statKey, { count: st.count + 1, lastAt: now });
    return new Promise(resolve => {
      const activeCount = (activeBySide.A ? 1 : 0) + (activeBySide.B ? 1 : 0);
      runItem({ uid, side, fxKey, tempo, focusToken, activeCount, resolve });
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
