'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 軍規級純前端 Web Audio API 物理聲學與戰場空間殘響合成引擎 v2 (js/sound.js)
   獨立模組化聲學子系統：零外部音訊依賴，純演算法合成多維戰場音效與 1.35s 空間殘響
   ===================================================== */
(function () {
  function readSoundPref() {
    try {
      if (window.LS && typeof window.LS.get === 'function') {
        return window.LS.get('db15_sound', true);
      }
      const raw = localStorage.getItem('db15_sound');
      return raw ? JSON.parse(raw) : true;
    } catch (e) {
      return true;
    }
  }

  function writeSoundPref(val) {
    try {
      if (window.LS && typeof window.LS.set === 'function') {
        window.LS.set('db15_sound', val);
      } else {
        localStorage.setItem('db15_sound', JSON.stringify(val));
      }
    } catch (e) {}
  }

  const SoundEngine = {
    ctx: null,
    masterComp: null,
    reverbNode: null,
    reverbSend: null,
    distCurve: null,
    whiteBuffer: null,
    noiseBuffer: null, // Pink Noise
    brownBuffer: null,
    enabled: readSoundPref(),

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        const sr = this.ctx.sampleRate;

        // 1. 母帶級動態壓限器：承受多武器齊射與重低音殉爆，防止數位破音
        this.masterComp = this.ctx.createDynamicsCompressor();
        this.masterComp.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.masterComp.knee.setValueAtTime(18, this.ctx.currentTime);
        this.masterComp.ratio.setValueAtTime(10, this.ctx.currentTime);
        this.masterComp.attack.setValueAtTime(0.002, this.ctx.currentTime);
        this.masterComp.release.setValueAtTime(0.22, this.ctx.currentTime);
        this.masterComp.connect(this.ctx.destination);

        // 2. 非線性火藥爆燃失真曲線 (WaveShaper Soft-Clipper / Harmonic Saturation)
        const curveLen = 8192;
        this.distCurve = new Float32Array(curveLen);
        for (let i = 0; i < curveLen; i++) {
          const x = (i * 2) / curveLen - 1;
          this.distCurve[i] = Math.tanh(x * 2.8);
        }

        // 3. 生成三種物理噪聲基底：White (超音速音爆/破片)、Pink (火箭噴流/火藥)、Brown (深層重低音殉爆/海浪)
        const bufSize = sr * 2;
        this.whiteBuffer = this.ctx.createBuffer(1, bufSize, sr);
        this.noiseBuffer = this.ctx.createBuffer(1, bufSize, sr);
        this.brownBuffer = this.ctx.createBuffer(1, bufSize, sr);

        const wData = this.whiteBuffer.getChannelData(0);
        const pData = this.noiseBuffer.getChannelData(0);
        const bData = this.brownBuffer.getChannelData(0);

        let b0 = 0, b1 = 0, b2 = 0, lastBrown = 0;
        for (let i = 0; i < bufSize; i++) {
          const white = Math.random() * 2 - 1;
          wData[i] = white * 0.65;

          // Pink Noise
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          pData[i] = (b0 + b1 + b2 + white * 0.08) * 0.38;

          // Brown Noise (低頻能量濃厚，適合火砲膛壓與遠方滾動雷鳴)
          lastBrown = (lastBrown + (0.028 * white)) / 1.028;
          bData[i] = lastBrown * 2.8;
        }

        // 4. 建立 1.35 秒戶外開闊戰場空間殘響 (Outdoor Battlefield Convolution Reverb IR)
        const irLen = Math.floor(sr * 1.35);
        const irBuf = this.ctx.createBuffer(2, irLen, sr);
        for (let ch = 0; ch < 2; ch++) {
          const chData = irBuf.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < irLen; i++) {
            const tSec = i / sr;
            // 模擬地面與山谷早期反射 (Early Reflections at 18ms, 45ms, 88ms) + 戶外空氣衰減尾音
            const early = (Math.abs(tSec - 0.018) < 0.004 || Math.abs(tSec - 0.045) < 0.005 || Math.abs(tSec - 0.088) < 0.006) ? 0.55 : 0;
            const env = Math.exp(-tSec * 3.8) + early * Math.exp(-tSec * 2.0);
            const raw = (Math.random() * 2 - 1) * env;
            // 隨時間加深空氣低通吸收，讓遠方殘響溫暖渾厚不刺耳
            const alpha = Math.max(0.06, 0.35 * Math.exp(-tSec * 2.2));
            lp = lp + alpha * (raw - lp);
            chData[i] = lp * 0.65;
          }
        }
        this.reverbNode = this.ctx.createConvolver();
        this.reverbNode.buffer = irBuf;
        this.reverbSend = this.ctx.createGain();
        this.reverbSend.gain.setValueAtTime(0.32, this.ctx.currentTime);
        this.reverbNode.connect(this.reverbSend);
        this.reverbSend.connect(this.masterComp);
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      const ico = document.querySelector('#audioIcon');
      const btn = document.querySelector('#btnAudio');
      if (ico) ico.textContent = this.enabled ? '🔊' : '🔇';
      if (btn) btn.title = this.enabled ? '戰場音效已開啟' : '戰場音效已靜音';
      if (typeof window.toast === 'function') {
        window.toast(this.enabled ? '🔊 戰場音效已開啟' : '🔇 戰場音效已靜音');
      }
      if (this.enabled) this.init();
      writeSoundPref(this.enabled);
    },

    isMuted() {
      return !this.enabled;
    },

    // 建立帶非線性火藥飽和失真、左右立體聲定位與戰場空間殘響的物理聲學通道
    _createBus(t, side = 'A', wetLevel = 0.25, saturate = true) {
      const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.setValueAtTime(side === 'A' ? -0.26 : 0.26, t);
        panner.connect(this.masterComp);
        if (this.reverbNode && wetLevel > 0) {
          const wetGain = this.ctx.createGain();
          wetGain.gain.setValueAtTime(wetLevel, t);
          panner.connect(wetGain);
          wetGain.connect(this.reverbNode);
        }
      }
      const dest = panner || this.masterComp;
      if (saturate && this.distCurve) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.distCurve;
        shaper.oversample = '2x';
        shaper.connect(dest);
        return shaper;
      }
      return dest;
    },

    // 播放具備真實戰場物理衝擊與空間尾韻的軍武音效 (side: 'A' 為我方左側, 'B' 為敵方右側)
    play(type, side = 'A') {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx || !this.noiseBuffer) return;

      try {
        const t = this.ctx.currentTime;
        // 古代戰場音效映射
        if (type === 'blade_clash') type = 'blade_clash_native';
        else if (type === 'arrow_volley') type = 'arrow_volley_native';
        else if (type === 'war_drum') type = 'war_drum_native';
        else if (type === 'fire_attack') type = 'fire_attack_native';
        else if (type === 'strategy_gong') type = 'strategy_gong_native';
        else if (type === 'cavalry_charge') type = 'cavalry_charge_native';
        else if (type === 'warlord_fall') type = 'warlord_fall_native';
        else if (type === 'shield_block') type = 'shield_block_native';
        else if (type === 'metal_clash') type = 'metal_clash_native';


        if (type === 'cavalry_charge_native') {
          // 【鐵蹄奔雷：雙重低頻馬蹄重踏 + 戰馬衝鋒風聲】
          const bus = this._createBus(t, side, 0.58, true);
          // 低頻鐵蹄踏地 55Hz~90Hz 連續重擊
          for (let i = 0; i < 4; i++) {
            const dt = i * 0.055;
            const sub = this.ctx.createOscillator();
            const sg = this.ctx.createGain();
            sub.type = 'triangle';
            sub.frequency.setValueAtTime(85, t + dt);
            sub.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
            sg.gain.setValueAtTime(0.7, t + dt);
            sg.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14);
            sub.connect(sg); sg.connect(bus);
            sub.start(t + dt); sub.stop(t + dt + 0.16);
          }
          // 狂風呼嘯
          const wind = this.ctx.createBufferSource();
          wind.buffer = this.brownBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'lowpass'; bp.frequency.setValueAtTime(350, t);
          const wg = this.ctx.createGain();
          wg.gain.setValueAtTime(0.5, t);
          wg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          wind.connect(bp); bp.connect(wg); wg.connect(bus);
          wind.start(t); wind.stop(t + 0.38);

        } else if (type === 'shield_block_native') {
          // 【大盾格擋：沉重原木鋼盾撞擊震動】
          const bus = this._createBus(t, side, 0.5, true);
          const sub = this.ctx.createOscillator();
          const sg = this.ctx.createGain();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(140, t);
          sub.frequency.exponentialRampToValueAtTime(45, t + 0.16);
          sg.gain.setValueAtTime(0.8, t);
          sg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          sub.connect(sg); sg.connect(bus);
          sub.start(t); sub.stop(t + 0.2);

          const snap = this.ctx.createBufferSource();
          snap.buffer = this.whiteBuffer;
          const hp = this.ctx.createBiquadFilter();
          hp.type = 'bandpass'; hp.frequency.setValueAtTime(1200, t); hp.Q.setValueAtTime(2, t);
          const snapG = this.ctx.createGain();
          snapG.gain.setValueAtTime(0.6, t);
          snapG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          snap.connect(hp); hp.connect(snapG); snapG.connect(bus);
          snap.start(t); snap.stop(t + 0.09);

        } else if (type === 'warlord_fall_native') {
          // 【名將陣亡潰散：厚重盔甲金屬墜地與低音沉悶震蕩】
          const bus = this._createBus(t, side, 0.65, true);
          const sub = this.ctx.createOscillator();
          const sg = this.ctx.createGain();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(110, t);
          sub.frequency.exponentialRampToValueAtTime(30, t + 0.38);
          sg.gain.setValueAtTime(0.95, t);
          sg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          sub.connect(sg); sg.connect(bus);
          sub.start(t); sub.stop(t + 0.5);

          // 盔甲散落聲
          [1600, 2400, 3200].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.04);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + idx * 0.04 + 0.15);
            g.gain.setValueAtTime(0.25, t + idx * 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.04 + 0.2);
            osc.connect(g); g.connect(bus);
            osc.start(t + idx * 0.04); osc.stop(t + idx * 0.04 + 0.22);
          });

        } else if (type === 'metal_clash_native') {
          // 【短兵相接重砍：沉悶刀刃切入鎧甲】
          const bus = this._createBus(t, side, 0.45, true);
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, t);
          osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
          osc.connect(g); g.connect(bus);
          osc.start(t); osc.stop(t + 0.16);
        } else if (type === 'blade_clash_native') {
          // 【刀劍金鐵交鳴：金屬高頻撞擊 + 非整數倍泛音震顫】
          const bus = this._createBus(t, side, 0.42, true);
          [2850, 4120, 5600].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq + idx * 80, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 0.18);
            g.gain.setValueAtTime(0.35 / (idx + 1), t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(g);
            g.connect(bus);
            osc.start(t);
            osc.stop(t + 0.25);
          });
          const snap = this.ctx.createBufferSource();
          snap.buffer = this.whiteBuffer;
          const hp = this.ctx.createBiquadFilter();
          hp.type = 'highpass'; hp.frequency.setValueAtTime(3200, t);
          const sg = this.ctx.createGain();
          sg.gain.setValueAtTime(0.5, t);
          sg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          snap.connect(hp); hp.connect(sg); sg.connect(bus);
          snap.start(t); snap.stop(t + 0.05);

        } else if (type === 'arrow_volley_native') {
          // 【萬箭破空呼嘯：帶通白噪音高速掃頻連續脈衝】
          const bus = this._createBus(t, side, 0.35, true);
          for (let i = 0; i < 3; i++) {
            const dt = i * 0.045;
            const src = this.ctx.createBufferSource();
            src.buffer = this.whiteBuffer;
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(1200 + i * 300, t + dt);
            bp.frequency.exponentialRampToValueAtTime(3600, t + dt + 0.16);
            bp.Q.setValueAtTime(3.5, t + dt);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.01, t + dt);
            g.gain.linearRampToValueAtTime(0.38, t + dt + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.22);
            src.connect(bp); bp.connect(g); g.connect(bus);
            src.start(t + dt); src.stop(t + dt + 0.24);
          }

        } else if (type === 'war_drum_native') {
          // 【三軍震天戰鼓：低頻正弦快速降頻 + 棕噪聲低音共鳴】
          const bus = this._createBus(t, side, 0.55, true);
          const sub = this.ctx.createOscillator();
          const sg = this.ctx.createGain();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(160, t);
          sub.frequency.exponentialRampToValueAtTime(42, t + 0.24);
          sg.gain.setValueAtTime(0.95, t);
          sg.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
          sub.connect(sg); sg.connect(bus);
          sub.start(t); sub.stop(t + 0.4);

          const thud = this.ctx.createBufferSource();
          thud.buffer = this.brownBuffer;
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.setValueAtTime(260, t);
          const tg = this.ctx.createGain();
          tg.gain.setValueAtTime(0.7, t);
          tg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          thud.connect(lp); lp.connect(tg); tg.connect(bus);
          thud.start(t); thud.stop(t + 0.32);

        } else if (type === 'fire_attack_native') {
          // 【火攻爆燃與霹靂砲：火藥爆裂 + 熊熊燃燒噪聲】
          const bus = this._createBus(t, side, 0.45, true);
          const blast = this.ctx.createBufferSource();
          blast.buffer = this.brownBuffer;
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.setValueAtTime(550, t);
          lp.frequency.exponentialRampToValueAtTime(110, t + 0.32);
          const bg = this.ctx.createGain();
          bg.gain.setValueAtTime(0.85, t);
          bg.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
          blast.connect(lp); lp.connect(bg); bg.connect(bus);
          blast.start(t); blast.stop(t + 0.38);

        } else if (type === 'strategy_gong_native') {
          // 【軍師鳴金銅鑼：非整數倍金屬長延音共鳴】
          const bus = this._createBus(t, side, 0.38, true);
          [440, 685, 1120].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.32 / (i + 1), t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
            osc.connect(g); g.connect(bus);
            osc.start(t); osc.stop(t + 0.9);
          });

        } else if (type === 'heavy_cannon') {
          // 【120mm/125mm 戰車滑膛砲實彈射擊：超音速膛口音爆 + 火藥膨脹怒吼 + 胸腔次低音 + 砲閂退殼金屬聲】
          const bus = this._createBus(t, side, 0.45, true);

          // 1. 0~14ms 超音速膛口裂帛瞬態 (Supersonic Ballistic Crack)
          const crack = this.ctx.createBufferSource();
          crack.buffer = this.whiteBuffer;
          const crackHp = this.ctx.createBiquadFilter();
          crackHp.type = 'highpass';
          crackHp.frequency.setValueAtTime(950, t);
          const crackGain = this.ctx.createGain();
          crackGain.gain.setValueAtTime(0.85, t);
          crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
          crack.connect(crackHp);
          crackHp.connect(crackGain);
          crackGain.connect(bus);
          crack.start(t);
          crack.stop(t + 0.025);

          // 2. 火藥高壓燃氣膨脹轟鳴 (Propellant Blast Body)
          const blast = this.ctx.createBufferSource();
          blast.buffer = this.brownBuffer;
          const blastLp = this.ctx.createBiquadFilter();
          blastLp.type = 'lowpass';
          blastLp.frequency.setValueAtTime(480, t);
          blastLp.frequency.exponentialRampToValueAtTime(58, t + 0.34);
          const blastGain = this.ctx.createGain();
          blastGain.gain.setValueAtTime(0.95, t);
          blastGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
          blast.connect(blastLp);
          blastLp.connect(blastGain);
          blastGain.connect(bus);
          blast.start(t);
          blast.stop(t + 0.4);

          // 3. 62Hz -> 26Hz 重型後座力次低音衝擊 (Sub-Bass Recoil Thud)
          const sub = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(72, t);
          sub.frequency.exponentialRampToValueAtTime(26, t + 0.28);
          subGain.gain.setValueAtTime(0.85, t);
          subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
          sub.connect(subGain);
          subGain.connect(bus);
          sub.start(t);
          sub.stop(t + 0.36);

          // 4. +115ms 自動裝填機 / 砲閂金屬拋殼聲 (Breech Clatter)
          const clack = this.ctx.createBufferSource();
          clack.buffer = this.whiteBuffer;
          const clackBp = this.ctx.createBiquadFilter();
          clackBp.type = 'bandpass';
          clackBp.frequency.setValueAtTime(2350, t + 0.115);
          clackBp.Q.setValueAtTime(4.5, t + 0.115);
          const clackGain = this.ctx.createGain();
          clackGain.gain.setValueAtTime(0.24, t + 0.115);
          clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.155);
          clack.connect(clackBp);
          clackBp.connect(clackGain);
          clackGain.connect(bus);
          clack.start(t + 0.115);
          clack.stop(t + 0.165);

        } else if (type === 'cannon' || type === 'flak') {
          // 【30mm/35mm 機砲 / 防空快砲 / 近迫密集陣 4 連發機械點射：徹底消除卡通滑音，呈現真實機械膛壓與金屬槍機撞擊】
          const bus = this._createBus(t, side, 0.28, true);
          for (let i = 0; i < 4; i++) {
            const d = i * 0.056;
            // 膛口火藥爆裂音
            const snap = this.ctx.createBufferSource();
            snap.buffer = this.whiteBuffer;
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(2400 - i * 80, t + d);
            bp.Q.setValueAtTime(1.6, t + d);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.48, t + d);
            g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.038);
            snap.connect(bp);
            bp.connect(g);
            g.connect(bus);
            snap.start(t + d);
            snap.stop(t + d + 0.042);

            // 槍膛低頻厚重撞擊
            const body = this.ctx.createBufferSource();
            body.buffer = this.brownBuffer;
            const lp = this.ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(340, t + d);
            const bg = this.ctx.createGain();
            bg.gain.setValueAtTime(0.62, t + d);
            bg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.052);
            body.connect(lp);
            lp.connect(bg);
            bg.connect(bus);
            body.start(t + d);
            body.stop(t + d + 0.058);
          }

        } else if (type === 'missile') {
          // 【防空飛彈 / 超音速空對空飛彈：冷發射氣爆點火 + 固態火箭發動機寬頻撕裂噴流聲】
          const bus = this._createBus(t, side, 0.35, true);

          // 1. 發射筒點火氣爆瞬態 (Booster Ignition Thump)
          const pop = this.ctx.createBufferSource();
          pop.buffer = this.brownBuffer;
          const popLp = this.ctx.createBiquadFilter();
          popLp.type = 'lowpass';
          popLp.frequency.setValueAtTime(260, t);
          const popGain = this.ctx.createGain();
          popGain.gain.setValueAtTime(0.75, t);
          popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
          pop.connect(popLp);
          popLp.connect(popGain);
          popGain.connect(bus);
          pop.start(t);
          pop.stop(t + 0.1);

          // 2. 固態火箭高壓尾焰撕裂空氣嘶吼 (Broadband Turbulent Jet Roar，寬頻帶 Q=0.8 杜絕口哨感)
          const jet = this.ctx.createBufferSource();
          jet.buffer = this.noiseBuffer;
          const jetFilter = this.ctx.createBiquadFilter();
          jetFilter.type = 'bandpass';
          jetFilter.frequency.setValueAtTime(1650, t + 0.015);
          jetFilter.frequency.exponentialRampToValueAtTime(680, t + 0.42);
          jetFilter.Q.setValueAtTime(0.75, t + 0.015);
          const jetGain = this.ctx.createGain();
          jetGain.gain.setValueAtTime(0.05, t);
          jetGain.gain.linearRampToValueAtTime(0.52, t + 0.045);
          jetGain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
          jet.connect(jetFilter);
          jetFilter.connect(jetGain);
          jetGain.connect(bus);
          jet.start(t);
          jet.stop(t + 0.46);

          // 3. 尾焰低頻空氣震動基底
          const rumble = this.ctx.createBufferSource();
          rumble.buffer = this.brownBuffer;
          const rumLp = this.ctx.createBiquadFilter();
          rumLp.type = 'lowpass';
          rumLp.frequency.setValueAtTime(280, t);
          const rumGain = this.ctx.createGain();
          rumGain.gain.setValueAtTime(0.42, t + 0.02);
          rumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
          rumble.connect(rumLp);
          rumLp.connect(rumGain);
          rumGain.connect(bus);
          rumble.start(t + 0.02);
          rumble.stop(t + 0.4);

        } else if (type === 'rocket_salvo') {
          // 【海馬斯 / 多管火箭 / 巡弋飛彈波次齊射：4 發連續出筒悶響與火箭推進尾流】
          const bus = this._createBus(t, side, 0.38, true);
          for (let i = 0; i < 4; i++) {
            const delay = i * 0.068;
            // 發射箱點火重擊
            const tube = this.ctx.createBufferSource();
            tube.buffer = this.brownBuffer;
            const tubeLp = this.ctx.createBiquadFilter();
            tubeLp.type = 'lowpass';
            tubeLp.frequency.setValueAtTime(220, t + delay);
            const tubeGain = this.ctx.createGain();
            tubeGain.gain.setValueAtTime(0.55, t + delay);
            tubeGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.075);
            tube.connect(tubeLp);
            tubeLp.connect(tubeGain);
            tubeGain.connect(bus);
            tube.start(t + delay);
            tube.stop(t + delay + 0.085);

            // 火箭噴流嘶吼
            const roar = this.ctx.createBufferSource();
            roar.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1150 - i * 70, t + delay);
            filter.frequency.exponentialRampToValueAtTime(420, t + delay + 0.25);
            filter.Q.setValueAtTime(0.85, t + delay);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.04, t + delay);
            gain.gain.linearRampToValueAtTime(0.38, t + delay + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.28);
            roar.connect(filter);
            filter.connect(gain);
            gain.connect(bus);
            roar.start(t + delay);
            roar.stop(t + delay + 0.3);
          }

        } else if (type === 'torpedo') {
          // 【重型魚雷 / 潛艦高壓水下發射：高壓氣體出管悶響 + 螺旋槳空泡湍流 + 聲納回波】
          const bus = this._createBus(t, side, 0.35, false);

          // 1. 水下高壓魚雷管射出悶響
          const slug = this.ctx.createBufferSource();
          slug.buffer = this.brownBuffer;
          const slugLp = this.ctx.createBiquadFilter();
          slugLp.type = 'lowpass';
          slugLp.frequency.setValueAtTime(180, t);
          slugLp.frequency.exponentialRampToValueAtTime(55, t + 0.35);
          const slugGain = this.ctx.createGain();
          slugGain.gain.setValueAtTime(0.75, t);
          slugGain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
          slug.connect(slugLp);
          slugLp.connect(slugGain);
          slugGain.connect(bus);
          slug.start(t);
          slug.stop(t + 0.4);

          // 2. 水下泵噴推進空泡水流聲 (Cavitation Turbulence)
          const cav = this.ctx.createBufferSource();
          cav.buffer = this.noiseBuffer;
          const cavBp = this.ctx.createBiquadFilter();
          cavBp.type = 'bandpass';
          cavBp.frequency.setValueAtTime(520, t + 0.03);
          cavBp.frequency.exponentialRampToValueAtTime(240, t + 0.42);
          cavBp.Q.setValueAtTime(1.4, t + 0.03);
          const cavGain = this.ctx.createGain();
          cavGain.gain.setValueAtTime(0.28, t + 0.03);
          cavGain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
          cav.connect(cavBp);
          cavBp.connect(cavGain);
          cavGain.connect(bus);
          cav.start(t + 0.03);
          cav.stop(t + 0.45);

        } else if (type === 'swarm') {
          // 【自殺無人機 / 巡飛彈蜂群：多旋翼葉片調幅氣流聲 + 高速俯衝風切聲 (無卡通鋸齒滑音)】
          const bus = this._createBus(t, side, 0.2, false);

          // 高速俯衝風切氣流
          const wind = this.ctx.createBufferSource();
          wind.buffer = this.noiseBuffer;
          const windBp = this.ctx.createBiquadFilter();
          windBp.type = 'bandpass';
          windBp.frequency.setValueAtTime(620, t);
          windBp.frequency.linearRampToValueAtTime(980, t + 0.16);
          windBp.frequency.linearRampToValueAtTime(480, t + 0.34);
          windBp.Q.setValueAtTime(1.5, t);
          const windGain = this.ctx.createGain();
          windGain.gain.setValueAtTime(0.04, t);
          windGain.gain.linearRampToValueAtTime(0.34, t + 0.14);
          windGain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
          wind.connect(windBp);
          windBp.connect(windGain);
          windGain.connect(bus);
          wind.start(t);
          wind.stop(t + 0.38);

          // 螺旋槳葉片切割空氣脈衝 (Rotor Blade Pass Modulation)
          const rotor = this.ctx.createOscillator();
          const rotorFilter = this.ctx.createBiquadFilter();
          const rotorGain = this.ctx.createGain();
          rotor.type = 'triangle';
          rotor.frequency.setValueAtTime(210, t);
          rotor.frequency.linearRampToValueAtTime(265, t + 0.16);
          rotor.frequency.linearRampToValueAtTime(175, t + 0.34);
          rotorFilter.type = 'lowpass';
          rotorFilter.frequency.setValueAtTime(750, t);
          rotorGain.gain.setValueAtTime(0.02, t);
          rotorGain.gain.linearRampToValueAtTime(0.14, t + 0.14);
          rotorGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          rotor.connect(rotorFilter);
          rotorFilter.connect(rotorGain);
          rotorGain.connect(bus);
          rotor.start(t);
          rotor.stop(t + 0.36);

        } else if (type === 'explosion') {
          // 【戰損毀滅雙段式重型殉爆：初段高爆破片裂帛 ➔ 70ms 彈藥庫二次深層重低音殉爆 ➔ 1.35s 戰場轟鳴尾音】
          const bus = this._createBus(t, side, 0.58, true);

          // 1. 初段高爆破空瞬態 (Initial Detonation Snap)
          const snap = this.ctx.createBufferSource();
          snap.buffer = this.whiteBuffer;
          const snapLp = this.ctx.createBiquadFilter();
          snapLp.type = 'lowpass';
          snapLp.frequency.setValueAtTime(2800, t);
          snapLp.frequency.exponentialRampToValueAtTime(180, t + 0.18);
          const snapGain = this.ctx.createGain();
          snapGain.gain.setValueAtTime(0.85, t);
          snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          snap.connect(snapLp);
          snapLp.connect(snapGain);
          snapGain.connect(bus);
          snap.start(t);
          snap.stop(t + 0.24);

          // 2. 二段彈藥庫殉爆深層滾動巨響 (Secondary Ammo Cook-off Brown Roar)
          const rumble = this.ctx.createBufferSource();
          rumble.buffer = this.brownBuffer;
          const rumLp = this.ctx.createBiquadFilter();
          rumLp.type = 'lowpass';
          rumLp.frequency.setValueAtTime(320, t + 0.045);
          rumLp.frequency.exponentialRampToValueAtTime(48, t + 0.78);
          const rumGain = this.ctx.createGain();
          rumGain.gain.setValueAtTime(0.95, t + 0.045);
          rumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
          rumble.connect(rumLp);
          rumLp.connect(rumGain);
          rumGain.connect(bus);
          rumble.start(t + 0.045);
          rumble.stop(t + 0.88);

          // 3. 32Hz 地面震波次低音 (Seismic Sub-Bass Shockwave)
          const sub = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          sub.type = 'sine';
          sub.frequency.setValueAtTime(88, t);
          sub.frequency.exponentialRampToValueAtTime(24, t + 0.65);
          subGain.gain.setValueAtTime(0.92, t);
          subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
          sub.connect(subGain);
          subGain.connect(bus);
          sub.start(t);
          sub.stop(t + 0.75);

        } else if (type === 'hit_impact') {
          // 【裝甲鋼板動能貫穿與破片撞擊：低頻受擊悶響 + 高頻金屬碎裂】
          const bus = this._createBus(t, side, 0.3, true);

          const thud = this.ctx.createBufferSource();
          thud.buffer = this.brownBuffer;
          const thudLp = this.ctx.createBiquadFilter();
          thudLp.type = 'lowpass';
          thudLp.frequency.setValueAtTime(280, t);
          const thudGain = this.ctx.createGain();
          thudGain.gain.setValueAtTime(0.75, t);
          thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          thud.connect(thudLp);
          thudLp.connect(thudGain);
          thudGain.connect(bus);
          thud.start(t);
          thud.stop(t + 0.18);

          const crunch = this.ctx.createBufferSource();
          crunch.buffer = this.whiteBuffer;
          const crunchBp = this.ctx.createBiquadFilter();
          crunchBp.type = 'bandpass';
          crunchBp.frequency.setValueAtTime(1950, t);
          crunchBp.frequency.exponentialRampToValueAtTime(520, t + 0.11);
          crunchBp.Q.setValueAtTime(1.8, t);
          const crunchGain = this.ctx.createGain();
          crunchGain.gain.setValueAtTime(0.52, t);
          crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          crunch.connect(crunchBp);
          crunchBp.connect(crunchGain);
          crunchGain.connect(bus);
          crunch.start(t);
          crunch.stop(t + 0.14);

        } else if (type === 'block') {
          // 【主動防護系統 APS 近迫攔截彈爆破與鎢珠破片散射聲 (無卡通彈簧音)】
          const bus = this._createBus(t, side, 0.25, true);

          // 攔截彈空爆瞬態
          const pop = this.ctx.createBufferSource();
          pop.buffer = this.whiteBuffer;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1600, t);
          bp.Q.setValueAtTime(1.2, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.6, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
          pop.connect(bp);
          bp.connect(g);
          g.connect(bus);
          pop.start(t);
          pop.stop(t + 0.06);

          // 3 顆高速金屬破片散射清脆撞擊
          [0.018, 0.036, 0.054].forEach((d, idx) => {
            const ping = this.ctx.createBufferSource();
            ping.buffer = this.whiteBuffer;
            const pFilter = this.ctx.createBiquadFilter();
            pFilter.type = 'bandpass';
            pFilter.frequency.setValueAtTime(3400 + idx * 450, t + d);
            pFilter.Q.setValueAtTime(6.0, t + d);
            const pGain = this.ctx.createGain();
            pGain.gain.setValueAtTime(0.28, t + d);
            pGain.gain.exponentialRampToValueAtTime(0.001, t + d + 0.03);
            ping.connect(pFilter);
            pFilter.connect(pGain);
            pGain.connect(bus);
            ping.start(t + d);
            ping.stop(t + d + 0.035);
          });

        } else if (type === 'emp_pulse') {
          // 【戰機 RWR 雷達鎖定告警雙脈衝 + 寬頻電磁干擾雜訊】
          const bus = this._createBus(t, side, 0.15, false);

          // NATO RWR 威脅鎖定急促雙音 (1480Hz / 1180Hz)
          [0, 0.065].forEach((d, idx) => {
            const rwr = this.ctx.createOscillator();
            const rg = this.ctx.createGain();
            rwr.type = 'sine';
            rwr.frequency.setValueAtTime(idx === 0 ? 1480 : 1180, t + d);
            rg.gain.setValueAtTime(0.16, t + d);
            rg.gain.exponentialRampToValueAtTime(0.001, t + d + 0.048);
            rwr.connect(rg);
            rg.connect(bus);
            rwr.start(t + d);
            rwr.stop(t + d + 0.052);
          });

          // 電磁干擾靜電脈衝
          const noise = this.ctx.createBufferSource();
          noise.buffer = this.whiteBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(2200, t);
          filter.frequency.exponentialRampToValueAtTime(650, t + 0.24);
          filter.Q.setValueAtTime(2.2, t);
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.26, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(bus);
          noise.start(t);
          noise.stop(t + 0.28);

        } else if (type === 'equip') {
          // 【軍械金屬槍機上膛卡榫聲 (Click-Clack)】
          const bus = this._createBus(t, side, 0.05, false);
          [0, 0.032].forEach((d, idx) => {
            const click = this.ctx.createBufferSource();
            click.buffer = this.whiteBuffer;
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(idx === 0 ? 1900 : 2950, t + d);
            bp.Q.setValueAtTime(4.0, t + d);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.28, t + d);
            g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.024);
            click.connect(bp);
            bp.connect(g);
            g.connect(bus);
            click.start(t + d);
            click.stop(t + d + 0.028);
          });

        } else if (type === 'victory') {
          // 【軍事勝利凱旋和弦 (F4 -> A4 -> C5)】
          const bus = this._createBus(t, side, 0.28, false);
          [349.23, 440.0, 523.25].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.08);
            gain.gain.setValueAtTime(0.16, t + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.7);
            osc.connect(gain);
            gain.connect(bus);
            osc.start(t + idx * 0.08);
            osc.stop(t + idx * 0.08 + 0.75);
          });
        }
      } catch (e) {}
    }
  };

  window.SoundEngine = SoundEngine;
})();

