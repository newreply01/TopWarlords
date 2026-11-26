// 雲端存檔隱私測試：node test/test_cloud_sync_privacy.js
// 1. Google 帳號同步只寫入私有節點 commanders/{uid}/warlords，不寫入公開統計區 global_stats
// 2. 上傳的存檔不含 email
// 3. 成功寫入後刪除舊版留在 global_stats/warlords/commanders/{uid} 的公開副本
// 4. 私有節點寫入失敗時不會退回寫入公開路徑
// 5. 讀取舊版公開副本（遷移用）時剔除 email
// 6. 舊版代號帳號（無 Google 登入）不再進行任何雲端寫入
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
const UID = 'gUser123';
const EMAIL = 'player@example.com';

function makeEnv({ failPrivateWrite = false, seed = {} } = {}) {
  const store = new Map(Object.entries(seed));
  const ops = [];
  const ref = p => ({
    set: async v => {
      ops.push({ op: 'set', path: p, value: JSON.parse(JSON.stringify(v)) });
      if (failPrivateWrite && p.startsWith('commanders/')) throw new Error('PERMISSION_DENIED: Permission denied');
      store.set(p, v);
    },
    remove: async () => { ops.push({ op: 'remove', path: p }); store.delete(p); },
    once: async () => ({ exists: () => store.has(p), val: () => store.get(p) })
  });
  const local = new Map();
  const localStorage = {
    getItem: k => (local.has(k) ? local.get(k) : null),
    setItem: (k, v) => local.set(k, String(v)),
    removeItem: k => local.delete(k)
  };
  const currentUser = { uid: UID, email: EMAIL, displayName: '測試玩家', getIdToken: async () => 'tok' };
  const firebase = {
    apps: [{ database: () => ({ ref }) }],
    initializeApp: () => ({ database: () => ({ ref }) }),
    auth: Object.assign(() => ({ currentUser, onAuthStateChanged: () => {}, signOut: async () => {}, signInWithPopup: async () => ({ user: currentUser }) }), { GoogleAuthProvider: function () {} })
  };
  const window = { firebase, dispatchEvent: () => {}, location: { href: 'http://x/' } };
  const ctx = vm.createContext({ window, localStorage, console: { ...console, warn: () => {} }, CustomEvent: function () {}, crypto: require('crypto').webcrypto, TextEncoder });
  vm.runInContext(SRC, ctx, { filename: 'cloud-sync.js' });
  return { CloudSync: window.CloudSync, ops, store, localStorage };
}

const hasEmail = v => JSON.stringify(v || {}).includes(EMAIL) || Object.prototype.hasOwnProperty.call(v || {}, 'email');

(async () => {
  // --- 1~3：Google 帳號正常同步 ---
  {
    const legacyMirror = `global_stats/warlords/commanders/${UID}`;
    const env = makeEnv({ seed: { [legacyMirror]: { id: UID, email: EMAIL, saveData: {} } } });
    env.localStorage.setItem('wl15_cloud_account', JSON.stringify({ id: UID, displayId: '測試玩家', email: EMAIL, isGoogle: true }));
    const ok = await env.CloudSync.syncToCloud(true);
    assert.strictEqual(ok, true, '同步應成功');
    const sets = env.ops.filter(o => o.op === 'set');
    assert.ok(sets.length === 1 && sets[0].path === `commanders/${UID}/warlords`, `只能寫入私有節點：${JSON.stringify(sets.map(s => s.path))}`);
    assert.ok(!env.ops.some(o => o.op === 'set' && o.path.startsWith('global_stats')), '不得寫入 global_stats');
    assert.ok(!hasEmail(sets[0].value), '上傳存檔不得包含 email');
    assert.ok(env.ops.some(o => o.op === 'remove' && o.path === legacyMirror), '應刪除舊版公開副本');
    assert.ok(!env.store.has(legacyMirror), '舊版公開副本應已不存在');
    console.log('[PASS] Google 同步只寫入私有節點、不含 email，並清除舊版公開副本');
  }

  // --- 4：私有節點寫入失敗不退回公開路徑 ---
  {
    const env = makeEnv({ failPrivateWrite: true });
    env.localStorage.setItem('wl15_cloud_account', JSON.stringify({ id: UID, displayId: '測試玩家', email: EMAIL, isGoogle: true }));
    const ok = await env.CloudSync.syncToCloud(true);
    assert.strictEqual(ok, false, '私有節點被拒時同步應回報失敗');
    assert.ok(!env.ops.some(o => o.op === 'set' && o.path.startsWith('global_stats')), '失敗時不得改寫公開路徑');
    assert.strictEqual(env.CloudSync.getStatus().state, 'error');
    console.log('[PASS] 私有節點寫入被拒時不會退回寫入公開路徑');
  }

  // --- 5：只有舊版公開副本的玩家以 Google 登入 → 可讀回存檔比較，選擇後寫入私有節點並刪除公開副本 ---
  {
    const legacyMirror = `global_stats/warlords/commanders/${UID}`;
    const env = makeEnv({ seed: { [legacyMirror]: { id: UID, email: EMAIL, nickname: '舊存檔', saveData: { gameId: 'topwarlords', stats: { played: 3, win: 2 } }, updatedAt: 1 } } });
    let seen = null;
    env.CloudSync.setSaveResolver(async info => { seen = info; return 'local'; });
    const res = await env.CloudSync.loginWithGoogle();
    assert.ok(seen && seen.cloud && seen.cloud.nickname === '舊存檔', `應讀回舊版公開副本供玩家比較：${JSON.stringify(seen)}`);
    assert.ok(!hasEmail(seen), '提供給比較介面的資料不得含 email');
    assert.ok(res && res.account && res.account.id === UID);
    const sets = env.ops.filter(o => o.op === 'set');
    assert.ok(sets.every(o => o.path === `commanders/${UID}/warlords` && !hasEmail(o.value)), `遷移只寫私有節點且不含 email：${JSON.stringify(sets.map(o => o.path))}`);
    assert.ok(!env.store.has(legacyMirror), '遷移後應刪除舊版公開副本');
    console.log('[PASS] 舊版公開副本可讀回遷移，遷移後只存在私有節點且公開副本已刪除');
  }

  // --- 6：舊版代號帳號不再雲端寫入 ---
  {
    const env = makeEnv();
    env.localStorage.setItem('wl15_cloud_account', JSON.stringify({ id: 'legacycmd', displayId: 'LegacyCmd', authToken: 'abc' }));
    const ok = await env.CloudSync.syncToCloud(true);
    assert.strictEqual(ok, false);
    assert.strictEqual(env.ops.length, 0, `舊版帳號不得有任何雲端寫入：${JSON.stringify(env.ops)}`);
    console.log('[PASS] 舊版代號帳號不再寫入任何雲端路徑（含 passHash／authToken）');
  }

  // --- 原始碼層級：不得再出現寫入 global_stats 存檔的程式 ---
  assert.ok(!/global_stats\/warlords\/commanders\/\$\{id\}`\)\.set\(/.test(SRC), '原始碼不得再寫入公開存檔鏡像');
  assert.ok(!/email:\s*account\.email/.test(SRC), '上傳 payload 不得包含 email');
  console.log('\n[ALL PASS] 雲端存檔隱私測試通過');
})().catch(err => { console.error('[FAIL]', err.message); process.exit(1); });
