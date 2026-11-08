# -*- coding: utf-8 -*-
"""
全面擴充 sound.js 古戰場物理聲學庫：
新增：
- cavalry_charge (鐵蹄奔雷轟鳴 + 戰馬長嘶呼嘯)
- warlord_fall (名將陣亡：沉重倒地與盔甲碎裂)
- shield_block (重盾沉悶格擋衝擊)
- metal_clash (刀斧劈砍盾甲重擊)
"""
from pathlib import Path

p = Path("D:/TopWarlords/js/sound.js")
text = p.read_text(encoding="utf-8")

# 1. 映射擴充
target_mapping = """        // 古代戰場音效映射
        if (type === 'blade_clash') type = 'blade_clash_native';
        else if (type === 'arrow_volley') type = 'arrow_volley_native';
        else if (type === 'war_drum') type = 'war_drum_native';
        else if (type === 'fire_attack') type = 'fire_attack_native';
        else if (type === 'strategy_gong') type = 'strategy_gong_native';"""

replacement_mapping = """        // 古代戰場音效映射
        if (type === 'blade_clash') type = 'blade_clash_native';
        else if (type === 'arrow_volley') type = 'arrow_volley_native';
        else if (type === 'war_drum') type = 'war_drum_native';
        else if (type === 'fire_attack') type = 'fire_attack_native';
        else if (type === 'strategy_gong') type = 'strategy_gong_native';
        else if (type === 'cavalry_charge') type = 'cavalry_charge_native';
        else if (type === 'warlord_fall') type = 'warlord_fall_native';
        else if (type === 'shield_block') type = 'shield_block_native';
        else if (type === 'metal_clash') type = 'metal_clash_native';"""

assert target_mapping in text, "target_mapping not found"
text = text.replace(target_mapping, replacement_mapping, 1)

# 2. 插入合成實作
sound_impls = """
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
        } else """

target_insert_point = "        if (type === 'blade_clash_native') {"
assert target_insert_point in text, "target_insert_point not found"
text = text.replace(target_insert_point, sound_impls + target_insert_point.lstrip(), 1)

p.write_text(text, encoding="utf-8")
print("Successfully enhanced ancient sound engine in sound.js!")

