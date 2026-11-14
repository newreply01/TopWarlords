'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 天梯核心演算法與排名引擎 (Ladder Engine)
   實作 CRS-15 戰略勝點數學模型、每日 00:00 截算、戰術迷霧偵察與排名躍升
   ===================================================== */

const LadderEngine = (function () {
  const STORAGE_KEY = 'wl15_ladder_v1';
  const LEGACY_STORAGE_KEY = 'topwarlords_ladder_v1';
  const GHOST_DB_PATH = 'global_stats/warlords/ladder_ghosts';

  function generateCommanderUID() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CMD-${code}`;
  }

  const DEFAULT_DEFENSE_DECK = ['ZHANGLIAO', 'DIANWEI', 'HUANGZHONG', 'GANNING', 'SUNBIN'];

  function normalizeDefenseDoc(doc) {
    if (doc === 'air_sup') return 'strike';
    if (doc === 'electronic') return 'deception';
    if (doc === 'strike' || doc === 'defense' || doc === 'deception') return doc;
    return 'defense';
  }

  function sanitizeDefenseDeck(deck) {
    const fallback = (typeof LADDER_PRESETS !== 'undefined' && Array.isArray(LADDER_PRESETS) && LADDER_PRESETS[0] && Array.isArray(LADDER_PRESETS[0].deck))
      ? LADDER_PRESETS[0].deck.slice()
      : DEFAULT_DEFENSE_DECK.slice();
    if (!Array.isArray(deck) || deck.length !== 5) return fallback;
    if (typeof UNIT_MAP !== 'undefined' && typeof SLOTS !== 'undefined') {
      const seen = new Set();
      let total = 0;
      for (let i = 0; i < 5; i++) {
        const u = UNIT_MAP[deck[i]];
        if (!u || seen.has(u.id) || (SLOTS[i] && u.cat !== SLOTS[i].fixed)) return fallback;
        seen.add(u.id);
        total += u.cost;
      }
      if (total > 15) return fallback;
    }
    return deck.slice();
  }

  let state = {
    version: 'v5.5.0',
    player: {
      id: 'player_me',
      uid: 'CMD-7392', // 指揮官永久專屬軍事識別碼 (對應綁定使用者名稱)
      name: '我方聯合戰術作戰群',
      flag: '🇹🇼',
      rp: 0,
      rank: 101,
      yesterdayRank: 101,
      yesterdayRP: 0,
      orders: 30, // 剩餘作戰派遣令 (每小時 30 次)
      lastResetDate: '',
      lastResetHour: '',
      streakDays: 1, // 連續維持該名次天數
      defenseDeck: DEFAULT_DEFENSE_DECK.slice(),
      defenseDoc: 'strike',
      stats: { wins: 0, losses: 0, highestRank: 101, highestRP: 0, miracleKills: 0, streakBreaks: 0 }
    },
    roster: [], // 全體天梯名冊 (包含玩家與對手，即時依 rp 降序)
    yesterdayTop10: [] // 昨日前十強榮譽殿堂快照
  };

  function init() {
    load();
    checkDailyReset();
    sortAndReindex();
    setTimeout(() => syncCloudGhosts(), 600);
  }

  /* 雲端鏡像駐防同步 (隔離於 global_stats/warlords/ladder_ghosts 並雙寫前綴鏡像) */
  function getFirebaseDb() {
    try {
      if (typeof window !== 'undefined' && window.firebase && window.firebase.apps && window.firebase.apps.length) {
        return window.firebase.database();
      }
    } catch (e) { }
    return null;
  }

  function pushDefenseFleetToCloud() {
    const db = getFirebaseDb();
    if (!db || !state.player || !state.player.uid) return;
    const key = String(state.player.uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (key.startsWith('TC_')) return;
    const deck = sanitizeDefenseDeck(state.player.defenseDeck);
    if (typeof validateDeck === 'function' && validateDeck(deck).length > 0) return;
    const ghostPayload = {
      gameId: 'topwarlords',
      uid: state.player.uid,
      name: state.player.name || '無名指揮官',
      flag: state.player.flag || '🇹🇼',
      rp: state.player.rp ?? 0,
      deck: deck,
      doc: normalizeDefenseDoc(state.player.defenseDoc),
      streakDays: state.player.streakDays || 1,
      updatedAt: Date.now()
    };
    db.ref(`${GHOST_DB_PATH}/${key}`).set(ghostPayload).catch(() => { });
    db.ref(`ladder_ghosts/WL_${key}`).set(ghostPayload).catch(() => { });
  }

  function syncCloudGhosts(onUpdated) {
    const db = getFirebaseDb();
    if (!db) return;
    db.ref(GHOST_DB_PATH).orderByChild('updatedAt').limitToLast(20).once('value').then(snap => {
      const val = snap.val();
      if (!val || typeof val !== 'object') return;
      let changed = false;
      Object.entries(val).forEach(([key, g]) => {
        if (key.startsWith('TC_')) return;
        if (!g || !g.uid || g.uid === state.player.uid) return;
        if (g.gameId && g.gameId !== 'topwarlords') return;
        if (!Array.isArray(g.deck) || g.deck.length !== 5) return;
        if (typeof validateDeck === 'function' && validateDeck(g.deck).length > 0) return;
        const existing = state.roster.find(u => u.uid === g.uid || (u.isCloudGhost && u.name === g.name));
        if (existing && existing.id !== state.player.id) {
          existing.name = g.name;
          existing.flag = g.flag || '🌐';
          existing.deck = g.deck.slice();
          existing.doc = g.doc || 'defense';
          existing.isCloudGhost = true;
          changed = true;
        } else {
          // 尋找一名低互動 NPC 席位替換為真實玩家雲端駐防艦隊
          const npcCandidates = state.roster.filter(u => u.id !== state.player.id && !u.isCloudGhost && Math.abs(u.rp - (g.rp || 2100)) <= 260);
          const targetNpc = npcCandidates[0];
          if (targetNpc) {
            targetNpc.uid = g.uid;
            targetNpc.name = g.name;
            targetNpc.flag = g.flag || '🌐';
            targetNpc.deck = g.deck.slice();
            targetNpc.doc = g.doc || 'defense';
            targetNpc.title = '☁ 雲端真人駐防';
            targetNpc.isCloudGhost = true;
            changed = true;
          }
        }
      });
      if (changed) {
        sortAndReindex();
        save();
        if (typeof onUpdated === 'function') onUpdated();
      }
    }).catch(() => { });
  }

  const MAX_ORDERS = 30;

  function getCurrentHourStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}`;
  }

  function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.player && Array.isArray(saved.roster) && saved.roster.length > 0) {
          state = saved;
          // 確保玩家擁有永久不可變的專屬 UID (對應綁定其呼號)
          if (!state.player.uid) {
            state.player.uid = generateCommanderUID();
          }
          state.player.defenseDeck = sanitizeDefenseDeck(state.player.defenseDeck);
          state.player.defenseDoc = normalizeDefenseDoc(state.player.defenseDoc);

          // 每小時整點補給檢查 / 舊版派遣令自動升級為 30 次
          const curHour = getCurrentHourStr();
          if (state.player.lastResetHour !== curHour || state.player.orders === undefined || state.player.orders > MAX_ORDERS) {
            state.player.orders = MAX_ORDERS;
            state.player.lastResetHour = curHour;
          }
          // 舊版存檔轉移：若玩家 RP 為舊版 2055 預設值，重置為合規 0 RP 少尉起跑
          if (state.player.rp === 2055 && (!state.player.stats || state.player.stats.wins === 0)) {
            state.player.rp = 0;
            state.player.rank = state.roster.length;
            state.player.yesterdayRank = state.roster.length;
            state.player.yesterdayRP = 0;
          }
          if (typeof state.player.streakDays !== 'number' || state.player.streakDays < 1) {
            state.player.streakDays = 1;
          }
          // 確保載入時記憶體名冊與玩家本體即時同步並重排校正
          const pEntry = state.roster.find(u => u.id === state.player.id);
          if (pEntry) {
            pEntry.rp = state.player.rp;
          }
          sortAndReindex();
          // 確保每位 NPC 都有合理的連續駐榜天數 streakDays
          state.roster.forEach((u, i) => {
            if (u.id === state.player.id) {
              u.uid = state.player.uid;
            }
            if (typeof u.streakDays !== 'number' || u.streakDays < 1) {
              u.streakDays = i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : Math.floor(Math.random() * 4 + 1);
            }
          });
          // 版本平滑遷移：若為舊版存檔，更新 NPC 積分至全新 50,000 RP 擴展級距階梯 (v5.9.85)
          if (!state.version || state.version < 'v5.9.85') {
            state.version = 'v5.9.85';
            if (typeof LADDER_PRESETS !== 'undefined') {
              const pMap = new Map(LADDER_PRESETS.map(p => [p.id, p.rp]));
              state.roster.forEach(u => {
                if (u.id !== state.player.id && pMap.has(u.id)) {
                  u.rp = pMap.get(u.id);
                }
              });
            }
            sortAndReindex();
            save();
          }
          return;
        }
      }
    } catch (e) {
      console.warn('載入天梯存檔失敗，重建天梯預設名冊', e);
    }

    // 首次初始化天梯資料
    state.roster = JSON.parse(JSON.stringify(LADDER_PRESETS));
    // 為 NPC 初始化擬真的連續在榜天數 (1~7 天)
    state.roster.forEach((u, i) => {
      u.streakDays = i === 0 ? 5 : i === 1 ? 4 : i === 2 ? 3 : Math.floor(Math.random() * 4 + 1);
    });

    state.roster.push(state.player);
    state.player.lastResetDate = getTodayDateStr();
    state.player.lastResetHour = getCurrentHourStr();
    state.player.orders = MAX_ORDERS;
    sortAndReindex();

    // 產生初始的「昨日前十強快照」
    state.yesterdayTop10 = state.roster.slice(0, 10).map((u, idx) => ({
      ...u,
      finalRank: idx + 1,
      yesterdayRP: u.rp + Math.floor((Math.random() - 0.5) * 40)
    }));
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('儲存天梯資料失敗', e);
    }
  }

  /* 每日 00:00 截算與每小時整點派遣令補給協議 */
  function checkDailyReset() {
    const today = getTodayDateStr();
    const curHour = getCurrentHourStr();

    // 每小時整點補給作戰派遣令至 30 次
    if (state.player.lastResetHour !== curHour) {
      state.player.orders = MAX_ORDERS;
      state.player.lastResetHour = curHour;
      save();
    }
    if (state.player.lastResetDate !== today) {
      // 1. 結算連續在位天數 streakDays
      if (state.player.yesterdayRank === state.player.rank) {
        state.player.streakDays = (state.player.streakDays || 1) + 1;
      } else {
        state.player.streakDays = 1;
      }

      state.player.yesterdayRank = state.player.rank;
      state.player.yesterdayRP = state.player.rp;
      state.player.orders = MAX_ORDERS;
      state.player.lastResetDate = today;

      // 2. 備份昨日前十強
      state.yesterdayTop10 = state.roster.slice(0, 10).map((u, idx) => ({
        ...u,
        finalRank: idx + 1
      }));

      // 3. 模擬世界天梯演化：全體 NPC 指揮官產生微量分數波動 (±1 ~ 15 RP) 並更新連續天數
      state.roster.forEach(u => {
        if (u.id !== state.player.id) {
          const shift = Math.floor((Math.random() - 0.48) * 16);
          const oldRank = u.rank || 50;
          u.yesterdayRank = oldRank;
          u.rp = Math.max(10, u.rp + shift);
          if (oldRank === u.rank) {
            u.streakDays = (u.streakDays || 1) + 1;
          } else {
            u.streakDays = 1;
          }
        }
      });

      sortAndReindex();
      save();
    }
  }

  function sortAndReindex() {
    // 確保 state.roster 內的玩家物件與 state.player 完全同步（防止 JSON 反序列化產生的物件脫鉤）
    const meInRoster = state.roster.find(u => u.id === state.player.id);
    if (meInRoster) {
      meInRoster.rp = state.player.rp;
      meInRoster.name = state.player.name;
      meInRoster.flag = state.player.flag;
      if (state.player.defenseDeck) meInRoster.deck = state.player.defenseDeck.slice();
      if (state.player.defenseDoc) meInRoster.doc = state.player.defenseDoc;
    }
    state.roster.sort((a, b) => b.rp - a.rp);
    state.roster.forEach((u, idx) => {
      u.rank = idx + 1;
      if (u.id === state.player.id) {
        state.player.rank = u.rank;
        if (!state.player.stats.highestRank || state.player.rank < state.player.stats.highestRank) {
          state.player.stats.highestRank = state.player.rank;
        }
        if (state.player.rp > state.player.stats.highestRP) {
          state.player.stats.highestRP = state.player.rp;
        }
      }
    });
  }

  /* 取得對應 RP 的軍階資訊 */
  function getRankTier(rp) {
    for (const r of LADDER_RANKS) {
      if (rp >= r.minRP) return r;
    }
    return LADDER_RANKS[LADDER_RANKS.length - 1];
  }

  /* 取得 Top 10 名冊清單 (至尊上將殿堂) */
  function getRosterTop10() {
    sortAndReindex();
    return state.roster.slice(0, 10);
  }

  /* 取得 Top 30 名冊清單 */
  function getRosterTop30() {
    sortAndReindex();
    return state.roster.slice(0, 30);
  }

  /* 依排名取得指揮官資料 */
  function getRosterUserByRank(rank) {
    sortAndReindex();
    return state.roster.find(u => u.rank === rank) || null;
  }

  /* 判定挑戰對手的難度階梯 (強攻 / 進取 / 穩健)
     delta: 席位跨度 (我方名次 - 目標名次)
     清單由上而下排布（前方 8 席，勝點維持標準 CRS-15 基準）：
     - 前 1~2 名 (跨度 7~8 席)：強攻 (獲勝 +30 RP，失利 -10 RP)
     - 前 3~4 名 (跨度 5~6 席)：進取 (獲勝 +22 RP，失利 -15 RP)
     - 前 5~8 名 (跨度 1~4 席)：穩健 (獲勝 +15 RP，失利 -20 RP)
  */
  function getTargetTierInfo(delta) {
    if (delta >= 7) {
      return {
        id: 'assault',
        name: '強攻',
        icon: '🔥',
        baseRP: 30,
        failRP: -10,
        btnClass: 'btn-tier-assault',
        desc: '越級強攻 (+7~8席)'
      };
    } else if (delta >= 5) {
      return {
        id: 'aggressive',
        name: '進取',
        icon: '⚔️',
        baseRP: 22,
        failRP: -15,
        btnClass: 'btn-tier-aggressive',
        desc: '中距進取 (+5~6席)'
      };
    } else {
      return {
        id: 'steady',
        name: '穩健',
        icon: '🛡️',
        baseRP: 15,
        failRP: -20,
        btnClass: 'btn-tier-steady',
        desc: '近距穩健 (+1~4席)'
      };
    }
  }

  /* 判斷特定名次是否在玩家可挑戰的前方 8 名內 */
  function canChallengeRank(targetRank) {
    const pRank = state.player.rank;
    // 支援前方完整 8 席全開挑戰 (強攻/進取/穩健)
    return targetRank < pRank && targetRank >= pRank - 8;
  }

  /* 取得當前可挑戰的目標清單（前方 8 名以內之對手） */
  function getChallengeableTargets() {
    sortAndReindex();
    const pRank = state.player.rank;
    if (pRank <= 1) return [];
    return state.roster.filter(u => u.id !== state.player.id && u.rank < pRank && u.rank >= pRank - 8)
      .sort((a, b) => b.rank - a.rank);
  }

  /* 取得我方戰區席位清單（包含前方 8 名目標、我方及後方追擊者） */
  function getRosterZone() {
    sortAndReindex();
    const pRank = state.player.rank;
    // 嚴格確保前方完整涵蓋 8 筆目標 (pRank - 8 ~ pRank - 1)
    const minR = Math.max(1, pRank - 8);
    // 保留後方 2 筆席位 (防守追擊者)，讓戰局具備全景縱深
    const maxR = Math.min(state.roster.length, pRank + 2);
    return state.roster.filter(u => u.rank >= minR && u.rank <= maxR)
      .sort((a, b) => a.rank - b.rank);
  }

  /* 取得今日全服統一戰區環境（根據當前日期種子計算，每日 00:00 自動輪替） */
  function getDailyTheater() {
    const today = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
      hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
    }
    const eventList = (typeof EVENTS !== 'undefined' && EVENTS.length) ? EVENTS : [
      { id: 'plain', icon: '🏜', name: '荒漠平原', desc: '地面開闊：裝甲火力 +20%，艦艇火力 −30%。', mod: { armorDmg: 1.2, navalDmg: 0.7 } },
      { id: 'strait', icon: '🌊', name: '島嶼海峽', desc: '海空主導：艦艇火力 +25%，裝甲火力 −15%。', mod: { navalDmg: 1.25, armorDmg: 0.85 } },
      { id: 'storm', icon: '⛈', name: '暴雨雷暴', desc: '能見度低：空中命中率 −15%，無人機傷害 −25%。', mod: { airHit: -0.15, droneDmg: 0.75 } },
      { id: 'urban', icon: '🏙', name: '都會巷戰', desc: '重砲受限：火砲 −25%、裝甲 −10%，無人機 +30%。', mod: { artyDmg: 0.75, droneDmg: 1.3, armorDmg: 0.9 } },
      { id: 'em', icon: '⚡', name: '電磁風暴', desc: '電戰效果 ×1.6；全體隱匿 +10。', mod: { ewMult: 1.6, stealthAdd: 10 } },
      { id: 'clear', icon: '☀', name: '晴朗無風', desc: '標準環境，無任何修正。', mod: {} }
    ];
    return eventList[hash % eventList.length];
  }

  /* 挑選 3 名具備挑戰梯度的候選對手 (附帶戰術偵察迷霧) */
  function getMatchCandidates() {
    sortAndReindex();
    const pIdx = state.roster.findIndex(u => u.id === state.player.id);
    const total = state.roster.length;

    // 梯度 1：穩健目標 (領先 1 ~ 3 名)
    const idx1 = Math.max(0, pIdx - Math.floor(Math.random() * 3 + 1));
    // 梯度 2：進取目標 (領先 4 ~ 7 名)
    const idx2 = Math.max(0, pIdx - Math.floor(Math.random() * 4 + 4));
    // 梯度 3：越級強攻 (領先 8 ~ 14 名)
    const idx3 = Math.max(0, pIdx - Math.floor(Math.random() * 7 + 8));

    const pickedIndices = Array.from(new Set([idx1, idx2, idx3])).filter(i => i !== pIdx);
    // 防呆：若已經在前幾名，向下挑選
    if (pickedIndices.length < 3) {
      for (let i = pIdx - 1; i >= 0 && pickedIndices.length < 3; i--) {
        if (!pickedIndices.includes(i) && i !== pIdx) pickedIndices.push(i);
      }
      for (let i = pIdx + 1; i < total && pickedIndices.length < 3; i++) {
        if (!pickedIndices.includes(i) && i !== pIdx) pickedIndices.push(i);
      }
    }

    return pickedIndices.map(idx => {
      const opp = state.roster[idx];
      // 產生戰術偵察情報：旗艦 (deck[0]) 公開，其餘 2~3 個槽位遮蔽 (戰術迷霧)
      const intelDeck = opp.deck.map((unitId, slotIdx) => {
        const u = UNIT_MAP[unitId] || { name: '未知裝備', cat: 'air', cost: 3 };
        const isMasked = (slotIdx >= 1 && slotIdx <= 3); // 中間 3 槽受電戰迷霧遮蔽
        return {
          id: unitId,
          name: isMasked ? '【密電遮蔽】' : u.name,
          cat: u.cat,
          cost: isMasked ? '?' : u.cost,
          flag: isMasked ? '📡' : (u.flag || '🌐'),
          img: isMasked ? '' : (u.img || `assets/units/${unitId}.jpg`),
          isMasked: isMasked
        };
      });

      const rpDiff = opp.rp - state.player.rp;
      let label = '勢均力敵';
      let tagClass = 'even';
      if (rpDiff >= 80) { label = '越級強攻'; tagClass = 'hard'; }
      else if (rpDiff <= -20) { label = '穩操勝券'; tagClass = 'easy'; }

      return {
        ...opp,
        rpDiff,
        label,
        tagClass,
        intelDeck,
        rawDeck: opp.deck
      };
    });
  }

  /* 戰略勝點數學模型 (CRS-15) 結算 */
  function resolveMatch(isWin, enemy, battleRes) {
    if (state.player.orders > 0) {
      state.player.orders--;
    }

    const pRP = state.player.rp;
    const eRP = enemy.rp;
    const diff = eRP - pRP;

    let baseDelta = 0;
    let diffBonus = 0;
    let excellenceMult = 1.0;
    let miracleBonus = 0;
    let aceBonus = false;
    let blitzBonus = false;

    const oldRank = state.player.rank;
    const targetDelta = (oldRank && enemy && enemy.rank) ? Math.max(1, oldRank - enemy.rank) : 1;
    const tierInfo = getTargetTierInfo(targetDelta);

    if (isWin) {
      state.player.stats.wins++;
      baseDelta = tierInfo.baseRP; // 依階梯檔位核發基準 RP (強攻 +30, 進取 +22, 穩健 +15)

      // 難度分差加成：微幅補正 (+0 ~ +5 RP)
      if (diff > 0) {
        diffBonus = Math.min(5, Math.round(diff / 60));
      } else {
        diffBonus = -Math.min(5, Math.round(Math.abs(diff) / 60));
      }

      // 戰術卓越加乘 (TEM)
      // 1. ACE 完勝判定：5 單位全員生還 (+15%)
      const myLosses = battleRes.final.A.filter(u => u.hp <= 0).length;
      if (myLosses === 0) {
        aceBonus = true;
        excellenceMult += 0.15;
      }

      // 2. 閃擊先制判定：階段二前即結束 (+10%)
      if (battleRes.frames.length <= 2) {
        blitzBonus = true;
        excellenceMult += 0.10;
      }
    } else {
      state.player.stats.losses++;
      baseDelta = tierInfo.failRP; // 強攻失敗減免保護 (-10 RP)，穩健失敗 -20 RP
      if (diff > 0) {
        diffBonus = Math.min(5, Math.round(diff / 60));
      } else {
        diffBonus = -Math.min(5, Math.round(Math.abs(diff) / 60));
      }
    }

    // 3. 以小博大奇蹟加成：低打高每次 +15 分 (不論輸贏皆榮譽發放)
    const miracleKills = (battleRes.keys || []).filter(k => k.text && k.text.includes('擊毀') && k.side === 'A').length;
    // 粗估檢查是否有低成本擊毀高價
    let miracleCount = 0;
    if (battleRes.frames && Array.isArray(battleRes.frames)) {
      battleRes.frames.forEach(f => {
        if (f && Array.isArray(f.lines)) {
          f.lines.forEach(ln => {
            if (ln.kind === 'kill' && ln.side === 'A') {
              const aId = ln.auid ? ln.auid.split('-')[0] : '';
              const tId = ln.tuid ? ln.tuid.split('-')[0] : '';
              const aU = UNIT_MAP[aId], tU = UNIT_MAP[tId];
              if (aU && tU && aU.cost <= 2 && tU.cost >= 4) miracleCount++;
            }
          });
        }
      });
    }

    if (miracleCount > 0) {
      miracleBonus = miracleCount * 5; // 榮譽減免/獎勵
      state.player.stats.miracleKills += miracleCount;
    }

    // 4. 終結者加成 (Streak Breaker Bonus)：若敵方連續霸榜/守位 >= 3 天，給予超額終結者獎金 +15 RP
    let streakBreakerBonus = 0;
    const oppInRoster = state.roster.find(u => u.id === enemy.id);
    if (isWin && oppInRoster && oppInRoster.streakDays >= 3) {
      streakBreakerBonus = 15; // 與 UI +15 保持完全一致
      state.player.stats.streakBreaks = (state.player.stats.streakBreaks || 0) + 1;
      oppInRoster.streakDays = 1; // 霸榜被終結
    }

    // 總分計算
    let totalDelta = 0;
    if (isWin) {
      totalDelta = Math.round((baseDelta + diffBonus) * excellenceMult) + miracleBonus + streakBreakerBonus;
      // 獲勝保底 tierInfo.baseRP，最高 +65 RP (包含完勝/速攻/奇蹟/終結者加成)
      totalDelta = Math.max(tierInfo.baseRP, Math.min(65, totalDelta));
    } else {
      // 失敗扣分：依檔位 failRP 微調，若有奇蹟擊毀可微幅減免
      const rawLoss = Math.max(-30, Math.min(-10, baseDelta + diffBonus));
      totalDelta = Math.min(-10, Math.max(-30, rawLoss + miracleBonus));
    }

    // 🎯 正統 RP 積分機制：嚴格根據戰局獲得之 totalDelta 累加/扣除，絕不竊取或繼承對手 RP
    state.player.rp = Math.max(0, (state.player.rp || 0) + totalDelta);
    if (oppInRoster) {
      if (isWin) {
        // 對手扣除防禦失利分數
        oppInRoster.rp = Math.max(0, oppInRoster.rp - Math.round(totalDelta * 0.65));
      } else {
        // 我方挑戰失敗，防守方獲得防禦勝點獎勵
        oppInRoster.rp = (oppInRoster.rp || 0) + Math.round(Math.abs(totalDelta) * 0.5);
      }
    }

    sortAndReindex();
    save();

    const newRank = state.player.rank;
    const rankDelta = oldRank - newRank; // 正數代表名次上升
    if (rankDelta !== 0) {
      state.player.streakDays = 1; // 名次發生變更，重新計算駐留天數
    }

    return {
      isWin,
      oldRP: pRP,
      newRP: state.player.rp,
      totalDelta,
      baseDelta,
      diffBonus,
      tierName: tierInfo.name,
      tierIcon: tierInfo.icon,
      tierInfo,
      miracleBonus,
      miracleCount,
      streakBreakerBonus,
      aceBonus,
      blitzBonus,
      oldRank,
      newRank,
      rankDelta,
      currentTier: getRankTier(state.player.rp)
    };
  }

  function setDefenseFleet(deck, doc) {
    if (Array.isArray(deck) && deck.length === 5) {
      state.player.defenseDeck = sanitizeDefenseDeck(deck);
    }
    if (doc) {
      state.player.defenseDoc = normalizeDefenseDoc(doc);
    }
    save();
    pushDefenseFleetToCloud();
  }

  /* 檢查特定呼號是否已被天梯中的其他席位使用 (名稱不可重複) */
  function isCallsignTaken(name, excludeOwn = true) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim().toLowerCase();
    if (!clean) return false;
    return state.roster.some(u => {
      if (excludeOwn && (u.id === state.player.id || u.uid === state.player.uid)) {
        return false;
      }
      return (u.name || '').trim().toLowerCase() === clean;
    });
  }

  /* 驗證使用者輸入的作戰呼號，包含長度、保留字元與全域唯一性 */
  function validateCallsign(name) {
    if (!name || typeof name !== 'string') {
      return { ok: false, reason: '請輸入有效的作戰呼號！' };
    }
    const clean = name.trim();
    if (clean.length < 2) {
      return { ok: false, reason: '呼號長度至少需 2 個字元！' };
    }
    if (clean.length > 16) {
      return { ok: false, reason: '呼號長度不可超過 16 個字元！' };
    }
    const reservedWords = ['系統', '裁判', '管理員', 'system', 'admin', 'npc'];
    if (reservedWords.some(w => clean.toLowerCase().includes(w))) {
      return { ok: false, reason: '該呼號包含系統保留關鍵字，無法使用！' };
    }
    if (isCallsignTaken(clean, true)) {
      return { ok: false, reason: `該軍武呼號【${clean}】已被現役席次佔用，請重新命名！` };
    }
    return { ok: true, cleanName: clean };
  }

  /* 設定使用者指揮官呼號與代表旗幟 (保證 ID 對應與名稱唯一性) */
  function setPlayerProfile(name, flag) {
    const valid = validateCallsign(name);
    if (!valid.ok) {
      return { success: false, reason: valid.reason };
    }

    state.player.name = valid.cleanName;
    state.player.hasCustomName = true;
    if (!state.player.uid) {
      state.player.uid = generateCommanderUID();
    }
    if (flag && typeof flag === 'string') {
      state.player.flag = flag;
    }

    // 同步更新 roster 中的玩家自身 (維持 UID 與名稱永久映射)
    const me = state.roster.find(u => u.id === state.player.id || u.uid === state.player.uid);
    if (me) {
      me.name = state.player.name;
      me.flag = state.player.flag;
      me.uid = state.player.uid;
    }
    save();
    return {
      success: true,
      uid: state.player.uid,
      name: state.player.name,
      flag: state.player.flag
    };
  }

  return {
    init,
    getState: () => state,
    getPlayerUID: () => (state.player && state.player.uid) || 'CMD-7392',
    getRankTier,
    getRosterTop10,
    getRosterTop30,
    getRosterUserByRank,
    getTargetTierInfo,
    canChallengeRank,
    getChallengeableTargets,
    getRosterZone,
    getDailyTheater,
    getMatchCandidates,
    resolveMatch,
    setDefenseFleet,
    syncCloudGhosts,
    pushDefenseFleetToCloud,
    setPlayerProfile,
    isCallsignTaken,
    validateCallsign,
    generateCommanderUID,
    checkDailyReset,
    MAX_ORDERS,
    save
  };
})();
