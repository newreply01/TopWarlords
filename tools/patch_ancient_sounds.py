# -*- coding: utf-8 -*-
"""
更新 app.js 戰鬥聲效與打擊文字，全面改為《三國志》古代名將戰場音效與術語
"""
from pathlib import Path

p = Path("D:/TopWarlords/js/app.js")
text = p.read_text(encoding="utf-8")

# 1. 替換聲效與武器判定
old_sfx_block = """  // 2. 判定武器視覺與聲學類型 (7 大名將專屬類型，支援三階彈藥動態切換武器特效與聲效)
  let wType = 'missile';
  const effSfx = ln.sfxOverride || (aUnit && aUnit.sfx) || 'missile';
  if (aUnit) {
    if ((ln.brevity && ln.brevity.startsWith('SEAD')) || effSfx === 'emp_pulse' || (!ln.sfxOverride && aUnit.cat === 'support' && /預警|電戰|咆哮者|干擾/.test(aUnit.name + (aUnit.weapon || '')))) {
      wType = 'ew';
    } else if ((ln.brevity && ln.brevity.startsWith('SABOT')) || effSfx === 'heavy_cannon') {
      wType = 'sabot';
    } else if (effSfx === 'cannon' || effSfx === 'flak') {
      wType = 'autocannon';
    } else if (effSfx === 'rocket_salvo') {
      wType = 'salvo';
    } else if (effSfx === 'torpedo' || (!ln.sfxOverride && aUnit.cat === 'naval' && /潛艦|魚雷/.test(aUnit.role + (aUnit.weapon || '')))) {
      wType = 'torpedo';
    } else if (effSfx === 'swarm') {
      wType = 'swarm';
    } else {
      wType = 'missile';
    }
  }

  // 觸發開火音效 (帶陣營立體聲方位與戶外戰場殘響)與行動端戰術微震動回饋
  if (aUnit) {
    const sfxToPlay = wType === 'ew' ? 'emp_pulse' : effSfx;
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.play === 'function') {
      SoundEngine.play(sfxToPlay, ln.side);
    }"""

new_sfx_block = """  // 2. 判定古代兵團打擊與聲學類型 (三國志古戰場刀槍/箭陣/戰鼓/火攻/軍師鑼)
  let wType = 'melee';
  let sfxToPlay = ln.sfxOverride || (aUnit && aUnit.sfx) || 'blade_clash';

  if (aUnit) {
    if (aUnit.cat === 'air_defense' || (ln.text && ln.text.includes('箭'))) {
      wType = 'arrow';
      sfxToPlay = 'arrow_volley';
    } else if (aUnit.cat === 'air') {
      wType = 'cavalry';
      sfxToPlay = 'cavalry_charge';
    } else if (aUnit.cat === 'support') {
      if (ln.text && (ln.text.includes('砲') || ln.text.includes('火'))) {
        wType = 'fire';
        sfxToPlay = 'fire_attack';
      } else {
        wType = 'strategy';
        sfxToPlay = 'strategy_gong';
      }
    } else if (aUnit.cat === 'armor') {
      wType = 'shield';
      sfxToPlay = 'blade_clash';
    } else if (aUnit.cat === 'naval') {
      wType = 'vanguard';
      sfxToPlay = 'war_drum';
    }
  }

  // 觸發古代戰場音效 (帶陣營立體聲方位與戶外戰場殘響)
  if (aUnit) {
    if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.play === 'function') {
      SoundEngine.play(sfxToPlay, ln.side);
    }"""

assert old_sfx_block in text, "old_sfx_block not found in app.js"
text = text.replace(old_sfx_block, new_sfx_block, 1)

# 2. 替換擊毀、攔截等文字與聲效
text = text.replace("spawnFloater(tx, ty, '💥 擊毀!', 'kill');\n      SoundEngine.play('explosion', targetSide);",
                    "spawnFloater(tx, ty, '⚔️ 陣亡潰敗!', 'kill');\n      SoundEngine.play('warlord_fall', targetSide);")

text = text.replace("spawnFloater(tx, ty, '🛡️ APS 攔截', 'block');\n      SoundEngine.play('block', targetSide);",
                    "spawnFloater(tx, ty, '🛡️ 重盾格擋!', 'block');\n      SoundEngine.play('shield_block', targetSide);")

text = text.replace("if (wType !== 'ew') SoundEngine.play('hit_impact', targetSide);",
                    "SoundEngine.play('metal_clash', targetSide);")

p.write_text(text, encoding="utf-8")
print("Successfully patched ancient sfx triggers in app.js!")
