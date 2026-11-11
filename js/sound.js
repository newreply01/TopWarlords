'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 古戰場真實錄音聲學與動態配樂引擎 v7.0 (js/sound.js)
   採用免版稅真實樂器與冷兵器錄音取樣 (太鼓、號角、戰馬奔馳、刀劍交擊、弓弩齊射、銅鑼、古箏交響配樂)
   支援左右陣營立體聲定位、多取樣輪替防機械感、戶外山谷空間殘響與平滑 BGM 交叉淡入淡出
   ===================================================== */
(function () {
  const AUDIO_VER = '7.7.14';
  const BASE_PATH = 'assets/audio/';

  const CLIP_MANIFEST = {
    bgm_prep:       `${BASE_PATH}bgm_prep.mp3?v=${AUDIO_VER}`,
    bgm_battle:     `${BASE_PATH}bgm_battle.mp3?v=${AUDIO_VER}`,
    war_drum:       `${BASE_PATH}war_drum.mp3?v=${AUDIO_VER}`,
    war_horn:       `${BASE_PATH}war_horn.mp3?v=${AUDIO_VER}`,
    cavalry_charge: `${BASE_PATH}cavalry_charge.mp3?v=${AUDIO_VER}`,
    cavalry_hooves: `${BASE_PATH}cavalry_hooves.mp3?v=${AUDIO_VER}`,
    blade_clash_1:  `${BASE_PATH}blade_clash_1.mp3?v=${AUDIO_VER}`,
    blade_clash_2:  `${BASE_PATH}blade_clash_2.mp3?v=${AUDIO_VER}`,
    blade_clash_3:  `${BASE_PATH}blade_clash_3.mp3?v=${AUDIO_VER}`,
    heavy_strike:   `${BASE_PATH}heavy_strike.mp3?v=${AUDIO_VER}`,
    shield_block:   `${BASE_PATH}shield_block.mp3?v=${AUDIO_VER}`,
    arrow_volley:   `${BASE_PATH}arrow_volley.mp3?v=${AUDIO_VER}`,
    fire_attack:    `${BASE_PATH}fire_attack.mp3?v=${AUDIO_VER}`,
    strategy_gong:  `${BASE_PATH}strategy_gong.mp3?v=${AUDIO_VER}`,
    warlord_fall:   `${BASE_PATH}warlord_fall.mp3?v=${AUDIO_VER}`,
    ui_click:       `${BASE_PATH}ui_click.mp3?v=${AUDIO_VER}`,
    equip:          `${BASE_PATH}equip.mp3?v=${AUDIO_VER}`,
    victory:        `${BASE_PATH}victory.mp3?v=${AUDIO_VER}`,
    defeat:         `${BASE_PATH}defeat.mp3?v=${AUDIO_VER}`
  };

  // 先載入戰場核心音效，再載入長篇 BGM，確保首戰零延遲
  const PRIORITY_KEYS = [
    'ui_click', 'equip', 'war_drum', 'war_horn',
    'blade_clash_1', 'blade_clash_2', 'blade_clash_3', 'heavy_strike',
    'shield_block', 'cavalry_charge', 'cavalry_hooves', 'arrow_volley',
    'fire_attack', 'strategy_gong', 'warlord_fall', 'victory', 'defeat',
    'bgm_battle', 'bgm_prep'
  ];

  function readSoundPref() {
    try {
      if (window.LS && typeof window.LS.get === 'function') {
        const wl = window.LS.get('wl15_sound', null);
        if (wl !== null && wl !== undefined) return Boolean(wl);
        return Boolean(window.LS.get('db15_sound', true));
      }
      const rawWl = localStorage.getItem('wl15_sound');
      if (rawWl !== null) return Boolean(JSON.parse(rawWl));
      const rawDb = localStorage.getItem('db15_sound');
      return rawDb !== null ? Boolean(JSON.parse(rawDb)) : true;
    } catch (e) {
      return true;
    }
  }

  function writeSoundPref(val) {
    try {
      if (window.LS && typeof window.LS.set === 'function') {
        window.LS.set('wl15_sound', val);
        window.LS.set('db15_sound', val);
      } else {
        localStorage.setItem('wl15_sound', JSON.stringify(val));
        localStorage.setItem('db15_sound', JSON.stringify(val));
      }
    } catch (e) {}
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
    enabled: readSoundPref(),

    // 預先抓取二進位音訊檔（不需等待使用者點擊即可透過網路快取下載）
    prefetchAll() {
      PRIORITY_KEYS.forEach((key) => {
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
              (key === 'bgm_prep' && this.currentBgmMode === 'prep' && !this.currentBgmNode) ||
              (key === 'bgm_battle' && this.currentBgmMode === 'battle' && !this.currentBgmNode)
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
        this.sfxBus.gain.setValueAtTime(0.95, now);

        this.bgmBus = this.ctx.createGain();
        this.bgmBus.gain.setValueAtTime(0.32, now);

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
          if (this.enabled && this.currentBgmMode && !this.currentBgmNode) {
            this._startBgmSource(this.currentBgmMode);
          }
        }).catch(() => {});
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
        if (this.currentBgmMode && !this.currentBgmNode) {
          this._startBgmSource(this.currentBgmMode);
        }
      } else {
        if (this.masterGain && this.ctx) {
          this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
          this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
        }
      }
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
      if (!this.enabled) return;
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
        } catch (e) {}
      }
    },

    _startBgmSource(mode) {
      if (!this.ctx || !this.enabled) return;
      const clipKey = mode === 'battle' ? 'bgm_battle' : 'bgm_prep';
      const buf = this.buffers[clipKey];
      if (!buf) {
        this.prefetchAll();
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
        } catch (e) {}
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
      } catch (e) {}
    },

    _duckBgm(duckGain = 0.12, holdSec = 2.4) {
      if (!this.bgmBus || !this.ctx) return;
      const now = this.ctx.currentTime;
      this.bgmBus.gain.cancelScheduledValues(now);
      this.bgmBus.gain.setTargetAtTime(duckGain, now, 0.06);
      this.bgmBus.gain.setTargetAtTime(0.32, now + holdSec, 0.45);
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

    _triggerBuffer(clipKey, { side = 'A', gain = 0.85, rateJitter = 0.05, delay = 0, panScale = 1.0 }) {
      const buf = this.buffers[clipKey];
      if (!buf || !this.ctx) return false;

      const now = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const rate = 1.0 + (Math.random() * 2 - 1) * rateJitter;
      src.playbackRate.setValueAtTime(Math.max(0.82, Math.min(1.18, rate)), now);

      const g = this.ctx.createGain();
      const gJit = gain * (0.94 + Math.random() * 0.12);
      g.gain.setValueAtTime(gJit, now);

      if (this.ctx.createStereoPanner && panScale > 0) {
        const panner = this.ctx.createStereoPanner();
        const basePan = side === 'A' ? -0.32 : (side === 'B' ? 0.32 : 0);
        panner.pan.setValueAtTime(basePan * panScale + (Math.random() * 0.08 - 0.04), now);
        src.connect(g);
        g.connect(panner);
        panner.connect(this.sfxBus);
      } else {
        src.connect(g);
        g.connect(this.sfxBus);
      }

      src.start(now);
      return true;
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
      } catch (e) {}
    }
  };

  // 頁面載入後立即背景預抓真實音效檔，並在首次互動時自動解鎖 WebAudio
  if (typeof window !== 'undefined') {
    window.SoundEngine = SoundEngine;
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
