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

function resolveBrevityAndSfx(at, t, tier) {
  if (hasRoleFlag(at, 'STRATEGIST') || (hasRoleFlag(at, 'FORMATION_SHIELD') && t && t.cat !== 'air')) {
    const label = tier === 1 ? '軍師號令' : (tier === 2 ? '謀略調度' : '運籌決勝');
    return { brv: label, sfxOverride: 'strategy_gong', isC4isr: true };
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

/* ---------- 隊伍建立 ---------- */
function makeTeam(ids, side) {
  return ids.map((id, i) => {
    const d = UNIT_MAP[id] || {
      name: '主力名將', cat: 'air', cost: 1, v: 'A',
      traits: [], roleFlags: [], hp: 120, atk: 60, def: 0, st: 0, ew: 0
    };
    return {
      uid: `${id}-${side}${i}`, side, id, name: d.name, cat: d.cat, cost: d.cost, v: d.v,
      traits: d.traits || [], roleFlags: d.roleFlags || [], hpMax: d.hp, hp: d.hp, atk: d.atk, def: d.def,
      stealth: d.st || 0, ew: d.ew || 0, alive: true, apsUsed: false, abmUsed: false,
      shots: 0, dmgDone: 0, killedBy: null
    };
  });
}

/* ---------- 主戰鬥函式 ---------- */
const DMG_SCALE = 1.0;

function resolveBattle(deckA, deckB, opts) {
  opts = opts || {};
  const seed = opts.seed == null ? (Math.random() * 4294967296) >>> 0 : opts.seed;
  const rng = mulberry32(seed);
  const ev = opts.event || EVENTS[EVENTS.length - 1];
  const m = Object.assign({ armorDmg: 1, navalDmg: 1, artyDmg: 1, droneDmg: 1, airHit: 0, ewMult: 1, stealthAdd: 0 }, ev.mod || {});
  const T = { A: makeTeam(deckA, 'A'), B: makeTeam(deckB, 'B') };
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
  const pushFrame = (phase, title, lines) => {
    if (!lines.length) lines = [{ side: 'N', kind: 'info', text: '本輪無有效交鋒。' }];
    frames.push({ phase, title, lines, hp: snap() });
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
    return base - (((tgt.stealth + m.stealthAdd) * sc) / 100) * w - S[att.side].hitPen + (extra || 0);
  }

  /* 同步結算：先全部擲骰，再統一套用傷害 */
  function volley(attacks, vOpts) {
    vOpts = vOpts || {};
    const lines = vOpts.prefixLines ? vOpts.prefixLines.slice() : [];
    const rolled = [];
    for (const a of attacks) {
      if (!a.tgt) continue;
      const p = clamp(a.hit, 0.08, 0.96);
      rolled.push({ a, p, ok: rng() < p, raw: a.dmg * (0.85 + rng() * 0.3) * DMG_SCALE * (S[a.att.side].atkAll || 1) });
    }
    for (const r of rolled) {
      const a = r.a, t = a.tgt, at = a.att;
      if (!t.alive) continue;
      const pct = Math.round(r.p * 100);
      const tier = a.ammoTier || 1;
      const meta = resolveBrevityAndSfx(at, t, tier);
      const brv = meta.brv;

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
      const d = r.raw * (a.trueDmg ? 1 : (1 - t.def)) * S[t.side].taken;
      t.hp -= d;
      at.dmgDone += d;
      if (t.hp <= 0) {
        t.hp = 0; t.alive = false; t.killedBy = at;
        const killCode = (t.cat === 'air') ? '陣斬落馬' : (t.cat === 'armor') ? '重創破陣' : '力竭戰死';
        const killLabel = (t.cat === 'air') ? '斬落馬下' : (t.cat === 'armor') ? '潰敗破陣' : '陣前討取';
        const actionVerb = meta.isC4isr ? '指揮聯合圍剿討取' : '擊破討取';
        lines.push({
          side: at.side,
          kind: 'kill',
          auid: at.uid,
          tuid: t.uid,
          brevity: killCode,
          ammoTier: tier,
          sfxOverride: meta.sfxOverride,
          dmg: Math.round(d),
          text: `[${killCode} ${killLabel}] ${at.name} ${actionVerb} ${t.name}！`,
          hpAfter: 0
        });
        addKey(t.cost * 2 + Math.max(0, t.cost - at.cost) * 2, `${at.name}（$${at.cost}）陣斬 ${t.name}（$${t.cost}）`, at.side);
      } else {
        const hitArrow = meta.isC4isr ? '調兵圍攻 →' : '→';
        lines.push({
          side: at.side,
          kind: 'hit',
          auid: at.uid,
          tuid: t.uid,
          brevity: brv,
          ammoTier: tier,
          sfxOverride: meta.sfxOverride,
          dmg: Math.round(d),
          text: `[${brv}] ${at.name} ${hitArrow} ${t.name}：重創 −${Math.round(d / t.hpMax * 100)}%（剩餘 ${Math.round(t.hp / t.hpMax * 100)}% 戰力）`,
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
    pushFrame(1, '階段一 · 先制破陣（斬首／奇襲破陣）', volley(at, { allowAbm: true }));
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
    pushFrame(2, '階段二 · 神射箭雨攔截', volley(at));
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
    pushFrame(2, '階段二 · 奔雷突騎爭先', volley(at));
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
          // AMBUSH 一番槍敢死伏擊：挑戰高費名將造成 1.25 倍傷害
          if (u.traits.includes('AMBUSH') && t.cost >= u.cost + 2) mult *= 1.25;
          if (tgts.length > 1) mult *= 0.6;
          at.push({
            att: u, tgt: t, ammoTier: ammo.tier,
            hit: hitP(u, t, 0.76 + S[s].navHit, 0.45, ammo.hitMod),
            dmg: u.atk * mult * S[s].navMult * m.navalDmg * S[s].atkEarly * ammo.dmgMult
          });
        }
      }
    }
    pushFrame(2, '階段二 · 先登奇兵交鋒', volley(at));
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
      const ground = enemyArmor.length ? enemyArmor : enemyAlive;
      const adAlive = alive(e, x => x.cat === 'air_defense').length;
      
      const hasIdleAbmRadar = !enemyAir.length && myAlive.some(x => hasRoleFlag(x, 'FORMATION_SHIELD'));
      const spot = (myAlive.some(x => x.traits.includes('SPOT')) || hasIdleAbmRadar) ? 1.15 : 1;
      const abmTrackBonus = hasIdleAbmRadar ? 0.04 : 0;
      const ciws = alive(e, x => x.traits.includes('CIWS')).length > 0;

      for (const u of myAlive) {
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
          const pool = enemyNaval.length ? enemyNaval : ground;
          const ts = (u.traits.includes('SWARM') && ammo.canSwarm) ? pickN(pool, 2) : [pickTop(pool)];
          u.shots++;
          for (const t of ts) {
            if (!t) continue;
            let nMult = 0.85 * S[s].navMult;
            if (t.traits.includes('SUB') && u.traits.includes('ASW')) nMult *= 1.35;
            if (u.traits.includes('AMBUSH') && t.cost >= u.cost + 2) nMult *= 1.2;
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
          } else if (u.traits.includes('ARTY') || u.traits.includes('DEEP')) {
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
    pushFrame(3, phaseLabel, volley(at, { prefixLines }));
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
    let upset = 0; // 以小博大越級戰功
    for (const u of en) if (!u.alive && u.killedBy && u.killedBy.side === s) upset += Math.max(0, u.cost - u.killedBy.cost) * 2;
    upset = Math.min(12, upset);
    const control = armorCtl + airSup + navCtl;
    return { remain, armorCtl, airSup, navCtl, control, upset, total: remain + control + upset };
  }
  const vp = { A: calcVP('A'), B: calcVP('B') };
  const aDead = alive('A').length === 0, bDead = alive('B').length === 0;
  let winner, wipeout = false, ammoDepleted = false;
  if (aDead && bDead) { winner = 'draw'; wipeout = true; }
  else if (aDead && !bDead) { winner = 'B'; wipeout = true; }
  else if (bDead && !aDead) { winner = 'A'; wipeout = true; }
  else {
    ammoDepleted = true;
    const d = vp.A.total - vp.B.total;
    winner = Math.abs(d) < 0.5 ? 'draw' : (d > 0 ? 'A' : 'B');
    pushFrame(3, '階段三終結 · 鳴金收兵戰功議和', [{
      side: winner === 'draw' ? 'N' : winner,
      kind: 'info',
      brevity: '鳴金收兵',
      text: `激戰十輪兵糧將盡，雙方鳴金收兵！移交戰略戰功積分裁定（${vp.A.total.toFixed(1)} : ${vp.B.total.toFixed(1)} 戰功）！`
    }]);
    if (winner !== 'draw') {
      addKey(5, `鳴金收兵戰功議和，${winner === 'A' ? '我方' : '敵方'}以 ${vp[winner].total.toFixed(1)} 戰功勝出`, winner);
    }
  }
  const mvp = {};
  for (const s of ['A', 'B']) mvp[s] = T[s].slice().sort((a, b) => b.dmgDone - a.dmgDone)[0];
  const key = keys.slice().sort((a, b) => b.imp - a.imp).slice(0, 4).sort((a, b) => a.frame - b.frame);

  return { seed, winner, wipeout, ammoDepleted, vp, frames, key, mvp, ev, docs, ewA, ewB, advSide, syn, final: T };
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
    if (SLOTS[i].fixed && u.cat !== SLOTS[i].fixed) errs.push(`${SLOTS[i].label}只能配置${CATS[SLOTS[i].fixed].label}`);
    if (banned.includes(id)) errs.push(`${u.name} 已被戰術禁用 (BANNED)`);
  });
  const cats = ids.filter(Boolean).map(id => UNIT_MAP[id] && UNIT_MAP[id].cat).filter(Boolean);
  if (new Set(cats).size !== cats.length) errs.push('同一兵團職能不可重複選取');
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
