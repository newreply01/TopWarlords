# -*- coding: utf-8 -*-
"""
將 all_warlords.json 轉換並生成完整的 D:/TopWarlords/js/data.js
"""
import json

with open("D:/TopWarlords/all_warlords.json", "r", encoding="utf-8") as f:
    warlords = json.load(f)

data_js_template = """'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords) — 資料層
   200 位日韓中純歷史名將 = 5 兵團 × 5 價位 × 8 款 A~H 型
   100% 具備專屬戰術特性、專屬兵器與獨立五維數值
   ===================================================== */
const BUDGET = 15;

const CATS = {
  air:         { label: '奔雷突騎', short: 'CAV', color: '#38bdf8' },
  armor:       { label: '重甲陷陣', short: 'ARM', color: '#fbbf24' },
  air_defense: { label: '神射強弩', short: 'ARC', color: '#a78bfa' },
  naval:       { label: '先登奇兵', short: 'VAN', color: '#22d3ee' },
  support:     { label: '軍師奇謀', short: 'STR', color: '#4ade80' }
};

/* 五大兵團專屬槽位 */
const SLOTS = [
  { id: 's1', label: '突騎槽', fixed: 'air' },
  { id: 's2', label: '重甲槽', fixed: 'armor' },
  { id: 's3', label: '神射槽', fixed: 'air_defense' },
  { id: 's4', label: '先登槽', fixed: 'naval' },
  { id: 's5', label: '軍師槽', fixed: 'support' }
];

const TRAITS = {
  CAS:     '側翼包抄：第三階段突擊敵方重甲傷害 ×1.8（一般部隊 ×1.15）',
  LR:      '馳馬遠射：突騎交鋒命中率 +6%',
  HEAVY:   '玄甲厚鎧：精銳重鎧防護（減傷 20%～28%）',
  APS:     '重盾格擋：大盾自動格擋敵軍第一次來襲的重擊',
  AA_LONG: '強弓遠射：神射強弩命中率 +8%',
  CIWS:    '近衛拒馬：敵方死士與連環火攻傷害減半',
  AEGIS:   '斷騎護陣：階段二可協同神射攔截敵方突騎（火力 55%）',
  SUB:     '潛行夜襲：隱匿極高；對未設防部隊傷害 ×1.3',
  ASW:     '看破反伏：專克潛行夜襲與忍者，傷害 ×1.6',
  AMBUSH:  '一番槍先登：對高費（+2 費以上）敵將傷害 ×1.25',
  SWARM:   '多路並進：同時攻擊兩個目標（單次傷害 ×0.6）',
  EW:      '運籌帷幄：謀略值領先越多，敵方命中最多 −15%、己方攻擊最多 +8%',
  SEAD:    '先制破陣：階段一先制打擊敵方神射箭陣',
  DEEP:    '十面埋伏：階段一直擊敵方最昂貴主帥核心',
  ARTY:    '攻城砲火：第三階段持續以投石火砲轟擊敵陣',
  SAT:     '箭雨覆蓋：同時攻擊兩個目標（單次傷害 ×0.75）',
  TRUE_AT: '破甲重擊：無視重鎧減傷（真實傷害），對重甲額外破防加成',
  SPOT:    '登高觀瞻：為友軍攻城器械與火砲提供校射，傷害 +15%'
};

/* [id, 名稱, 兵種, 費用, 風格, 稱號, 傳記, 隱匿, 謀略, 特性[], roleFlags[], HP, ATK, DEF] */
const RAW_UNITS = [
__RAW_UNITS_PLACEHOLDER__
];

const UNIT_META = {
__UNIT_META_PLACEHOLDER__
};

const UNITS = RAW_UNITS.map(r => {
  const [id, name, cat, cost, v, tag, desc, st, ew, traits, roleFlags, hp, atk, def] = r;
  const meta = UNIT_META[id] || {
    flag: '🇨🇳', origin: '東亞名將',
    weapon: '傳世名兵',
    sfx: 'blade_clash',
    img: ''
  };
  return {
    id, name, cat, cost, v, tag, desc, traits, roleFlags,
    st, ew,
    hp, atk, def,
    flag: meta.flag,
    origin: meta.origin,
    weapon: meta.weapon,
    sfx: meta.sfx,
    img: meta.img
  };
});

const UNIT_MAP = {};
UNITS.forEach(u => { UNIT_MAP[u.id] = u; });

/* ---------- 古代軍陣協同羈絆 (Ancient Battle Formations) ---------- */
const DRONE_IDS = new Set(['TIANDAN', 'GUANDU_CAT', 'XIAOSHI_SCOUT', 'CHENTANG', 'MASANOBU', 'KOGA_SCOUT', 'KORYO_CAT', 'HOGAK_DRUM', 'SHUIGUI', 'KUMANO', 'SINGIJEON']);

const SYNERGIES = [
  {
    id: 'cec',
    icon: '📜',
    name: '八陣神機網',
    desc: '頂尖智聖 (謀略≥50) ＋ 斷騎護將／遠程神射：全軍謀略 +12、神射命中 +6%',
    check: units => units.some(u => (u.ew || 0) >= 50) && units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG')),
    partial: units => {
      const hasEw = units.some(u => (u.ew || 0) >= 50);
      const hasAa = units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG'));
      if (hasEw && !hasAa) return '已備妥頂級軍師，再選【神射強弩或斷騎護將】即可啟動：全軍謀略 +12、神射命中 +6%';
      if (!hasEw && hasAa) return '已備妥神射大陣，再選【$5 頂級軍師 (謀略≥50)】即可啟動：全軍謀略 +12、神射命中 +6%';
      return null;
    }
  },
  {
    id: 'mumt',
    icon: '⚡',
    name: '奇正相生陣',
    desc: '$5 傳奇飛將突騎 ＋ 死士／奇兵伏擊／火攻隊：奇兵與器械傷害 +15%、全體隱匿 +5',
    check: units => units.some(u => u.cat === 'air' && u.cost === 5) && units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM')),
    partial: units => {
      const has5th = units.some(u => u.cat === 'air' && u.cost === 5);
      const hasDrone = units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM'));
      if (has5th && !hasDrone) return '已備妥 $5 飛將突騎，再選【先登死士／奇兵／火攻隊】即可啟動：奇兵傷害 +15%、全軍隱匿 +5';
      if (!has5th && hasDrone) return '已備妥奇兵部隊，再選【$5 傳奇飛將突騎】即可啟動：奇兵傷害 +15%、全軍隱匿 +5';
      return null;
    }
  },
  {
    id: 'asw_net',
    icon: '⚔️',
    name: '水陸伏波破暗陣',
    desc: '先登奇兵／潛行將領 ＋ 謀略高士 (謀略≥15 或 SPOT)：先登命中 +6%、先登傷害 +12%',
    check: units => units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB')) && units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasNav = units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB'));
      const hasSpot = units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT'));
      if (hasNav && !hasSpot) return '已備妥先登奇兵，再選【高智謀臣或觀瞻名將 (謀略≥15)】即可啟動：先登命中 +6%、先登傷害 +12%';
      return null;
    }
  },
  {
    id: 'iron_fist',
    icon: '🛡️',
    name: '步騎火砲合圍',
    desc: '重甲陷陣大將 ＋ 攻城器械／前觀引導：階段三重甲與火砲傷害 +10%',
    check: units => units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS')) && units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasTank = units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS'));
      const hasArty = units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT'));
      if (hasTank && !hasArty) return '已備妥重甲中軍，再選【攻城投石／火器器械／觀瞻名將】即可啟動：重甲與砲火傷害 +10%';
      if (!hasTank && hasArty) return '已備妥攻城支援，再選【重甲陷陣／大盾名將】即可啟動：重甲與砲火傷害 +10%';
      return null;
    }
  }
];

function getDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length < 2) return [];
  return SYNERGIES.filter(syn => syn.check(units));
}

function getPartialDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length === 0 || units.length >= 5) return [];
  const out = [];
  for (const syn of SYNERGIES) {
    if (!syn.check(units) && typeof syn.partial === 'function') {
      const hint = syn.partial(units);
      if (hint) out.push({ id: syn.id, icon: syn.icon, name: syn.name, hint });
    }
  }
  return out;
}

function getUnitSynergyHints(u) {
  if (!u) return [];
  const hints = [];
  const isCecEw = (u.ew || 0) >= 50;
  const isCecAa = (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG');
  if (isCecEw) hints.push({ icon: '📜', name: '八陣神機網', hint: '搭配【斷騎護將／神射弩陣】可啟動：全軍謀略+12、神射命中+6%' });
  if (isCecAa) hints.push({ icon: '📜', name: '八陣神機網', hint: '搭配【$5 頂尖智聖】可啟動：全軍謀略+12、神射命中+6%' });

  const is5th = u.cat === 'air' && u.cost === 5;
  const isDrone = DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM');
  if (is5th) hints.push({ icon: '⚡', name: '奇正相生陣', hint: '搭配【先登死士／奇兵／火攻隊】可啟動：奇兵傷害+15%、全軍隱匿+5' });
  if (isDrone) hints.push({ icon: '⚡', name: '奇正相生陣', hint: '搭配【$5 傳奇飛將突騎】可啟動：奇兵傷害+15%、全軍隱匿+5' });

  const isNav = (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB');
  const isSpot = (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT');
  if (isNav) hints.push({ icon: '⚔️', name: '水陸伏波破暗陣', hint: '搭配【高智謀臣或觀瞻名將】可啟動：先登命中+6%、先登傷害+12%' });
  if (isSpot && u.cat !== 'naval') hints.push({ icon: '⚔️', name: '水陸伏波破暗陣', hint: '搭配【先登奇兵／潛行將領】可啟動：先登命中+6%、先登傷害+12%' });

  const isTank = (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS');
  const isArty = (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT');
  if (isTank) hints.push({ icon: '🛡️', name: '步騎火砲合圍', hint: '搭配【攻城器械／前觀引導】可啟動：重甲與火砲傷害+10%' });
  if (isArty && u.cat !== 'armor') hints.push({ icon: '🛡️', name: '步騎火砲合圍', hint: '搭配【重甲陷陣／大盾名將】可啟動：重甲與火砲傷害+10%' });

  return hints;
}

const MAX_HP = Math.max(...UNITS.map(u => u.hp));
const MAX_ATK = Math.max(...UNITS.map(u => u.atk));

const CAT_HINT = {
  air:         '擅長：高速突擊、側翼破陣。害怕：神射強弩（隱匿奇襲可減少箭雨攔截）。',
  armor:       '擅長：正面死鬥、掌握戰線控制分。害怕：側翼包抄、刺客死士與攻城火砲。',
  air_defense: '擅長：攔截突騎（×2.5）。害怕：階段一被軍師奇謀先制破陣。',
  naval:       '擅長：陣前鬥將、先登水陸奇襲。潛行夜襲刺客需靠看破反伏將領克制。',
  support:     '擅長：軍師謀略先攻、先制破陣斬首、攻城火砲。本身需護衛保護。'
};

/* ---------- 名將氣力與戰術能力標籤 ---------- */
function getUnitRealismBadges(u) {
  if (!u) return { magLabel: '', specials: [] };
  const isDeep = (u.roleFlags || []).includes('STAMINA_DEEP');
  const magLabel = isDeep
    ? '🥋 百戰老將（主力招式 5 波 ➔ 次要 3 波 ➔ 貼身肉搏）'
    : '🥋 充沛氣力（主力招式 4 波 ➔ 次要 3 波 ➔ 貼身肉搏）';
  const specials = [];
  if (isDeep) {
    specials.push({ icon: '🔋', title: '氣力深厚 (+1波)', desc: '主力招式與次要武技各多 1 波深度，持久戰戰力衰退更慢。' });
  }
  if ((u.roleFlags || []).includes('PASSIVE_VOLLEY')) {
    specials.push({ icon: '🏹', title: '隱蔽伏弩', desc: '善用地形隱蔽，階段一不會遭敵方先制破陣優先點名（若被鎖定敵命中 -18%）。' });
  }
  if ((u.roleFlags || []).includes('FORMATION_SHIELD')) {
    specials.push({ icon: '🛡️', title: '護軍大陣', desc: '階段一 78% 機率以大陣化解敵方首波斬首奇襲庇護全軍；無敵騎時轉為號令調度友軍。' });
  }
  if ((u.roleFlags || []).includes('STRATEGIST')) {
    specials.push({ icon: '📜', title: '運籌帷幄', desc: '運籌帷幄調動全軍集火打擊目標，自身不參與近身白刃戰。' });
  }
  if ((u.roleFlags || []).includes('HEAVY_AP')) {
    specials.push({ icon: '🗡️', title: '神兵破甲', desc: '即便進入力竭貼身肉搏階段，仍完整保有破甲（TRUE_AT）無視減傷能力。' });
  }
  return { magLabel, isDeep, specials };
}

/* ---------- 名將征戰服役勳章 (Mastery Ribbons) ---------- */
const MASTERY_STORAGE_KEY = 'wl15_unit_mastery';

function getUnitMasteryMap() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(MASTERY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function getUnitMasteryBadge(unitId) {
  if (!unitId) return null;
  const map = getUnitMasteryMap();
  const rec = map[unitId];
  if (!rec || !rec.s) return null;
  const s = Number(rec.s) || 0;
  const w = Number(rec.w) || 0;
  const m = Number(rec.m) || 0;
  const d = Math.round(Number(rec.d) || 0);
  const winRate = Math.round((w / Math.max(1, s)) * 100);
  let tier = 'service', icon = '🎖️', title = '實戰服役紀錄', color = '#38bdf8', nextHint = '';
  if (s >= 1000 && w >= 650 && (m >= 200 || w >= 800)) {
    tier = 'diamond'; icon = '💎'; title = '玉璽傳奇綬帶'; color = '#a855f7';
    nextHint = '已達最高傳奇服役榮譽';
  } else if (s >= 400 && w >= 250 && (m >= 80 || w >= 320)) {
    tier = 'gold'; icon = '🥇'; title = '金印名將綬帶'; color = '#fbbf24';
    nextHint = `晉升💎玉璽傳奇：出征 ${s}/1000 · 勝場 ${w}/650 · 斬將破陣 ${m}/200`;
  } else if (s >= 150 && w >= 90 && (m >= 30 || w >= 120)) {
    tier = 'silver'; icon = '🥈'; title = '銀印精銳綬帶'; color = '#e2e8f0';
    nextHint = `晉升🥇金印名將：出征 ${s}/400 · 勝場 ${w}/250 · 斬將破陣 ${m}/80`;
  } else if (s >= 50 && w >= 30 && (m >= 10 || w >= 40)) {
    tier = 'bronze'; icon = '🥉'; title = '銅印百戰綬帶'; color = '#f59e0b';
    nextHint = `晉升🥈銀印精銳：出征 ${s}/150 · 勝場 ${w}/90 · 斬將破陣 ${m}/30`;
  } else {
    nextHint = `解鎖🥉銅印百戰：出征 ${s}/50 · 勝場 ${w}/30 · 斬將破陣 ${m}/10`;
  }
  return {
    tier, icon, title, color,
    sorties: s, wins: w, mvps: m, dmg: d, winRate, nextHint,
    summary: `出征 ${s} 場 · 勝場 ${w} (${winRate}%) · 斬將破陣 ${m} 次 · 累計殺傷 ${d.toLocaleString()}`
  };
}

function recordUnitMasteryFromBattle(res, mySide = 'A') {
  try {
    if (typeof localStorage === 'undefined' || !res || !res.final) return;
    const myUnits = res.final[mySide] || [];
    if (!myUnits.length) return;
    const won = res.winner === mySide;
    const myMvp = res.mvp ? res.mvp[mySide] : null;
    const map = getUnitMasteryMap();
    myUnits.forEach(u => {
      if (!u || !u.id) return;
      const cur = map[u.id] || { s: 0, w: 0, m: 0, d: 0 };
      cur.s = (Number(cur.s) || 0) + 1;
      if (won) {
        cur.w = (Number(cur.w) || 0) + 1;
        if (myMvp && myMvp.id === u.id && (Number(u.dmgDone) || 0) > 0) {
          cur.m = (Number(cur.m) || 0) + 1;
        }
      }
      cur.d = Math.round((Number(cur.d) || 0) + (Number(u.dmgDone) || 0));
      map[u.id] = cur;
    });
    localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

/* ---------- 推薦經典名將陣容 (Recommended Historical Formations) ---------- */
const TEMPLATES = [
  { name: '八陣神機', note: '諸葛奇謀＋八陣合圍', ids: ['CAOZHANG', 'DIANWEI', 'ZHUGELIAN', 'SHUIGUI', 'ZHUGELIANG'] },
  { name: '封狼居胥', note: '霍去病千里奔襲破敵', ids: ['HUO', 'BYEOLMUBAN', 'SINGIJEON', 'HATTORI', 'PANGTONG'] },
  { name: '殺神陷陣', note: '武安君白起正面破陣', ids: ['DENGAI', 'BAIQI', 'CHOIMUSEON', 'JIANGQIN', 'ZHUGUKE'] },
  { name: '鳴梁伏波', note: '忠武公李舜臣水陸連環', ids: ['LINGTONG', 'KATOKIYOMASA', 'CHOIMUSEON', 'YISUNSIN', 'CHENGYU'] },
  { name: '天下布武', note: '織田信長三段火器齊射', ids: ['DATE', 'SHIMAZUY', 'NOBUNAGA', 'DINGFENG', 'LUSU'] }
];

/* 暴露至全域物件以便跨模組與 Playwright 調用 */
if (typeof window !== 'undefined') {
  window.BUDGET = BUDGET;
  window.CATS = CATS;
  window.TRAITS = TRAITS;
  window.CAT_HINT = CAT_HINT;
  window.UNITS = UNITS;
  window.UNIT_MAP = UNIT_MAP;
  window.SYNERGIES = SYNERGIES;
  window.TEMPLATES = TEMPLATES;
  window.getDeckSynergies = getDeckSynergies;
  window.getUnitSynergyHints = getUnitSynergyHints;
  window.getUnitRealismBadges = getUnitRealismBadges;
  window.getUnitMasteryBadge = getUnitMasteryBadge;
  window.recordUnitMasteryFromBattle = recordUnitMasteryFromBattle;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUDGET, CATS, TRAITS, CAT_HINT, UNITS, UNIT_MAP, SYNERGIES, TEMPLATES,
    getDeckSynergies, getUnitSynergyHints, getUnitRealismBadges,
    getUnitMasteryBadge, recordUnitMasteryFromBattle
  };
}
"""

raw_units_lines = []
for u in warlords:
    line = f"  [{json.dumps(u['id'], ensure_ascii=False)}, {json.dumps(u['name'], ensure_ascii=False)}, '{u['cat']}', {u['cost']}, '{u['v']}', {json.dumps(u['tag'], ensure_ascii=False)}, {json.dumps(u['desc'], ensure_ascii=False)}, {u['st']}, {u['ew']}, {json.dumps(u['traits'], ensure_ascii=False)}, {json.dumps(u['roleFlags'], ensure_ascii=False)}, {u['hp']}, {u['atk']}, {u['def']}],"
    raw_units_lines.append(line)

unit_meta_lines = []
for u in warlords:
    img_path = f"assets/warlords/{u['id']}.jpg?v=1.0.0"
    line = f"  {u['id']}: {{ flag: '{u['flag']}', origin: '{u['origin']}', weapon: '{u['weapon']}', sfx: '{u['sfx']}', img: '{img_path}' }},"
    unit_meta_lines.append(line)

full_content = data_js_template.replace("__RAW_UNITS_PLACEHOLDER__", "\n".join(raw_units_lines))
full_content = full_content.replace("__UNIT_META_PLACEHOLDER__", "\n".join(unit_meta_lines))

with open("D:/TopWarlords/js/data.js", "w", encoding="utf-8") as f:
    f.write(full_content)

print(f"成功生成 D:/TopWarlords/js/data.js，包含 {len(warlords)} 位名將！")
