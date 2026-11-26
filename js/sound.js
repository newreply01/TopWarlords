'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 古戰場真實錄音聲學與動態配樂引擎 v7.0 (js/sound.js)
   採用免版稅真實樂器與冷兵器錄音取樣 (太鼓、號角、戰馬奔馳、刀劍交擊、弓弩齊射、銅鑼、古箏交響配樂)
   支援左右陣營立體聲定位、多取樣輪替防機械感、戶外山谷空間殘響與平滑 BGM 交叉淡入淡出
   ===================================================== */
(function () {
  const AUDIO_VER = '7.15.2';
  const BASE_PATH = 'assets/audio/';

  const CLIP_MANIFEST = {
    bgm_prep: `${BASE_PATH}bgm_prep.mp3?v=${AUDIO_VER}`,
    bgm_battle: `${BASE_PATH}bgm_battle.mp3?v=${AUDIO_VER}`,
    war_drum: `${BASE_PATH}war_drum.mp3?v=${AUDIO_VER}`,
    war_horn: `${BASE_PATH}war_horn.mp3?v=${AUDIO_VER}`,
    cavalry_charge: `${BASE_PATH}cavalry_charge.mp3?v=${AUDIO_VER}`,
    cavalry_hooves: `${BASE_PATH}cavalry_hooves.mp3?v=${AUDIO_VER}`,
    blade_clash_1: `${BASE_PATH}blade_clash_1.mp3?v=${AUDIO_VER}`,
    blade_clash_2: `${BASE_PATH}blade_clash_2.mp3?v=${AUDIO_VER}`,
    blade_clash_3: `${BASE_PATH}blade_clash_3.mp3?v=${AUDIO_VER}`,
    heavy_strike: `${BASE_PATH}heavy_strike.mp3?v=${AUDIO_VER}`,
    shield_block: `${BASE_PATH}shield_block.mp3?v=${AUDIO_VER}`,
    arrow_volley: `${BASE_PATH}arrow_volley.mp3?v=${AUDIO_VER}`,
    fire_attack: `${BASE_PATH}fire_attack.mp3?v=${AUDIO_VER}`,
    strategy_gong: `${BASE_PATH}strategy_gong.mp3?v=${AUDIO_VER}`,
    warlord_fall: `${BASE_PATH}warlord_fall.mp3?v=${AUDIO_VER}`,
    ui_click: `${BASE_PATH}ui_click.mp3?v=${AUDIO_VER}`,
    equip: `${BASE_PATH}equip.mp3?v=${AUDIO_VER}`,
    victory: `${BASE_PATH}victory.mp3?v=${AUDIO_VER}`,
    defeat: `${BASE_PATH}defeat.mp3?v=${AUDIO_VER}`
  };

  // 先載入戰場核心音效；長篇 BGM 採按需延遲載入，預設靜音時不浪費 1.64MB 流量
  const SFX_KEYS = [
    'ui_click', 'equip', 'war_drum', 'war_horn',
    'blade_clash_1', 'blade_clash_2', 'blade_clash_3', 'heavy_strike',
    'shield_block', 'cavalry_charge', 'cavalry_hooves', 'arrow_volley',
    'fire_attack', 'strategy_gong', 'warlord_fall', 'victory', 'defeat'
  ];
  const BGM_KEYS = ['bgm_battle', 'bgm_prep'];
  const PRIORITY_KEYS = SFX_KEYS.concat(BGM_KEYS);

  // 8 大無雙技能流派：全數採用真實樂器與冷兵器錄音（單一清脆起手音 + 3D 爆發實音，無合成音色）
  const SKILL_AUDIO_PROFILES = {
    fire_storm:      { open: 'fire_attack',    impact: 'heavy_strike' },
    thunder_strike:  { open: 'cavalry_charge', impact: 'heavy_strike' },
    bagua_array:     { open: 'strategy_gong',  impact: 'war_drum' },
    overlord_cleave: { open: 'blade_clash_2',  impact: 'heavy_strike' },
    piercing_volley: { open: 'arrow_volley',   impact: 'heavy_strike' },
    tidal_surge:     { open: 'war_horn',       impact: 'war_drum' },
    aegis_command:   { open: 'shield_block',   impact: 'war_drum' },
    shadow_ambush:   { open: 'blade_clash_1',  impact: 'blade_clash_3' }
  };

  function readSoundPref() {
    try {
      if (window.LS && typeof window.LS.get === 'function') {
        const wl = window.LS.get('wl15_sound', null);
        return wl !== null && wl !== undefined ? Boolean(wl) : true;
      }
      const rawWl = localStorage.getItem('wl15_sound');
      return rawWl !== null ? Boolean(JSON.parse(rawWl)) : true;
    } catch (e) {
      return true;
    }
  }

  function writeSoundPref(val) {
    try {
      if (window.LS && typeof window.LS.set === 'function') {
        window.LS.set('wl15_sound', val);
      } else {
        localStorage.setItem('wl15_sound', JSON.stringify(val));
      }
    } catch (e) { }
  }

  function readBgmPref() {
    try {
      if (window.LS && typeof window.LS.get === 'function') {
        const wl = window.LS.get('wl15_bgm', null);
        return wl !== null && wl !== undefined ? Boolean(wl) : false;
      }
      const raw = localStorage.getItem('wl15_bgm');
      return raw !== null ? Boolean(JSON.parse(raw)) : false;
    } catch (e) {
      return false;
    }
  }

  function writeBgmPref(val) {
    try {
      if (window.LS && typeof window.LS.set === 'function') {
        window.LS.set('wl15_bgm', val);
      } else {
        localStorage.setItem('wl15_bgm', JSON.stringify(val));
      }
    } catch (e) { }
  }

  function readVolPref(key, fallback) {
    try {
      const raw = (window.LS && typeof window.LS.get === 'function')
        ? window.LS.get(key, null)
        : localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      const num = typeof raw === 'number' ? raw : Number(JSON.parse(raw));
      return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeVolPref(key, val) {
    try {
      const clamped = Math.max(0, Math.min(1, Number(val)));
      if (window.LS && typeof window.LS.set === 'function') {
        window.LS.set(key, clamped);
      } else {
        localStorage.setItem(key, JSON.stringify(clamped));
      }
    } catch (_) { }
  }

  const SoundEngine = {
    ctx: null,
    masterGain: null,
    masterComp: null,
    sfxBus: null,
    bgmBus: null,
    reverbNode: null,
    reverbSend: null,
    rawArrayBuffers: {},
    buffers: {},
    loadingPromises: {},
    lastPlayAt: {},
    bladeCursor: 0,
    currentBgmMode: null,
    currentBgmNode: null,
    currentBgmGain: null,
    unlocked: false,
    spatialSources: new Set(),
    finaleNodes: new Set(),
    _cheerNoiseBuffer: null,
    enabled: readSoundPref(),
    bgmEnabled: readBgmPref(),
    sfxVolume: readVolPref('wl15_sfx_vol', 0.95),
    bgmVolume: readVolPref('wl15_bgm_vol', 0.32),

    _fetchKeys(keys) {
      keys.forEach((key) => {
        if (this.loadingPromises[key]) return;
        const url = CLIP_MANIFEST[key];
        if (!url || typeof fetch !== 'function') return;
        this.loadingPromises[key] = fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            return res.arrayBuffer();
          })
          .then((ab) => {
            this.rawArrayBuffers[key] = ab;
            if (this.ctx) return this._decodeKey(key);
            return null;
          })
          .catch(() => null);
      });
    },

    // 預先抓取真實 SFX 音效檔；僅在 BGM 已開啟時才下載 1.64MB 背景音樂
    prefetchAll() {
      this._fetchKeys(this.bgmEnabled ? PRIORITY_KEYS : SFX_KEYS);
    },

    prefetchBgm() {
      this._fetchKeys(BGM_KEYS);
    },

    _decodeKey(key) {
      if (this.buffers[key]) return Promise.resolve(this.buffers[key]);
      const ab = this.rawArrayBuffers[key];
      if (!ab || !this.ctx) return Promise.resolve(null);
      // 複製一份 ArrayBuffer 避免 decodeAudioData detach 後無法重試
      const copy = ab.slice(0);
      return new Promise((resolve) => {
        this.ctx.decodeAudioData(
          copy,
          (audioBuf) => {
            this.buffers[key] = audioBuf;
            if (
              this.enabled && this.bgmEnabled &&
              ((key === 'bgm_prep' && this.currentBgmMode === 'prep' && !this.currentBgmNode) ||
                (key === 'bgm_battle' && this.currentBgmMode === 'battle' && !this.currentBgmNode))
            ) {
              this._startBgmSource(this.currentBgmMode);
            }
            resolve(audioBuf);
          },
          () => resolve(null)
        );
      });
    },

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        const now = this.ctx.currentTime;
        const sr = this.ctx.sampleRate;

        // 總輸出音量與母帶動態壓限器
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? 0.92 : 0.0001, now);

        this.masterComp = this.ctx.createDynamicsCompressor();
        this.masterComp.threshold.setValueAtTime(-10, now);
        this.masterComp.knee.setValueAtTime(14, now);
        this.masterComp.ratio.setValueAtTime(6, now);
        this.masterComp.attack.setValueAtTime(0.003, now);
        this.masterComp.release.setValueAtTime(0.2, now);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.setValueAtTime(this.sfxVolume, now);

        this.bgmBus = this.ctx.createGain();
        this.bgmBus.gain.setValueAtTime(this.bgmVolume, now);

        // 0.95 秒自然山谷戰場空間殘響 (Warm Outdoor Valley Reverb)
        const irLen = Math.floor(sr * 0.95);
        const irBuf = this.ctx.createBuffer(2, irLen, sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = irBuf.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < irLen; i++) {
            const tSec = i / sr;
            const early = (Math.abs(tSec - 0.022) < 0.003 || Math.abs(tSec - 0.054) < 0.004) ? 0.45 : 0;
            const env = Math.exp(-tSec * 4.6) + early;
            const raw = (Math.random() * 2 - 1) * env;
            lp += 0.22 * (raw - lp);
            d[i] = lp * 0.5;
          }
        }
        this.reverbNode = this.ctx.createConvolver();
        this.reverbNode.buffer = irBuf;
        this.reverbSend = this.ctx.createGain();
        this.reverbSend.gain.setValueAtTime(0.18, now);

        this.sfxBus.connect(this.masterComp);
        this.sfxBus.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbSend);
        this.reverbSend.connect(this.masterComp);
        this.bgmBus.connect(this.masterComp);
        this.masterComp.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        // 解碼所有已下載完成的音訊
        Object.keys(this.rawArrayBuffers).forEach((k) => this._decodeKey(k));
        this.prefetchAll();
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.unlocked = true;
          if (this.enabled && this.bgmEnabled && this.currentBgmMode && !this.currentBgmNode) {
            this._startBgmSource(this.currentBgmMode);
          }
        }).catch(() => { });
      } else if (this.ctx && this.ctx.state === 'running') {
        this.unlocked = true;
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      const ico = document.querySelector('#audioIcon');
      const btn = document.querySelector('#btnAudio');
      if (ico) ico.textContent = this.enabled ? '🔊' : '🔇';
      if (btn) btn.title = this.enabled ? '古戰場音效與配樂已開啟' : '古戰場音效已靜音';
      if (typeof window.toast === 'function') {
        window.toast(this.enabled ? '🔊 古戰場音效與配樂已開啟' : '🔇 戰場音效已靜音');
      }
      writeSoundPref(this.enabled);

      if (this.enabled) {
        this.init();
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setTargetAtTime(0.92, this.ctx.currentTime, 0.04);
        }
        if (this.bgmEnabled && this.currentBgmMode && !this.currentBgmNode) {
          this._startBgmSource(this.currentBgmMode);
        }
      } else {
        this.stopSpatial();
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
        }
      }
    },

    syncBgmButton() {
      const btn = document.querySelector('#btnBgm');
      const ico = document.querySelector('#bgmIcon');
      if (btn) {
        btn.setAttribute('aria-pressed', String(this.bgmEnabled));
        btn.classList.toggle('is-muted', !this.bgmEnabled);
        btn.title = this.bgmEnabled ? '背景音樂已開啟（點擊關閉）' : '背景音樂已關閉（點擊開啟）';
      }
      if (ico) ico.textContent = this.bgmEnabled ? '🎵' : '🔇';
    },

    getVolumes() {
      return { sfx: this.sfxVolume, bgm: this.bgmVolume };
    },

    setSfxVolume(val) {
      const v = Math.max(0, Math.min(1, Number(val)));
      if (!Number.isFinite(v)) return this.sfxVolume;
      this.sfxVolume = v;
      writeVolPref('wl15_sfx_vol', v);
      if (this.sfxBus && this.ctx) {
        this.sfxBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
      }
      return v;
    },

    setBgmVolume(val) {
      const v = Math.max(0, Math.min(1, Number(val)));
      if (!Number.isFinite(v)) return this.bgmVolume;
      this.bgmVolume = v;
      writeVolPref('wl15_bgm_vol', v);
      if (this.bgmBus && this.ctx) {
        this.bgmBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
      }
      return v;
    },

    toggleBgm() {
      this.bgmEnabled = !this.bgmEnabled;
      writeBgmPref(this.bgmEnabled);
      this.syncBgmButton();
      if (typeof window.toast === 'function') {
        window.toast(this.bgmEnabled ? '🎵 背景音樂已開啟' : '🔇 背景音樂已關閉');
      }
      if (this.bgmEnabled) {
        this.init();
        this.prefetchBgm();
        if (this.enabled) {
          this._startBgmSource(this.currentBgmMode || 'prep');
        }
      } else {
        const savedMode = this.currentBgmMode;
        this.stopBgm(0.35);
        this.currentBgmMode = savedMode;
      }
      return this.bgmEnabled;
    },

    isMuted() {
      return !this.enabled;
    },

    getStats() {
      const total = PRIORITY_KEYS.length;
      const decoded = Object.keys(this.buffers).length;
      const fetched = Object.keys(this.rawArrayBuffers).length;
      return { total, fetched, decoded, state: this.ctx ? this.ctx.state : 'uninitialized', bgm: this.currentBgmMode };
    },

    // 切換古戰場動態配樂 ('prep': 議事點將古箏交響 | 'battle': 兩軍交鋒戰鼓管弦)
    playBgm(mode = 'prep') {
      const normalized = mode === 'battle' ? 'battle' : 'prep';
      if (this.currentBgmMode === normalized && this.currentBgmNode) return;
      this.currentBgmMode = normalized;
      if (!this.enabled || !this.bgmEnabled) return;
      this.init();
      this._startBgmSource(normalized);
    },

    stopBgm(fadeSec = 0.6) {
      this.currentBgmMode = null;
      if (this.currentBgmNode && this.currentBgmGain && this.ctx) {
        const now = this.ctx.currentTime;
        const oldNode = this.currentBgmNode;
        const oldGain = this.currentBgmGain;
        this.currentBgmNode = null;
        this.currentBgmGain = null;
        try {
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
          oldGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
          oldNode.stop(now + fadeSec + 0.05);
        } catch (e) { }
      }
    },

    _startBgmSource(mode) {
      if (!this.ctx || !this.enabled || !this.bgmEnabled) return;
      const clipKey = mode === 'battle' ? 'bgm_battle' : 'bgm_prep';
      const buf = this.buffers[clipKey];
      if (!buf) {
        this.prefetchBgm();
        return;
      }

      const now = this.ctx.currentTime;
      // 淡出舊 BGM
      if (this.currentBgmNode && this.currentBgmGain) {
        const prevNode = this.currentBgmNode;
        const prevGain = this.currentBgmGain;
        try {
          prevGain.gain.cancelScheduledValues(now);
          prevGain.gain.setValueAtTime(Math.max(0.0001, prevGain.gain.value), now);
          prevGain.gain.linearRampToValueAtTime(0.0001, now + 0.85);
          prevNode.stop(now + 0.9);
        } catch (e) { }
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const g = this.ctx.createGain();
      const targetVol = mode === 'battle' ? 0.92 : 0.72;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(targetVol, now + 1.1);

      src.connect(g);
      g.connect(this.bgmBus);
      try {
        src.start(now);
        this.currentBgmNode = src;
        this.currentBgmGain = g;
      } catch (e) { }
    },

    _duckBgm(duckGain = 0.12, holdSec = 2.4) {
      if (!this.bgmBus || !this.ctx) return;
      const now = this.ctx.currentTime;
      const restGain = this.bgmVolume ?? 0.32;
      this.bgmBus.gain.cancelScheduledValues(now);
      this.bgmBus.gain.setTargetAtTime(Math.min(duckGain, restGain), now, 0.06);
      this.bgmBus.gain.setTargetAtTime(restGain, now + holdSec, 0.45);
    },

    // 將遊戲內各事件名稱映射至真實錄音取樣池與混音參數
    _resolveEvent(type) {
      switch (type) {
        case 'click':
        case 'select':
        case 'hover':
          return { key: 'ui_click', gain: 0.55, rateJitter: 0.05, minGapMs: 28, panScale: 0.0 };

        case 'equip':
        case 'shuffle':
        case 'clear':
          return { key: 'equip', gain: 0.72, rateJitter: 0.05, minGapMs: 45, panScale: 0.0 };

        case 'battleStart':
        case 'horn':
        case 'war_horn':
          return { key: 'war_horn', layer: 'war_drum', gain: 0.88, rateJitter: 0.02, minGapMs: 250, panScale: 0.0, duck: true };

        case 'war_drum':
        case 'vanguard':
          return { key: 'war_drum', layer: 'blade_clash_2', layerDelay: 0.08, layerGain: 0.55, gain: 0.84, rateJitter: 0.06, minGapMs: 65, panScale: 1.0 };

        case 'cavalry_charge':
        case 'cavalry':
          return { key: 'cavalry_charge', layer: 'heavy_strike', layerDelay: 0.14, layerGain: 0.55, gain: 0.88, rateJitter: 0.06, minGapMs: 75, panScale: 1.0 };

        case 'cavalry_hooves':
          return { key: 'cavalry_hooves', gain: 0.72, rateJitter: 0.06, minGapMs: 70, panScale: 1.0 };

        case 'blade_clash':
        case 'metal_clash':
        case 'melee':
        case 'blade': {
          this.bladeCursor = (this.bladeCursor + 1) % 4;
          const variants = ['blade_clash_1', 'blade_clash_2', 'blade_clash_3', 'heavy_strike'];
          return { key: variants[this.bladeCursor], gain: 0.85, rateJitter: 0.08, minGapMs: 42, panScale: 1.0 };
        }

        case 'heavy_strike':
        case 'heavy':
          return { key: 'heavy_strike', gain: 0.92, rateJitter: 0.06, minGapMs: 55, panScale: 1.0 };

        case 'shield_block':
        case 'block':
          return { key: 'shield_block', gain: 0.86, rateJitter: 0.06, minGapMs: 45, panScale: 1.0 };

        case 'arrow_volley':
        case 'arrow':
        case 'machinegun':
          return { key: 'arrow_volley', gain: 0.86, rateJitter: 0.07, minGapMs: 60, panScale: 1.0 };

        case 'fire_attack':
        case 'fire':
        case 'cannon':
        case 'missile':
        case 'explode':
        case 'torpedo':
          return { key: 'fire_attack', gain: 0.88, rateJitter: 0.06, minGapMs: 75, panScale: 1.0 };

        case 'strategy_gong':
        case 'strategy':
        case 'emp_pulse':
        case 'ew':
        case 'radar':
          return { key: 'strategy_gong', gain: 0.78, rateJitter: 0.04, minGapMs: 90, panScale: 0.7 };

        case 'warlord_fall':
        case 'fall':
        case 'kill':
          return { key: 'warlord_fall', gain: 0.95, rateJitter: 0.04, minGapMs: 90, panScale: 0.85 };

        case 'victory':
        case 'win':
          return { key: 'victory', gain: 0.95, rateJitter: 0.0, minGapMs: 400, panScale: 0.0, duck: true };

        case 'defeat':
        case 'lose':
          return { key: 'defeat', gain: 0.90, rateJitter: 0.0, minGapMs: 400, panScale: 0.0, duck: true };

        default:
          return { key: 'blade_clash_1', gain: 0.78, rateJitter: 0.06, minGapMs: 50, panScale: 0.8 };
      }
    },

    _triggerBuffer(clipKey, { side = 'A', gain = 0.85, rateJitter = 0.05, delay = 0, panScale = 1.0, pan = null, distance = 0, spatial = false, finale = false }) {
      const buf = this.buffers[clipKey];
      if (!buf || !this.ctx) return false;

      const now = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const rate = 1.0 + (Math.random() * 2 - 1) * rateJitter;
      src.playbackRate.setValueAtTime(Math.max(0.82, Math.min(1.18, rate)), now);

      const g = this.ctx.createGain();
      const gJit = gain * (0.94 + Math.random() * 0.12) / (1 + Math.max(0, distance - 8) * 0.07);
      g.gain.setValueAtTime(gJit, now);

      let filter = null;
      if (distance > 0) {
        filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.max(1600, 15000 / (1 + distance * 0.12)), now);
        src.connect(filter);
        filter.connect(g);
      } else {
        src.connect(g);
      }
      let panner = null;
      if (this.ctx.createStereoPanner && panScale > 0) {
        panner = this.ctx.createStereoPanner();
        const basePan = side === 'A' ? -0.32 : (side === 'B' ? 0.32 : 0);
        panner.pan.setValueAtTime(pan === null ? basePan * panScale + (Math.random() * 0.08 - 0.04) : pan, now);
        g.connect(panner);
        panner.connect(this.sfxBus);
      } else {
        g.connect(this.sfxBus);
      }

      src.onended = () => {
        this.spatialSources.delete(src);
        this.finaleNodes.delete(src);
        src.disconnect();
        if (filter) filter.disconnect();
        g.disconnect();
        if (panner) panner.disconnect();
      };
      src.start(now);
      if (spatial) this.spatialSources.add(src);
      if (finale) this.finaleNodes.add(src);
      return true;
    },

    stopSpatial() {
      this.spatialSources.forEach(source => source.stop());
      this.spatialSources.clear();
    },

    stopFinale() {
      this.finaleNodes.forEach(node => {
        try { node.stop(); } catch (_) {}
        try { node.disconnect(); } catch (_) {}
      });
      this.finaleNodes.clear();
    },

    _getCheerNoiseBuffer() {
      if (this._cheerNoiseBuffer) return this._cheerNoiseBuffer;
      if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
      const sr = this.ctx.sampleRate || 44100;
      const durSec = 1.35;
      const len = Math.max(1, Math.floor(sr * durSec));
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = typeof buf.getChannelData === 'function' ? buf.getChannelData(0) : null;
      if (data) {
        let lp = 0;
        let b0 = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          // 結合 1/f 粉紅噪聲與多頻胸腔吶喊調變，模擬千軍齊呼的厚實聲浪
          const white = Math.random() * 2 - 1;
          b0 = 0.94 * b0 + white * 0.18;
          lp = 0.72 * lp + b0 * 0.28;
          const mod = 0.72 + 0.16 * Math.sin(t * 2 * Math.PI * 17.5) + 0.12 * Math.sin(t * 2 * Math.PI * 31.0 + 1.1);
          data[i] = Math.max(-1, Math.min(1, lp * 2.1 * mod));
        }
      }
      this._cheerNoiseBuffer = buf;
      return buf;
    },

    _triggerCrowdCheerWave({ delay = 0, duration = 1.15, gain = 0.44, pan = 0, lowpassHz = 2600 } = {}) {
      const noiseBuf = this._getCheerNoiseBuffer();
      if (!noiseBuf || !this.ctx || !this.sfxBus) return false;
      const t0 = this.ctx.currentTime + Math.max(0, delay);
      const dur = Math.max(0.4, Math.min(1.28, duration));
      const tEnd = t0 + dur;

      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = false;
      if (src.playbackRate?.setValueAtTime) {
        src.playbackRate.setValueAtTime(0.95 + Math.random() * 0.10, t0);
      }

      // 雙人聲共振峰 (胸聲 580Hz + 吼聲 1180Hz) + 低通柔化，避免乾澀白噪
      const formantA = this.ctx.createBiquadFilter();
      formantA.type = 'bandpass';
      formantA.frequency?.setValueAtTime?.(560 + Math.random() * 60, t0);
      formantA.Q?.setValueAtTime?.(2.2, t0);

      const formantB = this.ctx.createBiquadFilter();
      formantB.type = 'bandpass';
      formantB.frequency?.setValueAtTime?.(1160 + Math.random() * 110, t0);
      formantB.Q?.setValueAtTime?.(3.0, t0);

      const lpFilter = this.ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency?.setValueAtTime?.(lowpassHz, t0);

      const mixGainA = this.ctx.createGain();
      mixGainA.gain?.setValueAtTime?.(0.95, t0);
      const mixGainB = this.ctx.createGain();
      mixGainB.gain?.setValueAtTime?.(0.55, t0);

      const env = this.ctx.createGain();
      const setEnv = (method, v, t) => {
        if (typeof env.gain?.[method] === 'function') env.gain[method](v, t);
        else env.gain?.setValueAtTime?.(v, t);
      };
      env.gain?.setValueAtTime?.(0.0001, t0);
      setEnv('linearRampToValueAtTime', gain, t0 + Math.min(0.22, dur * 0.25));
      setEnv('linearRampToValueAtTime', gain * 0.86, t0 + dur * 0.68);
      setEnv('linearRampToValueAtTime', 0.0001, tEnd);

      let panner = null;
      if (typeof this.ctx.createStereoPanner === 'function') {
        panner = this.ctx.createStereoPanner();
        panner.pan?.setValueAtTime?.(Math.max(-1, Math.min(1, pan)), t0);
      }

      src.connect(formantA);
      src.connect(formantB);
      formantA.connect(mixGainA);
      formantB.connect(mixGainB);
      mixGainA.connect(lpFilter);
      mixGainB.connect(lpFilter);
      lpFilter.connect(env);
      if (panner) {
        env.connect(panner);
        panner.connect(this.sfxBus);
      } else {
        env.connect(this.sfxBus);
      }

      const nodesList = [src, formantA, formantB, lpFilter, mixGainA, mixGainB, env, panner].filter(Boolean);
      src.onended = () => {
        this.finaleNodes.delete(src);
        nodesList.forEach(n => {
          try { n.disconnect(); } catch (_) {}
        });
      };
      this.finaleNodes.add(src);
      src.start(t0);
      return true;
    },

    playBattleFinale(outcome = 'victory', winnerSide = 'A') {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      this.stopFinale();

      const scheduleClip = (key, opts) => {
        this._triggerBuffer(key, { ...opts, finale: true });
      };

      try {
        if (outcome === 'victory') {
          this._duckBgm(0.10, 3.4);
          scheduleClip('war_horn', { side: winnerSide, gain: 0.86, rateJitter: 0.02, delay: 0.0, panScale: 0.35 });
          scheduleClip('war_drum', { side: winnerSide, gain: 0.90, rateJitter: 0.03, delay: 0.0, panScale: 0.25 });
          scheduleClip('victory', { side: winnerSide, gain: 0.95, rateJitter: 0.0, delay: 0.32, panScale: 0.0 });
          scheduleClip('war_drum', { side: 'A', gain: 0.66, rateJitter: 0.04, delay: 1.18, pan: -0.25, panScale: 1.0 });
          scheduleClip('war_drum', { side: 'B', gain: 0.66, rateJitter: 0.04, delay: 2.10, pan: 0.25, panScale: 1.0 });

          // 三波立體聲軍陣歡呼聲浪
          this._triggerCrowdCheerWave({ delay: 0.18, duration: 1.15, gain: 0.44, pan: -0.32, lowpassHz: 2650 });
          this._triggerCrowdCheerWave({ delay: 1.02, duration: 1.25, gain: 0.50, pan: 0.04, lowpassHz: 2800 });
          this._triggerCrowdCheerWave({ delay: 1.92, duration: 1.15, gain: 0.44, pan: 0.34, lowpassHz: 2650 });

          // 古代軍陣慶祝「叩盾齊呼」五連節奏
          [0.52, 0.92, 1.38, 1.84, 2.34].forEach((dSec, idx) => {
            scheduleClip('shield_block', {
              side: idx % 2 === 0 ? 'A' : 'B',
              gain: 0.34,
              rateJitter: 0.05,
              delay: dSec,
              pan: idx % 2 === 0 ? -0.35 : 0.35,
              panScale: 1.0
            });
          });
        } else if (outcome === 'defeat') {
          this._duckBgm(0.12, 3.2);
          scheduleClip('defeat', { side: 'B', gain: 0.90, rateJitter: 0.0, delay: 0.0, panScale: 0.0 });
          // 遠處敵陣低沉凱旋歡呼
          this._triggerCrowdCheerWave({ delay: 0.55, duration: 1.05, gain: 0.22, pan: 0.48, lowpassHz: 1350 });
          this._triggerCrowdCheerWave({ delay: 1.65, duration: 1.05, gain: 0.20, pan: 0.42, lowpassHz: 1300 });
        } else {
          this._duckBgm(0.15, 2.8);
          scheduleClip('strategy_gong', { side: 'A', gain: 0.85, rateJitter: 0.02, delay: 0.0, panScale: 0.0 });
          scheduleClip('war_horn', { side: 'B', gain: 0.65, rateJitter: 0.02, delay: 0.35, panScale: 0.0 });
        }
      } catch (_) {}
    },

    playSpatial(type, side, { distance, pan, gain = 1 }) {
      if (![distance, pan, gain].every(Number.isFinite) || distance < 0 || gain < 0) {
        throw new TypeError('Spatial sound requires finite non-negative distance/gain and finite pan');
      }
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const spec = this._resolveEvent(type);
      const now = performance.now();
      if (now - (this.lastPlayAt[spec.key] || 0) < (spec.minGapMs || 40)) return;
      this.lastPlayAt[spec.key] = now;
      return this._triggerBuffer(spec.key, {
        side, distance, pan: Math.max(-1, Math.min(1, pan)), gain: Math.min(1, gain) * spec.gain,
        rateJitter: spec.rateJitter, spatial: true
      });
    },

    play(type, side = 'A') {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      try {
        const spec = this._resolveEvent(type);
        const nowMs = performance.now();
        const prevMs = this.lastPlayAt[spec.key] || 0;
        if (nowMs - prevMs < (spec.minGapMs || 40)) return;
        this.lastPlayAt[spec.key] = nowMs;

        if (spec.duck) this._duckBgm(0.10, 2.8);

        const ok = this._triggerBuffer(spec.key, {
          side,
          gain: spec.gain,
          rateJitter: spec.rateJitter,
          delay: 0,
          panScale: spec.panScale
        });

        if (ok && spec.layer) {
          this._triggerBuffer(spec.layer, {
            side,
            gain: spec.layerGain || 0.55,
            rateJitter: spec.rateJitter,
            delay: spec.layerDelay || 0.06,
            panScale: spec.panScale
          });
        }
      } catch (e) { }
    },

    /** 技能發動起手音效：直接播放該流派的清脆專屬音效（不疊加戰鼓/號角避免混濁） */
    playSkillActivation(fxKey, side = 'A', fallbackSfx = null) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const profile = SKILL_AUDIO_PROFILES[fxKey];
        const openKey = profile?.open || (fallbackSfx ? this._resolveEvent(fallbackSfx).key : 'blade_clash_2');
        const nowMs = performance.now();
        const gateKey = `skill_open_${fxKey || openKey}_${side}`;
        if (nowMs - (this.lastPlayAt[gateKey] || 0) < 220) return;
        this.lastPlayAt[gateKey] = nowMs;

        this._triggerBuffer(openKey, {
          side,
          gain: 0.90,
          rateJitter: 0.03,
          delay: 0,
          panScale: 0.65
        });
      } catch (e) { }
    },

    /** 3D 技能特效爆發命中音效：對應粒子／衝擊波落下瞬間的俐落打擊音 */
    playSkillImpact(fxKey, side = 'A', spatialOpts = null) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const profile = SKILL_AUDIO_PROFILES[fxKey] || SKILL_AUDIO_PROFILES.overlord_cleave;
        const nowMs = performance.now();
        const gateKey = `skill_impact_${fxKey || 'default'}_${side}`;
        if (nowMs - (this.lastPlayAt[gateKey] || 0) < 160) return;
        this.lastPlayAt[gateKey] = nowMs;

        const useSpatial = spatialOpts && Number.isFinite(spatialOpts.distance) && Number.isFinite(spatialOpts.pan);
        const baseOpts = useSpatial
          ? {
              side,
              distance: Math.max(0, spatialOpts.distance * 0.25),
              pan: Math.max(-1, Math.min(1, spatialOpts.pan)),
              gain: Math.min(1, spatialOpts.gain ?? 0.92) * 0.86,
              rateJitter: 0.04,
              spatial: true
            }
          : { side, gain: 0.86, rateJitter: 0.04, panScale: 0.75 };

        this._triggerBuffer(profile.impact, { ...baseOpts, delay: 0 });
      } catch (e) { }
    }
  };

  // 頁面載入後立即背景預抓真實音效檔，並在首次互動時自動解鎖 WebAudio
  if (typeof window !== 'undefined') {
    window.SoundEngine = SoundEngine;
    if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', () => {
        SoundEngine.syncBgmButton();
        const bgmBtn = document.getElementById('btnBgm');
        if (bgmBtn) bgmBtn.addEventListener('click', () => SoundEngine.toggleBgm());
      });
    }
    const schedulePrefetch = window.requestIdleCallback || function (cb) { setTimeout(cb, 120); };
    schedulePrefetch(() => SoundEngine.prefetchAll());

    const unlockOnce = () => {
      if (SoundEngine.enabled) {
        SoundEngine.init();
        if (!SoundEngine.currentBgmMode) {
          const inBattle = document.querySelector('#viewBattle:not([hidden])');
          SoundEngine.playBgm(inBattle ? 'battle' : 'prep');
        }
      }
      window.removeEventListener('pointerdown', unlockOnce, true);
      window.removeEventListener('keydown', unlockOnce, true);
    };
    window.addEventListener('pointerdown', unlockOnce, true);
    window.addEventListener('keydown', unlockOnce, true);
  }
})();
