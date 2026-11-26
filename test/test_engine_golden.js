// 戰鬥引擎固定種子回歸快照：node test/test_engine_golden.js [--update]
// 以固定種子產生 240 場對戰（輪替戰場事件／教條／陣形／地形），比對每場戰果指紋。
// 任何數值或邏輯改動都會讓指紋變化：若為刻意的平衡調整，請以 --update 重新產生快照並在 CHANGELOG 說明。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT = path.join(__dirname, 'golden', 'engine_snapshot.json');
const code = ['historical-audit.js', 'data.js', 'engine.js']
  .map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
  .join('\n');
const E = new Function(code + '\nreturn { EVENTS, DOCTRINES, BATTLE_FORMATION_DEFS, BATTLE_TERRAINS, resolveBattle, randomDeck, mulberry32, battleFingerprint, normalizeArmyFormations };')();

const N = 240;
const rng = E.mulberry32(20261126);
const formationIds = E.BATTLE_FORMATION_DEFS.map(f => f.id).filter(id => id !== 'fourYi');
const results = [];
const summary = { A: 0, B: 0, draw: 0, wipeout: 0 };
for (let i = 0; i < N; i++) {
  const deckA = E.randomDeck(rng);
  const deckB = E.randomDeck(rng);
  const seed = Math.floor(rng() * 4294967296) >>> 0;
  const ev = E.EVENTS[i % E.EVENTS.length];
  const terrain = E.BATTLE_TERRAINS[i % E.BATTLE_TERRAINS.length].id;
  const fA = E.normalizeArmyFormations(Array(5).fill(formationIds[i % formationIds.length]), deckA);
  const fB = E.normalizeArmyFormations(Array(5).fill(formationIds[(i + 3) % formationIds.length]), deckB);
  const res = E.resolveBattle(deckA, deckB, {
    seed, event: ev, terrain,
    docA: E.DOCTRINES[i % 3].id, docB: E.DOCTRINES[(i + 1) % 3].id,
    formationsA: fA, formationsB: fB
  });
  summary[res.winner]++;
  if (res.wipeout) summary.wipeout++;
  results.push({ i, a: deckA.join('.'), b: deckB.join('.'), w: res.winner, fp: E.battleFingerprint(res) });
}

// 決定性自檢：同一輸入重算兩次須完全一致
const probe = results[0];
const again = E.resolveBattle(probe.a.split('.'), probe.b.split('.'), { seed: 1, event: E.EVENTS[0] });
const again2 = E.resolveBattle(probe.a.split('.'), probe.b.split('.'), { seed: 1, event: E.EVENTS[0] });
if (E.battleFingerprint(again) !== E.battleFingerprint(again2)) {
  console.error('[FAIL] 引擎不具決定性：相同輸入產生不同結果');
  process.exit(1);
}

if (process.argv.includes('--update') || !fs.existsSync(SNAPSHOT)) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ n: N, summary, results }, null, 0).replace(/\},\{/g, '},\n{') + '\n', 'utf8');
  console.log(`[UPDATED] 已寫入 ${N} 場戰果快照：`, summary);
  process.exit(0);
}

const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
const diffs = [];
results.forEach((r, idx) => {
  const s = snap.results[idx];
  if (!s || s.a !== r.a || s.b !== r.b) diffs.push({ i: idx, reason: '陣容產生器改變（randomDeck 或名將資料變動）' });
  else if (s.fp !== r.fp) diffs.push({ i: idx, reason: s.w !== r.w ? `勝負改變 ${s.w} → ${r.w}` : '戰況數值改變（勝負相同）' });
});
if (diffs.length) {
  const flips = diffs.filter(d => d.reason.startsWith('勝負改變')).length;
  console.error(`[FAIL] ${diffs.length}/${N} 場戰果與快照不同（其中 ${flips} 場勝負翻轉）`);
  console.error('       快照勝負分布：', snap.summary, ' → 目前：', summary);
  diffs.slice(0, 8).forEach(d => console.error(`       #${d.i}: ${d.reason}`));
  console.error('       若為刻意的平衡調整，請執行 node test/test_engine_golden.js --update 並於 CHANGELOG 註明。');
  process.exit(1);
}
console.log(`[PASS] 戰鬥引擎 ${N} 場固定種子戰果與快照完全一致`, summary);
