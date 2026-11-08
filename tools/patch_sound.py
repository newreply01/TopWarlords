# -*- coding: utf-8 -*-
from pathlib import Path

sound_file = Path("D:/TopWarlords/js/sound.js")
txt = sound_file.read_text(encoding="utf-8")

# 在 play 函式最前頭加入古代音效別名映射
target = "play(type, side = 'A') {\n      if (!this.enabled) return;\n      this.init();\n      if (!this.ctx || !this.noiseBuffer) return;\n\n      try {\n        const t = this.ctx.currentTime;"

replacement = """play(type, side = 'A') {
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
        else if (type === 'strategy_gong') type = 'strategy_gong_native';"""

txt = txt.replace(target, replacement)

# 在 heavy_cannon 前加入古代音效具體合成邏輯
insert_anchor = "if (type === 'heavy_cannon') {"

ancient_sfx_code = """if (type === 'blade_clash_native') {
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

        } else """ + insert_anchor

txt = txt.replace(insert_anchor, ancient_sfx_code)
sound_file.write_text(txt, encoding="utf-8")
print("成功擴充 sound.js 古代戰場音效！")

