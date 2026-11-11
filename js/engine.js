'use strict';
/* =====================================================
   戰鬥引擎：確定性（種子化）三階段古戰場推演 (TopWarlords)
   同一組輸入（兩副名將陣容 + 戰場 + 教條 + 種子）永遠得到相同結果
   ===================================================== */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const other = s => (s === 'A' ? 'B' : 'A');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- 古戰場環境（賽前公開，每場輪動，Meta 不會固化） ---------- */
const EVENTS = [
  { id: 'plain',  icon: '🌾', name: '開闊曠野', desc: '平野利於大軍衝殺：重甲與突騎火力 +20%，先登奇兵伏擊 −25%。', mod: { armorDmg: 1.2, navalDmg: 0.75 } },
  { id: 'strait', icon: '🌊', name: '險峻峽谷', desc: '江河水網林地險阻：先登奇兵火力 +25%，中軍重甲火力 −15%。', mod: { navalDmg: 1.25, armorDmg: 0.85 } },
  { id: 'storm',  icon: '⛈', name: '暴雨雷暴', desc: '暴風驟雨視線昏暗：突騎與神射命中率 −15%，奇謀火計暗襲 −25%。', mod: { airHit: -0.15, droneDmg: 0.75 } },
  { id: 'urban',  icon: '🏯', name: '城下巷戰', desc: '城防隘口地狹：攻城火砲 −25%、重甲 −10%，忍軍死士奇襲 +30%。', mod: { artyDmg: 0.75, droneDmg: 1.3, armorDmg: 0.9 } },
  { id: 'em',     icon: '🌫', name: '大霧彌天', desc: '天地莫測：軍師謀略效果 ×1.6；全軍隱匿 +10。', mod: { ewMult: 1.6, stealthAdd: 10 } },
  { id: 'clear',  icon: '☀', name: '秋高氣爽', desc: '標準古戰場，天時地利無任何修正。', mod: {} }
];

/* ---------- 兵法戰術教條（賽前 3 選 1，源自《孫子兵法》與風林火山） ---------- */
const DOCTRINES = [
  { id: 'strike',    icon: '🌪️', name: '疾如風', desc: '奇襲破敵：階段一、二攻擊 +12%，但承受傷害 +5%。' },
  { id: 'defense',   icon: '⛰️', name: '不動如山', desc: '固守待援：承受傷害 −12%，神射攔截命中 +6%。' },
  { id: 'deception', icon: '🌑', name: '難知如陰', desc: '虛實奇謀：軍師謀略值 ×1.5；敵方全體命中率 −8%。' }
];
const DOC_FX = {
  strike:     { atkEarly: 1.12, taken: 1.05, adHit: 0,    ewMult: 1,   enemyPen: 0 },
  defense:    { atkEarly: 1,    taken: 0.88, adHit: 0.06, ewMult: 1,   enemyPen: 0 },
  deception:  { atkEarly: 1,    taken: 1,    adHit: 0,    ewMult: 1.5, enemyPen: 0.08 },
  electronic: { atkEarly: 1,    taken: 1,    adHit: 0,    ewMult: 1.5, enemyPen: 0.08 },
  air_sup:    { atkEarly: 1.12, taken: 1.05, adHit: 0,    ewMult: 1,   enemyPen: 0 }
};

/* ---------- 武將戰術標記 (Role Flags) 判定輔助函式 ---------- */
function hasRoleFlag(u, flag) {
  if (!u) return false;
  if (Array.isArray(u.roleFlags) && u.roleFlags.includes(flag)) return true;
  if (u.raw && Array.isArray(u.raw.roleFlags) && u.raw.roleFlags.includes(flag)) return true;
  // 向後相容 UNIT_MAP 上的欄位
  if (typeof UNIT_MAP !== 'undefined' && UNIT_MAP[u.id]) {
    const d = UNIT_MAP[u.id];
    if (Array.isArray(d.roleFlags) && d.roleFlags.includes(flag)) return true;
  }
  return false;
}

function getAmmoProfile(u) {
  const bonus = hasRoleFlag(u, 'STAMINA_DEEP') ? 1 : 0;
  const s = u.shots || 0;
  if (s < 4 + bonus) {
    return { tier: 1, dmgMult: 1.00, hitMod: 0, canSat: true, canSwarm: true, canTrueAt: true };
  }
  if (s < 7 + bonus) {
    return { tier: 2, dmgMult: 0.78, hitMod: 0, canSat: false, canSwarm: true, canTrueAt: true };
  }
  return { tier: 3, dmgMult: 0.52, hitMod: -0.06, canSat: false, canSwarm: false, canTrueAt: hasRoleFlag(u, 'HEAVY_AP') };
}

function getCombatRoleSummary(unit) {
  return ({
    air: '突騎：衝擊側翼，提防神射攔截',
    armor: '重甲：正面護陣，提防破甲攻擊',
    air_defense: '神射：優先攔截突騎，失去掩護才近戰',
    naval: '先登：側翼突襲，依特性破陣',
    support: '軍師：後方號令，依專屬戰法支援'
  })[unit.cat] || '依武將特性與專屬戰法交戰';
}

function getCombatMatchup(attacker, target, phase, trueDamage = false, skillProc = false, armorPierce = 0) {
  if (trueDamage || armorPierce >= 1) return '破甲：本次忽略護甲';
  if (armorPierce > 0 && target.def > 0) return `破甲：護甲效果降低 ${Math.round(armorPierce * 100)}%`;
  if (attacker.cat === 'air_defense' && target.cat === 'air') return '神射攔截突騎';
  if (skillProc && attacker.skill?.phase === `P${phase}` && attacker.skill.effects?.bonusVs?.[target.cat]) return '專屬戰法兵種加成';
  if (attacker.cat === 'air' && target.cat === 'armor') return '突騎衝擊重甲';
  if (target.cat === 'armor' && target.def > 0) return '重甲承受護甲減傷';
  return '';
}

function getSkillAttackModifiers(attacker, target, phase, terrain = 'plain') {
  const active = !attacker.skillUsed && attacker.skill?.phase === `P${phase}`;
  const effects = active ? attacker.skill.effects : null;
  const missingHp = clamp(1 - attacker.hp / attacker.hpMax, 0, 1);
  const targetMissingHp = clamp(1 - target.hp / target.hpMax, 0, 1);
  return {
    damage: active ? (effects ? (effects.damage || 1)
      + missingHp * (effects.missingHpDamage || 0)
      + targetMissingHp * (effects.woundedTargetDamage || 0)
      + (target.cost > attacker.cost ? effects.highCostDamage || 0 : 0)
      + (['mountain', 'forest'].includes(terrain) ? effects.terrainDamage || 0 : 0)
      + (effects.bonusVs?.[target.cat] || 0)
      : ({ 1: 1.12, 2: 1.15, 3: 1.18 }[phase] || 1)) : 1,
    armorPierce: effects?.armorPierce || 0,
    hit: effects?.hit || 0
  };
}

function resolveBrevityAndSfx(at, t, tier, skillProc = false) {
  if (hasRoleFlag(at, 'STRATEGIST') || (hasRoleFlag(at, 'FORMATION_SHIELD') && t && t.cat !== 'air')) {
    const label = skillProc && at.skill && at.skill.name
      ? at.skill.name
      : (tier === 1 ? (at.skill && at.skill.name ? at.skill.name : '軍師號令') : (tier === 2 ? '謀略調度' : '運籌決勝'));
    return { brv: label, sfxOverride: 'strategy_gong', isC4isr: true };
  }
  if (skillProc && at.skill && at.skill.name) {
    return { brv: at.skill.name, sfxOverride: null, isC4isr: false };
  }
  if (tier === 1) {
    let brv = '絕技破敵';
    if (at.cat === 'air') {
      brv = (t.cat === 'air') ? (at.traits.includes('LR') ? '馳騎奔射' : '騎兵交鋒') : '側翼突襲';
    } else if (at.cat === 'air_defense' || (at.traits.includes('AEGIS') && t.cat === 'air')) {
      brv = (t.cat === 'air') ? '萬箭齊發' : '連弩平射';
    } else if (at.cat === 'armor') {
      brv = (at.traits.includes('TRUE_AT') ? '陌刀破甲' : '鐵盾重擊');
    } else if (at.cat === 'naval') {
      brv = at.traits.includes('SUB') ? '夜襲刺殺' : '先登斬將';
    } else if (at.cat === 'support') {
      if (at.traits.includes('SEAD')) brv = '先制破陣';
      else if (at.traits.includes('DEEP')) brv = '十面埋伏';
      else if (at.traits.includes('TRUE_AT')) brv = '火牛破敵';
      else if (at.traits.includes('EW') || at.traits.includes('SPOT')) brv = '奇謀引導';
      else brv = '霹靂砲轟';
    }
    return { brv, sfxOverride: null, isC4isr: false };
  }
  if (tier === 2) {
    if (at.cat === 'air') {
      return t.cat === 'air'
        ? { brv: '長槍挑刺', sfxOverride: 'blade_clash', isC4isr: false }
        : { brv: '游騎馳射', sfxOverride: 'arrow_volley', isC4isr: false };
    }
    if (at.cat === 'armor') return { brv: '長刀橫掃', sfxOverride: 'blade_clash', isC4isr: false };
    if (at.cat === 'naval') {
      return at.traits.includes('SUB')
        ? { brv: '短兵伏擊', sfxOverride: 'blade_clash', isC4isr: false }
        : { brv: '中軍接戰', sfxOverride: 'blade_clash', isC4isr: false };
    }
    if (at.cat === 'air_defense') {
      return t.cat === 'air'
        ? { brv: '神射快箭', sfxOverride: 'arrow_volley', isC4isr: false }
        : { brv: '短弓防守', sfxOverride: 'arrow_volley', isC4isr: false };
    }
    const isDrone = typeof DRONE_IDS !== 'undefined' && DRONE_IDS.has(at.id);
    return isDrone
      ? { brv: '死士再襲', sfxOverride: 'fire_attack', isC4isr: false }
      : { brv: '投石連擊', sfxOverride: 'war_drum', isC4isr: false };
  }
  // Tier 3：主次武技告罄、氣力見底，切換佩劍/匕首貼身肉搏
  if (at.cat === 'air') return { brv: '佩劍格殺', sfxOverride: 'blade_clash', isC4isr: false };
  if (at.cat === 'armor') return { brv: '貼身肉搏', sfxOverride: 'blade_clash', isC4isr: false };
  if (at.cat === 'naval') {
    return at.traits.includes('SUB')
      ? { brv: '匕首死戰', sfxOverride: 'blade_clash', isC4isr: false }
      : { brv: '短兵死守', sfxOverride: 'blade_clash', isC4isr: false };
  }
  if (at.cat === 'air_defense') {
    return hasRoleFlag(at, 'FORMATION_SHIELD')
      ? { brv: '大陣死守', sfxOverride: 'war_drum', isC4isr: false }
      : { brv: '拔劍自衛', sfxOverride: 'blade_clash', isC4isr: false };
  }
  return { brv: '親衛死守', sfxOverride: 'blade_clash', isC4isr: false };
}

/* ---------- 主戰鬥函式 ---------- */
const DMG_SCALE = 1.0;


const BATTLE_FORMATION_DEFS = [
  { id: 'fishscale', name: '魚鱗', desc: '野戰均衡、攻守穩定，戰法發動率提高。', attack: 1, damageTaken: 1, hit: 0, tacticChance: 0.06, tacticDamage: 1.08, layout: 'line' },
  { id: 'spearhead', name: '鋒矢', desc: '突擊高傷、戰法較易發動，但承受傷害增加。', attack: 1.12, damageTaken: 1.08, hit: 0.03, tacticChance: 0.12, tacticDamage: 1.2, layout: 'wedge' },
  { id: 'square', name: '方圓', desc: '穩守持久，減少承受傷害；不易發動戰法。', attack: 0.9, damageTaken: 0.78, hit: -0.02, tacticChance: 0, tacticDamage: 1, layout: 'square', duelImmune: true },
  { id: 'goose', name: '雁行', desc: '遠距火力與命中提升，但防禦較弱，無法俘虜敵將。', attack: 1.1, damageTaken: 1.12, hit: 0.04, tacticChance: 0.03, tacticDamage: 1.15, layout: 'staggered', ranged: true, canCapture: false },
  { id: 'crane', name: '鶴翼', desc: '展開兩翼包抄，略增命中與攻勢。', attack: 1.05, damageTaken: 1, hit: 0.02, tacticChance: 0.04, tacticDamage: 1.15, layout: 'wings', occupation: true },
  { id: 'longsnake', name: '長蛇', desc: '山地、森林中攻防能力提升 50%。', attack: 1, damageTaken: 1, hit: 0, tacticChance: 0.02, tacticDamage: 1.15, layout: 'column', terrainMultiplier: 1.5 },
  { id: 'cone', name: '錐行', desc: '高速穿插；戰鬥力較弱且無法發動戰法。', attack: 0.78, damageTaken: 1.05, hit: -0.02, tacticChance: 0, tacticDamage: 1, layout: 'cone', mobility: 1.5 },
  { id: 'fourYi', name: '四夷', desc: '由孟獲或沙摩柯領軍解鎖；全軍在山岳、森林中攻防提升 50%，容易發動戰法。', attack: 1, damageTaken: 1, hit: 0, tacticChance: 0.14, tacticDamage: 1.2, layout: 'wedge', terrainMultiplier: 1.5, eligibleUnitIds: ['MENGHUO', 'SHAMOKE'] }
];

const BATTLE_TERRAINS = [
  { id: 'plain', name: '平原' },
  { id: 'mountain', name: '山岳' },
  { id: 'forest', name: '森林' }
];

function getBattleFormation(id) {
  return BATTLE_FORMATION_DEFS.find(formation => formation.id === id) || BATTLE_FORMATION_DEFS[0];
}

function getRecommendedFormations(deck, terrain = 'plain') {
  const rough = terrain === 'mountain' || terrain === 'forest';
  const id = rough && (deck || []).some(unit => ['MENGHUO', 'SHAMOKE'].includes(unit)) ? 'fourYi'
    : rough ? 'longsnake' : 'fishscale';
  return (deck || []).map(() => id);
}

function normalizeArmyFormations(values, deck = null, fallback = 'fishscale') {
  const choices = typeof values === 'string' ? [values] : Array.isArray(values) ? values : [];
  const selected = choices.find(id => BATTLE_FORMATION_DEFS.some(formation => formation.id === id)) || fallback;
  const formation = getBattleFormation(selected);
  const id = formation.eligibleUnitIds && deck && !deck.some(unit => formation.eligibleUnitIds.includes(unit))
    ? 'fishscale' : formation.id;
  return Array(5).fill(id);
}

function getBattleEnvironment(event, terrain = 'plain') {
  const weather = event?.id || 'clear';
  const selected = BATTLE_TERRAINS.some(item => item.id === terrain) ? terrain : 'plain';
  return {
    scene: weather === 'strait' ? 'canyon' : weather === 'urban' ? 'city'
      : weather === 'plain' ? 'grassland' : weather === 'em' ? 'fog' : weather === 'storm' ? 'storm' : selected,
    terrain: weather === 'strait' ? 'mountain' : ['plain', 'urban'].includes(weather) ? 'plain' : selected,
    weather
  };
}

function makeTeam(ids, side, formationIds, terrain) {
  const armyFormations = normalizeArmyFormations(formationIds, ids);
  return ids.map((id, i) => {
    const d = UNIT_MAP[id] || {
      name: '主力名將', cat: 'air', cost: 1, v: 'A',
      traits: [], roleFlags: [], hp: 120, atk: 60, def: 0, st: 0, ew: 0
    };
    const formation = getBattleFormation(armyFormations[i]);
    const terrainMultiplier = ((formation.id === 'longsnake' || formation.id === 'fourYi') && (terrain === 'mountain' || terrain === 'forest'))
      ? formation.terrainMultiplier
      : 1;
    return {
      uid: `${id}-${side}${i}`, side, id, name: d.name, cat: d.cat, cost: d.cost, v: d.v,
      traits: d.traits || [], roleFlags: d.roleFlags || [], hpMax: d.hp, hp: d.hp, atk: d.atk, def: d.def,
      stealth: d.st || 0, ew: d.ew || 0, skill: d.skill || null, alive: true, apsUsed: false, abmUsed: false,
      skillUsed: false, ambushUsed: false, skillGuard: 0,
      shots: 0, dmgDone: 0, killedBy: null,
      formation: formation.id,
      formationName: formation.name,
      formationAttack: formation.attack * terrainMultiplier,
      formationDefense: terrainMultiplier,
      formationDamageTaken: formation.damageTaken,
      formationHit: formation.hit,
      formationTacticChance: formation.tacticChance,
      formationTacticDamage: formation.tacticDamage,
      formationLayout: formation.layout,
      formationMobility: formation.mobility || 1,
      formationRanged: Boolean(formation.ranged),
      formationOccupation: Boolean(formation.occupation || formation.id === 'cone'),
      formationDuelImmune: Boolean(formation.duelImmune),
      formationCanCapture: formation.canCapture !== false,
      captured: false,
      duelUsed: false
    };
  });
}
function resolveBattle(deckA, deckB, opts) {
  opts = opts || {};
  const seed = opts.seed == null ? (Math.random() * 4294967296) >>> 0 : opts.seed;
  const rng = mulberry32(seed);
  const ev = opts.event || EVENTS[EVENTS.length - 1];
  const m = Object.assign({ armorDmg: 1, navalDmg: 1, artyDmg: 1, droneDmg: 1, airHit: 0, ewMult: 1, stealthAdd: 0 }, ev.mod || {});
  const terrain = getBattleEnvironment(ev, opts.terrain).terrain;
  const T = {
    A: makeTeam(deckA, 'A', opts.formationsA, terrain),
    B: makeTeam(deckB, 'B', opts.formationsB, terrain)
  };
  const normDoc = d => (d === 'electronic' ? 'deception' : d === 'air_sup' ? 'strike' : (DOC_FX[d] ? d : 'defense'));
  const docs = { A: normDoc(opts.docA), B: normDoc(opts.docB) };
  const S = {
    A: Object.assign({ hitPen: 0, ewBonus: 0, navHit: 0, navMult: 1, droneMult: 1, landMult: 1 }, DOC_FX[docs.A]),
    B: Object.assign({ hitPen: 0, ewBonus: 0, navHit: 0, navMult: 1, droneMult: 1, landMult: 1 }, DOC_FX[docs.B])
  };
  S.A.hitPen = S.B.enemyPen;
  S.B.hitPen = S.A.enemyPen;

  const syn = {
    A: typeof getDeckSynergies === 'function' ? getDeckSynergies(T.A) : [],
    B: typeof getDeckSynergies === 'function' ? getDeckSynergies(T.B) : []
  };
  for (const s of ['A', 'B']) {
    for (const sy of syn[s]) {
      if (sy.id === 'cec') { S[s].ewBonus += 12; S[s].adHit += 0.06; }
      if (sy.id === 'mumt') { S[s].droneMult *= 1.15; T[s].forEach(u => { u.stealth += 5; }); }
      if (sy.id === 'asw_net') { S[s].navHit += 0.06; S[s].navMult *= 1.12; }
      if (sy.id === 'iron_fist') { S[s].landMult *= 1.10; }
    }
  }

  const frames = [];
  const keys = [];
  const alive = (s, f) => T[s].filter(u => u.alive && (!f || f(u)));
  const over = () => alive('A').length === 0 || alive('B').length === 0;
  const snap = () => { const o = {}; for (const s of ['A', 'B']) for (const u of T[s]) o[u.uid] = Math.round(u.hp); return o; };
  const pushFrame = (phase, title, lines, metadata) => {
    if (!lines.length) lines = [{ side: 'N', kind: 'info', text: '本輪無有效交鋒。' }];
    frames.push(Object.assign({ phase, title, lines, hp: snap() }, metadata || {}));
  };
  const addKey = (imp, text, side) => keys.push({ frame: frames.length, imp, text, side });

  function pickTop(list) {
    if (!list.length) return null;
    if (rng() < 0.3) return list[Math.floor(rng() * list.length)];
    return list.slice().sort((a, b) => b.cost - a.cost || b.hpMax - a.hpMax)[0];
  }
  function pickN(list, n) {
    if (!list.length) return [];
    const first = pickTop(list);
    const out = [first];
    const rest = list.filter(u => u !== first);
    while (out.length < n && rest.length) out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
    return out;
  }
  function hitP(att, tgt, base, w, extra, stealthScale) {
    const sc = stealthScale == null ? 1 : stealthScale;
    return base - (((tgt.stealth + m.stealthAdd) * sc) / 100) * w - S[att.side].hitPen + (extra || 0) + (att.formationHit || 0);
  }

  function applySkillEffects(unit, lines) {
    const effects = unit.skill?.effects || {};
    unit.skillGuard = Math.max(unit.skillGuard, effects.guard || 0);
    const hpBefore = unit.hp;
    unit.hp = Math.min(unit.hpMax, unit.hp + unit.hpMax * (effects.heal || 0));
    S[unit.side].skillGuard = Math.max(S[unit.side].skillGuard || 0, effects.teamGuard || 0);
    S[unit.side].skillHit = Math.max(S[unit.side].skillHit || 0, effects.teamHit || 0);
    S[other(unit.side)].skillHitPen = Math.max(S[other(unit.side)].skillHitPen || 0, effects.enemyHit || 0);
    if (effects.commandAttack) S[unit.side].atkAll = (S[unit.side].atkAll || 1) * (1 + effects.commandAttack);
    lines.push({
      side: unit.side, kind: 'info', auid: unit.uid, brevity: unit.skill.name,
      skillActivation: true, skillEffects: effects, hpRestored: unit.hp - hpBefore,
      text: `[${unit.skill.name}] ${unit.name}：${unit.skill.desc}`
    });
  }

  /* 同步結算：先全部擲骰，再統一套用傷害 */
  function volley(attacks, vOpts) {
    vOpts = vOpts || {};
    const lines = vOpts.prefixLines ? vOpts.prefixLines.slice() : [];
    const rolled = [];
    for (const a of attacks) {
      if (!a.tgt) continue;
      const skillModifiers = getSkillAttackModifiers(a.att, a.tgt, vOpts.phase, terrain);
      const p = clamp(a.hit + skillModifiers.hit + (S[a.att.side].skillHit || 0) - (S[a.att.side].skillHitPen || 0), 0.08, 0.96);
      const ok = rng() < p;
      const skillPhase = Number(String(a.att.skill?.phase || '').replace('P', ''));
      const skillProc = Boolean(ok && !a.att.skillUsed && skillPhase === vOpts.phase);
      const ambushProc = Boolean(ok && !a.att.ambushUsed && a.att.traits.includes('AMBUSH') && a.tgt.cost >= a.att.cost + 2);
      if (skillProc) a.att.skillUsed = true;
      if (ambushProc) a.att.ambushUsed = true;
      const tacticProc = ok && a.att.formationTacticChance > 0 && rng() < a.att.formationTacticChance;
      const canDuel = vOpts.allowDuels && ok && ['air', 'armor', 'naval'].includes(a.att.cat) && ['air', 'armor', 'naval'].includes(a.tgt.cat)
        && !a.att.formationDuelImmune && !a.tgt.formationDuelImmune && !a.att.duelUsed && !a.tgt.duelUsed;
      const duelProc = Boolean(canDuel && rng() < 0.12);
      if (duelProc) {
        a.att.duelUsed = true;
        a.tgt.duelUsed = true;
      }
      rolled.push({
        a, p, ok, tacticProc, duelProc, skillProc, ambushProc, skillModifiers,
        raw: a.dmg * (0.85 + rng() * 0.3) * DMG_SCALE * (S[a.att.side].atkAll || 1) * a.att.formationAttack * (tacticProc ? a.att.formationTacticDamage : 1) * (duelProc ? 1.12 : 1) * skillModifiers.damage * (ambushProc ? 1.25 : 1)
      });
    }
    for (const roll of rolled) {
      if (roll.skillProc) applySkillEffects(roll.a.att, lines);
      if (roll.ambushProc) lines.push({
        side: roll.a.att.side, kind: 'info', auid: roll.a.att.uid, tuid: roll.a.tgt.uid,
        brevity: '奇襲突擊', ambushActivation: true,
        text: `[奇襲突擊] ${roll.a.att.name} 對高價目標 ${roll.a.tgt.name} 發起一次性伏擊，本次傷害 ×1.25。`
      });
    }
    for (const r of rolled) {
      const a = r.a, t = a.tgt, at = a.att;
      if (!t.alive) continue;
      const pct = Math.round(r.p * 100);
      const tier = a.ammoTier || 1;
      const meta = resolveBrevityAndSfx(at, t, tier, r.skillProc);
      const brv = r.skillProc ? meta.brv : (r.ambushProc ? '奇襲突擊' : meta.brv);
      const matchup = getCombatMatchup(at, t, vOpts.phase, a.trueDmg, r.skillProc, r.skillModifiers.armorPierce);

      if (!r.ok) {
        const missCode = tier === 3 ? '力竭偏差' : '身法規避';
        const missDesc = meta.isC4isr
          ? `[身法規避] ${at.name} 指揮合圍 ${t.name}：敵將機敏避開（${pct}% 機率）`
          : (tier === 3
              ? `[力竭偏差] ${at.name} → ${t.name}：氣力不支招式偏斜（${pct}% 機率）`
              : `[身法規避] ${at.name} → ${t.name}：招式落空未中（${pct}% 機率）`);
        lines.push({
          side: at.side,
          kind: 'miss',
          auid: at.uid,
          tuid: t.uid,
          brevity: missCode,
          ammoTier: tier,
          sfxOverride: meta.sfxOverride,
          text: missDesc,
          hpAfter: Math.round(t.hp)
        });
        continue;
      }

      // 八陣護軍（如諸葛亮、戚繼光）：階段一護軍大陣阻絕敵方先制刺殺與破陣奇謀
      if (vOpts.allowAbm && !hasRoleFlag(at, 'STRATEGIST')) {
        const abm = alive(t.side, u => hasRoleFlag(u, 'FORMATION_SHIELD') && !u.abmUsed)[0];
        if (abm) {
          abm.abmUsed = true;
          abm.apsUsed = true;
          abm.shots++;
          if (rng() < 0.78) {
            lines.push({
              side: t.side,
              kind: 'block',
              auid: abm.uid,
              tuid: at.uid,
              brevity: '八陣護主',
              sfxOverride: 'strategy_gong',
              text: `[八陣護軍] ${abm.name} 佈下防禦大陣，及時擋下了 ${at.name} 的先制奇襲（庇護 ${t.name}）！`,
              hpAfter: Math.round(at.hp)
            });
            addKey(4, `${abm.name} 結成護軍大陣化解了 ${at.name} 的先手奇謀`, t.side);
            continue;
          }
        }
      }

      if (t.traits.includes('APS') && !t.apsUsed) {
        t.apsUsed = true;
        lines.push({
          side: t.side,
          kind: 'block',
          auid: at.uid,
          tuid: t.uid,
          brevity: '盾陣格擋',
          text: `[重盾格擋] ${t.name} 舉盾硬生生格擋下 ${at.name} 首波衝擊！`,
          hpAfter: Math.round(t.hp)
        });
        addKey(3, `${t.name} 的重盾格擋阻斷了 ${at.name} 的首波攻勢`, t.side);
        continue;
      }
      const d = r.raw * (a.trueDmg ? 1 : (1 - Math.min(0.9, t.def * t.formationDefense * (1 - r.skillModifiers.armorPierce)))) * S[t.side].taken * t.formationDamageTaken * (1 - Math.max(t.skillGuard, S[t.side].skillGuard || 0));
      t.hp -= d;
      at.dmgDone += d;
      if (t.hp <= 0) {
        t.hp = 0; t.alive = false; t.killedBy = at;
        const captured = at.formationCanCapture && rng() < 0.18;
        t.captured = captured;
        const killCode = (t.cat === 'air') ? '陣斬落馬' : (t.cat === 'armor') ? '重創破陣' : '力竭戰死';
        const killLabel = (t.cat === 'air') ? '斬落馬下' : (t.cat === 'armor') ? '潰敗破陣' : '陣前討取';
        const actionVerb = meta.isC4isr ? '指揮聯合圍剿討取' : '擊破討取';
        lines.push({
          side: at.side,
          kind: captured ? 'capture' : 'kill',
          matchup,
          formation: at.formation,
          formationTactic: r.tacticProc,
          duel: r.duelProc,
          captured,
          auid: at.uid,
          tuid: t.uid,
          brevity: r.skillProc ? at.skill.name : (r.ambushProc ? '奇襲突擊' : killCode),
          ammoTier: tier,
          sfxOverride: meta.sfxOverride,
          dmg: Math.round(d),
          text: captured
            ? `[俘虜] ${r.skillProc ? `【${at.skill.name}】 ` : (r.ambushProc ? '[奇襲] ' : '')}${at.name} 擒獲 ${t.name}！`
            : r.duelProc
            ? `[一騎單挑] ${at.name} 與 ${t.name} 正面交鋒後 ${actionVerb}！`
            : r.skillProc
              ? `[${at.skill.name}] ${at.name} 施展專屬戰法，${actionVerb} ${t.name}！`
              : r.ambushProc
                ? `[奇襲突擊] ${at.name} 趁隙突襲 ${t.name}！`
                : `[${killCode} ${killLabel}] ${at.name} ${actionVerb} ${t.name}！`,
          hpAfter: 0
        });
        addKey(t.cost * 2 + Math.max(0, t.cost - at.cost) * 2, captured
          ? `${at.name}（$${at.cost}）擒獲 ${t.name}（$${t.cost}）`
          : `${at.name}（$${at.cost}）陣斬 ${t.name}（$${t.cost}）`, at.side);
      } else {
        const hitArrow = meta.isC4isr ? '調兵圍攻 →' : '→';
        lines.push({
          side: at.side,
          kind: 'hit',
          matchup,
          duel: r.duelProc,
          auid: at.uid,
          tuid: t.uid,
          formation: at.formation,
          formationTactic: r.tacticProc,
          brevity: r.duelProc ? '一騎單挑' : brv,
          ammoTier: tier,
          sfxOverride: meta.sfxOverride,
          dmg: Math.round(d),
          text: r.duelProc
            ? `[一騎單挑] ${at.name} 與 ${t.name} 近身交鋒：重創 −${Math.round(d / t.hpMax * 100)}%（剩餘 ${Math.round(t.hp / t.hpMax * 100)}% 戰力）`
            : `[${brv}] ${at.name} ${hitArrow} ${t.name}：重創 −${Math.round(d / t.hpMax * 100)}%（剩餘 ${Math.round(t.hp / t.hpMax * 100)}% 戰力）`,
          hpAfter: Math.round(t.hp)
        });
      }
    }
    return lines;
  }

  /* ===== 階段一：軍師謀略博弈與先制奇襲 ===== */
  const ewOf = s => (alive(s).reduce((x, u) => x + u.ew, 0) + S[s].ewBonus) * S[s].ewMult * m.ewMult;
  const ewA = ewOf('A'), ewB = ewOf('B');
  let advSide = null;
  const l1 = [];
  const terrainName = BATTLE_TERRAINS.find(item => item.id === terrain).name;
  l1.push({ side: 'N', kind: 'info', text: `戰場地形：${terrainName}` });
  l1.push({ side: 'A', kind: 'info', text: `我軍布陣：${T.A.map(unit => unit.formationName).join('、')}` });
  l1.push({ side: 'B', kind: 'info', text: `敵軍布陣：${T.B.map(unit => unit.formationName).join('、')}` });
  if (syn.A.length) l1.push({ side: 'A', kind: 'info', text: `我方啟動軍陣協同體系：${syn.A.map(x => x.icon + ' ' + x.name).join('、')}` });
  if (syn.B.length) l1.push({ side: 'B', kind: 'info', text: `敵方啟動軍陣協同體系：${syn.B.map(x => x.icon + ' ' + x.name).join('、')}` });
  l1.push({ side: 'N', kind: 'info', text: `全軍謀略值：我方 ${ewA.toFixed(0)} ／ 敵方 ${ewB.toFixed(0)}` });
  if (Math.abs(ewA - ewB) >= 10) {
    advSide = ewA > ewB ? 'A' : 'B';
    const ratio = clamp(Math.abs(ewA - ewB) / 50, 0, 1);
    const pen = 0.15 * ratio, boost = 0.08 * ratio;
    S[other(advSide)].hitPen += pen;
    S[advSide].atkAll = 1 + boost;
    l1.push({ side: advSide, kind: 'info', text: `${advSide === 'A' ? '我方' : '敵方'}運籌決勝取得謀略先機：對手命中率 −${Math.round(pen * 100)}%，己方全軍戰意 +${Math.round(boost * 100)}%。` });
    if (ratio >= 0.5) addKey(4, `${advSide === 'A' ? '我方' : '敵方'}智勝一籌取得戰局先手（謀略 ${ewA.toFixed(0)} vs ${ewB.toFixed(0)}）`, advSide);
  } else {
    l1.push({ side: 'N', kind: 'info', text: '雙方軍師旗鼓相當，謀略互不相讓。' });
  }

  for (const s of ['A', 'B']) {
    for (const commander of alive(s, unit => hasRoleFlag(unit, 'STRATEGIST') && unit.skill?.phase === 'P1' && !unit.skillUsed)) {
      commander.skillUsed = true;
      applySkillEffects(commander, l1);
    }
  }
  pushFrame(1, '階段一 · 軍師謀略博弈', l1);

  {
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.traits.includes('SEAD') || x.traits.includes('DEEP'))) {
        let t;
        let passiveIrPen = 0;
        if (u.traits.includes('DEEP')) {
          t = pickTop(alive(e));
        } else {
          // 先制破陣：優先鎖定敵方神射箭陣；隱蔽伏弩名將不顯軍旗，難以直接被點殺
          const radarAds = alive(e, x => x.cat === 'air_defense' && !hasRoleFlag(x, 'PASSIVE_VOLLEY'));
          const radarEmitters = alive(e, x => x.traits.includes('AEGIS') || x.ew >= 15);
          t = pickTop(radarAds) || pickTop(radarEmitters) || pickTop(alive(e, x => x.cat === 'naval')) || pickTop(alive(e));
          if (t && hasRoleFlag(t, 'PASSIVE_VOLLEY')) passiveIrPen = -0.18;
        }
        if (!t) continue;
        const ammo = getAmmoProfile(u);
        u.shots++;
        at.push({
          att: u, tgt: t, ammoTier: ammo.tier,
          hit: hitP(u, t, 0.82, 0.55, ammo.hitMod + passiveIrPen),
          trueDmg: u.traits.includes('TRUE_AT') && ammo.canTrueAt,
          dmg: u.atk * 1.5 * S[s].atkEarly * ammo.dmgMult
        });
      }
    }
    pushFrame(1, '階段一 · 先制破陣（斬首／奇襲破陣）', volley(at, { allowAbm: true, phase: 1 }));
  }

  /* ===== 階段二：神射攔截、先鋒爭先與先登奇兵對決 ===== */
  if (!over()) {
    // 2-1 神射弩陣萬箭齊發，攔截敵方奔雷突騎
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      const shooters = alive(s, x => x.cat === 'air_defense' || x.traits.includes('AEGIS'));
      for (const u of shooters) {
        const t = pickTop(alive(e, x => x.cat === 'air'));
        if (!t) continue;
        const ammo = getAmmoProfile(u);
        u.shots++;
        const f = u.cat === 'air_defense' ? 1 : 0.55;
        const hit = hitP(u, t, 0.82 + (u.traits.includes('AA_LONG') ? 0.08 : 0) + S[s].adHit, 0.55, m.airHit + ammo.hitMod);
        at.push({ att: u, tgt: t, ammoTier: ammo.tier, hit, dmg: u.atk * 2.5 * f * ammo.dmgMult });
      }
    }
    pushFrame(2, '階段二 · 神射箭雨攔截', volley(at, { phase: 2 }));
  }
  if (!over()) {
    // 2-2 奔雷突騎交鋒（爭奪先機權 10 分）
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.cat === 'air')) {
        const airPool = alive(e, x => x.cat === 'air');
        if (!airPool.length) continue;
        const ammo = getAmmoProfile(u);
        const tgts = (u.traits.includes('SAT') && ammo.canSat) ? pickN(airPool, 2) : [pickTop(airPool)];
        u.shots++;
        for (const t of tgts) {
          if (!t) continue;
          const hit = hitP(u, t, 0.66 + (u.traits.includes('LR') ? 0.06 : 0) + (u.stealth - t.stealth) / 250, 0.3, m.airHit + ammo.hitMod);
          at.push({ att: u, tgt: t, ammoTier: ammo.tier, hit, dmg: u.atk * 1.1 * (tgts.length > 1 ? 0.75 : 1) * S[s].atkEarly * ammo.dmgMult });
        }
      }
    }
    pushFrame(2, '階段二 · 奔雷突騎爭先', volley(at, { phase: 2 }));
  }
  if (!over()) {
    // 2-3 先登奇兵對決（虎賁破陣 vs 潛行夜襲，爭奪先登權 5 分）
    const at = [];
    for (const s of ['A', 'B']) {
      const e = other(s);
      for (const u of alive(s, x => x.cat === 'naval')) {
        const navs = alive(e, x => x.cat === 'naval');
        const pool = navs.length ? navs : alive(e, x => x.cat === 'armor');
        if (!pool.length) continue;
        const ammo = getAmmoProfile(u);
        const tgts = (u.traits.includes('SWARM') && ammo.canSwarm) ? pickN(pool, 2) : [pickTop(pool)];
        u.shots++;
        for (const t of tgts) {
          if (!t) continue;
          let mult = navs.length ? 1 : 0.8;
          // ASW 看破反伏專精：專剋潛行夜襲 (SUB) 造成 1.6 倍傷害
          if (t.traits.includes('SUB') && u.traits.includes('ASW')) mult *= 1.6;
          // SUB 潛行夜襲：對未設防目標造成 1.3 倍傷害
          if (u.traits.includes('SUB') && !t.traits.includes('SUB')) mult *= 1.3;
          if (tgts.length > 1) mult *= 0.6;
          at.push({
            att: u, tgt: t, ammoTier: ammo.tier,
            hit: hitP(u, t, 0.76 + S[s].navHit, 0.45, ammo.hitMod),
            dmg: u.atk * mult * S[s].navMult * m.navalDmg * S[s].atkEarly * ammo.dmgMult
          });
        }
      }
    }
    pushFrame(2, '階段二 · 先登奇兵交鋒', volley(at, { phase: 2 }));
  }

  /* ===== 階段三：中軍主力決戰與氣力三階消耗（上限 10 輪，未全殲則鳴金收兵由戰功 VP 裁定） ===== */
  let r = 1;
  const MAX_ROUNDS = 10;
  while (!over() && r <= MAX_ROUNDS) {
    const at = [];
    const prefixLines = [];
    // 第 6 輪起：陣形拉鋸方位盡露，展開死鬥合圍（微幅提升命中，不虛胖攻擊力）
    const stealthScale = r >= 6 ? 0.75 : 1.0;
    const lockBonus = r >= 6 ? 0.05 : 0.0;

    if (r === 6) {
      prefixLines.push({
        side: 'N', kind: 'info', brevity: '短兵相接',
        text: '兩軍大陣徹底咬合，近身死鬥展開（隱匿效果降低，命中率提升）！'
      });
    } else if (r === 8) {
      prefixLines.push({
        side: 'N', kind: 'info', brevity: '氣力漸竭',
        text: '戰局進入白熱化，主力名將氣力見底，拔出佩刀短匕展開最後死鬥！'
      });
    }

    for (const s of ['A', 'B']) {
      const e = other(s);
      const enemyAlive = alive(e);
      if (!enemyAlive.length) continue;

      const myAlive = alive(s);
      const enemyArmor = alive(e, x => x.cat === 'armor');
      const enemyAir = alive(e, x => x.cat === 'air');
      const enemyNaval = alive(e, x => x.cat === 'naval');
      const frontlineGround = enemyArmor.length ? enemyArmor : enemyAlive;
      const rearGround = alive(e, x => x.cat === 'support' || x.cat === 'air_defense');
      const adAlive = alive(e, x => x.cat === 'air_defense').length;
      
      const hasIdleAbmRadar = !enemyAir.length && myAlive.some(x => hasRoleFlag(x, 'FORMATION_SHIELD'));
      const spot = (myAlive.some(x => x.traits.includes('SPOT')) || hasIdleAbmRadar) ? 1.15 : 1;
      const abmTrackBonus = hasIdleAbmRadar ? 0.04 : 0;
      const ciws = alive(e, x => x.traits.includes('CIWS')).length > 0;
      if (r === 1 && myAlive.some(unit => unit.formation === 'cone') && !S[e].supplyCut) {
        S[e].atkAll = (typeof S[e].atkAll === 'number' ? S[e].atkAll : 1) * 0.92;
        S[e].supplyCut = true;
        prefixLines.push({
          side: s,
          kind: 'info',
          brevity: '截斷糧道',
          text: `${s === 'A' ? '我軍' : '敵軍'}錐行部隊高速穿插敵後，截斷糧道！敵軍全軍攻勢減弱 8%。`
        });
        addKey(3, `${s === 'A' ? '我軍' : '敵軍'}錐行部隊截斷敵軍糧道，削弱其持續作戰能力`, s);
      }

      for (const u of myAlive) {
        const ground = u.cat === 'air_defense' && u.formationRanged && rearGround.length
          ? rearGround
          : frontlineGround;
        if (u.cat === 'air') {
          // 突騎繞後側翼包抄重甲
          const ammo = getAmmoProfile(u);
          const ts = (u.traits.includes('SAT') && ammo.canSat) ? pickN(ground, 2) : [pickTop(ground)];
          const isTrueAt = u.traits.includes('TRUE_AT') && ammo.canTrueAt;
          const mult = u.traits.includes('CAS') ? 1.8 : (isTrueAt ? 1.65 : 1.15);
          u.shots++;
          for (const t of ts) {
            if (!t) continue;
            at.push({
              att: u, tgt: t, ammoTier: ammo.tier, trueDmg: isTrueAt,
              hit: hitP(u, t, 0.82 - Math.min(0.3, adAlive * 0.07), 0.15, m.airHit + lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
              dmg: u.atk * mult * (ts.length > 1 ? 0.75 : 1) * (t.cat === 'armor' ? (isTrueAt ? 1.25 : 1.1) : 0.85) * ammo.dmgMult
            });
          }
        } else if (u.cat === 'naval') {
          // 先登奇兵進攻
          const ammo = getAmmoProfile(u);
          const pool = !u.formationRanged && enemyNaval.length ? enemyNaval : ground;
          const ts = (u.traits.includes('SWARM') && ammo.canSwarm) ? pickN(pool, 2) : [pickTop(pool)];
          u.shots++;
          for (const t of ts) {
            if (!t) continue;
            let nMult = 0.85 * S[s].navMult;
            if (t.traits.includes('SUB') && u.traits.includes('ASW')) nMult *= 1.35;
            if (ts.length > 1) nMult *= 0.65;
            at.push({
              att: u, tgt: t, ammoTier: ammo.tier,
              hit: hitP(u, t, 0.78 + S[s].navHit, 0.25, lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
              dmg: u.atk * nMult * m.navalDmg * ammo.dmgMult
            });
          }
        } else if (u.cat === 'armor') {
          // 重甲中軍正面對決
          const t = pickTop(ground);
          if (!t) continue;
          const ammo = getAmmoProfile(u);
          const isTrueAt = u.traits.includes('TRUE_AT') && ammo.canTrueAt;
          u.shots++;
          at.push({
            att: u, tgt: t, ammoTier: ammo.tier, trueDmg: isTrueAt,
            hit: hitP(u, t, 0.85, 0.2, lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
            dmg: u.atk * (isTrueAt ? 1.65 : 1.45) * S[s].landMult * m.armorDmg * (t.cat === 'armor' ? (isTrueAt ? 1.25 : 1.1) : 0.9) * ammo.dmgMult
          });
        } else if (u.cat === 'support') {
          // 軍師奇計／火器攻城
          const ammo = getAmmoProfile(u);
          u.shots++;
          if (u.traits.includes('TRUE_AT')) {
            const isTrueAt = ammo.canTrueAt;
            const ts = (u.traits.includes('SWARM') && ammo.canSwarm) ? pickN(ground, 2) : [pickTop(ground)];
            for (const t of ts) {
              if (!t) continue;
              at.push({
                att: u, tgt: t, ammoTier: ammo.tier,
                hit: hitP(u, t, 0.78, 0.35, lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
                trueDmg: isTrueAt,
                dmg: u.atk * 2.2 * (ts.length > 1 ? 0.65 : 1) * S[s].droneMult * m.droneDmg * (ciws ? 0.5 : 1) * ammo.dmgMult
              });
            }
          } else if (u.traits.includes('ARTY')) {
            const ts = (u.traits.includes('SAT') && ammo.canSat) ? pickN(ground, 2) : [pickTop(ground)];
            for (const t of ts) {
              if (!t) continue;
              at.push({
                att: u, tgt: t, ammoTier: ammo.tier,
                hit: hitP(u, t, 0.78, 0.3, lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
                dmg: u.atk * 1.65 * (ts.length > 1 ? 0.75 : 1) * S[s].landMult * m.artyDmg * spot * ammo.dmgMult
              });
            }
          } else {
            const t = pickTop(ground);
            if (t) {
              at.push({
                att: u, tgt: t, ammoTier: ammo.tier,
                hit: hitP(u, t, 0.80, 0.25, lockBonus + abmTrackBonus + ammo.hitMod, stealthScale),
                dmg: u.atk * 0.85 * S[s].droneMult * spot * ammo.dmgMult
              });
            }
          }
        } else if (u.cat === 'air_defense') {
          // 神射弩陣平射支援
          if (enemyAir.length) {
            const t = pickTop(enemyAir);
            if (t) {
              const ammo = getAmmoProfile(u);
              const ts = (u.traits.includes('SAT') && ammo.canSat) ? pickN(enemyAir, 2) : [t];
              u.shots++;
              for (const airTgt of ts) {
                if (!airTgt) continue;
                at.push({
                  att: u, tgt: airTgt, ammoTier: ammo.tier,
                  hit: hitP(u, airTgt, 0.88 + (u.traits.includes('AA_LONG') ? 0.05 : 0) + S[s].adHit, 0.35, m.airHit + lockBonus + ammo.hitMod, stealthScale),
                  dmg: u.atk * 2.2 * (ts.length > 1 ? 0.75 : 1) * ammo.dmgMult
                });
              }
            }
          } else {
            const t = pickTop(ground);
            if (t) {
              const ammo = getAmmoProfile(u);
              const abmScale = hasRoleFlag(u, 'FORMATION_SHIELD') ? 0.50 : 0.7;
              u.shots++;
              at.push({
                att: u, tgt: t, ammoTier: ammo.tier,
                hit: clamp(0.72 + lockBonus + ammo.hitMod, 0.08, 0.96),
                dmg: u.atk * abmScale * ammo.dmgMult
              });
            }
          }
        }
      }
    }
    const phaseLabel = r <= 5
      ? `階段三 · 中軍死鬥合圍（第 ${r} 輪）`
      : (r <= 7 ? `階段三 · 短兵相接鏖戰（第 ${r} 輪）` : `階段三 · 氣力見底苦戰（第 ${r} 輪）`);
    pushFrame(3, phaseLabel, volley(at, { prefixLines, allowDuels: true, phase: 3 }));
    r++;
  }

  /* ===== 戰功與勝負裁定 (VP 結算) ===== */
  const airPow = t => t.filter(u => u.cat === 'air').reduce((x, u) => x + u.cost * u.hp / u.hpMax, 0);
  const navPow = t => t.filter(u => u.cat === 'naval').reduce((x, u) => x + u.cost * u.hp / u.hpMax, 0);
  function calcVP(s) {
    const us = T[s], en = T[other(s)];
    const remain = us.reduce((x, u) => x + u.cost * (u.hp / u.hpMax), 0) * 4;
    const armorHp = us.filter(u => u.cat === 'armor').reduce((x, u) => x + u.hp / u.hpMax, 0);
    const armorCtl = 15 * Math.min(1, armorHp); // 中軍戰線分 15 分
    const airSup = airPow(us) > airPow(en) ? 10 : 0; // 先機突騎分 10 分
    const navCtl = navPow(us) > navPow(en) ? 5 : 0;  // 先登奇兵分 5 分
    const occupationStrength = us.filter(u => u.formationOccupation && u.alive).reduce((sum, u) => sum + u.hp / u.hpMax, 0);
    const occupationCtl = 6 * Math.min(1, occupationStrength / 2);
    let upset = 0; // 以小博大越級戰功
    for (const u of en) if (!u.alive && u.killedBy && u.killedBy.side === s) upset += Math.max(0, u.cost - u.killedBy.cost) * 2;
    upset = Math.min(12, upset);
    const control = armorCtl + airSup + navCtl;
    return { remain, armorCtl, airSup, navCtl, occupationCtl, control, upset, total: remain + control + occupationCtl + upset };
  }
  const vp = { A: calcVP('A'), B: calcVP('B') };
  const aDead = alive('A').length === 0, bDead = alive('B').length === 0;
  let winner, wipeout = false, ammoDepleted = false, finale = false;
  if (aDead && bDead) { winner = 'draw'; wipeout = true; }
  else if (aDead && !bDead) { winner = 'B'; wipeout = true; }
  else if (bDead && !aDead) { winner = 'A'; wipeout = true; }
  else {
    ammoDepleted = true;
    const d = vp.A.total - vp.B.total;
    let tieBrokenByFinalCharge = false;
    if (Math.abs(d) < 0.5) {
      const remainingStrength = side => alive(side).reduce((sum, unit) => sum + unit.hp / unit.hpMax, 0);
      const strengthDelta = remainingStrength('A') - remainingStrength('B');
      winner = Math.abs(strengthDelta) < 0.01 ? (rng() < 0.5 ? 'A' : 'B') : (strengthDelta > 0 ? 'A' : 'B');
      tieBrokenByFinalCharge = true;
    } else {
      winner = d > 0 ? 'A' : 'B';
    }
    finale = true;
    pushFrame(3, '終章 · 兩軍總衝鋒', [{
      side: 'N',
      kind: 'info',
      finaleStart: true,
      brevity: '總衝鋒',
      text: tieBrokenByFinalCharge
        ? `十輪戰功難分高下，兩軍主將親率殘部總衝鋒；以戰線保存與最後一擊決出勝負！（${vp.A.total.toFixed(1)} : ${vp.B.total.toFixed(1)} 戰功）`
        : `十輪鏖戰後戰線全面崩解，${winner === 'A' ? '我軍' : '敵軍'}主將率殘部發起最後衝鋒！（戰功 ${vp.A.total.toFixed(1)} : ${vp.B.total.toFixed(1)}）`
    }], { finale: 'charge' });

    const sidesToFinish = [winner];
    const finalLines = [];
    const finalStrikes = [];
    for (const winningSide of sidesToFinish) {
      const attackers = alive(winningSide);
      const defeatedSide = other(winningSide);
      const targets = alive(defeatedSide).sort((a, b) =>
        Number(b.cat === 'support') - Number(a.cat === 'support') ||
        b.cost - a.cost ||
        a.uid.localeCompare(b.uid)
      );
      targets.forEach((target, index) => {
        const attacker = attackers[index % attackers.length];
        finalStrikes.push({ winningSide, attacker, target });
      });
    }
    finalStrikes.forEach(({ winningSide, attacker, target }) => {
      const damage = Math.round(target.hp);
      target.hp = 0;
      target.alive = false;
      target.killedBy = attacker;
      attacker.dmgDone += damage;
      finalLines.push({
        side: winningSide,
        kind: 'kill',
        finale: true,
        auid: attacker.uid,
        tuid: target.uid,
        brevity: '總衝鋒殲滅',
        dmg: damage,
        text: `[總衝鋒殲滅] ${attacker.name} 率軍突入敵陣，陣斬 ${target.name}！`,
        hpAfter: 0
      });
    });
    pushFrame(3, '終章 · 敗軍全線潰滅', finalLines);
    wipeout = true;
    addKey(10, `${winner === 'A' ? '我軍' : '敵軍'}發起總衝鋒，殲滅敵方殘部`, winner);
  }
  const mvp = {};
  for (const s of ['A', 'B']) mvp[s] = T[s].slice().sort((a, b) => b.dmgDone - a.dmgDone)[0];
  const key = keys.slice().sort((a, b) => b.imp - a.imp).slice(0, 4).sort((a, b) => a.frame - b.frame);

  return { seed, winner, wipeout, ammoDepleted, finale, vp, frames, key, mvp, ev, docs, ewA, ewB, advSide, syn, terrain, formationDefs: BATTLE_FORMATION_DEFS, final: T };
}

/* ---------- 陣容驗證 / 代碼 ---------- */
function deckCost(ids) {
  return (ids || []).reduce((x, id) => x + (id && UNIT_MAP[id] ? UNIT_MAP[id].cost : 0), 0);
}

function validateDeck(ids, budget, banned) {
  budget = budget == null ? BUDGET : budget;
  banned = banned || [];
  const errs = [];
  if (!Array.isArray(ids) || ids.length !== SLOTS.length) return ['陣容槽位數量錯誤'];
  ids.forEach((id, i) => {
    if (!id) { errs.push(`${SLOTS[i].label}尚未配置`); return; }
    const u = UNIT_MAP[id];
    if (!u) { errs.push(`未知名將：${id}`); return; }
    if (SLOTS[i].fixed && u.cat !== SLOTS[i].fixed) errs.push(`兵種槽位錯誤：${SLOTS[i].label}`);
    if (banned.includes(id)) errs.push(`${u.name} 已被戰術禁用 (BANNED)`);
  });
  const cats = ids.filter(Boolean).map(id => UNIT_MAP[id] && UNIT_MAP[id].cat).filter(Boolean);
  if (new Set(cats).size !== cats.length) errs.push('同一軍種不可重複配置');
  if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) errs.push('同一位名將不可重複配置');
  if (deckCost(ids.filter(id => id && UNIT_MAP[id])) > budget) errs.push(`軍令預算超標（上限 $${budget}）`);
  return errs;
}
const encodeDeck = ids => ids.join('.');
function decodeDeck(code) {
  const ids = String(code || '').trim().toUpperCase().split(/[.\-,\s]+/).filter(Boolean);
  return ids.length === SLOTS.length && ids.every(id => UNIT_MAP[id]) ? ids : null;
}

/* ---------- AI 風格與陣容生成（嚴格五大兵種各 1 位） ---------- */
const ARCHETYPES = [
  { id: 'armor',    name: '中軍鐵壁', desc: '重金投入重甲陷陣與攻城火器，主打正面死鬥。', plan: [['air', 2], ['armor', 5], ['air_defense', 3], ['naval', 2], ['support', 3]] },
  { id: 'air',      name: '神騎破陣', desc: '頂級飛將突騎引領衝鋒，掌控戰場先機。',   plan: [['air', 5], ['armor', 2], ['air_defense', 2], ['naval', 3], ['support', 3]] },
  { id: 'hedgehog', name: '固守待援', desc: '神射強弩連陣加先登死士，專打防守反擊。',   plan: [['air', 2], ['armor', 3], ['air_defense', 5], ['naval', 3], ['support', 2]] },
  { id: 'balanced', name: '五行兼備', desc: '五大兵種均衡配置，各司其職無明顯弱點。',   plan: [['air', 3], ['armor', 3], ['air_defense', 3], ['naval', 3], ['support', 3]] },
  { id: 'naval',    name: '先登奇襲', desc: '以先登鬥將與水陸夜襲為核心，以小博大。',   plan: [['air', 3], ['armor', 2], ['air_defense', 2], ['naval', 5], ['support', 3]] },
  { id: 'ew',       name: '智聖奇謀', desc: '頂尖軍師運籌帷幄，死士奇兵暗襲破局。',   plan: [['air', 2], ['armor', 3], ['air_defense', 2], ['naval', 3], ['support', 5]] }
];

function buildFromPlan(plan, rng) {
  const ids = [];
  for (const [cat, cost] of plan) {
    const c = UNITS.filter(u => u.cat === cat && u.cost === cost && !ids.includes(u.id));
    ids.push(c[Math.floor(rng() * c.length)].id);
  }
  return ids;
}

/* 隨機補滿（嚴格五大槽位各 1 位，杜絕重複） */
function randomDeck(rng, budget, locked, banned) {
  rng = (typeof rng === 'function') ? rng : Math.random;
  budget = budget == null ? BUDGET : budget;
  locked = locked || [];
  banned = banned || [];
  for (let attempt = 0; attempt < 300; attempt++) {
    const ids = [];
    let spent = 0, ok = true;
    for (let i = 0; i < SLOTS.length && ok; i++) {
      if (locked[i]) {
        ids.push(locked[i]); spent += UNIT_MAP[locked[i]].cost;
      }
    }
    if (spent > budget) return null;
    const unlockedIdx = [];
    for (let i = 0; i < SLOTS.length; i++) if (!locked[i]) unlockedIdx.push(i);
    for (let i = unlockedIdx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = unlockedIdx[i]; unlockedIdx[i] = unlockedIdx[j]; unlockedIdx[j] = tmp;
    }
    for (let k = 0; k < unlockedIdx.length; k++) {
      const i = unlockedIdx[k];
      const rest = unlockedIdx.length - 1 - k;
      const maxCost = Math.min(5, budget - spent - rest);
      if (maxCost < 1) { ok = false; break; }
      const cat = SLOTS[i].fixed;
      const cand = UNITS.filter(u => u.cat === cat && u.cost <= maxCost && !ids.includes(u.id) && !locked.includes(u.id) && !banned.includes(u.id));
      if (!cand.length) { ok = false; break; }
      const total = cand.reduce((x, u) => x + u.cost, 0);
      let r = rng() * total, pick = cand[0];
      for (const u of cand) { r -= u.cost; if (r <= 0) { pick = u; break; } }
      ids[i] = pick.id; spent += pick.cost;
    }
    if (ok) {
      const out = [];
      for (let i = 0; i < SLOTS.length; i++) out.push(locked[i] || ids[i]);
      if (validateDeck(out, budget, banned).length === 0) return out;
    }
  }
  return null;
}

/* ---------- 批次模擬（沙盒／平衡工具） ---------- */
function simulate(deckA, deckB, n, opts) {
  opts = opts || {};
  const out = { n, win: 0, lose: 0, draw: 0, sumA: 0, sumB: 0, byEvent: {} };
  EVENTS.forEach(e => { out.byEvent[e.id] = { win: 0, n: 0 }; });
  const rng = mulberry32((opts.seed || 12345) >>> 0);
  for (let i = 0; i < n; i++) {
    const ev = opts.event || EVENTS[i % EVENTS.length];
    const docA = opts.docA || DOCTRINES[Math.floor(rng() * 3)].id;
    const docB = opts.docB || DOCTRINES[Math.floor(rng() * 3)].id;
    const r = resolveBattle(deckA, deckB, { seed: Math.floor(rng() * 4294967296), event: ev, docA, docB });
    if (r.winner === 'A') { out.win++; out.byEvent[ev.id].win++; }
    else if (r.winner === 'B') out.lose++;
    else out.draw++;
    out.byEvent[ev.id].n++;
    out.sumA += r.vp.A.total; out.sumB += r.vp.B.total;
  }
  return out;
}
