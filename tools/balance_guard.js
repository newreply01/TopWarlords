// 武將定價平衡檢查：node tools/balance_guard.js [--games N] [--plans] [--verbose]
//
// 方法（成對抽樣）：每位武將固定放進己方對應槽位，其餘槽位以 $15 預算隨機補齊；
// 所有武將共用同一批隨機對手、戰鬥種子、天候與兵法序列，先後手輪替。
// 若定價合理，每位武將的勝率應接近 50%（買貴的武將會壓縮其他槽位預算）。
//
// 門檻（預設每位 1200 場，單一武將抽樣誤差約 ±1.4%）：
//   - 每位武將勝率須落在 UNIT_MIN～UNIT_MAX
//   - 每個「槽位 × 費用」五人平均須落在 TIER_MIN～TIER_MAX
// 任一不符即以結束碼 1 失敗。--plans 另外列出全部 $15 費用分配方案的強弱（較慢，不列入門檻）。
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
const GAMES = argVal('--games', 1200);
const VERBOSE = args.includes('--verbose');
const UNIT_MIN = 0.44, UNIT_MAX = 0.56;
const TIER_MIN = 0.465, TIER_MAX = 0.535;

const code = ['historical-audit.js', 'data.js', 'engine.js']
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
const E = new Function(code + '\nreturn {UNITS,SLOTS,EVENTS,DOCTRINES,resolveBattle,randomDeck,mulberry32};')();
const LABEL = { air: '突騎', armor: '重甲', air_defense: '神射', naval: '先登', support: '軍師' };
const CATS = E.SLOTS.map(s => s.fixed);
const pct = x => (x * 100).toFixed(1) + '%';

function battle(me, opp, i, seed) {
  const meA = i % 2 === 0;
  const r = E.resolveBattle(meA ? me : opp, meA ? opp : me, {
    seed, event: E.EVENTS[i % E.EVENTS.length],
    docA: E.DOCTRINES[i % 3].id, docB: E.DOCTRINES[Math.floor(i / 3) % 3].id
  });
  return r.winner === (meA ? 'A' : 'B') ? 1 : r.winner === 'draw' ? 0.5 : 0;
}

const orng = E.mulberry32(20261127);
const opp = [], seeds = [];
for (let i = 0; i < GAMES; i++) { opp.push(E.randomDeck(orng)); seeds.push(Math.floor(orng() * 4e9)); }

const wr = {};
for (const u of E.UNITS) {
  const rng = E.mulberry32(7331);
  const locked = []; locked[CATS.indexOf(u.cat)] = u.id;
  let w = 0;
  for (let i = 0; i < GAMES; i++) w += battle(E.randomDeck(rng, 15, locked, []), opp[i], i, seeds[i]);
  wr[u.id] = w / GAMES;
}

const failures = [];
console.log(`=== 武將定價平衡檢查（每位 ${GAMES} 場）===`);
console.log('槽位   ' + [1, 2, 3, 4, 5].map(k => `   $${k}  `).join(''));
for (const c of CATS) {
  let line = LABEL[c].padEnd(5);
  for (let k = 1; k <= 5; k++) {
    const g = E.UNITS.filter(u => u.cat === c && u.cost === k);
    const avg = g.reduce((s, u) => s + wr[u.id], 0) / g.length;
    if (avg < TIER_MIN || avg > TIER_MAX) failures.push(`${LABEL[c]} $${k} 平均 ${pct(avg)}`);
    line += pct(avg).padStart(8);
  }
  console.log(line);
}
const all = Object.values(wr);
const mean = all.reduce((a, b) => a + b) / all.length;
const sd = Math.sqrt(all.reduce((a, b) => a + (b - mean) ** 2, 0) / all.length);
E.UNITS.forEach(u => {
  if (wr[u.id] < UNIT_MIN || wr[u.id] > UNIT_MAX) failures.push(`${LABEL[u.cat]} $${u.cost} ${u.name}(${u.id}) ${pct(wr[u.id])}`);
});
const sorted = [...E.UNITS].sort((a, b) => wr[b.id] - wr[a.id]);
const show = u => `${pct(wr[u.id])} ${LABEL[u.cat]} $${u.cost} ${u.name}`;
console.log(`\n勝率標準差 ${pct(sd)}｜最高 ${show(sorted[0])}｜最低 ${show(sorted[sorted.length - 1])}`);
if (VERBOSE) {
  console.log('\n最強 10：'); sorted.slice(0, 10).forEach(u => console.log('  ' + show(u)));
  console.log('最弱 10：'); sorted.slice(-10).forEach(u => console.log('  ' + show(u)));
}

if (args.includes('--plans')) {
  const N = 400, plans = [];
  for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) for (let c = 1; c <= 5; c++) for (let d = 1; d <= 5; d++) {
    const e = 15 - a - b - c - d; if (e >= 1 && e <= 5) plans.push([a, b, c, d, e]);
  }
  const res = plans.map(pl => {
    const rng = E.mulberry32(31337); let w = 0;
    for (let i = 0; i < N; i++) {
      const deck = pl.map((k, j) => { const g = E.UNITS.filter(u => u.cat === CATS[j] && u.cost === k); return g[Math.floor(rng() * g.length)].id; });
      w += battle(deck, opp[i % GAMES], i, seeds[i % GAMES]);
    }
    return { pl, wr: w / N };
  }).sort((x, y) => y.wr - x.wr);
  const fmt = r => `${pct(r.wr)}  ` + r.pl.map((k, j) => `${LABEL[CATS[j]]}$${k}`).join(' ');
  console.log(`\n=== $15 費用分配方案（${plans.length} 種，每種 ${N} 場）===`);
  console.log('最強 5：'); res.slice(0, 5).forEach(r => console.log('  ' + fmt(r)));
  console.log('最弱 5：'); res.slice(-5).forEach(r => console.log('  ' + fmt(r)));
}

if (failures.length) {
  console.log(`\n[FAIL] ${failures.length} 項超出平衡門檻（武將 ${pct(UNIT_MIN)}～${pct(UNIT_MAX)}，槽位費用平均 ${pct(TIER_MIN)}～${pct(TIER_MAX)}）：`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\n[PASS] 所有武將與槽位費用平均皆在平衡門檻內');
