(function () {
'use strict';

function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.slice();
  if (typeof val === 'object') return Object.values(val);
  return [];
}

/* =====================================================
   頂尖對戰：15元聯合作戰 — 互動介面與核心邏輯
   含：快速對戰、真人非同步幽靈對戰、BO3 征服賽、精選對戰、沙盒模擬
   ===================================================== */
const $ = s => document.querySelector(s);
const ICON = {
  air: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5c-1.8 0-3.4.9-4.3 2.3L11 9l-5 1-3 4 2 1 2-2 2 1-2 5h2.5l2.5-4 3 1 1 4h2.5l-.5-5.5 2.5-3.5c1.2-.8 2-2.2 2-3.8C22.5 5.9 21 5 19 5z"/></svg>',
  armor: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6.1c0 5.1 3.4 9.8 8 10.9 4.6-1.1 8-5.8 8-10.9V5l-8-3zm0 3.2l5 1.9v4.7c0 3.6-2.1 6.9-5 8-2.9-1.1-5-4.4-5-8V7.1l5-1.9z"/></svg>',
  air_defense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 3c7 4 7 14 0 18"/><line x1="5" y1="3" x2="5" y2="21"/><line x1="3" y1="12" x2="20" y2="12"/><polyline points="16 8 20 12 16 16"/></svg>',
  naval: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5"/><path d="M11 19l-6-6"/><path d="M8 16l-4 4"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12.5" cy="10.5" r="3"/></svg>'
};

const LS = {

  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      window.dispatchEvent(new CustomEvent('gamesavechange'));
    } catch (e) {
      console.error('本機存檔失敗:', e);
      toast('本機存檔失敗，請檢查儲存空間並備份資料');
    }
  }
};
window.LS = LS;

/* ---------- 軍規級純前端 Web Audio API 物理聲學引擎 (獨立模組化載入自 js/sound.js) ---------- */
const SoundEngine = window.SoundEngine || {
  enabled: LS.get('wl15_sound', true),
  init() {},
  toggle() {},
  play() {}
};
window.SoundEngine = SoundEngine;

/* ---------- 預設社群幽靈名將錄 ---------- */
const SEED_GHOSTS = [
  { id: 'g_falcon', callsign: '冠軍侯・驃騎營', title: '驃騎將軍', rating: 1420, wins: 58, losses: 19, deck: ['HUO','ZHOUTAI','NASU','GANNING','CHENPING'], doctrine: 'strike', motto: '疾如風千里奔襲，閃擊直取中軍帥帳！', isUser: false },
  { id: 'g_iron', callsign: '武安君・鐵壁陣', title: '鎮國大將軍', rating: 1310, wins: 41, losses: 22, deck: ['SHINGEN','BAIQI','ZONGZE','ZHANGLIAO','WEIXIAOKUAN'], doctrine: 'defense', motto: '不動如山大盾重甲，長平鐵壁固若金湯。', isUser: false },
  { id: 'g_shadow', callsign: '臥龍崗・八陣圖', title: '軍師祭酒', rating: 1490, wins: 64, losses: 14, deck: ['ZHAOYUN','YUEFEI','HUANGZHONG','KUMANO','ZHUGELIANG'], doctrine: 'deception', motto: '奇門八陣迷霧困敵，未戰而廟算先勝。', isUser: false },
  { id: 'g_swarm', callsign: '忠武公・龜船水師', title: '三道水軍統制使', rating: 1260, wins: 33, losses: 26, deck: ['GONGSUNDU','KATOKIYOMASA','NAGASHINO','YISUNSIN','PANGTONG'], doctrine: 'deception', motto: '鶴翼陣鐵甲龜船，鳴梁海峽以寡擊眾。', isUser: false },
  { id: 'g_viper', callsign: '毘沙門天・車懸陣', title: '越後守護', rating: 1610, wins: 88, losses: 21, deck: ['KENSHIN','ZHANGFEI','INABA','WEIYAN','GUOJIA'], doctrine: 'strike', motto: '車懸輪番急襲破陣，白刃一騎討斬將奪旗。', isUser: false },
  { id: 'g_aegis', callsign: '大司馬・漢軍鐵騎', title: '大將軍大司馬', rating: 1720, wins: 104, losses: 25, deck: ['WEI','LIANPO','LIGUANG','YANGSU','XUNYU'], doctrine: 'strike', motto: '武剛車陣奇兵破虜，神射強弩萬箭齊發。', isUser: false }
];

function getGhostPool() {
  const p = LS.get('wl15_ghost_pool_v2', null);
  if (!p || !p.length) { LS.set('wl15_ghost_pool_v2', SEED_GHOSTS); return SEED_GHOSTS.slice(); }
  return p;
}
function saveGhostPool(p) { LS.set('wl15_ghost_pool_v2', p); }

const stats = LS.get('wl15_stats', { played: 0, win: 0, streak: 0, best: 0, bo3Won: 0 });
const playerGhost = LS.get('wl15_player_ghost', { rp: 0, callsign: '虎步先鋒鐵騎營', rankTitle: '作戰少尉', wins: 0, losses: 0, myGhostDeck: null });

function calcRankTitle(rp) {
  if (typeof LadderEngine !== 'undefined' && LadderEngine.getRankTier) {
    return LadderEngine.getRankTier(rp).name;
  }
  if (rp >= 50000) return '天下大將軍';
  if (rp >= 42000) return '驃騎大將軍';
  if (rp >= 35000) return '車騎大將軍';
  if (rp >= 28000) return '衛將軍';
  if (rp >= 22000) return '前後左右將軍';
  if (rp >= 16000) return '都督軍事';
  if (rp >= 11000) return '中郎將';
  if (rp >= 7000)  return '校尉';
  if (rp >= 3500)  return '裨將軍';
  if (rp >= 1500)  return '折衝都尉';
  return '軍候百夫長';
}

// 重新整理頁面時，名將錄重新洗牌，同時將名將選擇重置回到完全未選取狀態（全新開局）
LS.set('wl15_deck_A', [null, null, null, null, null]);
LS.set('wl15_deck_B', [null, null, null, null, null]);
const savedDeckA = [null, null, null, null, null];
const savedDeckB = [null, null, null, null, null];
const savedDocA = LS.get('wl15_doc_A', 'strike');
const savedDocB = LS.get('wl15_doc_B', 'defense');
const activeSlot = LS.get('wl15_active_slot', 'A');

const state = {
  mode: 'quick',
  practiceSubMode: 'quick',
  quickSubMode: 'ai', // 'ai' (預設 AI 演習) 或 'ghost' (全球名將異步幽靈)
  deckSlot: activeSlot,
  dualDecks: { A: savedDeckA.slice(), B: savedDeckB.slice() },
  dualDocs: { A: savedDocA, B: savedDocB },
  deck: [null, null, null, null, null],
  active: 0,
  flexCat: { 3: 'naval', 4: 'support' },
  doctrine: activeSlot === 'B' ? savedDocB : savedDocA,
  aiArch: 'random', event: null, enemy: null, enemyName: '', enemyDoc: 'defense',
  sandEnemy: 'random', sandEvent: 'all', sandResult: null, hover: null, lastRes: null,
  /* 手機版活躍兵種分頁 */
  mobileCat: 'air',
  /* 精選對戰題目選擇 ('today' 或 DAILY_PLANS 的 id) */
  dailyPlanId: 'today',
  /* 幽靈對戰專屬 */
  ghostTarget: null,
  /* BO3 專屬 */
  bo3: {
    active: false, round: 1, winsA: 0, winsB: 0, history: [],
    rivalName: '', rivalBaseDeck: null, enemyDeck: null, enemyDoc: 'defense',
    bannedByA: null, bannedByB: null, bannedListA: [], bannedListB: [], candidateBan: null, nextEvent: null
  },
  /* 來源感知戰備編制模式 ('ladder' | 'tournament' | null) */
  buildSource: null,
  ladderPendingTarget: null,
  /* 線上真人雙人對戰狀態 (WebRTC Online PvP) */
  isOnlinePvp: false,
  pvpMyReady: false,
  pvpOpponentReady: false,
  pvpOpponentDeck: null,
  pvpOpponentDoc: 'defense',
  pvpAfkStreak: 0
};
let playToken = 0, speed = Number(LS.get('wl15_speed', 1)) || 1, skip = false, paused = false, currentActiveModal = null, lastBattleRes = null;

function syncActiveDeck() {
  state.dualDecks[state.deckSlot] = state.deck.slice();
  state.dualDocs[state.deckSlot] = state.doctrine;
  LS.set('wl15_deck_' + state.deckSlot, state.deck);
  LS.set('wl15_doc_' + state.deckSlot, state.doctrine);
  LS.set('wl15_active_slot', state.deckSlot);
}

function switchDeckSlot(slot) {
  if (state.deckSlot === slot) return;
  syncActiveDeck();
  state.deckSlot = slot;
  LS.set('wl15_active_slot', slot);
  state.deck = (state.dualDecks[slot] || [null, null, null, null, null]).slice();
  state.doctrine = state.dualDocs[slot] || 'strike';
  renderAll();
  toast(`已切換至【編制 ${slot}】戰備槽位`);
}


/* =====================================================
   PvPTimerManager: 雙人真人連線與多局系列賽倒數與逾時接管管理器
   ===================================================== */
const PvPTimerManager = (function() {
  let timerId = null;
  let phase = null; // 'initial' (首局 60s) | 'result' (戰報 15s) | 'ban' (反制 25s) | 'refit' (次局 45s/60s)
  let deadline = 0;
  let duration = 0;
  let remaining = 0;
  let onTick = null;
  let onTimeout = null;
  let streak = 0; // 本地玩家連續超時次數

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    phase = null;
    deadline = 0;
    remaining = 0;
    onTick = null;
    onTimeout = null;
    updateTimerVisuals();
  }

  function start(newPhase, seconds, tickCallback, timeoutCallback) {
    stop();
    phase = newPhase;
    duration = seconds;
    deadline = Date.now() + seconds * 1000;
    remaining = seconds;
    onTick = tickCallback;
    onTimeout = timeoutCallback;

    updateTimerVisuals();
    if (onTick) {
      try { onTick(remaining, duration); } catch (e) { console.error('Timer onTick error', e); }
    }

    timerId = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((deadline - now) / 1000));
      remaining = left;
      updateTimerVisuals();
      if (onTick) {
        try { onTick(remaining, duration); } catch (e) { console.error('Timer onTick error', e); }
      }

      if (remaining <= 5 && remaining > 0) {
        if (typeof SoundEngine !== 'undefined' && SoundEngine.play) {
          SoundEngine.play('click');
        }
      }

      if (left <= 0) {
        const cb = onTimeout;
        stop();
        if (cb) {
          try { cb(); } catch (e) { console.error('Timer onTimeout error', e); }
        }
      }
    }, 1000);
  }

  function getRemaining() { return remaining; }
  function getDuration() { return duration; }
  function getPhase() { return phase; }
  function getStreak() { return streak; }
  function incrementStreak() { streak++; return streak; }
  function resetStreak() { streak = 0; }

  function updateTimerVisuals() {
    const badge = document.getElementById('pvpTimerBadge');
    const secEl = document.getElementById('pvpTimerSec');
    if (badge && secEl) {
      if (phase && remaining > 0) {
        badge.style.display = 'inline-flex';
        secEl.textContent = remaining;
        if (remaining <= 10) {
          badge.style.borderColor = 'rgba(239, 68, 68, 0.8)';
          badge.style.color = 'var(--red)';
        } else {
          badge.style.borderColor = 'rgba(245, 158, 11, 0.5)';
          badge.style.color = 'var(--amber)';
        }
      } else {
        badge.style.display = 'none';
      }
    }
  }

  return {
    start,
    stop,
    getRemaining,
    getDuration,
    getPhase,
    getStreak,
    incrementStreak,
    resetStreak,
    updateTimerVisuals
  };
})();

function startPvpDeploymentTimer(seconds = 60) {
  if (!state.isOnlinePvp) return;
  const isInitial = (!state.bo3 || state.bo3.round <= 1);
  const phaseName = isInitial ? 'initial' : 'refit';

  PvPTimerManager.start(phaseName, seconds, (rem, dur) => {
    renderMissionBar();
    renderCommandDeck();
  }, () => {
    handlePvpDeploymentTimeout();
  });
}

function handlePvpDeploymentTimeout() {
  if (!state.isOnlinePvp) return;
  if (state.pvpMyReady) return;

  const isHost = OnlinePvPEngine.isHostUser();
  const mySide = isHost ? 'A' : 'B';
  const streak = PvPTimerManager.incrementStreak();

  if (streak >= 2) {
    handlePlayerForfeit(mySide, '連續 2 次戰備配裝逾時');
    return;
  }

  toast('⚠️ 戰備超時！參謀部 AI 已補齊裝備接管出征 (超時警告 1/2)！');
  autoFillAndSubmitPvpDeck();
}

function autoFillAndSubmitPvpDeck() {
  if (!state.isOnlinePvp) return;
  if (state.pvpMyReady) return;

  const currentDeck = state.deck.slice();
  const banned = currentBanned();

  const preservedLocked = [null, null, null, null, null];
  currentDeck.forEach((id, idx) => {
    if (id && !banned.includes(id)) {
      preservedLocked[idx] = id;
    }
  });

  let filledDeck = randomDeck(Math.random, budgetLimit(), preservedLocked, banned);
  if (!filledDeck) {
    filledDeck = randomDeck(Math.random, budgetLimit(), [], banned);
  }
  if (!filledDeck) {
    filledDeck = ['ZHAOYUN', 'GYEBAEK', 'ZONGZE', 'DONGXI', 'LIUCHENG'];
  }

  state.deck = filledDeck.slice();
  renderAll();
  handleOnlinePvpSubmit();
}

function handlePlayerForfeit(loserSide, reason = '超時未行動') {
  if (!state.isOnlinePvp) return;
  const isHost = OnlinePvPEngine.isHostUser();
  const mySide = isHost ? 'A' : 'B';
  const iAmLoser = (loserSide === mySide);

  PvPTimerManager.stop();

  if (iAmLoser) {
    OnlinePvPEngine.sendPacket('PLAYER_FORFEIT', {
      loserSide,
      reason,
      round: state.bo3.round
    });
  }

  const winsNeeded = getBo3WinsNeeded();
  if (loserSide === 'A') {
    state.bo3.winsB = winsNeeded;
  } else {
    state.bo3.winsA = winsNeeded;
  }

  state.bo3.finished = true;
  state.bo3.winner = (loserSide === 'A') ? 'B' : 'A';
  const isSeriesWon = !iAmLoser;
  toast(iAmLoser
    ? `⚠️ 由於你【${reason}】，參謀本部判定棄權判負！對手贏得本次系列賽！`
    : `🏆 對手因【${reason}】判定棄權判負！你已直接贏得本次系列賽！`);

  $('#resultModal').hidden = true;
  $('#bo3CounterModal').hidden = true;
  if (currentActiveModal) currentActiveModal.hidden = true;
  currentActiveModal = null;

  showBo3SeriesResult(isSeriesWon);
}

function setDoctrine(docId) {
  state.doctrine = docId;
  syncActiveDeck();
  renderCommandDeck();
  const docObj = DOCTRINES.find(d => d.id === docId);
  toast(`已啟用教條：${docObj ? docObj.name : docId}`);
}

/* ---------- 工具 ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }
window.toast = toast;
function dateKey() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailyNo() { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5) + 1; }
const budgetLimit = () => BUDGET;
const spent = () => deckCost(state.deck.filter(Boolean));
const slotCat = i => SLOTS[i].fixed || state.flexCat[i];
let sleepResolve = null;
const wakeSleep = () => {
  if (sleepResolve) {
    const r = sleepResolve;
    sleepResolve = null;
    try { r(); } catch (_) {}
  }
};
const sleep = async ms => {
  if (skip) return;
  await new Promise(r => {
    sleepResolve = r;
    setTimeout(() => {
      if (sleepResolve === r) sleepResolve = null;
      r();
    }, ms / speed);
  });
  while (paused && !skip) {
    await new Promise(r => {
      sleepResolve = r;
      setTimeout(() => {
        if (sleepResolve === r) sleepResolve = null;
        r();
      }, 80);
    });
  }
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const currentBanned = () => {
  if (state.mode === 'tournament' || state.buildSource === 'tournament') {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    const prof = (typeof getTournamentPlayerProfile === 'function') ? getTournamentPlayerProfile() : null;
    if (onlineRoom && onlineRoom.matches && prof) {
      const m = Object.values(onlineRoom.matches).find(x => (x.teamA?.uid === prof.uid || x.teamB?.uid === prof.uid));
      if (m) {
        const isTeamA = (m.teamA?.uid === prof.uid);
        const bansOnMe = isTeamA ? (m.bannedListB || []) : (m.bannedListA || []);
        return ensureArray(bansOnMe);
      }
    }
    const m = (typeof TournamentEngine !== 'undefined') ? TournamentEngine.getMyMatch() : null;
    if (m) {
      const isTeamA = m.teamA && m.teamA.isMe;
      const bansOnMe = isTeamA ? (m.bannedListB || []) : (m.bannedListA || []);
      return ensureArray(bansOnMe);
    }
    return [];
  }
  if (state.mode !== 'bo3' || !state.bo3) return [];
  if (Array.isArray(state.bo3.bannedListB) && state.bo3.bannedListB.length) {
    return state.bo3.bannedListB;
  }
  return state.bo3.bannedByB ? [state.bo3.bannedByB] : [];
};

/* ---------- 對手與賽事初始化 ---------- */
function setupMatch(keepEvent = false) {
  if (state.mode === 'daily') {
    const isToday = state.dailyPlanId === 'today';
    const isRandomTier = state.dailyPlanId === 'random_tier';
    const seedNum = isToday ? hashStr('db15-' + dateKey()) : (isRandomTier ? ((Math.random() * 4294967296) >>> 0) : hashStr('db15-' + dateKey() + '-' + state.dailyPlanId));
    const rng = mulberry32(seedNum);
    state.event = EVENTS[Math.floor(rng() * EVENTS.length)];
    let p = null;
    if (isToday) {
      // 今日官方特選：依據當日種子決定難度階梯 ($19 ~ $25 均勻隨機)
      p = DAILY_PLANS[Math.floor(rng() * DAILY_PLANS.length)];
    } else if (isRandomTier) {
      // 隨機精選對戰對手：每次切換都隨機抽取 $19~$25 的題目
      p = DAILY_PLANS[Math.floor(Math.random() * DAILY_PLANS.length)];
    } else {
      p = DAILY_PLANS.find(x => x.id === state.dailyPlanId) || DAILY_PLANS[0];
    }
    state.enemy = buildFromPlan(p.plan, rng);
    state.enemyName = p.name;
    state.enemyDoc = DOCTRINES[Math.floor(rng() * 3)].id;
  } else if (state.mode === 'quick') {
    if (!keepEvent || !state.event) {
      state.event = pick(EVENTS);
    }
    const arch = state.aiArch === 'random' ? pick(ARCHETYPES) : ARCHETYPES.find(a => a.id === state.aiArch);
    state.enemy = buildFromPlan(arch.plan, Math.random);
    state.enemyName = arch.name;
    state.enemyDoc = pick(DOCTRINES).id;
  } else if (state.mode === 'ghost') {
    setMode('ladder');
    return;
  } else if (state.mode === 'bo3') {
    if (state.isOnlinePvp) {
      state.event = state.bo3.nextEvent || state.event || pick(EVENTS);
      state.enemy = state.pvpOpponentDeck ? state.pvpOpponentDeck.slice() : null;
      state.enemyName = state.bo3.rivalName;
      state.enemyDoc = state.pvpOpponentDoc || 'defense';
    } else if (!state.bo3.active) {
      initBo3Series();
    } else if (state.bo3.finished) {
      state.event = state.bo3.nextEvent || state.event || pick(EVENTS);
      state.enemy = (state.bo3.enemyDeck && state.bo3.enemyDeck.slice()) || [];
      state.enemyName = state.bo3.rivalName;
      state.enemyDoc = state.bo3.enemyDoc;
    } else {
      state.event = state.bo3.nextEvent || pick(EVENTS);
      state.enemy = (state.bo3.enemyDeck && state.bo3.enemyDeck.slice()) || [];
      state.enemyName = state.bo3.rivalName;
      state.enemyDoc = state.bo3.enemyDoc;
    }
  } else { state.event = null; state.enemy = null; }
}

function initBo3Series(keepSettings = true) {
  const rival = pick(SEED_GHOSTS);
  const prevMaxGames = (keepSettings && state.bo3 && state.bo3.maxGames) ? state.bo3.maxGames : 5;
  const prevMarketMode = (keepSettings && state.bo3 && state.bo3.marketMode) ? state.bo3.marketMode : 'locked';

  state.bo3 = {
    active: true, finished: false, winner: null, round: 1, winsA: 0, winsB: 0, history: [],
    rivalName: rival.callsign, rivalBaseDeck: rival.deck.slice(),
    enemyDeck: rival.deck.slice(), enemyDoc: rival.doctrine,
    bannedByA: null, bannedByB: null,
    bannedListA: [], bannedListB: [], candidateBan: null,
    candidateBans: [],
    nextEvent: pick(EVENTS),
    locked: false, // 首局開戰前允許調撥軍火，開戰後鎖定
    maxGames: prevMaxGames, // 3, 5, 7
    marketMode: prevMarketMode // 'locked' | 'free'
  };
  state.event = state.bo3.nextEvent;
  state.enemy = state.bo3.enemyDeck.slice();
  state.enemyName = state.bo3.rivalName;
  state.enemyDoc = state.bo3.enemyDoc;
}

function getBo3WinsNeeded() {
  const maxG = (state.bo3 && state.bo3.maxGames) || 5;
  return Math.ceil(maxG / 2); // 3->2, 5->3, 7->4
}

function getBo3BanCount() {
  return (state.bo3 && state.bo3.marketMode === 'free') ? 2 : 1;
}

/* ---------- 全景矩陣選兵與戰區動態軍火池 (Market Draft Pool) ---------- */
state.variants = state.variants || {};
state.marketPool = state.marketPool || null;

// 保證可解演算法：隨機產生 5 兵種各 5 筆不同價格與型號的裝備，且保證至少存在 3 組以上 <= 15 的合法陣容
// 嚴格分層隨機抽樣：保證 5 大兵種每一類別均嚴格維持 5, 4, 3, 2, 1 各一個武器選項，杜絕金額等級重複
function generateRandomMarketPool() {
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  const costs = [5, 4, 3, 2, 1];
  const pool = {};

  cats.forEach(cat => {
    pool[cat] = costs.map(cost => {
      // 找出該兵種該價位的 4 款不同型號裝備 (A/B/C/D)
      const cand = UNITS.filter(u => u.cat === cat && u.cost === cost);
      if (!cand.length) return null;
      // 隨機抽選其中一款型號（在自由調撥模式下，若有未被禁用的其他型號，優先挑選未被禁用的，讓玩家洗牌時盡量獲得可用名將）
      const banned = currentBanned();
      const validCand = cand.filter(u => !banned.includes(u.id));
      const poolSource = validCand.length > 0 ? validCand : cand;
      const picked = poolSource[Math.floor(Math.random() * poolSource.length)];
      // 同步記錄該價位的型號選擇
      state.variants[`${cat}-${cost}`] = picked.v;
      return picked;
    }).filter(Boolean);
  });

  state.marketPool = pool;
  return pool;
}

function isBo3MarketLocked() {
  if (state.mode !== 'bo3') return false;
  const b = state.bo3;
  if (!b) return false;
  if (b.finished) return true;
  // 若設定為自由調撥 (marketMode === 'free')，則整場系列賽都不鎖定軍火庫調撥
  if (b.marketMode === 'free') return false;
  return Boolean(b.locked || b.round > 1 || b.winsA > 0 || b.winsB > 0 || (b.history && b.history.length > 0));
}

function updateRerollMarketButtonState() {
  const btn = $('#btnRerollMarket');
  if (!btn) return;
  const icon = btn.querySelector('.reroll-icon');
  const title = btn.querySelector('.reroll-title');
  const sub = btn.querySelector('.reroll-sub');
  const b = state.bo3;

  if (state.mode === 'bo3' && b && b.finished) {
    btn.disabled = true;
    btn.classList.add('locked-bo3');
    btn.setAttribute('title', '多局鏖戰系列賽已完結！請重啟新一輪系列賽。');
    if (icon) icon.textContent = '🏆';
    if (title) title.innerHTML = '系列賽已完結';
    if (sub) sub.textContent = '固定配給 · 禁洗牌';
  } else if (state.mode === 'bo3' && isBo3MarketLocked()) {
    btn.disabled = true;
    btn.classList.add('locked-bo3');
    btn.setAttribute('title', '多局鏖戰進行中，軍火庫已全面鎖定！請在現有配給軍火中調整戰術配置。');
    if (icon) icon.textContent = '🔒';
    if (title) title.innerHTML = '軍火庫已鎖定';
    if (sub) sub.textContent = '固定配給 · 禁洗牌';
  } else if (state.mode === 'bo3' && b && b.marketMode === 'free') {
    btn.disabled = false;
    btn.classList.remove('locked-bo3');
    btn.setAttribute('title', '隨機點將調撥兵符庫 (自由調撥模式：每局備戰皆可重新洗牌，禁用清單維持生效)');
    if (icon) icon.textContent = '🎲';
    if (title) title.innerHTML = '點將調撥兵符';
    if (sub) sub.textContent = '重新洗牌';
  } else if (state.mode === 'bo3') {
    btn.disabled = false;
    btn.classList.remove('locked-bo3');
    btn.setAttribute('title', '隨機調撥多局鏖戰軍火庫 (首局開戰後將正式鎖定全系列賽)');
    if (icon) icon.textContent = '🎲';
    if (title) title.innerHTML = '點將調撥兵符';
    if (sub) sub.textContent = '重新洗牌';
  } else {
    btn.disabled = false;
    btn.classList.remove('locked-bo3');
    btn.setAttribute('title', '隨機調撥 5 大兵種戰區軍火庫 (注意：將清空當前選取)');
    if (icon) icon.textContent = '🎲';
    if (title) title.innerHTML = '點將調撥兵符';
    if (sub) sub.textContent = '重新洗牌';
  }
}

function rerollMarketPool() {
  if (state.mode === 'bo3' && isBo3MarketLocked()) {
    toast(state.bo3?.finished ? '🏆 系列賽已完結！請重啟新一輪系列賽。' : '🔒 多局鏖戰進行中，軍火庫已封閉鎖定！請在現有配給裝備中調整陣容應對。');
    return;
  }
  // 調撥軍火等同重置當前選取，杜絕利用保留裝備反覆洗出理想軍火的不公平刷牌漏洞
  state.deck = [null, null, null, null, null];
  state.active = 0;
  syncActiveDeck();

  generateRandomMarketPool();
  SoundEngine.play('equip');
  if (state.mode === 'bo3') {
    if (state.bo3 && state.bo3.marketMode === 'free') {
      toast('🎲 東亞名將已重新調遣點兵！（已被敵方禁用的裝備仍持續封存）');
    } else {
      toast('🎲 多局鏖戰軍火庫已重新調配！首局開戰後將正式鎖定全系列賽。');
    }
  } else {
    toast('🎲 東亞名將已重新徵召點將！已清除當前選取，請由新軍火庫重新選配。');
  }
  renderAll();
}

function getVariantUnit(cat, cost) {
  const pref = state.variants[`${cat}-${cost}`] || 'A';
  return UNITS.find(u => u.cat === cat && u.cost === cost && u.v === pref) ||
         UNITS.find(u => u.cat === cat && u.cost === cost);
}

function toggleVariant(cat, cost, e) {
  if (e) e.stopPropagation();
  const allVars = UNITS.filter(u => u.cat === cat && u.cost === cost);
  if (!allVars.length) return;
  const equippedInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(unit => unit && unit.cat === cat && unit.cost === cost);
  const cur = equippedInDeck ? equippedInDeck.v : (state.variants[`${cat}-${cost}`] || allVars[0].v);
  const vList = allVars.map(u => u.v);
  const nextIdx = (vList.indexOf(cur) + 1) % vList.length;
  const nxt = vList[nextIdx];
  state.variants[`${cat}-${cost}`] = nxt;
  const newUnit = allVars.find(u => u.v === nxt) || allVars[0];
  if (equippedInDeck && newUnit) {
    const slotIdx = state.deck.indexOf(equippedInDeck.id);
    if (slotIdx >= 0) {
      state.deck[slotIdx] = newUnit.id;
      toast(`已切換為：${newUnit.name} (${newUnit.v}型)`);
    }
  } else if (newUnit) {
    toast(`型號已切換為：${newUnit.name} (${newUnit.v}型)`);
  }
  renderAll();
}

const CAT_TO_SLOT = { air: 0, armor: 1, air_defense: 2, naval: 3, support: 4 };

function resolveTargetSlot(u) {
  // 五大兵種嚴格一對一對應專屬槽位：
  // 0: 制空打擊 (air)
  // 1: 重裝鐵騎 (armor)
  // 2: 區域防空 (air_defense)
  // 3: 制海權威 (naval)
  // 4: 情報／長程打擊 (support)
  return CAT_TO_SLOT[u.cat] !== undefined ? CAT_TO_SLOT[u.cat] : 0;
}

function canPickForSlot(u, targetSlot) {
  if (currentBanned().includes(u.id)) return '戰術禁用';
  const expectedSlot = CAT_TO_SLOT[u.cat];
  if (targetSlot !== expectedSlot) return `限填${CATS[SLOTS[targetSlot].fixed].label}`;
  const existingIdx = state.deck.indexOf(u.id);
  if (existingIdx >= 0 && existingIdx !== targetSlot) return '已裝備';
  const others = state.deck.filter((id, k) => id && k !== targetSlot);
  const cost = deckCost(others);
  const diff = (cost + u.cost) - budgetLimit();
  if (diff > 0) return `預算不足 (差$${diff})`;
  return '';
}

function handleMatrixCardClick(u) {
  // 1. 若該裝備本身已在隊伍中，點擊即為卸下
  const existingIdx = state.deck.indexOf(u.id);
  if (existingIdx >= 0) {
    state.deck[existingIdx] = null;
    state.active = existingIdx;
    syncActiveDeck();
    renderAll();
    toast(`已卸下【${u.name}】`);
    return;
  }

  // 2. 若隊伍中已有同兵種同價位的異型裝備（例如選了 B型颱風，點擊該格），點擊也是卸下
  const sameTierIdx = state.deck.findIndex(id => id && UNIT_MAP[id].cat === u.cat && UNIT_MAP[id].cost === u.cost);
  if (sameTierIdx >= 0) {
    const oldU = UNIT_MAP[state.deck[sameTierIdx]];
    state.deck[sameTierIdx] = null;
    state.active = sameTierIdx;
    syncActiveDeck();
    renderAll();
    toast(`已卸下【${oldU.name}】`);
    return;
  }

  // 3. 正常裝備或替換
  const targetSlot = resolveTargetSlot(u);
  const why = canPickForSlot(u, targetSlot);
  if (why) {
    toast(`無法裝備：${why}`);
    return;
  }
  const oldId = state.deck[targetSlot];
  state.deck[targetSlot] = u.id;
  const nxt = state.deck.findIndex(x => !x);
  state.active = nxt >= 0 ? nxt : targetSlot;
  syncActiveDeck();
  renderAll();
  if (oldId) {
    toast(`已將【${UNIT_MAP[oldId].name}】替換為【${u.name}】`);
  } else {
    toast(`已配置【${u.name}】至第 ${targetSlot + 1} 槽位`);
  }
}

/* ---------- 戰場場景自選下拉選單元件 (100% 絕對垂直對齊) ---------- */
function renderTacticalWeatherDropdown(contextMode = 'quick') {
  const isRandom = Boolean(state.isWeatherRandom);
  const currentEv = state.event;
  const currentIcon = isRandom ? '🎲' : (currentEv ? currentEv.icon : '🎲');
  const currentName = isRandom ? '隨機天候' : (currentEv ? currentEv.name : '隨機天候');
  const weatherTitle = isRandom
    ? '隨機天候：開戰自動自 6 大戰場環境隨機抽選'
    : (currentEv ? `${currentEv.name}：${currentEv.desc}` : '自選戰場場景');

  return `
    <div class="mission-item custom-weather-dropdown" id="weatherDropdown" style="margin-left:4px" data-context="${contextMode}">
      <button class="select sm weather-dropdown-btn" id="btnWeatherDropdown" type="button" title="${esc(weatherTitle)}" aria-haspopup="listbox" aria-expanded="false">
        <span class="tw-icon">${currentIcon}</span>
        <span class="tw-name">${esc(currentName)}</span>
        <span class="tw-arrow">▾</span>
      </button>
      <div class="custom-weather-menu" id="weatherDropdownMenu" role="listbox" hidden>
        <div class="weather-opt-item ${isRandom ? 'active' : ''}" data-val="random" role="option">
          <span class="weather-opt-icon">🎲</span>
          <span class="weather-opt-name">隨機天候</span>
        </div>
        ${EVENTS.map(ev => {
          const isActive = (!isRandom && currentEv && currentEv.id === ev.id);
          return `
            <div class="weather-opt-item ${isActive ? 'active' : ''}" data-val="${ev.id}" role="option" title="${esc(ev.desc)}">
              <span class="weather-opt-icon">${ev.icon}</span>
              <span class="weather-opt-name">${esc(ev.name)}</span>
            </div>`;
        }).join('')}
      </div>
      <select id="bo3EventSel" style="display:none" tabindex="-1" aria-hidden="true">
        <option value="random" ${isRandom ? 'selected' : ''}>🎲 隨機天候</option>
        ${EVENTS.map(ev => `<option value="${ev.id}" ${(!isRandom && currentEv && currentEv.id === ev.id) ? 'selected' : ''}>${ev.icon} ${ev.name}</option>`).join('')}
      </select>
    </div>`;
}

function selectWeatherEvent(evId, contextMode) {
  let chosen = null;
  if (evId === 'random') {
    state.isWeatherRandom = true;
    chosen = pick(EVENTS);
    toast(`戰場天候已設為【隨機天候】（每局開戰自動隨機抽選）`);
  } else {
    state.isWeatherRandom = false;
    chosen = EVENTS.find(ev => ev.id === evId);
    if (chosen) {
      toast(`戰場天候已自選為：${chosen.icon} ${chosen.name}（${chosen.desc}）`);
    }
  }
  if (chosen) {
    state.event = chosen;
    if (state.bo3) {
      state.bo3.nextEvent = chosen;
    }
    const sel = document.getElementById('bo3EventSel');
    if (sel) sel.value = evId;
    renderMissionBar();
    updateTopHud();
    updateCardSelectionVisuals();
  }
}

const ARCHETYPE_ICONS = {
  random: '🎲',
  armor: '🛡️',
  air: '✈️',
  hedgehog: '🦔',
  balanced: '⚖️',
  naval: '⚓',
  ew: '📡'
};

function renderTacticalAiDropdown() {
  const currentArchId = state.aiArch || 'random';
  const isRandom = currentArchId === 'random';
  const currentArch = isRandom ? null : ARCHETYPES.find(a => a.id === currentArchId);
  const currentIcon = ARCHETYPE_ICONS[currentArchId] || '🎲';
  const currentName = currentArch ? currentArch.name : '隨機對手';
  const aiTitle = currentArch
    ? `AI對手【${currentArch.name}】：${currentArch.desc}`
    : 'AI對手【隨機對手】：每局開戰自動隨機配對 AI 戰略流派風格';

  return `
    <span class="mission-label-text" style="font-weight:700;margin-left:8px;margin-right:2px">AI對手：</span>
    <div class="mission-item custom-ai-dropdown" id="aiDropdown">
      <button class="select sm ai-dropdown-btn" id="btnAiDropdown" type="button" title="${esc(aiTitle)}" aria-haspopup="listbox" aria-expanded="false">
        <span class="tai-icon">${currentIcon}</span>
        <span class="tai-name">${esc(currentName)}</span>
        <span class="tai-arrow">▾</span>
      </button>
      <div class="custom-ai-menu" id="aiDropdownMenu" role="listbox" hidden>
        <div class="ai-opt-item ${isRandom ? 'active' : ''}" data-val="random" role="option">
          <span class="ai-opt-icon">🎲</span>
          <span class="ai-opt-name">隨機對手</span>
        </div>
        ${ARCHETYPES.map(a => {
          const isActive = (!isRandom && currentArchId === a.id);
          const icon = ARCHETYPE_ICONS[a.id] || '⚔️';
          return `
            <div class="ai-opt-item ${isActive ? 'active' : ''}" data-val="${a.id}" role="option" title="${esc(a.desc)}">
              <span class="ai-opt-icon">${icon}</span>
              <span class="ai-opt-name">${esc(a.name)}</span>
            </div>`;
        }).join('')}
      </div>
      <select id="aiSel" style="display:none" tabindex="-1" aria-hidden="true">
        <option value="random" ${isRandom ? 'selected' : ''}>🎲 隨機對手</option>
        ${ARCHETYPES.map(a => `<option value="${a.id}" ${(!isRandom && currentArchId === a.id) ? 'selected' : ''}>${ARCHETYPE_ICONS[a.id] || ''} ${a.name}</option>`).join('')}
      </select>
    </div>`;
}

function selectAiArch(archId) {
  state.aiArch = archId;
  setupMatch(true); // 保留天候，不隨 AI 對手切換跳動
  const sel = document.getElementById('aiSel');
  if (sel) sel.value = archId;
  renderMissionBar();
  updateCardSelectionVisuals();
  const arch = state.aiArch === 'random' ? null : ARCHETYPES.find(a => a.id === state.aiArch);
  const icon = ARCHETYPE_ICONS[archId] || '🎲';
  toast(`AI對手已設定為：${icon} ${arch ? arch.name : '隨機對手'}（${arch ? arch.desc : '每局自動抽選'}）`);
}

/* ---------- 渲染：緊湊戰情橫幅 (Mission Bar) ---------- */
function formatWeatherBadge(ev) {
  if (!ev) return '';
  return `<div class="mission-item weather-badge weather-pill" id="weatherPill" title="${esc(ev.name)}：${esc(ev.desc)}" data-desc="${esc(ev.name)}：${esc(ev.desc)}" role="button" tabindex="0">
    <span class="weather-icon">${ev.icon}</span>
    <b class="weather-name">${esc(ev.name)}</b>
  </div>`;
}

function renderMissionBar() {
  const mb = $('#missionContent');
  if (!mb) return;
  const mode = state.mode;
  let h = '';

  if (state.buildSource === 'ladder') {
    const target = state.ladderPendingTarget;
    const theater = state.event || (typeof LadderEngine !== 'undefined' && LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || { icon: '☀️', name: '全天候', desc: '晴空萬里' };
    h = `<span class="mission-tag" style="background:rgba(245,158,11,.18);color:var(--amber);border-color:rgba(245,158,11,.45);font-weight:800;font-size:13px">🏆 天梯戰備 · 出征與防守部隊調整</span>
      ${formatWeatherBadge(theater)}
      ${target ? `<div class="mission-item" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);padding:4px 10px;border-radius:6px">
        <span style="font-size:13px;font-weight:700;color:var(--red)">🎯 鎖定挑戰：#${target.rank} ${esc(target.name)}</span>
      </div>` : ''}
      <div class="mission-actions" style="display:flex;gap:8px;margin-left:auto">
        <button class="btn ghost sm" id="btnCancelLadderBuild" style="color:var(--muted);border-color:var(--line2);height:34px;font-size:12.5px" title="放棄本次調整並返回天梯">✕ 放棄返回</button>
        <button class="btn amber sm" id="btnSaveReturnLadder" style="font-weight:700;height:34px;font-size:13px" title="保存編制為天梯防守陣容並返回天梯大廳">💾 保存並返回天梯 ➔</button>
      </div>`;
    mb.innerHTML = h;
    return;
  } else if (state.buildSource === 'tournament') {
    h = `<span class="mission-tag" style="background:rgba(245,158,11,.18);color:var(--amber);border-color:rgba(245,158,11,.45);font-weight:800;font-size:13px">🥇 群雄爭霸 · 作戰陣容調配</span>
      <div class="mission-item" style="background:rgba(255,255,255,.06);padding:4px 10px;border-radius:6px;border:1px solid var(--line2)">
        <span style="font-size:13px;font-weight:700">⚡ 5 槽聯合作戰陣容（預算上限 $15）</span>
      </div>
      <div class="mission-actions" style="display:flex;gap:8px;margin-left:auto">
        <button class="btn ghost sm" id="btnCancelTourneyBuild" style="color:var(--muted);border-color:var(--line2);height:34px;font-size:12.5px" title="放棄調整並返回錦標賽大廳">✕ 放棄返回</button>
        <button class="btn amber sm" id="btnSaveReturnTourney" style="font-weight:700;height:34px;font-size:13px" title="保存編制並返回錦標賽">💾 保存並返回群雄爭霸 ➔</button>
      </div>`;
    mb.innerHTML = h;
    return;
  }

  const subTabsHtml = `<div class="drill-subtabs" id="drillSubTabs">
    <button class="drill-subtab ${mode === 'quick' ? 'active' : ''}" data-submode="quick" title="標準 15 元平額作戰，支援隨機或指定 AI 教條與情報偵察">⚡ 快速交鋒</button>
    <button class="drill-subtab ${mode === 'daily' ? 'active' : ''}" data-submode="daily" title="每日特選與超標 BOSS ($19~$25) 殘局破局挑戰">🎯 精選破局</button>
    <button class="drill-subtab ${mode === 'sandbox' ? 'active' : ''}" data-submode="sandbox" title="300 場 Monte Carlo 數據推演與極端環境壓測">🧪 沙盒模擬</button>
  </div>`;

  if (mode === 'quick') {
    h = `${subTabsHtml}
      ${renderTacticalAiDropdown()}
      ${renderTacticalWeatherDropdown('quick')}`;
  } else if (mode === 'ghost') {
    setMode('ladder');
    return;
  } else if (mode === 'bo3') {
    const b = state.bo3;
    const maxG = b.maxGames || 5;
    const isFree = b.marketMode === 'free';
    const isFinished = Boolean(b && b.finished);
    const isLockedState = Boolean(b.locked || b.round > 1 || b.winsA > 0 || b.winsB > 0 || (b.history && b.history.length > 0) || isFinished);

    if (isFinished) {
      const isWinner = b.winner === 'A' || b.winsA > b.winsB;
      const resultTag = isWinner ? '👑 奪得總冠軍' : '✘ 系列賽惜敗';
      const tagBg = isWinner ? 'rgba(255,215,0,.18)' : 'rgba(239,68,68,.16)';
      const tagColor = isWinner ? '#fbbf24' : '#f87171';
      const tagBorder = isWinner ? 'rgba(255,215,0,.45)' : 'rgba(239,68,68,.4)';
      h = `<span class="mission-tag bo3-mission-tag" style="background:${tagBg};color:${tagColor};border-color:${tagBorder};font-weight:800;display:inline-flex;align-items:center;gap:6px">🏆 BO${maxG} 系列賽已完結 <span style="opacity:0.4">▪</span> 最終比分 <b style="font-family:var(--head);font-size:15px;letter-spacing:1px">${b.winsA} : ${b.winsB}</b> <span style="opacity:0.4">▪</span> ${resultTag}</span>
        <div class="mission-actions" style="margin-left:auto;display:flex;gap:8px">
          <button class="btn sm" id="btnOpenBo3SeriesModal" style="font-weight:700;height:34px;font-size:12.5px" title="查看系列賽大獎盃結算戰報">📊 查看結算戰報</button>
          <button class="btn amber sm" id="btnRestartBo3Series" style="font-weight:800;height:34px;font-size:13px;background:linear-gradient(135deg,var(--amber),#f59e0b);color:#111" title="結束當前系列賽，重啟新一輪對抗">🔄 重啟新一輪系列賽 ➔</button>
        </div>`;
      mb.innerHTML = h;
      updateRerollMarketButtonState();
      return;
    }

    // 智能禁用摘要標籤產生器 (避免長條文字撐爆橫幅)
    const renderBanCapsule = (list, isMeBanning) => {
      if (!list || !list.length) return '';
      const prefix = isMeBanning ? '🚫 禁敵' : '⚠️ 敵禁';
      const colorStyle = isMeBanning
        ? 'color:var(--green);background:rgba(93,255,176,.12);border:1px solid rgba(93,255,176,.4)'
        : 'color:var(--red);background:rgba(255,93,110,.12);border:1px solid rgba(255,93,110,.4)';
      const fullListText = list.map(id => UNIT_MAP[id]?.name || id).join('、');

      if (list.length <= 2) {
        return `<span style="${colorStyle};padding:1px 6px;border-radius:4px;font-size:11px;margin-left:5px;font-weight:700" title="全系列賽永久封鎖：${esc(fullListText)}">${prefix}：${esc(fullListText)}</span>`;
      }
      return `<span class="ban-capsule" style="${colorStyle};padding:1px 6px;border-radius:4px;font-size:11px;margin-left:5px;font-weight:700;cursor:pointer" title="全系列賽永久封鎖 (${list.length}件)：${esc(fullListText)}" data-ban-desc="${prefix} (${list.length}件)：${esc(fullListText)}">${prefix} ${list.length} 件 ⓘ</span>`;
    };

    const banAHtml = renderBanCapsule(b.bannedListA, true);
    const banBHtml = renderBanCapsule(b.bannedListB, false);

    // 戰前整備選單 (第 1 局且尚未鎖定)
    const settingsHtml = (!isLockedState && !state.isOnlinePvp) ? `
      <div class="mission-item" style="margin-left:4px">
        <select class="select sm" id="bo3GamesSel" title="自訂系列賽局數制">
          <option value="3" ${maxG === 3 ? 'selected' : ''}>⚡ 3局2勝 (BO3)</option>
          <option value="5" ${maxG === 5 ? 'selected' : ''}>⚔️ 5局3勝 (BO5)</option>
          <option value="7" ${maxG === 7 ? 'selected' : ''}>🔥 7局4勝 (BO7)</option>
        </select>
        <select class="select sm" id="bo3MarketSel" style="margin-left:3px" title="自訂軍火庫配給規則">
          <option value="locked" ${!isFree ? 'selected' : ''}>🔒 開戰鎖定 (Ban 1)</option>
          <option value="free" ${isFree ? 'selected' : ''}>🎲 自由調撥 (Ban 2)</option>
        </select>
      </div>` : '';

    // 戰場場景自選下拉選單 (自訂絕對對齊組件)
    const eventSelHtml = renderTacticalWeatherDropdown('bo3');

    if (state.isOnlinePvp) {
      const opp = OnlinePvPEngine.getOpponent();
      const oppDisplay = opp ? `${opp.flag} ${opp.name}` : b.rivalName;
      const isHost = OnlinePvPEngine.isHostUser();

      const hostSettingsHtml = (!isLockedState && isHost) ? `
        <div class="mission-item" style="margin-left:4px">
          <select class="select sm" id="bo3PvpGamesSel" title="房主設定局數制">
            <option value="3" ${maxG === 3 ? 'selected' : ''}>⚡ 3局2勝</option>
            <option value="5" ${maxG === 5 ? 'selected' : ''}>⚔️ 5局3勝</option>
            <option value="7" ${maxG === 7 ? 'selected' : ''}>🔥 7局4勝</option>
          </select>
          <select class="select sm" id="bo3PvpMarketSel" style="margin-left:3px" title="房主設定軍火庫模式">
            <option value="locked" ${!isFree ? 'selected' : ''}>🔒 鎖定 (Ban 1)</option>
            <option value="free" ${isFree ? 'selected' : ''}>🎲 自由 (Ban 2)</option>
          </select>
        </div>` : '';

      h = `<span class="mission-tag bo3-mission-tag" style="background:rgba(56,189,248,.18);color:#38bdf8;border-color:rgba(56,189,248,.4);font-weight:700;display:inline-flex;align-items:center;gap:6px">🌐 線上回合 <span style="opacity:0.4">▪</span> BO${maxG} (${isFree ? '自由調撥' : '開戰鎖定'}) <span style="opacity:0.4">▪</span> 第 ${b.round}/${maxG} 局</span>
        ${hostSettingsHtml}
        ${formatWeatherBadge(state.event)}
        <div class="mission-item" style="background:rgba(255,255,255,.06);padding:3px 8px;border-radius:6px;border:1px solid var(--line2)">
          <span style="font-family:var(--head);font-size:15px;font-weight:800;letter-spacing:.05em">比分：<b style="color:var(--cyan);font-size:16px">${b.winsA}</b> <span style="color:var(--muted)">-</span> <b style="color:var(--red);font-size:16px">${b.winsB}</b></span>
          <span class="muted" style="margin-left:8px">VS <b style="color:var(--text);font-weight:700">${esc(oppDisplay)}</b></span>
          <span class="badge ${state.pvpOpponentReady ? 'badge-ok' : 'badge-no'}" style="margin-left:6px;font-size:11px">${state.pvpOpponentReady ? '✔ 對手就緒' : '⏳ 配置中'}</span>
          ${banAHtml}
          ${banBHtml}
          <span id="pvpTimerBadge" class="mission-item pvp-timer-capsule" style="display:${PvPTimerManager.getRemaining() > 0 ? 'inline-flex' : 'none'};padding:2px 7px;border-radius:5px;font-size:11.5px;font-weight:700">⏰ <b id="pvpTimerSec">${PvPTimerManager.getRemaining()}</b>s</span>
        </div>
        <div class="mission-actions">
          <button class="btn ghost sm" id="btnExitPvp" style="color:var(--red);border-color:rgba(255,93,110,.3)" title="退出當前線上對戰房間">退出連線 ✕</button>
        </div>`;
    } else {
      const bansHtml = (banAHtml || banBHtml) ? `<div class="mission-item" style="gap:4px">${banAHtml}${banBHtml}</div>` : '';
      const seriesRuleLabel = ` (${isFree ? '自由調撥' : '開戰鎖定'})`;
      const scoreBadge = `<span style="font-family:var(--head);font-weight:800;letter-spacing:.05em;color:var(--amber);margin-left:2px">${b.winsA} : ${b.winsB}</span>`;
      h = `<span class="mission-tag bo3-mission-tag" style="background:rgba(255,179,64,.16);color:var(--amber);border-color:rgba(255,179,64,.4);font-weight:700;display:inline-flex;align-items:center;gap:6px">⚔️ BO${maxG} (${isFree ? '自由調撥' : '開戰鎖定'}) <span style="opacity:0.4">▪</span> 第 ${b.round}/${maxG} 局 <span style="opacity:0.4">▪</span> ${scoreBadge}</span>
        ${settingsHtml}
        ${eventSelHtml}
        ${bansHtml}
        <div class="mission-actions" style="margin-left:6px;gap:5px">
          <button class="btn amber sm" id="btnOnlinePvp" style="white-space:nowrap;padding:4px 10px;font-weight:700" title="建立或加入線上雙人 P2P 即時對戰房間">🌐 線上即時開房對戰</button>
        </div>`;
    }
  } else if (mode === 'daily') {
    const k = state.dailyPlanId === 'today' ? ('wl15_daily_' + dateKey()) : ('wl15_daily_' + dateKey() + '_' + state.dailyPlanId);
    const rec = LS.get(k, null);
    const enemyCost = deckCost(state.enemy);
    const overCost = enemyCost - 15;

    // 將題目按預算分組
    const tiers = [19, 20, 21, 22, 23, 24, 25];
    const groupedOptions = tiers.map(cost => {
      const plans = DAILY_PLANS.filter(p => p.cost === cost);
      if (!plans.length) return '';
      const label = cost === 25 ? `─── $25 終極滅世神裝 ───` : `─── $${cost} 超標階梯 ───`;
      return `<optgroup label="${label}">
        ${plans.map(dp => `<option value="${dp.id}" ${state.dailyPlanId === dp.id ? 'selected' : ''}>${dp.name} ($${dp.cost}超標)</option>`).join('')}
      </optgroup>`;
    }).join('');

    h = `${subTabsHtml}
      ${formatWeatherBadge(state.event)}
      <div class="mission-item">
        <span class="mission-label-text">關卡：</span>
        <select class="select sm" id="dailyPlanSel">
          <option value="today" ${state.dailyPlanId === 'today' ? 'selected' : ''}>🌟 今日特選 ($19~$25)</option>
          <option value="random_tier" ${state.dailyPlanId === 'random_tier' ? 'selected' : ''}>🎲 隨機自由對手</option>
          ${groupedOptions}
        </select>
        ${rec ? `<span style="margin-left:8px;font-size:12px" class="${rec.won ? 'badge-ok' : 'badge-no'}">${rec.won ? '✔ 已破局' : '尚未破局'} (${rec.tries}次)</span>` : ''}
      </div>`;
  } else if (mode === 'sandbox') {
    const enemySource = state.customSandEnemy || state.lastBattleEnemy;
    const customOpt = (enemySource && Array.isArray(enemySource.deck) && enemySource.deck.length === 5)
      ? `<option value="custom_enemy" ${state.sandEnemy === 'custom_enemy' ? 'selected' : ''}>🎯 最近敵陣：${esc(enemySource.name)}</option>`
      : '';
    const lastEventOpt = (enemySource && enemySource.event)
      ? `<option value="last_event" ${state.sandEvent === 'last_event' ? 'selected' : ''}>🎯 最近戰場：${esc(enemySource.event.name)}</option>`
      : '';
    h = `${subTabsHtml}
      <div class="mission-item">
        <span class="mission-label-text">對手風格：</span>
        <select class="select sm" id="sandEnemy">
          ${customOpt}
          <option value="random" ${state.sandEnemy === 'random' ? 'selected' : ''}>全部輪替</option>
          ${ARCHETYPES.map(a => `<option value="${a.id}" ${state.sandEnemy === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
        <span class="mission-label-text" style="margin-left:8px">戰場事件：</span>
        <select class="select sm" id="sandEvent">
          ${lastEventOpt}
          <option value="all" ${state.sandEvent === 'all' ? 'selected' : ''}>全部輪替</option>
          ${EVENTS.map(e => `<option value="${e.id}" ${state.sandEvent === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
        </select>
      </div>`;
  }
  mb.innerHTML = h;
  updateRerollMarketButtonState();
}

/* ---------- 渲染：手機專屬兵種切換分頁導覽列 ---------- */
function renderMobileCatNav() {
  const nav = $('#mobileCatNav');
  if (!nav) return;
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  nav.innerHTML = cats.map(cat => {
    const uInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(u => u && u.cat === cat);
    const isActive = (state.mobileCat || 'air') === cat;
    return `<button class="m-tab ${isActive ? 'active' : ''}" data-mobile-cat="${cat}" style="--c:${CATS[cat].color}">
      <div class="m-tab-title">${ICON[cat]} <span>${CATS[cat].short}</span></div>
      <span class="m-tab-badge ${uInDeck ? 'on' : ''}">${uInDeck ? '$' + uInDeck.cost : '−'}</span>
    </button>`;
  }).join('');
}

/* ---------- 戰場環境修正即時解析 (5x5 矩陣微徽章與情報提示) ---------- */
function getActiveBuildWeather() {
  if (state.buildSource === 'ladder') {
    return state.event || (typeof LadderEngine !== 'undefined' && LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || null;
  }
  if (state.mode === 'sandbox') {
    if (state.sandEvent === 'all') return null;
    if (state.sandEvent === 'last_event') {
      const src = state.customSandEnemy || state.lastBattleEnemy;
      return src && src.event ? src.event : null;
    }
    return EVENTS.find(e => e.id === state.sandEvent) || null;
  }
  if (state.mode === 'daily') {
    return state.event || null;
  }
  if (state.mode === 'quick' || state.mode === 'bo3') {
    if (state.isWeatherRandom && !state.isOnlinePvp) return null;
    return state.event || null;
  }
  return state.event || null;
}

function getUnitWeatherMod(u, ev) {
  const activeEv = ev === undefined ? getActiveBuildWeather() : ev;
  if (!u || !activeEv || !activeEv.id || activeEv.id === 'clear') return null;
  const id = activeEv.id;
  const traits = u.traits || [];
  if (id === 'plain') {
    if (u.cat === 'armor') return { type: 'buff', short: '▲ +20%', tip: `${activeEv.icon} ${activeEv.name}：重甲步陣戰力 +20%` };
    if (u.cat === 'naval') return { type: 'debuff', short: '▼ -30%', tip: `${activeEv.icon} ${activeEv.name}：先登水師奇襲 −30%` };
  } else if (id === 'strait') {
    if (u.cat === 'naval') return { type: 'buff', short: '▲ +25%', tip: `${activeEv.icon} ${activeEv.name}：先登水師戰力 +25%` };
    if (u.cat === 'armor') return { type: 'debuff', short: '▼ -15%', tip: `${activeEv.icon} ${activeEv.name}：重甲步陣 −15%` };
  } else if (id === 'storm') {
    if (u.cat === 'air') return { type: 'debuff', short: '▼ -15%命中', tip: `${activeEv.icon} ${activeEv.name}：突騎奔襲命中 −15%` };
    if (u.cat === 'support' && traits.includes('TRUE_AT')) return { type: 'debuff', short: '▼ -25%', tip: `${activeEv.icon} ${activeEv.name}：火攻奇器威力 −25%` };
  } else if (id === 'urban') {
    if (u.cat === 'support' && traits.includes('TRUE_AT')) return { type: 'buff', short: '▲ +30%', tip: `${activeEv.icon} ${activeEv.name}：攻城奇器威力 +30%` };
    if (u.cat === 'support' && (traits.includes('ARTY') || traits.includes('DEEP'))) return { type: 'debuff', short: '▼ -25%', tip: `${activeEv.icon} ${activeEv.name}：遠程投石／斬首 −25%` };
    if (u.cat === 'armor') return { type: 'debuff', short: '▼ -10%', tip: `${activeEv.icon} ${activeEv.name}：重甲展開受限 −10%` };
  } else if (id === 'em') {
    if ((u.ew || 0) >= 25) return { type: 'buff', short: '▲ 奇謀×1.6', tip: `${activeEv.icon} ${activeEv.name}：軍師奇謀 ×1.6，全軍伏兵隱匿 +10` };
  }
  return null;
}

/* ---------- 渲染：5x5 全景矩陣看板 (Matrix Board) ---------- */
function renderMatrix() {
  renderMobileCatNav();
  const mb = $('#matrixBoard');
  if (!mb) return;
  const cats = ['air', 'armor', 'air_defense', 'naval', 'support'];
  const catSlots = { air: '突騎槽', armor: '重甲槽', air_defense: '神射槽', naval: '先登槽', support: '軍師槽' };
  const activeWeather = getActiveBuildWeather();

  if (!state.marketPool) {
    generateRandomMarketPool();
  }

  mb.innerHTML = cats.map(cat => {
    const c = CATS[cat].color;
    const isMobileActive = (state.mobileCat || 'air') === cat;

    // 取得當前兵種隨機抽出的 5 筆武器選項
    let displayUnits = state.marketPool[cat] || [];

    // 確保已在隊伍中的該兵種裝備精準對齊在同一價位槽位，嚴格維持 5, 4, 3, 2, 1 結構
    const equippedInDeck = state.deck.map(id => id ? UNIT_MAP[id] : null).find(unit => unit && unit.cat === cat);
    if (equippedInDeck) {
      const matchIdx = displayUnits.findIndex(u => u.cost === equippedInDeck.cost);
      if (matchIdx >= 0) {
        displayUnits = displayUnits.slice();
        displayUnits[matchIdx] = equippedInDeck;
      }
    }

    // 【重要修復】若該兵種有被 BAN 的單位（如大衛投石索），強制在看板該價位格位展示該單位本尊，杜絕被其他型號隱藏遮蔽！
    const bannedIds = currentBanned();
    if (bannedIds.length) {
      bannedIds.forEach(bId => {
        const bUnit = UNIT_MAP[bId];
        if (bUnit && bUnit.cat === cat) {
          const matchIdx = displayUnits.findIndex(u => u.cost === bUnit.cost);
          if (matchIdx >= 0 && (!equippedInDeck || equippedInDeck.cost !== bUnit.cost)) {
            displayUnits = displayUnits.slice();
            displayUnits[matchIdx] = bUnit;
            state.variants[`${cat}-${bUnit.cost}`] = bUnit.v;
          }
        }
      });
    }

    const M_TRAIT_SHORT = {
      CAS: '🐎蹂躪步陣', LR: '🏹百步穿楊', HEAVY: '🛡️玄甲鐵壁', APS: '⚔️格擋反震',
      AA_LONG: '🎯專克突騎', CIWS: '🔥密集弩陣', AEGIS: '🏯鐵桶拒馬', SUB: '🌊潛行渡江',
      ASW: '🔱水陸搜剿', AMBUSH: '🌑奇兵伏擊', SWARM: '🔥萬箭連發', EW: '📜奇門遁甲',
      SEAD: '⚡破除弓陣', DEEP: '🗡️斬將奪旗', ARTY: '☄️霹靂火砲', SAT: '🔥烈火燎原',
      TRUE_AT: '🪓破甲重擊', SPOT: '🚩登高瞭望'
    };
    const cardsHtml = displayUnits.map(u => {
      const isEquipped = state.deck.includes(u.id);
      const isBanned = currentBanned().includes(u.id);
      const targetSlot = isEquipped ? state.deck.indexOf(u.id) : resolveTargetSlot(u);
      const why = canPickForSlot(u, targetSlot);
      const envMod = getUnitWeatherMod(u, activeWeather);
      const showWhy = Boolean(why && !isEquipped);

      return `<div class="m-card ${isEquipped ? 'sel' : ''} ${showWhy ? 'dis' : ''} ${isBanned ? 'banned' : ''}"
                   style="--c:${c}" data-id="${u.id}" data-cat="${cat}" data-cost="${u.cost}">
        <div class="m-card-main-row">
          <div class="m-avatar-wrap">
            <img class="m-avatar-img" src="${u.img || ''}" width="48" height="48" loading="lazy" decoding="async" alt="${esc(u.name)}" onerror="this.style.display='none'" />
            <span class="m-avatar-cost">$${u.cost}</span>
          </div>
          <div class="m-card-info-col">
            <div class="m-top">
              <div class="m-name-group">
                <div class="m-name" title="${esc(u.name)}"><span class="m-flag" style="margin-right:2px">${u.flag || ''}</span> ${esc(u.name)}</div>
                <div class="m-tag">${esc(u.tag)}</div>
              </div>
              <div class="m-actions">
                <button class="m-info-btn" data-info-id="${u.id}" title="查看名將傳記與實戰數值">ℹ</button>
              </div>
            </div>
            <div class="m-weapon-strip">⚔️ ${esc((u.weapon || '').split(' ')[0])}</div>
          </div>
        </div>
        <div class="m-mobile-intel">${u.weapon ? `<span class="m-mob-wpn">🎯 ${esc(u.weapon)}</span>` : ''}${(u.traits && u.traits.length) ? `<div class="m-mob-traits">${u.traits.map(t => `<span class="m-mob-trait-pill">${M_TRAIT_SHORT[t] || t}</span>`).join('')}</div>` : ''}</div>
        <div class="m-bot">
          <div class="m-stats">
            <span>HP <b>${u.hp}</b></span>
            <span>ATK <b>${u.atk}</b></span>
            <span>${u.ew > u.st ? 'EW' : 'STH'} <b>${Math.max(u.ew, u.st)}</b></span>
          </div>
          ${showWhy
            ? `<span class="m-why ${isBanned ? 'why-banned' : 'why-budget'}">${why}</span>`
            : (envMod ? `<span class="m-env-badge env-${envMod.type}" title="${esc(envMod.tip)}">${envMod.short}</span>` : '')}
        </div>
      </div>`;
    }).join('');

    return `<div class="col-category ${isMobileActive ? 'mobile-active' : ''}" style="--c:${c}" data-cat="${cat}">
      <div class="cat-head">
        <div class="cat-title">${ICON[cat]} <span>${CATS[cat].label}</span></div>
        <div class="cat-sub">${CATS[cat].short} · ${catSlots[cat]}</div>
      </div>
      ${cardsHtml}
    </div>`;
  }).join('');
}

/* ---------- 懸浮詳細情報 Tooltip (真實寬屏寫真展台) ---------- */
const tooltip = $('#unitTooltip');
function showTooltip(u, x, y) {
  if (!u || !tooltip) return;
  if (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches)) {
    hideTooltip();
    return;
  }
  const isBanned = currentBanned().includes(u.id);
  const envMod = getUnitWeatherMod(u);
  tooltip.innerHTML = `
    <div class="u-tt-header">
      ${u.img ? `<img class="u-tt-img" src="${u.img}" decoding="async" alt="${esc(u.name)}" onerror="this.style.display='none'" />` : ''}
      <div class="u-tt-overlay">
        <h4><span>${u.flag || '🌐'}</span> ${esc(u.name)} ${isBanned ? '<span style="color:var(--red);font-size:11px">(已禁)</span>' : ''}</h4>
        <div class="u-tt-sub">${esc(u.origin || '')} · $${u.cost} · ${esc(u.tag)}</div>
      </div>
    </div>
    <div class="u-tt-body">
      ${envMod ? `<div class="u-tt-env-box env-${envMod.type}">${esc(envMod.tip)}</div>` : ''}
      ${u.weapon ? `<div class="u-tt-weapon-box"><span>🎯 主武裝:</span> <b>${esc(u.weapon)}</b></div>` : ''}
      ${(() => {
        const r = typeof getUnitRealismBadges === 'function' ? getUnitRealismBadges(u) : null;
        if (!r) return '';
        const spHtml = r.specials.map(s => `<div style="margin-top:3px;color:var(--amber);font-size:11.5px"><b>${s.icon} ${esc(s.title)}：</b>${esc(s.desc)}</div>`).join('');
        return `<div style="margin-bottom:6px;padding:5px 8px;border-radius:6px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);font-size:11.5px"><div style="color:var(--cyan);font-weight:700">${esc(r.magLabel)}</div>${spHtml}</div>`;
      })()}
      ${(() => {
        const mb = typeof getUnitMasteryBadge === 'function' ? getUnitMasteryBadge(u.id) : null;
        if (!mb) return '';
        return `<div style="margin-bottom:6px;padding:4px 8px;border-radius:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.28);font-size:11px;color:${mb.color}"><div><b>${mb.icon} ${esc(mb.title)}：</b><span style="color:var(--text)">${esc(mb.summary)}</span></div>${mb.nextHint ? `<div style="margin-top:2px;font-size:10.5px;color:var(--muted)">▸ ${esc(mb.nextHint)}</div>` : ''}</div>`;
      })()}
      <p class="u-tt-desc">${esc(u.desc)}</p>
      <dl>
        <dt>耐久 HP</dt><dd>${u.hp}</dd>
        <dt>打擊 ATK</dt><dd>${u.atk}</dd>
        <dt>隱匿值</dt><dd>${u.st}</dd>
        <dt>電戰值</dt><dd>${u.ew}</dd>
        <dt>減傷防禦</dt><dd>${Math.round(u.def * 100)}%</dd>
      </dl>
      ${u.traits && u.traits.length ? `<ul>${u.traits.map(t => `<li>${esc(TRAITS[t])}</li>`).join('')}</ul>` : ''}
      ${(() => {
        const synHints = typeof getUnitSynergyHints === 'function' ? getUnitSynergyHints(u) : [];
        if (!synHints.length) return '';
        return `<div class="u-tt-synergy-box">${synHints.map(h => `<div class="u-tt-syn-item"><b>${h.icon} ${esc(h.name)}：</b><span>${esc(h.hint)}</span></div>`).join('')}</div>`;
      })()}
    </div>`;

  const pad = 18;
  const tw = 336, th = 380;
  let posX = x + pad;
  let posY = y + pad;
  if (posX + tw > window.innerWidth - 10) posX = x - tw - pad;
  if (posX < 10) posX = 10;
  if (posY + th > window.innerHeight - 10) posY = Math.max(10, window.innerHeight - th - 10);
  tooltip.style.left = `${posX}px`;
  tooltip.style.top = `${posY}px`;
  tooltip.hidden = false;
}
function hideTooltip() { if (tooltip) tooltip.hidden = true; }

/* ---------- 隊伍陣法即時分析 (Warlord Formation Archetype) ---------- */
function analyzeDeckArchetype(deck) {
  if (!Array.isArray(deck)) return { name: '五行正奇合戰陣', icon: '🏯', desc: '五軍均衡列陣，萬變不驚', detail: '突騎、重甲、神射、先登、軍師五部齊備。' };
  const units = deck.filter(Boolean).map(id => UNIT_MAP[id]).filter(Boolean);
  if (units.length < 3) {
    return { name: '點兵聚將中', icon: '📜', desc: '請調遣至少 3 部兵馬入帳', detail: '軍陣尚未成型，請繼續於上方五軍名將譜中點選將領。' };
  }
  
  const avgStealth = units.reduce((s, u) => s + (u.st || 0), 0) / units.length;
  const avgHp = units.reduce((s, u) => s + (u.hp || 0), 0) / units.length;
  const avgEw = units.reduce((s, u) => s + (u.ew || 0), 0) / units.length;
  const avgAtk = units.reduce((s, u) => s + (u.atk || 0), 0) / units.length;
  
  const hasStar5 = units.some(u => u.cost === 5);
  const onesCount = units.filter(u => u.cost === 1).length;
  const airUnit = units.find(u => u.cat === 'air');
  const armorUnit = units.find(u => u.cat === 'armor');
  const adUnit = units.find(u => u.cat === 'air_defense');
  const supUnit = units.find(u => u.cat === 'support');

  if (avgStealth >= 50 || (airUnit && (airUnit.st || 0) >= 80)) {
    return { name: '銜枚奇襲斬首陣', icon: '🗡️', desc: '伏兵潛行千里，直取敵軍主帥', detail: '以高隱匿精銳奇兵繞過正面盾牆，開戰瞬間斬將奪旗、動搖敵軍軍心。' };
  }
  if (avgEw >= 36 || (supUnit && (supUnit.ew || 0) >= 65)) {
    return { name: '奇門八陣困敵流', icon: '☯️', desc: '掌握奇謀天時，惑亂敵軍陣腳', detail: '仰仗大軍師布下八卦奇陣與虛實疑兵，大幅削弱敵軍命中並強化我軍先機。' };
  }
  if (avgHp >= 200 || (armorUnit && armorUnit.cost === 5 && (armorUnit.hp || 0) >= 300)) {
    return { name: '不動如山鐵壁陣', icon: '🛡️', desc: '重甲大盾如林，白刃死戰稱雄', detail: '依托重甲名將與塔盾方陣穩守中軍，硬抗萬箭齊發並在短兵決戰輾壓敵陣。' };
  }
  if (supUnit && ((supUnit.traits && supUnit.traits.includes('strike')) || supUnit.cost >= 4) && avgAtk >= 82) {
    return { name: '烈火轟雷破陣流', icon: '🔥', desc: '火攻霹靂齊發，焚毀敵軍連營', detail: '結合火器名將與強弓猛襲，於遠程交鋒階段傾瀉毀滅性火攻。' };
  }
  if (adUnit && adUnit.cost >= 4) {
    return { name: '萬弩連珠拒馬陣', icon: '🏹', desc: '強弩勁弓封鎖，專克奔雷鐵騎', detail: '構築三段擊與連弩拒馬火網，徹底粉碎敵軍騎兵衝鋒與先登突襲。' };
  }
  if (hasStar5 && onesCount >= 2) {
    return { name: '無雙猛將親衛陣', icon: '🐎', desc: '絕世名將領軍，輕騎奇兵策應', detail: '以 $5 傳奇統帥為破陣核心，輔以多支低費精銳斥候分攤兵損、側翼牽制。' };
  }
  return { name: '五行正奇合戰陣', icon: '🏯', desc: '五軍均衡列陣，適配四時天象', detail: '騎、盾、弓、鋒、謀五軍協同互補，面對大霧、豪雨、渡口皆游刃有餘。' };
}

/* ---------- 渲染：底部常駐指揮台 (Command Deck) ---------- */
function renderCommandDeck() {
  const cd = $('#commandDeck');
  if (!cd) return;
  const used = spent(), lim = budgetLimit();
  
  // 安全更新預算儀表 (防範任何 DOM 不相容導致渲染阻斷)
  const bu = $('#budgetUsed'); if (bu) bu.textContent = used;
  const bm = $('#budgetMax'); if (bm) bm.textContent = lim;
  $('#budgetBadge')?.classList.toggle('over', used > lim);
  $('#budgetUsed')?.classList.toggle('over', used > lim);
  $('.budget-digits')?.classList.toggle('over', used > lim);
  const bmb = $('#budgetMiniBar'); if (bmb) bmb.innerHTML = Array.from({ length: lim }, (_, i) => `<i class="${i < used ? 'on' : ''}"></i>`).join('');

  // A/B 雙陣容按鈕狀態
  $('#btnDeckA')?.classList.toggle('active', state.deckSlot === 'A');
  $('#btnDeckB')?.classList.toggle('active', state.deckSlot === 'B');

  // 槽位已選計數膠囊
  const filledCount = (state.deck || []).filter(Boolean).length;
  const pill = $('#slotsPill');
  if (pill) {
    pill.textContent = `${filledCount}/5 槽位`;
    pill.classList.toggle('ready', filledCount === 5);
  }

  // 底部 5 槽位縮影指示器（若 DOM 存在才渲染）
  const ds = $('#deckSlots');
  if (ds && Array.isArray(SLOTS)) {
    ds.innerHTML = SLOTS.map((s, i) => {
      const id = (state.deck || [])[i], u = id ? UNIT_MAP[id] : null;
      const cat = u ? u.cat : (s.fixed || (i === 3 ? 'naval' : 'support'));
      const isAct = i === state.active;
      const catColor = (u && CATS[cat]) ? CATS[cat].color : 'var(--muted)';
      return `<div class="d-slot ${u ? 'filled' : ''} ${isAct ? 'active' : ''}" data-slot="${i}" title="${u ? esc(u.name) : '點擊設定此槽位'}">
        <div class="d-slot-top">
          <span>${esc(s.label.split(' ')[0])}</span>
          ${u ? `<span class="d-slot-cost">$${u.cost}</span>` : ''}
        </div>
        <div class="d-slot-name" style="color:${catColor}">${u ? esc(u.name) : '未選取'}</div>
        ${u ? `<button class="d-slot-clear" data-clear-slot="${i}" title="卸下">✕</button>` : ''}
      </div>`;
    }).join('');
  }

  // 戰術教條快捷切換 (維持 先發制人\縱深防禦\電子欺敵，滑鼠移到圖標上方再顯示內容)
  const dt = $('#docToggles');
  if (dt && Array.isArray(DOCTRINES)) {
    dt.innerHTML = DOCTRINES.map(d =>
      `<button class="doc-btn ${state.doctrine === d.id ? 'on' : ''}" data-doc="${d.id}" title="${esc(d.name)}：${esc(d.desc)}">
        <span class="doc-icon">${d.icon}</span>
        <span class="doc-name">${esc(d.name)}</span>
      </button>`).join('');
  }

  // 聯合理論體系羈絆常駐亮燈指示槽 (改回原本五個英文字母代號：CEC, MUM-T, ASW, LAND, EW，滑鼠懸停顯示完整體系與達成條件)
  const synBar = $('#deckSynergyBar');
  if (synBar) {
    const pickedUnits = state.deck.map(id => id ? UNIT_MAP[id] : null).filter(Boolean);
    const activeSyns = (typeof getDeckSynergies === 'function') ? getDeckSynergies(pickedUnits) : [];
    const activeSynMap = new Set(activeSyns.map(s => s.id));

    // 4 大核心古兵法陣勢羈絆指示燈
    const INDICATOR_DEFS = [
      { id: 'cec', icon: '☯️', code: '八陣', name: '八陣圖天羅網', req: '$5大軍師 ＋ 神射強弩／重甲拒馬' },
      { id: 'mumt', icon: '🐎', code: '奇正', name: '奇正相生奔雷陣', req: '$5無雙突騎 ＋ 奇謀斥候／先登快艇' },
      { id: 'asw_net', icon: '🌊', code: '伏波', name: '水陸伏波合擊', req: '先登水師 ＋ 軍師奇謀／登高瞭望' },
      { id: 'iron_fist', icon: '🛡️', code: '合圍', name: '步騎鐵壁合圍', req: '重甲陷陣 ＋ 霹靂火器／登高瞭望' }
    ];

    const indicatorsHtml = INDICATOR_DEFS.map(ind => {
      const isLit = activeSynMap.has(ind.id);
      const synObj = activeSyns.find(s => s.id === ind.id);
      const tip = isLit
        ? `【${ind.icon} ${ind.name} · 已成陣】${synObj ? synObj.desc : '兵法陣勢加成生效中'}`
        : `【${ind.icon} ${ind.name} · 未成陣】成陣條件：${ind.req}`;
      return `<div class="syn-indicator ${isLit ? 'lit' : 'idle'} ind-${ind.id}" data-syn-id="${ind.id}" data-syn-tip="${esc(tip)}" title="${esc(tip)}">
        <span class="ind-icon">${ind.icon}</span>
        <span class="ind-code">${ind.code}</span>
        <i class="ind-dot"></i>
      </div>`;
    }).join('');

    // 奇謀戰力常駐平衡指示
    const baseEw = pickedUnits.reduce((acc, u) => acc + (u.ew || 0), 0) + (activeSynMap.has('cec') ? 12 : 0);
    const effEw = Math.round(baseEw * (state.doctrine === 'deception' ? 1.5 : 1));
    let ewClass = 'idle';
    let ewText = `奇謀 ${effEw}`;
    let ewTip = `【📜 軍師奇謀 · 數值 ${effEw}】全軍奇門謀略壓制值（點擊查看說明）`;
    if (pickedUnits.length >= 3) {
      if (effEw < 10) {
        ewClass = 'warn';
        ewTip = `【⚠ 謀略偏弱 (奇謀 ${effEw})】全軍奇謀值僅 ${effEw}，遭遇八陣流易中敵計`;
      } else {
        ewClass = 'strong';
        ewTip = `【📜 算無遺策 (奇謀 ${effEw})】全軍奇謀值 ${effEw}，可動搖敵軍命中並增益戰法`;
      }
    }
    const ewHtml = `<div class="syn-indicator ew-ind ${ewClass}" data-syn-tip="${esc(ewTip)}" title="${esc(ewTip)}">
      <span class="ind-icon">${ewClass === 'warn' ? '⚠' : '📜'}</span>
      <span class="ind-code">${ewText}</span>
      <i class="ind-dot"></i>
    </div>`;

    synBar.innerHTML = `<div class="indicators-dock-wrap">${indicatorsHtml}${ewHtml}</div>`;

    const sheetSyn = $('#sheetSynergyBox');
    if (sheetSyn) {
      sheetSyn.innerHTML = activeSyns.length > 0
        ? activeSyns.map(s => `<span class="syn-chip active" title="${esc(s.desc)}">${s.icon} ${esc(s.name)}</span>`).join('')
        : '<span class="syn-chip muted">請選取裝備以啟動聯合作戰體系羈絆</span>';
    }
  }

  // Presets and deck code shortcuts removed for fair drafting

  // 預算結餘 / 滿額效率標籤
  const effEl = $('#budgetEff');
  if (effEl) {
    if (used === lim) {
      effEl.textContent = '滿額 100%';
      effEl.className = 'budget-eff-tag full';
    } else if (used > lim) {
      effEl.textContent = `超標 $${used - lim}`;
      effEl.className = 'budget-eff-tag over';
    } else {
      effEl.textContent = `結餘 $${lim - used}`;
      effEl.className = 'budget-eff-tag';
    }
  }

  // 提示與開戰大按鈕
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : [];
  const missing = state.deck.filter(x => !x).length;
  const hintEl = $('#deckHint');
  const btnGo = $('#btnGo');
  const isReady = full && errs.length === 0;
  const isBo3Finished = state.mode === 'bo3' && Boolean(state.bo3 && state.bo3.finished);

  if (isBo3Finished) {
    btnGo.disabled = false;
    btnGo.classList.remove('status-missing', 'status-error', 'status-ready');
    btnGo.classList.add('status-finished');
  } else if (state.isOnlinePvp) {
    btnGo.classList.remove('status-finished');
    if (state.pvpMyReady) {
      btnGo.disabled = false;
      btnGo.classList.remove('status-missing', 'status-error');
      btnGo.classList.toggle('status-ready', state.pvpOpponentReady);
      btnGo.classList.toggle('status-locked', !state.pvpOpponentReady);
    } else {
      btnGo.disabled = !isReady;
      btnGo.classList.toggle('status-ready', isReady);
      btnGo.classList.toggle('status-missing', !isReady && missing > 0);
      btnGo.classList.toggle('status-error', !isReady && missing === 0 && errs.length > 0);
    }
  } else {
    btnGo.classList.remove('status-finished');
    btnGo.disabled = !isReady;
    btnGo.classList.toggle('status-ready', isReady);
    btnGo.classList.toggle('status-missing', !isReady && missing > 0);
    btnGo.classList.toggle('status-error', !isReady && missing === 0 && errs.length > 0);
  }

  const launchTitle = $('#launchTitle');
  const launchSub = $('#launchSub');
  const launchIcon = $('#launchIcon');

  if (launchTitle && launchSub) {
    if (isBo3Finished) {
      if (launchIcon) launchIcon.textContent = '🏆';
      const isWinner = state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB;
      launchTitle.textContent = `🏆 系列賽已完結 (${state.bo3.winsA}-${state.bo3.winsB})`;
      launchSub.textContent = isWinner ? '榮獲冠軍 · 點擊查看戰報/重啟' : '點擊查看系列賽戰報 · 或重啟';
    } else if (state.isOnlinePvp && state.pvpMyReady) {
      if (launchIcon) launchIcon.textContent = state.pvpOpponentReady ? '⚡' : '⏳';
      if (state.pvpOpponentReady) {
        launchTitle.textContent = OnlinePvPEngine.isHostUser() ? '雙方就緒！點擊開戰 ➔' : '雙方就緒，同步開戰中... ➔';
        launchSub.textContent = OnlinePvPEngine.isHostUser() ? '戰場即將展開，亦可手動點擊立即發起' : '等待本部特遣隊發送作戰訊令 (點擊催促)';
      } else {
        const rem = PvPTimerManager.getRemaining();
        launchTitle.textContent = '陣容已鎖定 · 等待對手';
        launchSub.textContent = (rem > 0) ? `對手戰備倒數中 (⏱️ ${rem}s) · 逾時 AI 接管` : '對手指揮官配置中... (點擊重新廣播)';
      }
    } else if (isReady) {
      if (state.isOnlinePvp) {
        const rem = PvPTimerManager.getRemaining();
        const timeHint = (rem > 0) ? ` (⏱️ ${rem}s 逾時 AI 補位)` : '';
        if (launchIcon) launchIcon.textContent = state.pvpOpponentReady ? '⚡' : '🔒';
        launchTitle.textContent = state.pvpOpponentReady ? '對手已就緒！點擊鎖定出擊' : '鎖定陣容 (提交戰術)';
        launchSub.textContent = (state.pvpOpponentReady ? '對手已在等待你！點擊立即開戰' : '點擊鎖定 5 槽陣容並發送給對手') + timeHint;
      } else if (state.buildSource === 'ladder') {
        if (state.ladderPendingTarget) {
          if (launchIcon) launchIcon.textContent = '⚔️';
          launchTitle.textContent = `保存並挑戰【${esc(state.ladderPendingTarget.name)}】！`;
          launchSub.textContent = '自動同步為天梯防守並即刻出征 · 點擊開戰';
        } else {
          if (launchIcon) launchIcon.textContent = '🏆';
          launchTitle.textContent = '保存編制 · 返回天梯出征';
          launchSub.textContent = '自動同步為天梯防守與主力部隊 · 點擊保存';
        }
      } else if (state.buildSource === 'tournament') {
        if (launchIcon) launchIcon.textContent = '🥇';
        launchTitle.textContent = '保存編制 · 返回淘汰錦標賽';
        launchSub.textContent = '自動同步錦標賽主力陣容 · 點擊保存';
      } else if (state.mode === 'sandbox') {
        if (launchIcon) launchIcon.textContent = '⚡';
        launchTitle.textContent = '開始 300 場模擬';
        launchSub.textContent = '大數據壓測 · 點擊開跑';
      } else if (state.mode === 'daily') {
        if (launchIcon) launchIcon.textContent = '🎯';
        launchTitle.textContent = '挑戰超標破局';
        launchSub.textContent = '突破特選防線 · 點擊開戰';
      } else if (state.mode === 'bo3') {
        if (launchIcon) launchIcon.textContent = '🏆';
        launchTitle.textContent = `第 ${state.bo3.round} 局開戰 (${state.bo3.winsA}-${state.bo3.winsB})`;
        launchSub.textContent = '陣容就緒 · 點擊開戰';
      } else {
        if (launchIcon) launchIcon.textContent = '⚔️';
        launchTitle.textContent = '開始聯合作戰';
        launchSub.textContent = '陣容就緒 · 點擊開戰';
      }
    } else if (errs.length > 0 && missing === 0) {
      const firstErr = errs[0];
      const isBannedErr = firstErr.includes('已被戰術禁用') || firstErr.includes('BANNED') || firstErr.includes('禁用');
      const isBudgetErr = firstErr.includes('預算超額');

      if (isBannedErr) {
        if (launchIcon) launchIcon.textContent = '🔒';
        launchTitle.textContent = '包含禁用名將';
        launchSub.textContent = firstErr;
      } else if (isBudgetErr) {
        if (launchIcon) launchIcon.textContent = '🚫';
        launchTitle.textContent = '預算超額';
        launchSub.textContent = firstErr;
      } else {
        if (launchIcon) launchIcon.textContent = '⚠️';
        launchTitle.textContent = '編制不合規';
        launchSub.textContent = firstErr;
      }
    } else {
      if (launchIcon) launchIcon.textContent = '⏳';
      launchTitle.textContent = `尚缺 ${missing} 個槽位`;
      launchSub.textContent = '點擊上方槽位選取 · 或隨機補滿';
    }
  }

  if (hintEl) {
    if (isBo3Finished) {
      const isWinner = state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB;
      hintEl.textContent = isWinner ? `🏆 系列賽已奪冠！總比分 ${state.bo3.winsA} : ${state.bo3.winsB}` : `系列賽已完結，總比分 ${state.bo3.winsA} : ${state.bo3.winsB}`;
      hintEl.className = 'deck-hint ready';
    } else if (missing > 0) {
      hintEl.textContent = `尚缺 ${missing} 個槽位`;
      hintEl.className = 'deck-hint';
    } else if (errs.length > 0) {
      hintEl.textContent = errs[0];
      hintEl.className = 'deck-hint warn';
    } else {
      hintEl.textContent = '陣容就緒，隨時可戰！';
      hintEl.className = 'deck-hint ready';
    }
  }
}

function updateCloudSyncButtonState() {
  const capsuleBtn = $('#btnCommanderCapsule') || $('#btnCloudSync');
  const avatarCircle = $('#navAvatarCircle');

  const acc = (typeof CloudSync !== 'undefined' && typeof CloudSync.getAccount === 'function') ? CloudSync.getAccount() : null;
  const syncStatus = (typeof CloudSync !== 'undefined' && typeof CloudSync.getStatus === 'function') ? CloudSync.getStatus() : { state: 'local' };
  const lState = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState() : null;
  const p = lState ? lState.player : null;
  const tier = (typeof LadderEngine !== 'undefined' && p)
    ? LadderEngine.getRankTier(p.rp)
    : { name: '作戰少尉', color: '#475569' };
  const rawName = p?.name || (typeof playerGhost !== 'undefined' ? playerGhost.callsign : '') || '指揮官';
  const myName = esc(rawName);

  // 1. Google 帳號風格圓形頭像 (中顯名稱首字)
  let firstChar = '指';
  const clean = rawName.replace(/^[\s🎖️⚡⚔️🏆🥇#@_\-\[\]0-9]+/, '').trim();
  if (clean) {
    firstChar = Array.from(clean)[0].toUpperCase();
  } else if (rawName.trim()) {
    firstChar = Array.from(rawName.trim())[0].toUpperCase();
  }
  if (avatarCircle?.dataset.ready === 'true') {
    avatarCircle.textContent = firstChar;
    avatarCircle.hidden = false;
  }
  if (capsuleBtn) {
    const saveLabel = acc ? (syncStatus.state === 'synced' ? '雲端已同步' : '存檔尚未確認同步') : '本機存檔';
    capsuleBtn.title = `指揮官中心：${myName}（${tier.name} · ${p ? p.rp : 0} RP）\n${saveLabel}${syncStatus.error ? `：${syncStatus.error}` : ''}\n點擊管理暱稱、Google 登入與存檔`;
  }
}

function renderHud() {
  const lState = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState() : null;
  const p = lState ? lState.player : null;
  const myName = p?.name ? esc(p.name) : esc(playerGhost.callsign || '虎步先鋒鐵騎營');
  const myFlag = p?.flag || playerGhost.flag || '🇹🇼';
  const tier = (typeof LadderEngine !== 'undefined' && p)
    ? LadderEngine.getRankTier(p.rp)
    : { name: '作戰少尉', color: '#475569' };

  if (p && typeof playerGhost !== 'undefined') {
    playerGhost.callsign = p.name;
    playerGhost.rankTitle = tier.name;
    playerGhost.rp = p.rp;
    playerGhost.flag = myFlag;
    LS.set('wl15_player_ghost', playerGhost);
    updateCloudSyncButtonState();
  }

  const hudStats = $('#hudStats');
  if (hudStats) {
    const tel = typeof Telemetry !== 'undefined' ? Telemetry.getStats() : { onlineCount: 1, totalBattles: 0, totalVisits: 1002 };
    const winRate = stats.played ? Math.round(stats.win / stats.played * 100) : 0;
    const visitsValEl = document.getElementById('telemetryVisitsVal');
    const targetVisits = (tel.totalVisits || 1002).toLocaleString();
    if (visitsValEl) {
      if (visitsValEl.textContent !== targetVisits) {
        visitsValEl.textContent = targetVisits;
      }
    } else {
      hudStats.innerHTML = `
        <span class="chip-stat chip-telemetry" id="btnOpenTelemetry" style="cursor:pointer" title="📡 全服 C4ISR 即時戰況大盤 (點擊查看在線人數與對戰數據)">
          <span class="live-pulse-dot"></span>
          <span>到訪 <b id="telemetryVisitsVal">${targetVisits}</b> 人次</span>
        </span>
      `;
    }
    const mPersonal = document.getElementById('modalPersonalRecord');
    if (mPersonal) {
      mPersonal.innerHTML = `${myFlag} <b>${myName}</b>（${esc(tier.name)}）｜ 個人累計 <b>${stats.played}</b> 場 · 勝率 <b>${winRate}%</b> · 當前 <b>${stats.streak}</b> 連勝`;
    }
  }
  updateCloudSyncButtonState();
}

function updateTopHud() {
  renderHud();
}

function updateCardSelectionVisuals() {
  renderMatrix();
  renderCommandDeck();
  renderOnboardingGuide();
}

/* ---------- 新手 30 秒三步驟戰術速成引導列 (30s Tactical Onboarding Coach Bar) ---------- */
function renderOnboardingGuide() {
  const bar = $('#onboardCoachBar');
  if (!bar) return;
  const isDismissed = Boolean(LS.get('wl15_onboard_done', false));
  if (isDismissed || (stats.played > 0 && !state.forceShowOnboard)) {
    bar.hidden = true;
    return;
  }

  const filledCount = (state.deck || []).filter(Boolean).length;
  const used = spent();
  const lim = budgetLimit();
  const full = filledCount === 5;
  const errs = full ? validateDeck(state.deck, lim, currentBanned()) : [];
  const isReady = full && errs.length === 0;
  const pickedUnits = state.deck.map(id => id ? UNIT_MAP[id] : null).filter(Boolean);
  const activeSyns = (typeof getDeckSynergies === 'function') ? getDeckSynergies(pickedUnits) : [];

  const step1Done = full && used <= lim;
  const step2Active = step1Done && activeSyns.length > 0;
  const activeStep = !step1Done ? 1 : (!isReady ? 2 : 3);

  bar.hidden = false;
  bar.innerHTML = `
    <div class="onboard-head">
      <span class="onboard-badge">📜 新手 30 秒點將速成</span>
    </div>
    <div class="onboard-steps">
      <div class="onboard-step ${activeStep === 1 ? 'active' : ''} ${step1Done ? 'done' : ''}">
        <i class="ob-num">${step1Done ? '✓' : '1'}</i>
        <span><b>五軍各點 1 將</b>（軍令 ≤$${lim}，已選 ${filledCount}/5）</span>
      </div>
      <span class="onboard-sep">▸</span>
      <div class="onboard-step ${activeStep === 2 ? 'active' : ''} ${step2Active ? 'done' : ''}">
        <i class="ob-num">${step2Active ? '✓' : '2'}</i>
        <span><b>湊齊古兵法陣勢</b>（左下點亮 八陣 / 奇正 / 伏波 / 合圍）</span>
      </div>
      <span class="onboard-sep">▸</span>
      <div class="onboard-step ${activeStep === 3 ? 'active' : ''}">
        <i class="ob-num">3</i>
        <span><b>選風林火山兵法並點擊右下【出師合戰 ➔】</b></span>
      </div>
    </div>
    <div class="onboard-actions">
      <button type="button" class="btn-onboard-demo" id="btnOnboardDemo" title="自動從當前名將譜配滿 $15 出陣陣容">🎲 一鍵示範點兵</button>
      <button type="button" class="btn-onboard-close" id="btnOnboardDismiss" title="關閉新手引導列">我知道了 ✕</button>
    </div>
  `;

  const demoBtn = $('#btnOnboardDemo');
  if (demoBtn) {
    demoBtn.onclick = () => {
      const randBtn = $('#btnRand');
      if (randBtn) randBtn.click();
    };
  }
  const dismissBtn = $('#btnOnboardDismiss');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      state.forceShowOnboard = false;
      LS.set('wl15_onboard_done', true);
      bar.hidden = true;
      toast('🎖️ 已完成新手引導！隨時可點右上「?」查看完整戰術手冊');
    };
  }
}

function renderAll() {
  renderMissionBar();
  renderMatrix();
  renderCommandDeck();
  renderHud();
  updateRerollMarketButtonState();
  renderOnboardingGuide();
}

/* ---------- 常用自訂編制與參謀部推薦模板管理 ---------- */
function getCustomPresets() {
  const raw = LS.get('wl15_custom_presets', null);
  if (Array.isArray(raw) && raw.length === 3) return raw;
  return [null, null, null];
}

function saveCustomPreset(slotIdx) {
  if (!state.deck.every(Boolean)) {
    toast('⚠️ 請先配置滿 5 個槽位再儲存至自訂編制！');
    return;
  }
  const presets = getCustomPresets();
  const arch = analyzeDeckArchetype(state.deck);
  presets[slotIdx] = {
    name: `${arch.icon} 自訂編制 #${slotIdx + 1}`,
    deck: state.deck.slice(),
    doc: state.doctrine || 'defense',
    cost: spent()
  };
  LS.set('wl15_custom_presets', presets);
  renderCommandDeck();
  if (!$('#deckMoreModal')?.hidden) openDeckMoreModal();
  toast(`💾 已將當前陣容儲存至【自訂編制 #${slotIdx + 1}】！`);
}

function applyPresetDeck(ids, doc, label) {
  const cleanIds = (ids || []).map(id => (UNIT_MAP[id] ? id : null));
  if (cleanIds.length !== 5 || !cleanIds.every(Boolean)) {
    toast('⚠️ 編制資料不完整');
    return;
  }
  const banned = currentBanned();
  if (banned.some(b => cleanIds.includes(b))) {
    toast('⚠️ 此編制包含本局已被戰術禁用的裝備，已為你載入可用槽位');
  }
  state.deck = cleanIds.map(id => banned.includes(id) ? null : id);
  if (doc && DOCTRINES.some(d => d.id === doc)) {
    state.doctrine = doc;
  }
  // 確保每個已選單位在矩陣看板中切換到對應 A/B/C/D 型號方便檢視
  state.deck.forEach(id => {
    const u = id ? UNIT_MAP[id] : null;
    if (u && state.variants) state.variants[`${u.cat}_${u.cost}`] = u.v;
  });
  syncActiveDeck();
  renderAll();
  const cm = $('#codeMenu'); if (cm) cm.hidden = true;
  const dm = $('#deckMoreModal'); if (dm) dm.hidden = true;
  toast(`⚡ 已套用編制：【${label}】`);
}

function renderPresetsMenus() {
  const customBox = $('#customPresetsMenuBox');
  const tplBox = $('#templatePresetsMenuBox');
  const presets = getCustomPresets();

  if (customBox) {
    customBox.innerHTML = presets.map((p, idx) => {
      if (!p || !Array.isArray(p.deck)) {
        return `<div class="preset-menu-row">
          <span class="preset-empty-txt">槽位 #${idx + 1} (尚未儲存)</span>
          <button type="button" class="btn-micro" data-save-preset="${idx}">💾 存入當前</button>
        </div>`;
      }
      const unitNames = p.deck.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<div class="preset-menu-row">
        <button type="button" class="preset-load-btn" data-load-custom="${idx}" title="點擊套用：${esc(unitNames)}">
          <b>${esc(p.name)} ($${p.cost || 15})</b>
          <small>${esc(unitNames)}</small>
        </button>
        <button type="button" class="btn-micro" data-save-preset="${idx}" title="覆蓋儲存當前陣容">覆蓋</button>
      </div>`;
    }).join('');
  }

  if (tplBox && typeof TEMPLATES !== 'undefined') {
    tplBox.innerHTML = TEMPLATES.map((t, idx) => {
      const unitNames = t.ids.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<button type="button" class="menu-item preset-tpl-btn" data-load-tpl="${idx}">
        <div><b>🎖️ ${esc(t.name)}</b> <small class="muted">(${esc(t.note)})</small></div>
        <div class="preset-sub-units">${esc(unitNames)}</div>
      </button>`;
    }).join('');
  }
}

/* ---------- 手機版專屬：裝備詳細情報抽屜 ---------- */
function openUnitDetailModal(u) {
  const modal = $('#unitDetailModal');
  const card = $('#unitSheetCard');
  if (!modal || !card) return;
  const isEquipped = state.deck.includes(u.id);
  const isBanned = currentBanned().includes(u.id);
  const targetSlot = isEquipped ? state.deck.indexOf(u.id) : resolveTargetSlot(u);
  const why = canPickForSlot(u, targetSlot);
  const c = CATS[u.cat].color;
  const envMod = getUnitWeatherMod(u);

  card.innerHTML = `
    <div class="sheet-head" style="--c:${c}">
      <div class="sheet-unit-title">
        <span style="display:inline-flex;width:20px;height:20px;color:${c}">${ICON[u.cat]}</span>
        <h3>${CATS[u.cat].label} · 詳細情報</h3>
      </div>
      <button class="sheet-close" id="btnUnitSheetClose">✕</button>
    </div>
    <div class="sheet-unit-meta" style="--c:${c}">
      <div>
        <div class="sheet-unit-name"><span>${u.flag || ''}</span> ${esc(u.name)} ${isBanned ? '<span style="color:var(--red);font-size:12px">[BANNED]</span>' : ''}</div>
        <div class="sheet-unit-tag">${esc(u.origin || '')} · $${u.cost} · ${esc(u.tag)}</div>
      </div>
      <span class="sheet-unit-cost">$${u.cost}</span>
    </div>
    ${u.img ? `<div style="height:120px;border-radius:8px;overflow:hidden;margin:8px 0 10px;border:1px solid var(--line2);background:#020617"><img src="${u.img}" decoding="async" style="width:100%;height:100%;object-fit:cover" alt="${esc(u.name)}" onerror="this.parentElement.style.display='none'"/></div>` : ''}
    ${envMod ? `<div class="u-tt-env-box env-${envMod.type}" style="margin-bottom:8px">${esc(envMod.tip)}</div>` : ''}
    ${u.weapon ? `<div class="u-tt-weapon-box" style="margin-bottom:10px"><span>🎯 主武裝:</span> <b>${esc(u.weapon)}</b></div>` : ''}
    ${(() => {
      const r = typeof getUnitRealismBadges === 'function' ? getUnitRealismBadges(u) : null;
      if (!r) return '';
      const spHtml = r.specials.map(s => `<div style="margin-top:4px;color:var(--amber);font-size:12px"><b>${s.icon} ${esc(s.title)}：</b>${esc(s.desc)}</div>`).join('');
      return `<div style="margin-bottom:10px;padding:7px 10px;border-radius:8px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.28);font-size:12px"><div style="color:var(--cyan);font-weight:700">${esc(r.magLabel)}</div>${spHtml}</div>`;
    })()}
    ${(() => {
      const mb = typeof getUnitMasteryBadge === 'function' ? getUnitMasteryBadge(u.id) : null;
      if (!mb) return '';
      return `<div style="margin-bottom:10px;padding:6px 10px;border-radius:8px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.28);font-size:12px;color:${mb.color}"><div><b>${mb.icon} ${esc(mb.title)}：</b><span style="color:var(--text)">${esc(mb.summary)}</span></div>${mb.nextHint ? `<div style="margin-top:3px;font-size:11px;color:var(--muted)">▸ ${esc(mb.nextHint)}</div>` : ''}</div>`;
    })()}
    <div class="sheet-unit-desc" style="--c:${c}">${esc(u.desc)}</div>
    <div class="sheet-label">作戰參數評級</div>
    <div class="sheet-stats-grid">
      <div class="sheet-stat-box"><span>耐久 HP</span><b>${u.hp}</b></div>
      <div class="sheet-stat-box"><span>打擊 ATK</span><b>${u.atk}</b></div>
      <div class="sheet-stat-box"><span>隱匿值</span><b>${u.st}</b></div>
      <div class="sheet-stat-box"><span>電戰值</span><b>${u.ew}</b></div>
      <div class="sheet-stat-box" style="grid-column:span 2"><span>裝甲減傷</span><b>${Math.round(u.def * 100)}%</b></div>
    </div>
    ${u.traits && u.traits.length ? `
      <div class="sheet-label">特長能力 (TRAITS)</div>
      <div class="sheet-traits-list">
        ${u.traits.map(t => `<div class="sheet-trait-item"><b>▸</b>${esc(TRAITS[t])}</div>`).join('')}
      </div>` : ''}
    ${(() => {
      const synHints = typeof getUnitSynergyHints === 'function' ? getUnitSynergyHints(u) : [];
      if (!synHints.length) return '';
      return `<div class="sheet-label">聯合作戰體系羈絆搭檔</div>
      <div class="sheet-synergy-hints">${synHints.map(h => `<div class="sheet-syn-hint-item"><b>${h.icon} ${esc(h.name)}</b><span>${esc(h.hint)}</span></div>`).join('')}</div>`;
    })()}
    <div style="display:flex;gap:8px;margin-top:16px">
      ${isEquipped ? `
        <button class="btn ghost sm" id="btnSheetEquip" data-id="${u.id}" style="flex:1;color:var(--red);border-color:rgba(255,93,110,.4)">
          從編制卸下 (回收 $${u.cost})
        </button>
      ` : `
        <button class="btn primary sm" id="btnSheetEquip" data-id="${u.id}" ${why ? 'disabled' : ''} style="flex:1">
          ${why ? `無法裝備：${why}` : `裝備至第 ${targetSlot + 1} 槽位 ($${u.cost})`}
        </button>
      `}
    </div>
  `;
  modal.hidden = false;
}

/* ---------- 手機版專屬：戰術司令部配置抽屜 ---------- */
function openDeckMoreModal() {
  const modal = $('#deckMoreModal');
  if (!modal) return;
  // 渲染教條
  $('#docSheetList').innerHTML = DOCTRINES.map(d => `
    <div class="doc-sheet-item ${state.doctrine === d.id ? 'on' : ''}" data-sheet-doc="${d.id}">
      <b><span>${d.icon}</span> ${esc(d.name)}</b>
      <small>${esc(d.desc)}</small>
    </div>
  `).join('');
  const sheetPresets = $('#sheetPresetsBox');
  if (sheetPresets) {
    const presets = getCustomPresets();
    const customHtml = presets.map((p, idx) => {
      if (!p || !Array.isArray(p.deck)) {
        return `<div class="preset-menu-row"><span class="preset-empty-txt">自訂編制 #${idx + 1} (空)</span><button type="button" class="btn-micro" data-save-preset="${idx}">💾 儲存當前</button></div>`;
      }
      const uNames = p.deck.map(id => UNIT_MAP[id]?.name?.split(' ')[0] || id).join('·');
      return `<div class="preset-menu-row"><button type="button" class="preset-load-btn" data-load-custom="${idx}"><b>${esc(p.name)}</b><small>${esc(uNames)}</small></button><button type="button" class="btn-micro" data-save-preset="${idx}">覆蓋</button></div>`;
    }).join('');
    const tplHtml = (typeof TEMPLATES !== 'undefined' ? TEMPLATES : []).map((t, idx) =>
      `<button type="button" class="btn ghost sm" data-load-tpl="${idx}" style="font-size:12px">⚡ ${esc(t.name)}</button>`
    ).join('');
    sheetPresets.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${customHtml}</div><div style="display:flex;flex-wrap:wrap;gap:6px">${tplHtml}</div>`;
  }
  const sheetSyn = $('#sheetSynergyBox');
  const mainSyn = $('#deckSynergyBar');
  if (sheetSyn && mainSyn) {
    sheetSyn.innerHTML = mainSyn.innerHTML || '<span class="syn-chip muted">請先選取裝備以檢視羈絆與戰術診斷</span>';
  }
  modal.hidden = false;
}

/* ---------- 互動事件綁定 ---------- */
// 手機版頂部兵種分頁切換
$('#mobileCatNav')?.addEventListener('click', e => {
  const tab = e.target.closest('[data-mobile-cat]');
  if (tab) {
    state.mobileCat = tab.dataset.mobileCat;
    renderMatrix();
  }
});

// 矩陣看板滑動手勢切換兵種 (Touch Swipe)
const CAT_SEQUENCE = ['air', 'armor', 'air_defense', 'naval', 'support'];
let touchStartX = 0, touchStartY = 0;
const boardEl = $('#matrixBoard');
if (boardEl) {
  boardEl.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  boardEl.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
        const curIdx = CAT_SEQUENCE.indexOf(state.mobileCat || 'air');
        if (deltaX < 0 && curIdx < CAT_SEQUENCE.length - 1) {
          state.mobileCat = CAT_SEQUENCE[curIdx + 1];
          renderMatrix();
        } else if (deltaX > 0 && curIdx > 0) {
          state.mobileCat = CAT_SEQUENCE[curIdx - 1];
          renderMatrix();
        }
      }
    }
  }, { passive: true });
}

// 矩陣卡片點擊、型號切換與懸停
$('#matrixBoard').addEventListener('click', e => {
  const infoBtn = e.target.closest('.m-info-btn');
  if (infoBtn) {
    e.stopPropagation();
    const u = UNIT_MAP[infoBtn.dataset.infoId];
    if (u) openUnitDetailModal(u);
    return;
  }
  const vBtn = e.target.closest('.m-var-toggle');
  if (vBtn) {
    toggleVariant(vBtn.dataset.cat, +vBtn.dataset.cost, e);
    return;
  }
  const card = e.target.closest('.m-card');
  if (!card) return;
  const u = UNIT_MAP[card.dataset.id];
  if (u) { hideTooltip(); handleMatrixCardClick(u); }
});

$('#matrixBoard').addEventListener('mousemove', e => {
  const card = e.target.closest('.m-card');
  if (!card) { hideTooltip(); return; }
  const u = UNIT_MAP[card.dataset.id];
  if (u) showTooltip(u, e.clientX, e.clientY);
});
$('#matrixBoard').addEventListener('mouseleave', hideTooltip);

// 手機版裝備詳細情報抽屜事件
$('#unitDetailModal')?.addEventListener('click', e => {
  if (e.target.id === 'unitDetailModal' || e.target.id === 'btnUnitSheetClose' || e.target.closest('#btnUnitSheetClose')) {
    $('#unitDetailModal').hidden = true;
    return;
  }
  const toggleBtn = e.target.closest('#btnSheetToggleVar');
  if (toggleBtn) {
    const cat = toggleBtn.dataset.cat;
    const cost = +toggleBtn.dataset.cost;
    toggleVariant(cat, cost);
    const newU = getVariantUnit(cat, cost);
    openUnitDetailModal(newU);
    return;
  }
  const equipBtn = e.target.closest('#btnSheetEquip');
  if (equipBtn && equipBtn.dataset.id) {
    const u = UNIT_MAP[equipBtn.dataset.id];
    if (u) {
      handleMatrixCardClick(u);
      $('#unitDetailModal').hidden = true;
    }
    return;
  }
});

// 手機版戰術司令部配置抽屜事件
$('#deckMoreModal')?.addEventListener('click', e => {
  const synTipEl = e.target.closest('[data-syn-tip]');
  if (synTipEl) {
    toast(synTipEl.dataset.synTip);
    return;
  }
  if (e.target.id === 'deckMoreModal' || e.target.id === 'btnDeckSheetClose') {
    $('#deckMoreModal').hidden = true;
    return;
  }
  const docItem = e.target.closest('[data-sheet-doc]');
  if (docItem) {
    state.doctrine = docItem.dataset.sheetDoc;
    renderCommandDeck();
    openDeckMoreModal();
    const docObj = DOCTRINES.find(d => d.id === state.doctrine);
    toast(`已切換戰術教條：${docObj.name}`);
    return;
  }
  if (e.target.id === 'sheetBtnClear') {
    state.deck = [null, null, null, null, null];
    state.active = 0;
    renderAll();
    $('#deckMoreModal').hidden = true;
    toast('已清空所有槽位');
    return;
  }
});

// 手機版底部抽屜下滑手勢關閉 (Swipe-Down to Dismiss)
['#unitDetailModal', '#deckMoreModal'].forEach(sel => {
  const modalEl = $(sel);
  if (!modalEl) return;
  let sheetStartY = 0, sheetStartX = 0, canSwipeClose = false;
  modalEl.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const cardEl = modalEl.querySelector('.modal-card');
    const inHead = Boolean(e.target.closest('.sheet-head'));
    canSwipeClose = inHead || !cardEl || cardEl.scrollTop <= 2;
    sheetStartY = e.touches[0].clientY;
    sheetStartX = e.touches[0].clientX;
  }, { passive: true });
  modalEl.addEventListener('touchend', e => {
    if (!canSwipeClose || e.changedTouches.length !== 1) return;
    const dy = e.changedTouches[0].clientY - sheetStartY;
    const dx = e.changedTouches[0].clientX - sheetStartX;
    if (dy > 65 && dy > Math.abs(dx) * 1.3) {
      modalEl.hidden = true;
    }
  }, { passive: true });
});

// 底部指揮台點擊
$('#commandDeck').addEventListener('click', e => {
  const synTipEl = e.target.closest('[data-syn-tip]');
  if (synTipEl) {
    toast(synTipEl.dataset.synTip);
    return;
  }
  const abBtn = e.target.closest('[data-ab]');
  if (abBtn) {
    switchDeckSlot(abBtn.dataset.ab);
    return;
  }
  const clr = e.target.closest('[data-clear-slot]');
  if (clr) {
    e.stopPropagation();
    const idx = +clr.dataset.clearSlot;
    state.deck[idx] = null;
    state.active = idx;
    syncActiveDeck();
    renderAll();
    return;
  }
  const synInd = e.target.closest('.syn-indicator');
  if (synInd) {
    const tip = synInd.getAttribute('data-syn-tip') || synInd.getAttribute('title');
    if (tip) toast(tip);
    return;
  }
  const slot = e.target.closest('[data-slot]');
  if (slot) {
    state.active = +slot.dataset.slot;
    renderCommandDeck();
    return;
  }
  const doc = e.target.closest('[data-doc]');
  if (doc) {
    state.doctrine = doc.dataset.doc;
    syncActiveDeck();
    renderCommandDeck();
    const docObj = DOCTRINES.find(d => d.id === state.doctrine);
    if (docObj) {
      toast(`🎖️ 已啟用戰術教條【${docObj.name}】：${docObj.desc}`);
    }
    return;
  }
  if (e.target.closest('#btnDeckMore')) {
    openDeckMoreModal();
    return;
  }
  if (e.target.closest('#btnRand')) {
    const banned = currentBanned();
    // 清理 locked 中已經被 BAN 的名將，嚴格不保留在隨機鎖定槽位上
    const locked = state.deck.map(id => (id && banned.includes(id) ? null : id));
    const d = randomDeck(Math.random, budgetLimit(), locked, banned) || randomDeck(Math.random, budgetLimit(), [], banned);
    if (d) {
      state.deck = d;
      syncActiveDeck();
      renderAll();
      toast('已隨機補滿合規作戰陣容');
    } else {
      toast('無法隨機補滿，請先清空或卸下高價裝備');
    }
    return;
  }
  if (e.target.closest('#btnClear')) {
    state.deck = [null, null, null, null, null];
    state.active = 0;
    syncActiveDeck();
    renderAll();
    toast('已清空所有槽位');
    return;
  }

  if (e.target.closest('#btnGo')) {
    if (state.mode === 'bo3' && state.bo3 && state.bo3.finished) {
      showBo3SeriesResult(state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB);
      return;
    }
    if (state.buildSource === 'ladder') {
      saveAndExitLadderBuild(true);
      return;
    }
    if (state.buildSource === 'tournament') {
      saveAndExitTourneyBuild();
      return;
    }
    if (state.mode === 'sandbox') {
      runSandbox();
    } else if (state.isOnlinePvp) {
      handleOnlinePvpSubmit();
    } else {
      startBattle();
    }
    return;
  }
});



// 橫幅事件代理
$('#missionBar').addEventListener('click', e => {
  const subBtn = e.target.closest('[data-submode]');
  if (subBtn) {
    const subMode = subBtn.dataset.submode;
    state.practiceSubMode = subMode;
    setMode(subMode);
    return;
  }
  if (e.target.closest('#btnCancelLadderBuild')) {
    cancelLadderBuild();
    return;
  }
  if (e.target.closest('#btnRestartBo3Series')) {
    initBo3Series();
    renderAll();
    toast('🏆 已重啟新一輪多局鏖戰系列賽！');
    return;
  }
  if (e.target.closest('#btnOpenBo3SeriesModal')) {
    const isWinner = (state.bo3 && (state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB));
    showBo3SeriesResult(isWinner);
    return;
  }
  if (e.target.closest('#btnSaveReturnLadder')) {
    saveAndExitLadderBuild(false);
    return;
  }
  if (e.target.closest('#btnCancelTourneyBuild')) {
    cancelTourneyBuild();
    return;
  }
  if (e.target.closest('#btnSaveReturnTourney')) {
    saveAndExitTourneyBuild();
    return;
  }
  if (e.target.closest('#btnRerollGhost')) {
    const pool = getGhostPool();
    state.ghostTarget = pick(pool.filter(g => g.id !== (state.ghostTarget && state.ghostTarget.id)));
    setupMatch(); renderAll(); toast('已為你配對新幽靈對手：' + state.ghostTarget.callsign); return;
  }
  if (e.target.closest('#btnDeployGhost')) {
    if (!state.deck.every(Boolean)) { toast('請先配置滿 5 個槽位再部署防衛幽靈！'); return; }
    openDeployGhostModal(); return;
  }
  if (e.target.closest('#btnOnlinePvp')) {
    openOnlinePvpModal(); return;
  }
  if (e.target.closest('#btnExitPvp')) {
    OnlinePvPEngine.closeConnection();
    state.isOnlinePvp = false;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
    initBo3Series();
    renderAll();
    toast('已安全退出線上雙人對戰房間，回到常規模式。');
    return;
  }
    // 自訂戰場下拉選單展開/收合
  const triggerBtn = e.target.closest('#btnWeatherDropdown');
  if (triggerBtn) {
    const dropdown = triggerBtn.closest('.custom-weather-dropdown');
    const menu = dropdown ? dropdown.querySelector('.custom-weather-menu') : null;
    if (menu) {
      const isHidden = menu.hasAttribute('hidden');
      if (isHidden) {
        menu.removeAttribute('hidden');
        dropdown.classList.add('open');
        triggerBtn.setAttribute('aria-expanded', 'true');
      } else {
        menu.setAttribute('hidden', '');
        dropdown.classList.remove('open');
        triggerBtn.setAttribute('aria-expanded', 'false');
      }
    }
    return;
  }

  // 自訂戰場項目點選
  const optItem = e.target.closest('.weather-opt-item');
  if (optItem) {
    const val = optItem.getAttribute('data-val');
    const dropdown = optItem.closest('.custom-weather-dropdown');
    const contextMode = dropdown ? dropdown.getAttribute('data-context') : 'quick';
    const menu = dropdown ? dropdown.querySelector('.custom-weather-menu') : null;
    if (menu) {
      menu.setAttribute('hidden', '');
      dropdown.classList.remove('open');
    }
    selectWeatherEvent(val, contextMode);
    return;
  }

  // AI對手下拉選單展開/收合
  const triggerAiBtn = e.target.closest('#btnAiDropdown');
  if (triggerAiBtn) {
    const dropdown = triggerAiBtn.closest('.custom-ai-dropdown');
    const menu = dropdown ? dropdown.querySelector('.custom-ai-menu') : null;
    if (menu) {
      const isHidden = menu.hasAttribute('hidden');
      if (isHidden) {
        menu.removeAttribute('hidden');
        dropdown.classList.add('open');
        triggerAiBtn.setAttribute('aria-expanded', 'true');
      } else {
        menu.setAttribute('hidden', '');
        dropdown.classList.remove('open');
        triggerAiBtn.setAttribute('aria-expanded', 'false');
      }
    }
    return;
  }

  // AI對手項目點選
  const optAiItem = e.target.closest('.ai-opt-item');
  if (optAiItem) {
    const val = optAiItem.getAttribute('data-val');
    const dropdown = optAiItem.closest('.custom-ai-dropdown');
    const menu = dropdown ? dropdown.querySelector('.custom-ai-menu') : null;
    if (menu) {
      menu.setAttribute('hidden', '');
      dropdown.classList.remove('open');
    }
    selectAiArch(val);
    return;
  }

  const wp = e.target.closest('#weatherPill, .weather-pill');
  if (wp) {
    const desc = wp.getAttribute('data-desc') || wp.getAttribute('title');
    if (desc) toast(`戰場環境【${desc}】`);
    return;
  }
  const bc = e.target.closest('.ban-capsule');
  if (bc) {
    const desc = bc.getAttribute('data-ban-desc') || bc.getAttribute('title');
    if (desc) toast(desc);
    return;
  }
});
$('#missionBar').addEventListener('change', e => {
  if (e.target.id === 'bo3EventSel') {
    const evId = e.target.value;
    let chosen = null;
    if (evId === 'random') {
      chosen = pick(EVENTS);
      toast(`戰場天候已隨機抽選：${chosen.icon} ${chosen.name}（${chosen.desc}）`);
    } else {
      chosen = EVENTS.find(ev => ev.id === evId);
      if (chosen) {
        toast(`戰場天候已自選為：${chosen.icon} ${chosen.name}（${chosen.desc}）`);
      }
    }
    if (chosen) {
      state.event = chosen;
      if (state.bo3) {
        state.bo3.nextEvent = chosen;
      }
      renderMissionBar();
      updateTopHud();
      updateCardSelectionVisuals();
    }
    return;
  }
  if (e.target.id === 'bo3GamesSel') {
    const games = parseInt(e.target.value, 10);
    if (state.bo3) {
      state.bo3.maxGames = games;
      renderMissionBar();
      updateTopHud();
      toast(`多局鏖戰：已設定為 ${games} 局 (${Math.ceil(games / 2)} 勝制)`);
    }
    return;
  }
  if (e.target.id === 'bo3MarketSel') {
    const mMode = e.target.value;
    if (state.bo3) {
      state.bo3.marketMode = mMode;
      renderMissionBar();
      updateRerollMarketButtonState();
      toast(mMode === 'free' ? '多局鏖戰：已切換為【自由調撥】（每局備戰皆可重新洗牌，禁用 2 件裝備）' : '多局鏖戰：已切換為【開戰鎖定】（首局開戰後全系列賽固定配給，禁用 1 件裝備）');
    }
    return;
  }
  if (e.target.id === 'bo3PvpGamesSel' || e.target.id === 'bo3PvpMarketSel') {
    if (state.isOnlinePvp && OnlinePvPEngine.isHostUser()) {
      const games = parseInt($('#bo3PvpGamesSel')?.value || '5', 10);
      const mMode = $('#bo3PvpMarketSel')?.value || 'locked';
      if (state.bo3) {
        state.bo3.maxGames = games;
        state.bo3.marketMode = mMode;
        OnlinePvPEngine.broadcastRoomSettings({ maxGames: games, marketMode: mMode });
        renderMissionBar();
        updateTopHud();
        updateRerollMarketButtonState();
        toast(`已更新線上房間設定：BO${games} · ${mMode === 'free' ? '自由調撥 (Ban 2)' : '開戰鎖定 (Ban 1)'}`);
      }
    }
    return;
  }
  if (e.target.id === 'aiSel') {
    state.aiArch = e.target.value;
    setupMatch(true); // 保留當前戰場場景天候，絕不隨對手流派切換而隨機跳動！
      renderMissionBar();
    updateCardSelectionVisuals();
    const arch = state.aiArch === 'random' ? null : ARCHETYPES.find(a => a.id === state.aiArch);
    toast(`AI對手已設定為：${arch ? (ARCHETYPE_ICONS[state.aiArch] || '') + ' ' + arch.name : '🎲 隨機對手'}`);
    return;
  }

  if (e.target.id === 'dailyPlanSel') {
    handleDailyPlanChange(e.target.value);
  }
  if (e.target.id === 'sandEnemy') state.sandEnemy = e.target.value;
  if (e.target.id === 'sandEvent') { state.sandEvent = e.target.value; renderMatrix(); }
});

function handleDailyPlanChange(val) {
  state.dailyPlanId = val;
  setupMatch();
  renderAll();
  let planName = '今日官方特選題目';
  const c = deckCost(state.enemy);
  if (val === 'random_tier') {
    planName = `🎲 隨機抽題【${state.enemyName}】($${c}超標 · +$${c - 15})`;
  } else if (val === 'today') {
    planName = `🌟 今日特選【${state.enemyName}】($${c}超標 · +$${c - 15})`;
  } else {
    const found = DAILY_PLANS.find(p => p.id === val);
    planName = found ? `【${found.name}】($${c}超標 · +$${c - 15})` : state.enemyName;
  }
  toast(`已切換精選對戰題目：${planName}`);
}

$('#missionBar').addEventListener('change', e => {
  if (e.target.id === 'dailyPlanSel') {
    handleDailyPlanChange(e.target.value);
  }
  if (e.target.id === 'sandEnemy') state.sandEnemy = e.target.value;
  if (e.target.id === 'sandEvent') state.sandEvent = e.target.value;
  if (e.target.id === 'aiArchSel') {
    state.aiArch = e.target.value;
    setupMatch();
    renderAll();
  }
});

/* ---------- 離開/清理戰鬥推演與檢視戰場 ---------- */
function exitActiveBattle() {
  playToken++; // 中止推演循環
  document.body.classList.remove('in-battle');
  const vb = $('#viewBattle');
  if (vb) vb.hidden = true;
  
  // 關閉所有戰鬥相關彈窗與主遮罩
  const modals = [
    $('#resultModal'),
    $('#ladderResultModal'),
    $('#bo3SeriesModal'),
    $('#bo3RoundModal')
  ];
  modals.forEach(m => {
    if (m) m.hidden = true;
  });
  if (typeof currentActiveModal !== 'undefined' && currentActiveModal) {
    currentActiveModal.hidden = true;
  }

  // 重置右上角戰鬥控制按鈕
  const btnSpeed = $('#btnSpeed'); if (btnSpeed) btnSpeed.hidden = false;
  const btnSkip = $('#btnSkip'); if (btnSkip) btnSkip.hidden = false;
  const btnReopen = $('#btnReopenResult'); if (btnReopen) btnReopen.hidden = true;
  const btnExit = $('#btnBattleExit'); if (btnExit) btnExit.hidden = true;

  // 清空戰鬥特效層
  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
}


// 3D 古戰場沙盤視圖切換
let is3DVisible = true;
$('#btnToggle3DView')?.addEventListener('click', () => {
  is3DVisible = !is3DVisible;
  const wrap = $('#battle3DWrapper');
  const btn = $('#btnToggle3DView');
  if (wrap) wrap.style.display = is3DVisible ? 'block' : 'none';
  if (btn) btn.textContent = is3DVisible ? '切換 3D/2D' : '展開 3D 沙盤';
  if (typeof Battle3DEngine !== 'undefined') {
    Battle3DEngine.toggleMode(is3DVisible);
  }
});

/* ---------- 模式切換與預算修剪 ---------- */
$('#modeTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return;
  setMode(b.dataset.mode);
});

// 點擊品牌 Logo 亦可平滑返回快速對戰指揮所
const brandLogo = $('.brand');
if (brandLogo) {
  brandLogo.addEventListener('click', () => {
    setMode('quick');
  });
}

// 點擊頂部玩家資訊徽章平滑前往天梯競技
$('#hudStats')?.addEventListener('click', e => {
  if (e.target.closest('#hudPlayerBadge')) {
    setMode('ladder');
  }
});

/* ---------- 天梯與錦標賽來源感知戰備編制流程 (Scheme A) ---------- */
function startLadderBuild(pendingTarget = null) {
  state.buildSource = 'ladder';
  state.ladderPendingTarget = pendingTarget;

  // 載入當前天梯防守陣容與教條（若已配置滿 5 槽）
  const lState = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState() : null;
  if (lState?.player?.defenseDeck && Array.isArray(lState.player.defenseDeck) && lState.player.defenseDeck.filter(Boolean).length === 5) {
    state.deck = lState.player.defenseDeck.slice();
    if (state.deckSlot === 'A') state.dualDecks.A = state.deck.slice();
    else if (state.deckSlot === 'B') state.dualDecks.B = state.deck.slice();
  }
  if (lState?.player?.defenseDoc) {
    state.doctrine = lState.player.defenseDoc;
  }

  // 載入今日天梯戰區天氣
  if (typeof LadderEngine !== 'undefined' && LadderEngine.getDailyTheater) {
    state.event = LadderEngine.getDailyTheater();
  }

  const viewLadder = $('#viewLadder');
  const viewTournament = $('#viewTournament');
  const viewBuild = $('#viewBuild');
  const missionBar = $('#missionBar');
  const commandDeck = $('#commandDeck');

  if (viewLadder) viewLadder.hidden = true;
  if (viewTournament) viewTournament.hidden = true;
  if (viewBuild) viewBuild.hidden = false;
  if (missionBar) missionBar.hidden = false;
  if (commandDeck) commandDeck.hidden = false;

  // 頂部模式按鈕維持「天梯競技」亮起
  document.querySelectorAll('.mode-btn').forEach(x => {
    x.classList.toggle('active', x.dataset.mode === 'ladder');
  });

  renderAll();
  toast(pendingTarget 
    ? `⚔️ 準備挑戰【${pendingTarget.name}】：請配置 5 槽陣容，完成後立即開戰！` 
    : '🏆 已進入天梯戰備模式：調整出征與防守部隊，完成後點擊保存即可返回天梯！');
}

function saveAndExitLadderBuild(executePending = false) {
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['尚未選滿 5 個槽位'];
  if (!full || errs.length > 0) {
    toast(`⚠️ ${errs[0] || '請先配置滿 5 個槽位再保存！'}`);
    return;
  }

  // 1. 同步為天梯防守陣容
  if (typeof LadderEngine !== 'undefined') {
    LadderEngine.setDefenseFleet(state.deck, state.doctrine);
  }

  // 2. 雲端存檔同步
  if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn && CloudSync.isLoggedIn()) {
    CloudSync.syncToCloud(true);
  }

  // 3. 若有指定挑戰目標且由開戰觸發
  if (executePending && state.ladderPendingTarget) {
    const targetUser = state.ladderPendingTarget;
    const lState = LadderEngine.getState();
    if (lState.player.orders <= 0) {
      toast('❌ 作戰派遣令已耗盡 (0/30)！每小時整點自動補給 30 次。');
      state.buildSource = null;
      state.ladderPendingTarget = null;
      setMode('ladder');
      return;
    }

    state.ladderEnemy = targetUser;
    state.enemy = targetUser.deck.slice();
    state.enemyName = `${targetUser.flag} ${targetUser.name}`;
    state.enemyDoc = targetUser.defenseDoc || targetUser.doc || 'defense';
    state.event = (LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || pick(EVENTS);
    state.buildSource = null;
    state.ladderPendingTarget = null;
    state.mode = 'ladder';

    $('#viewBuild').hidden = true;
    $('#missionBar').hidden = true;
    $('#commandDeck').hidden = true;

    startBattle();
    toast(`⚔️ 已保存編制並向第 #${targetUser.rank} 名【${targetUser.name}】發起突擊！戰區：【${state.event.icon} ${state.event.name}】`);
    return;
  }

  // 4. 一般保存返回天梯
  state.buildSource = null;
  state.ladderPendingTarget = null;
  toast('💾 天梯出征與防守部隊編制已成功保存！');
  setMode('ladder');
}

function cancelLadderBuild() {
  state.buildSource = null;
  state.ladderPendingTarget = null;
  toast('已取消調整，返回天梯競技場。');
  setMode('ladder');
}

function startTourneyBuild() {
  state.buildSource = 'tournament';

  const viewLadder = $('#viewLadder');
  const viewTournament = $('#viewTournament');
  const viewBuild = $('#viewBuild');
  const missionBar = $('#missionBar');
  const commandDeck = $('#commandDeck');

  if (viewLadder) viewLadder.hidden = true;
  if (viewTournament) viewTournament.hidden = true;
  if (viewBuild) viewBuild.hidden = false;
  if (missionBar) missionBar.hidden = false;
  if (commandDeck) commandDeck.hidden = false;

  // 頂部模式按鈕維持「淘汰錦標賽」亮起
  document.querySelectorAll('.mode-btn').forEach(x => {
    x.classList.toggle('active', x.dataset.mode === 'tournament');
  });

  renderAll();
  toast('🥇 已進入淘汰錦標賽戰備模式：配置完成後點擊保存即可返回參賽！');
}

function saveAndExitTourneyBuild() {
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['尚未選滿 5 個槽位'];
  if (!full || errs.length > 0) {
    toast(`⚠️ ${errs[0] || '請先配置滿 5 個槽位再保存！'}`);
    return;
  }
  state.buildSource = null;
  toast('💾 淘汰錦標賽主力陣容已成功保存！');
  setMode('tournament');
}

function cancelTourneyBuild() {
  state.buildSource = null;
  toast('已取消調整，返回淘汰錦標賽。');
  setMode('tournament');
}

function setMode(m) {
  if (typeof Telemetry !== 'undefined') {
    Telemetry.trackEvent('mode_switch', { mode: m });
  }

  // 若在天梯戰鬥推演中切換頂部分頁，自動結算天梯戰果，防作弊防退出
  if (state.mode === 'ladder' && state.ladderEnemy && lastBattleRes && !lastBattleRes._ladderHandled) {
    lastBattleRes._ladderHandled = true;
    const isWin = lastBattleRes.winner === 'A';
    const rep = LadderEngine.resolveMatch(isWin, state.ladderEnemy, lastBattleRes);
    stats.played++;
    if (isWin) {
      stats.win++;
      stats.streak++;
      stats.best = Math.max(stats.best, stats.streak);
    } else {
      stats.streak = 0;
    }
    LS.set('wl15_stats', stats);
    toast(isWin ? `🎖️ 天梯對決已在背景自動推演結算：戰術獲勝 (+${rep.totalDelta} RP)！` : `⚠️ 天梯對決已在背景自動推演結算：作戰失利 (${rep.totalDelta} RP)！`);
    state.ladderEnemy = null;
  }

  // 無論何時點選上方功能列（即使在戰鬥中或檢視戰場情形），立即乾淨退出戰鬥
  exitActiveBattle();

  // 若從線上雙人對戰切換至其他模式，安全關閉連線並重置狀態
  if (m !== 'bo3' && state.isOnlinePvp) {
    OnlinePvPEngine.closeConnection();
    state.isOnlinePvp = false;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
  }

  // 相容舊 ghost 模式：自動映射至快速對戰之幽靈子模式
  if (m === 'ghost') {
    m = 'quick';
    state.quickSubMode = 'ghost';
  }

  // 快速對戰主分頁映射：若點擊頂部「⚡ 快速對戰」，自動進入記憶之子分頁 (預設為 quick)
  if (m === 'quick' || m === 'practice') {
    m = state.practiceSubMode || 'quick';
  }
  if (m === 'quick' || m === 'daily' || m === 'sandbox') {
    state.practiceSubMode = m;
  }

  const prevMode = state.mode;
  state.mode = m; state.sandResult = null;
  state.buildSource = null;
  state.ladderPendingTarget = null;
  document.querySelectorAll('.mode-btn').forEach(x => {
    const isAct = (x.dataset.mode === m) || ((x.dataset.mode === 'quick' || x.dataset.mode === 'practice') && (m === 'quick' || m === 'daily' || m === 'sandbox'));
    x.classList.toggle('active', isAct);
    if (isAct && window.innerWidth <= 960) {
      const modeTabsNav = document.getElementById('modeTabs');
      if (modeTabsNav) {
        const btnLeft = x.offsetLeft;
        const btnWidth = x.offsetWidth;
        const navWidth = modeTabsNav.clientWidth;
        modeTabsNav.scrollTo({ left: btnLeft - (navWidth / 2) + (btnWidth / 2), behavior: 'smooth' });
      }
    }
  });
  window.scrollTo({ left: 0 });
  if (document.documentElement) document.documentElement.scrollLeft = 0;
  if (document.body) document.body.scrollLeft = 0;
  
  const viewLadder = $('#viewLadder');
  const viewTournament = $('#viewTournament');
  const viewBuild = $('#viewBuild');
  const missionBar = $('#missionBar');
  const commandDeck = $('#commandDeck');

  if (m === 'ladder') {
    if (viewLadder) viewLadder.hidden = false;
    if (viewTournament) viewTournament.hidden = true;
    if (viewBuild) viewBuild.hidden = true;
    if (missionBar) missionBar.hidden = true;
    if (commandDeck) commandDeck.hidden = true;
    renderLadderView();
    renderHud();
    // clean navigation without toast spam
    const p = LadderEngine.getState().player;
    if (!p.hasCustomName && !localStorage.getItem('topwarlords_callsign_set')) {
      setTimeout(() => openCommanderModal(), 400);
    }
    return;
  } else if (m === 'tournament') {
    if (viewTournament) viewTournament.hidden = false;
    if (viewLadder) viewLadder.hidden = true;
    if (viewBuild) viewBuild.hidden = true;
    if (missionBar) missionBar.hidden = true;
    if (commandDeck) commandDeck.hidden = true;
    renderTournamentView();
    renderHud();
    // clean navigation without toast spam
    const p = LadderEngine.getState().player;
    if (!p.hasCustomName && !localStorage.getItem('topwarlords_callsign_set')) {
      setTimeout(() => openCommanderModal(), 400);
    }
    return;
  } else {
    if (viewLadder) viewLadder.hidden = true;
    if (viewTournament) viewTournament.hidden = true;
    if (viewBuild) viewBuild.hidden = false;
    if (missionBar) missionBar.hidden = false;
    if (commandDeck) commandDeck.hidden = false;
  }

  prune(); setupMatch(); renderAll();
  if (m === 'bo3') {
    // clean bo5 switch
  } else if (m === 'quick') {
    if (prevMode !== 'quick') {
      // clean quick switch
    }
  } else if (m === 'daily') {
    if (prevMode !== 'daily') {
      // clean daily switch
    }
  } else if (m === 'sandbox') {
    if (state.lastBattleEnemy && !state.customSandEnemy) {
      state.customSandEnemy = {
        name: state.lastBattleEnemy.name,
        deck: state.lastBattleEnemy.deck.slice(),
        doc: state.lastBattleEnemy.doc,
        event: state.lastBattleEnemy.event
      };
    }
    if (prevMode !== 'sandbox') {
      // clean sandbox switch
    }
  }
}

/* =====================================================
   🏆 天梯競技場介面與交互邏輯 (Tactical Ladder UI Controller)
   ===================================================== */
let currentRosterTab = 'zone'; // 'live', 'zone', 或 'yesterday'

function renderLadderTargetsTray() {
  const section = $('#ladderTargetsSection');
  if (!section || typeof LadderEngine === 'undefined') return;
  const lState = LadderEngine.getState();
  const player = lState.player;
  const targets = (LadderEngine.getChallengeableTargets && LadderEngine.getChallengeableTargets()) || [];

  const rankRangeEl = $('#targetRankRange');
  const scrollMyRankEl = $('#btnScrollMyRank');
  if (scrollMyRankEl) scrollMyRankEl.textContent = player.rank;

  if (targets.length === 0) {
    if (rankRangeEl) rankRangeEl.textContent = player.rank === 1 ? '您已登頂榜首' : '暫無可挑戰目標';
    const grid = $('#targetsCardGrid');
    if (grid) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:16px;color:#94a3b8;font-size:13px">
        ${player.rank === 1 ? '👑 恭喜登頂天梯榜首！您是全服頂尖戰略指揮官，請駐防守衛您的榮譽席位！' : '目前前方無可挑戰之席位。'}
      </div>`;
    }
    return;
  }

  const minRank = targets[targets.length - 1].rank;
  const maxRank = targets[0].rank;
  if (rankRangeEl) {
    rankRangeEl.textContent = minRank === maxRank ? `#${minRank}` : `#${minRank} ~ #${maxRank}`;
  }

  const grid = $('#targetsCardGrid');
  if (!grid) return;

  grid.innerHTML = targets.map(u => {
    const tier = LadderEngine.getRankTier(u.rp);
    const streak = u.streakDays || 1;
    const isBreaker = streak >= 3;
    const docObj = DOCTRINES.find(d => d.id === (u.defenseDoc || u.doc || 'defense')) || DOCTRINES[1];
    const rpDiff = u.rp - player.rp;

    const deckChipsHtml = (u.deck || []).map((id, slotIdx) => {
      const unit = UNIT_MAP[id];
      // 戰術電戰迷霧：僅公開第 1 槽（旗艦），後 4 槽完全受密電遮蔽
      const isMasked = slotIdx >= 1;
      if (isMasked) {
        return `<div class="r-deck-chip masked" title="受戰術電戰迷霧遮蔽：未知武器裝備">
          <span class="chip-mask-q">?</span>
        </div>`;
      }
      if (!unit) return '<div class="r-deck-chip"></div>';
      return `<div class="r-deck-chip" title="${esc(unit.name)} ($${unit.cost})">
        <img src="${unit.img || `assets/units/${unit.id}.jpg`}" alt="${esc(unit.name)}" onerror="this.style.display='none'"/>
        <span class="chip-cost">$${unit.cost}</span>
      </div>`;
    }).join('');

    return `<div class="target-card ${isBreaker ? 'breaker-bonus' : ''}">
      <div class="t-card-left">
        <span class="t-card-rank">#${u.rank}</span>
        <span style="font-size:15px">${u.flag || '🌐'}</span>
        <div class="t-commander-info">
          <div class="t-name-row">
            <span class="t-commander-name" title="${esc(u.name)}">${esc(u.name)}</span>
            ${isBreaker ? `<span class="t-card-streak" title="守位 >= 3 天，擊破額外獲得 +15 RP 終結者加成！">👑 守位${streak}天 (+15)</span>` : ''}
          </div>
          <div class="t-commander-meta">
            <span style="color:${tier.color};font-weight:700">${tier.name}</span>
            <span>${u.rp.toLocaleString()} RP</span>
            <span class="doctrine-secret" style="font-size:10px;color:#94a3b8" title="戰略保密教條">🔒 戰術保密</span>
          </div>
        </div>
      </div>
      <div class="t-card-right">
        <div class="t-deck-chips">${deckChipsHtml}</div>
        <button type="button" class="btn-ladder-engage t-card-btn" data-target-rank="${u.rank}" data-target-id="${u.id}">
          ⚔️ 挑戰
        </button>
      </div>
    </div>`;
  }).join('');
}


function renderLadderView() {
  if (typeof LadderEngine === 'undefined') return;
  LadderEngine.init();
  const lState = LadderEngine.getState();
  const player = lState.player;
  const pTier = LadderEngine.getRankTier(player.rp);

  // 1. 渲染頂部個人戰情卡
  const myTierBadge = $('#myTierBadge');
  if (myTierBadge) {
    const iconStr = pTier.icon || '🎖️';
    const starCount = (iconStr.match(/⭐/g) || []).length;
    if (starCount >= 2) {
      const stars = Array.from(iconStr.replace(/\s+/g, ''));
      const starsHtml = stars.map(s => `<span class="star-chip">${s}</span>`).join('');
      myTierBadge.innerHTML = `<div class="tier-stars-box stars-${starCount}">${starsHtml}</div>`;
    } else {
      myTierBadge.innerHTML = `<div class="tier-stars-box single"><span class="star-chip">${iconStr}</span></div>`;
    }
    myTierBadge.title = `${pTier.name} (${pTier.en})`;
  }
  const myFlag = $('#myFlag');
  if (myFlag) myFlag.textContent = player.flag || '🇹🇼';
  const myCallsign = $('#myCallsign');
  if (myCallsign) myCallsign.textContent = player.name;
  const myUidPill = $('#myUidPill');
  if (myUidPill) myUidPill.textContent = player.uid || 'CMD-7392';
  const myTierName = $('#myTierName');
  if (myTierName) {
    myTierName.textContent = pTier.name;
    myTierName.style.color = pTier.color;
    myTierName.style.borderColor = pTier.color;
  }
  const myStreakBadge = $('#myStreakBadge');
  if (myStreakBadge) {
    const days = player.streakDays || 1;
    myStreakBadge.textContent = days >= 3 ? `👑 霸榜 ${days} 天` : `🛡️ 駐榜 ${days} 天`;
    myStreakBadge.className = days >= 3 ? 'my-streak-badge gold' : 'my-streak-badge';
  }
  const myRankVal = $('#myRankVal');
  if (myRankVal) myRankVal.textContent = `#${player.rank}`;
  const scrollMyRankEl = $('#btnScrollMyRank');
  if (scrollMyRankEl) scrollMyRankEl.textContent = player.rank;

  const myRankTrend = $('#myRankTrend');
  if (myRankTrend) {
    const diff = player.yesterdayRank - player.rank;
    if (diff > 0) {
      myRankTrend.textContent = `▲ +${diff} (昨 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend';
    } else if (diff < 0) {
      myRankTrend.textContent = `▼ ${diff} (昨 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend down';
    } else {
      myRankTrend.textContent = `− 持平 (昨 #${player.yesterdayRank})`;
      myRankTrend.className = 'trend flat';
    }
  }

  const myRPVal = $('#myRPVal');
  if (myRPVal) myRPVal.textContent = player.rp.toLocaleString();
  const myRPSub = $('#myRPSub');
  if (myRPSub) myRPSub.textContent = `昨日 ${player.yesterdayRP.toLocaleString()}`;

  const myOrdersVal = $('#myOrdersVal');
  if (myOrdersVal) {
    myOrdersVal.textContent = `⚡ ${player.orders} / 30`;
    myOrdersVal.className = player.orders > 0 ? 'val green' : 'val';
    if (player.orders === 0) myOrdersVal.style.color = '#ef4444';
  }

  // 防守部隊預覽與 AI 駐防戰術教條自選
  const defDeck = player.defenseDeck || state.deck;
  const defDoc = player.defenseDoc || state.doctrine || 'defense';
  const defBox = $('#defenseDeckPreview');
  if (defBox) {
    defBox.innerHTML = defDeck.map(id => {
      const u = UNIT_MAP[id];
      if (!u) return '<div class="mini-unit-chip"></div>';
      const shortName = u.name.split(' ')[0];
      const catObj = CATS[u.cat] || { short: 'UNIT', color: '#38bdf8' };
      return `<div class="mini-unit-chip" title="${esc(u.name)} ($${u.cost})">
        <img src="${u.img || `assets/units/${u.id}.jpg`}" alt="${esc(u.name)}" onerror="this.style.display='none'"/>
        <span class="cat-mini-tag" style="background:${catObj.color}">${catObj.short}</span>
        <span class="cost-tag">$${u.cost}</span>
        <span class="unit-mini-name">${esc(shortName)}</span>
      </div>`;
    }).join('');
  }
  const defEvalRow = $('#defenseEvalRow');
  if (defEvalRow) {
    const defUnits = defDeck.map(id => UNIT_MAP[id]).filter(Boolean);
    const totalCost = defUnits.reduce((s, u) => s + (u.cost || 0), 0);
    const arch = typeof analyzeDeckArchetype === 'function' ? analyzeDeckArchetype(defDeck) : { icon: '🎖️', name: '均衡聯合作戰流' };
    const syns = typeof getDeckSynergies === 'function' ? getDeckSynergies(defUnits) : [];
    const baseEw = defUnits.reduce((s, u) => s + (u.ew || 0), 0) + (syns.some(x => x.id === 'cec') ? 12 : 0);
    const effEw = Math.round(baseEw * (defDoc === 'deception' ? 1.5 : 1));
    defEvalRow.innerHTML = `
      <div class="def-eval-inline-inner">
        <span class="def-eval-arch-tag" title="戰術流派風格：${esc(arch.name)}">${arch.icon} ${esc(arch.name)}</span>
        <span class="def-eval-stat-tag cost">預算 <b>$${totalCost}/$15</b></span>
        <span class="def-eval-stat-tag ew" title="全域電子戰戰術值">EW <b>${effEw}</b></span>
      </div>
    `;
  }

  // 1.4 渲染天梯戰情情報 (整合方案 AB：攻防戰績與歷史巔峰)
  const myRecordVal = $('#myLadderRecordVal');
  if (myRecordVal) {
    const pStats = (player && player.stats) || { wins: 0, losses: 0 };
    const w = pStats.wins || 0;
    const l = pStats.losses || 0;
    const total = w + l;
    const winRate = total > 0 ? Math.round((w / total) * 100) : 0;
    myRecordVal.textContent = total > 0 ? `${w}勝 ${l}敗 (${winRate}%)` : `0勝 0敗 (新賽季)`;
  }
  const myPeakVal = $('#myLadderPeakVal');
  if (myPeakVal) {
    const pStats = (player && player.stats) || {};
    const curRank = (player && player.rank) || 101;
    const curRP = (player && player.rp) || 0;
    const bestRank = (pStats.highestRank && pStats.highestRank > 0) ? Math.min(pStats.highestRank, curRank) : curRank;
    const bestRP = Math.max(pStats.highestRP || 0, curRP);
    myPeakVal.textContent = `#${bestRank} (${bestRP.toLocaleString()} RP)`;
  }
  const defDocGrid = $('#defenseDocGrid');
  if (defDocGrid) {
    defDocGrid.innerHTML = DOCTRINES.map(d => {
      const isActive = defDoc === d.id;
      return `<button type="button" class="doc-seg-btn ${isActive ? 'active-def-doc' : ''}" data-def-doc="${d.id}" title="點擊切換駐防教條：${esc(d.desc)}">
        <span class="doc-seg-icon">${d.icon}</span>
        <span class="doc-seg-name">${esc(d.name)}</span>
      </button>`;
    }).join('');
  }
  const defDocRow = $('#defenseDocRow');
  if (defDocRow) {
    defDocRow.innerHTML = `
      <div class="doc-segmented-head">
        <span class="doc-seg-label" style="white-space:nowrap">駐防 AI 戰術教條</span>
        <span class="doc-seg-hint">（防守時自動執行）</span>
      </div>
      <div class="doc-segmented-grid">
        ${DOCTRINES.map(d => {
          const isActive = defDoc === d.id;
          return `<button type="button" class="doc-seg-btn ${isActive ? 'active-def-doc' : ''}" data-def-doc="${d.id}" title="點擊切換駐防教條：${esc(d.desc)}">
            <span class="doc-seg-icon">${d.icon}</span>
            <span class="doc-seg-name">${esc(d.name)}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  // 1.5 渲染今日天梯戰區天候橫幅 (精簡主文顯示避免溢出卡片，詳細說明放於 title 提示)
  const dailyTheater = (LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || (typeof EVENTS !== 'undefined' && EVENTS[0]);
  if (dailyTheater) {
    const tIcon = $('#theaterIcon');
    if (tIcon) tIcon.textContent = dailyTheater.icon || '⚡';
    const tName = $('#theaterName');
    if (tName) tName.textContent = dailyTheater.name || '戰區環境';
    const tDesc = $('#theaterDesc');
    if (tDesc) {
      tDesc.textContent = dailyTheater.desc || '';
      tDesc.title = `${dailyTheater.desc}（今日全服天梯攻防對局均在此環境下推演！）`;
    }
    const tStrip = $('#ladderTheaterStrip');
    if (tStrip) {
      tStrip.title = `【今日天梯戰區：${dailyTheater.name}】${dailyTheater.desc}（今日全服天梯攻防對局均在此環境下推演！）`;
    }
  }

  // 2. 渲染上方可挑戰目標托盤
  renderLadderTargetsTray();

  // 3. 渲染階梯天梯榜 (支援全榜與戰區頁籤)
  renderLadderRosterTable();
}

function renderLadderRosterTable() {
  const tableBox = $('#rosterTableBox');
  if (!tableBox) return;
  const lState = LadderEngine.getState();
  const player = lState.player;

  const isLive = currentRosterTab === 'live' || currentRosterTab === 'zone';
  let list = [];
  if (currentRosterTab === 'zone') {
    list = (LadderEngine.getRosterZone && LadderEngine.getRosterZone()) || LadderEngine.getRosterTop30();
  } else if (currentRosterTab === 'yesterday') {
    list = lState.yesterdayTop10;
  } else {
    list = (LadderEngine.getRosterTop10 ? LadderEngine.getRosterTop10() : LadderEngine.getRosterTop30().slice(0, 10));
  }

  const headerRowHtml = `
    <div class="roster-header-row">
      <div class="rh-col rh-rank">名次</div>
      <div class="rh-col rh-streak">駐榜狀態</div>
      <div class="rh-col rh-commander">戰區指揮官</div>
      <div class="rh-col rh-flagship" title="公開主力旗艦"><span class="rh-icon">🎯</span><span class="rh-text"> 主力旗艦</span></div>
      <div class="rh-col rh-archetype" title="偵察戰術流派"><span class="rh-icon">📡</span><span class="rh-text"> 戰術流派</span></div>
      <div class="rh-col rh-rp">戰略勝點</div>
      <div class="rh-col rh-action">作戰行動</div>
    </div>`;

  try {
    tableBox.innerHTML = headerRowHtml + list.map((u, idx) => {
      try {
        const isMe = u.id === player.id;
        const rankNo = u.rank || (idx + 1);
        const topClass = rankNo === 1 ? 'top-1' : rankNo === 2 ? 'top-2' : rankNo === 3 ? 'top-3' : '';
        const tier = (LadderEngine.getRankTier && LadderEngine.getRankTier(u.rp)) || { name: '作戰少尉', color: '#38bdf8' };
        const streak = u.streakDays || 1;

        const canEngage = isLive && (rankNo < player.rank) && (rankNo >= player.rank - 8);
        const isOverRank = isLive && (rankNo < player.rank - 8);
        const isBeaten = isLive && (rankNo > player.rank);

        let streakBadgeHtml = '';
        if (streak >= 5) {
          streakBadgeHtml = `<span class="r-streak-tag top" title="霸榜 ${streak} 天！擊敗可獲終結者超額獎勵">👑 霸榜 ${streak} 天</span>`;
        } else if (streak >= 3) {
          streakBadgeHtml = `<span class="r-streak-tag high" title="頑強守位 ${streak} 天！擊敗可獲終結者超額獎勵">🛡️ 守位 ${streak} 天</span>`;
        } else if (streak >= 2) {
          streakBadgeHtml = `<span class="r-streak-tag mid">🛡️ 守位 ${streak} 天</span>`;
        } else {
          streakBadgeHtml = `<span class="r-streak-tag new">🔥 今日新晉</span>`;
        }

        const userDeck = u.deck || u.defenseDeck || (isMe ? (player.defenseDeck || state.deck) : []);

        let actionColHtml = '';
        if (isMe) {
          actionColHtml = `<span class="r-action-pill you"><span class="r-action-ico">📍</span><span class="r-action-txt">我方作戰群</span></span>`;
        } else if (canEngage) {
          const delta = player.rank - rankNo;
          const tierInfo = (LadderEngine.getTargetTierInfo && LadderEngine.getTargetTierInfo(delta)) || {
            name: delta >= 7 ? '強攻' : delta >= 5 ? '進取' : '穩健',
            icon: delta >= 7 ? '🔥' : delta >= 5 ? '⚔️' : '🛡️',
            baseRP: delta >= 7 ? 30 : delta >= 5 ? 22 : 15,
            btnClass: delta >= 7 ? 'btn-tier-assault' : delta >= 5 ? 'btn-tier-aggressive' : 'btn-tier-steady'
          };
          actionColHtml = `<button class="btn-ladder-engage ${tierInfo.btnClass}" data-target-rank="${rankNo}" data-target-id="${u.id}" title="${tierInfo.name}目標：超越 ${delta} 席，獲勝基礎 +${tierInfo.baseRP} RP${streak >= 3 ? '，含終結者 +15 RP！' : ''}">
            <span class="btn-tier-label"><span class="r-action-ico">${tierInfo.icon}</span><span class="r-action-txt">${tierInfo.name}</span></span>
            <span class="btn-tier-val">+${tierInfo.baseRP}</span>
            ${streak >= 3 ? '<b class="breaker-dot" title="連霸≥3天 終結者加成">+15</b>' : ''}
          </button>`;
        } else if (isOverRank) {
          actionColHtml = `<span class="r-action-pill locked" title="階梯限制：僅可挑戰前方 8 席以內之目標"><span class="r-action-ico">🔒</span><span class="r-action-txt">跨級鎖定</span></span>`;
        } else if (isBeaten) {
          actionColHtml = `<span class="r-action-pill beaten"><span class="r-action-ico">✓</span><span class="r-action-txt">已超越</span></span>`;
        } else {
          actionColHtml = `<span class="r-action-pill locked"><span class="r-action-ico">📜</span><span class="r-action-txt">榮譽封存</span></span>`;
        }

        const flagshipUnit = UNIT_MAP[(userDeck || [])[0]];
        const rawFlagshipName = flagshipUnit ? flagshipUnit.name : '未知旗艦';
        const cleanFlagshipName = rawFlagshipName
          .replace(/\s*[\(（][^\)）]*[\)）]/g, '')
          .replace(/\s+Block\s+\d+/gi, '')
          .replace(/\s+NG$/i, '')
          .replace(/\s+現代化改|\s+升級型/g, '')
          .trim();

        const rowArch = typeof analyzeDeckArchetype === 'function'
          ? analyzeDeckArchetype(userDeck || [])
          : { icon: '🎖️', name: '均衡聯合作戰流' };

        const flagshipThumbHtml = flagshipUnit
          ? `<div class="recon-flagship-thumb" title="${esc(rawFlagshipName)} ($${flagshipUnit.cost})">
               <img src="${flagshipUnit.img || `assets/units/${flagshipUnit.id}.jpg`}" alt="${esc(rawFlagshipName)}" onerror="this.style.display='none'"/>
               <span class="chip-cost">$${flagshipUnit.cost}</span>
             </div>`
          : `<div class="recon-flagship-thumb"><span class="chip-mask-q">?</span></div>`;

        const flagshipColHtml = `
          <div class="r-flagship-col" title="${isMe ? '我方主力旗艦' : '公開主力旗艦'}：${esc(rawFlagshipName)} ($${flagshipUnit ? flagshipUnit.cost : '?'})">
            ${flagshipThumbHtml}
            <div class="flagship-info-box">
              <span class="flagship-name">${esc(cleanFlagshipName)}</span>
            </div>
          </div>`;

        const archetypeColHtml = `
          <div class="r-archetype-col" title="偵察戰術流派：${esc(rowArch.name)}">
            <span class="archetype-pill">
              <span class="arch-icon">${rowArch.icon}</span>
              <span class="arch-name">${esc(rowArch.name)}</span>
            </span>
          </div>`;

        const cleanTitle = (u.title || '戰區指揮官')
          .replace('戰備全域巡航防線', '全域巡航防線')
          .replace('峽灣隱匿快速防衛', '峽灣隱匿防衛');
        const docObj = (typeof DOCTRINES !== 'undefined' && DOCTRINES.find(d => d.id === (u.defenseDoc || u.doc || 'defense'))) || (typeof DOCTRINES !== 'undefined' ? DOCTRINES[1] : { icon: '🛡️', name: '縱深防禦' });
        const subLineHtml = isMe
          ? `<b style="color:${tier.color}">${tier.name}</b> · <span style="color:var(--cyan);font-weight:700" title="我方駐防教條">${docObj.icon} ${docObj.name}</span>`
          : `<b style="color:${tier.color}">${tier.name}</b> · <span>${esc(cleanTitle)}</span>`;

        return `<div class="roster-row ${isMe ? 'is-me' : ''} ${topClass} ${canEngage ? 'engageable' : ''}">
          <div class="r-rank">${rankNo <= 3 ? ['🥇','🥈','🥉'][rankNo - 1] : '#' + rankNo}</div>
          <div class="r-streak">${streakBadgeHtml}</div>
          <div class="r-commander">
            <span class="r-flag">${u.flag || '🏳️'}</span>
            <div class="r-name-block">
              <span class="r-name" title="${esc(u.name || '作戰官')}">${esc(u.name || '作戰官')} ${isMe ? `<span class="r-my-tag" title="指揮官暱稱 ${esc(u.uid || player.uid || 'CMD-7392')}">我方</span>` : ''}</span>
              <span class="r-title-sub">${subLineHtml}</span>
            </div>
          </div>
          ${flagshipColHtml}
          ${archetypeColHtml}
          <div class="r-rp">${(u.rp || 0).toLocaleString()} <small>RP</small></div>
          <div class="r-action">${actionColHtml}</div>
        </div>`;
      } catch (rowErr) {
        console.error('Error rendering row:', rowErr);
        return '';
      }
    }).join('');
  } catch (tableErr) {
    console.error('Fatal error rendering ladder roster table:', tableErr);
  }
}

// 天梯操作事件代理
// 淘汰錦標賽點擊事件
document.addEventListener('click', e => {
  if (e.target.closest('#btnGoBuildFromTourney')) {
    startTourneyBuild();
  }
});

$('#viewLadder')?.addEventListener('click', e => {
  // 0. 切換天梯駐防 AI 戰術教條
  const defDocBtn = e.target.closest('[data-def-doc]');
  if (defDocBtn) {
    const newDoc = defDocBtn.dataset.defDoc;
    const lState = LadderEngine.getState();
    const curDeck = lState.player.defenseDeck || (state.deck.every(Boolean) ? state.deck : ['F16V', 'M1A2', 'NASAMS', 'TJ', 'TB2']);
    LadderEngine.setDefenseFleet(curDeck, newDoc);
    renderLadderView();
    const dObj = DOCTRINES.find(d => d.id === newDoc);
    toast(`🛡️ 已將天梯駐防 AI 戰術教條切換為：【${dObj ? dObj.icon + ' ' + dObj.name : newDoc}】！`);
    return;
  }

  // 0.5 一鍵跳轉至戰備指揮所 (調整天梯出征與防守編制)
  if (e.target.closest('#btnGoBuildFromLadder')) {
    startLadderBuild();
    return;
  }

  // 1. 同步當前陣容為特遣部隊 (已由調配陣容全自動接管)

  // 2. 切換即時榜 vs 戰區席位 vs 昨日榮譽榜
  if (e.target.closest('#tabRosterZone')) {
    currentRosterTab = 'zone';
    $('#tabRosterZone')?.classList.add('active');
    $('#tabRosterLive')?.classList.remove('active');
    $('#tabRosterYesterday')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }
  if (e.target.closest('#tabRosterLive')) {
    currentRosterTab = 'live';
    $('#tabRosterLive')?.classList.add('active');
    $('#tabRosterZone')?.classList.remove('active');
    $('#tabRosterYesterday')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }
  if (e.target.closest('#tabRosterYesterday')) {
    currentRosterTab = 'yesterday';
    $('#tabRosterYesterday')?.classList.add('active');
    $('#tabRosterLive')?.classList.remove('active');
    $('#tabRosterZone')?.classList.remove('active');
    renderLadderRosterTable();
    return;
  }

  // 2.1 定位我的天梯席位 (#btnScrollToMe)
  if (e.target.closest('#btnScrollToMe')) {
    if (currentRosterTab === 'yesterday') {
      currentRosterTab = 'live';
      $('#tabRosterLive')?.classList.add('active');
      $('#tabRosterZone')?.classList.remove('active');
      $('#tabRosterYesterday')?.classList.remove('active');
      renderLadderRosterTable();
    }
    setTimeout(() => {
      const myRow = document.querySelector('.roster-row.is-me');
      if (myRow) {
        myRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        myRow.classList.remove('highlight-me');
        void myRow.offsetWidth;
        myRow.classList.add('highlight-me');
        setTimeout(() => myRow.classList.remove('highlight-me'), 2500);
        toast(`📍 已精確定位至我方天梯席位 (#${LadderEngine.getState().player.rank})！`);
      } else {
        toast(`📍 我方席位為 #${LadderEngine.getState().player.rank}，已切換顯示！`);
      }
    }, 60);
    return;
  }

  // 3. 發起天梯單列階梯挑戰 (點擊 ⚔️ 挑戰 按鈕)
  const engageBtn = e.target.closest('.btn-ladder-engage');
  if (engageBtn) {
    const targetRank = +engageBtn.dataset.targetRank;
    const targetId = engageBtn.dataset.targetId;
    const lState = LadderEngine.getState();
    const targetUser = lState.roster.find(u => u.rank === targetRank || u.id === targetId);
    if (!targetUser) {
      toast('❌ 目標指揮官資料已過期，請重新整理！');
      return;
    }

    // 檢查防跨級規則 (嚴格檢驗是否在玩家前方 5 名內)
    const pRank = lState.player.rank;
    if (targetUser.rank >= pRank) {
      toast('⚠️ 該名次低於或等於我方當前排名，無需重複挑戰！');
      return;
    }
    if (pRank - targetUser.rank > 8) {
      toast('🔒 階梯交戰守則：僅可挑戰前方 8 席以內之對手（強攻 / 進取 / 穩健）。');
      return;
    }

    if (!state.deck.every(Boolean)) {
      toast('⚠️ 你的出征部隊尚未配置滿 5 個槽位！已切換至戰備調整，完成後將自動發起挑戰。');
      startLadderBuild(targetUser);
      return;
    }

    const playerOrders = lState.player.orders;
    if (playerOrders <= 0) {
      toast('❌ 作戰派遣令已耗盡 (0/30)！每小時整點自動補給 30 次。');
      return;
    }

    // 啟動天梯挑戰！
    state.ladderEnemy = targetUser;
    state.enemy = targetUser.deck.slice();
    state.enemyName = `${targetUser.flag} ${targetUser.name}`;
    state.enemyDoc = targetUser.defenseDoc || targetUser.doc || 'defense';
    state.event = (LadderEngine.getDailyTheater && LadderEngine.getDailyTheater()) || pick(EVENTS);

    // 關閉天梯視圖，切換至對戰視圖開始推演
    $('#viewLadder').hidden = true;
    startBattle();
    toast(`⚔️ 已向第 #${targetUser.rank} 名【${targetUser.name}】發起突擊！戰區：【${state.event.icon} ${state.event.name}】`);
    return;
  }

  // 4. 自訂指揮官暱稱與旗幟
  if (e.target.closest('#btnEditCallsign') || e.target.closest('#myCallsign')) {
    openCommanderModal();
    return;
  }
});

/* ---------- 🎖️ 程序化軍規暱稱生成矩陣 (超過 300 萬種戰術組合，保證 100% 零重複) ---------- */
const CALLSIGN_PREFIXES = [
  '黑貓', '海狼', '雷霆', '幽靈', '長弓', '天弓', '神盾', '深淵', '極光', '暴風',
  '戰隼', '赤焰', '遊騎', '堡壘', '鐵騎', '蒼穹', '白虎', '玄武', '刺客', '影狼',
  '烈陽', '夜梟', '破浪', '幻影', '龍騎', '星芒', '獵豹', '黑曜', '蒼鷹', '紫電',
  '天火', '鋼雨', '怒濤', '逆火', '追風', '迅雷', '鋒刃', '天狼', '雄鷹', '劍齒'
];
const CALLSIGN_TYPES = [
  '匿蹤', '夜襲', '重裝', '制空', '特勤', '防空', '反潛', '電磁', '機動', '突擊',
  '戰術', '快反', '先鋒', '縱深', '伏擊', '海巡', '衛戍', '偵搜', '穿甲', '防衛'
];
const CALLSIGN_ECHELONS = [
  '特遣隊', '作戰群', '打擊旅', '先鋒營', '特巡連', '突擊隊', '巡防大隊', '中隊', '第7聯隊', '防衛軍'
];

function generateProceduralCallsign(existingNames = []) {
  const existingSet = new Set((existingNames || []).map(n => (n || '').trim()));
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)];
    const t = CALLSIGN_TYPES[Math.floor(Math.random() * CALLSIGN_TYPES.length)];
    const e = CALLSIGN_ECHELONS[Math.floor(Math.random() * CALLSIGN_ECHELONS.length)];
    const candidate = `${p}${t}${e}`;
    if (!existingSet.has(candidate) && (typeof LadderEngine === 'undefined' || !LadderEngine.isCallsignTaken || !LadderEngine.isCallsignTaken(candidate, true))) {
      return candidate;
    }
  }
  const num = Math.floor(10 + Math.random() * 90);
  return `${CALLSIGN_PREFIXES[Math.floor(Math.random() * CALLSIGN_PREFIXES.length)]}第${num}特遣隊`;
}

let selectedFlag = '🇹🇼';


/* 即時驗證使用者輸入的作戰暱稱 (檢查長度、保留字與名稱是否與現役席次重複) */
function checkCallsignInputValidity() {
  const input = $('#commanderNameInput');
  const feedback = $('#callsignFeedback');
  const saveBtn = $('#commanderSave');
  if (!input || !feedback) return false;

  const val = input.value.trim();
  const p = LadderEngine.getState().player;
  const pUid = p.uid || LadderEngine.getPlayerUID();

  if (!val) {
    feedback.className = 'callsign-feedback invalid';
    feedback.innerHTML = '⚠️ 請輸入 2 ~ 16 字元的作戰部隊暱稱！';
    input.classList.add('input-error');
    if (saveBtn) saveBtn.disabled = true;
    return false;
  }

  // 若與自身目前的名稱完全相同，提示維持現狀並允許保存
  if (val === p.name) {
    feedback.className = 'callsign-feedback unchanged';
    feedback.innerHTML = `ℹ️ 目前暱稱已對應綁定專屬軍籍編號 [<b>${pUid}</b>]`;
    input.classList.remove('input-error');
    if (saveBtn) saveBtn.disabled = false;
    return true;
  }

  // 調用 LadderEngine 全域名稱唯一性校驗
  const valid = LadderEngine.validateCallsign(val);
  if (!valid.ok) {
    feedback.className = 'callsign-feedback invalid';
    feedback.innerHTML = `❌ ${valid.reason}`;
    input.classList.add('input-error');
    if (saveBtn) saveBtn.disabled = true;
    return false;
  }

  // 驗證通過：名稱唯一且符合軍規
  feedback.className = 'callsign-feedback valid';
  feedback.innerHTML = `✅ 暱稱可用！確認後將與軍籍編號 [<b>${pUid}</b>] 永久綁定`;
  input.classList.remove('input-error');
  if (saveBtn) saveBtn.disabled = false;
  return true;
}

function openCommanderModal() {
  openCloudSyncModal();
  const p = LadderEngine.getState().player;
  const pUid = p.uid || LadderEngine.getPlayerUID();
  const modal = $('#commanderModal');
  if (!modal) return;
  currentActiveModal = $('#cloudSyncModal');

  // 1. 填入專屬軍籍 UID (不可變)
  const idDisplay = $('#commanderIdDisplay');
  if (idDisplay) idDisplay.textContent = pUid;

  // 2. 填入目前暱稱與旗幟
  const nameInput = $('#commanderNameInput');
  if (nameInput) {
    if (!p.hasCustomName || !p.name || p.name === '我方聯合戰術作戰群' || p.name === '我方特遣隊') {
      nameInput.value = generateProceduralCallsign();
    } else {
      nameInput.value = p.name;
    }
    nameInput.classList.remove('input-error');
  }
  selectedFlag = p.flag || '🇹🇼';

  document.querySelectorAll('.flag-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.flag === selectedFlag);
  });

  // 3. 執行初始驗證狀態反饋
  checkCallsignInputValidity();

  modal.hidden = false;
  setTimeout(() => {
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }, 100);
}

// 綁定 commanderModal 互動
$('#flagPickerRow')?.addEventListener('click', e => {
  const btn = e.target.closest('.flag-opt');
  if (!btn) return;
  selectedFlag = btn.dataset.flag;
  document.querySelectorAll('.flag-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

// 即時輸入重複性檢驗監聽
$('#commanderNameInput')?.addEventListener('input', () => {
  checkCallsignInputValidity();
});

// 🎲 隨機暱稱 (智慧過濾已被佔用的暱稱，保證產出絕對可用)
$('#btnRandomCallsign')?.addEventListener('click', () => {
  const rName = generateProceduralCallsign();
  const input = $('#commanderNameInput');
  if (input) {
    input.value = rName;
    checkCallsignInputValidity();
  }
});

// 📋 複製軍籍編號 (UID)
$('#btnCopyCommanderId')?.addEventListener('click', () => {
  const p = LadderEngine.getState().player;
  const uid = p.uid || LadderEngine.getPlayerUID();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(uid).then(() => {
      toast(`📋 軍籍指戰編號 [${uid}] 已複製到剪貼簿！`);
    }).catch(() => {
      toast(`📋 指戰編號: ${uid}`);
    });
  } else {
    toast(`📋 指戰編號: ${uid}`);
  }
});

$('#commanderCancel')?.addEventListener('click', () => {
  $('#commanderModal').hidden = true;
  openCloudSyncModal();
});

$('#commanderSave')?.addEventListener('click', () => {
  const val = ($('#commanderNameInput')?.value || '').trim();
  if (!checkCallsignInputValidity()) {
    toast('⚠️ 暱稱格式不合規或已被現有席次佔用，請重新命名！');
    return;
  }
  const result = LadderEngine.setPlayerProfile(val, selectedFlag);
  if (!result || !result.success) {
    toast(`⚠️ 任命失敗：${(result && result.reason) || '未知錯誤'}`);
    checkCallsignInputValidity();
    return;
  }
  localStorage.setItem('topwarlords_callsign_set', '1');
  localStorage.setItem('topwarlords_auto_callsign', result.name);
  playerGhost.callsign = result.name;
  playerGhost.flag = selectedFlag;
  LS.set('wl15_player_ghost', playerGhost);
  $('#commanderModal').hidden = true;
  CloudSync.scheduleSync();
  renderLadderView();
  renderHud();
  if (state.mode === 'tournament') {
    renderTournamentView();
  }
  openCloudSyncModal();
  toast(`🎖️ 戰術任命狀已頒布！指揮官【${selectedFlag} ${result.name}】(${result.uid}) 正式進駐戰區！`);
});

function prune() {
  while (spent() > budgetLimit()) {
    const idx = state.deck.map((id, i) => id ? i : -1).filter(i => i >= 0).sort((a, b) => UNIT_MAP[state.deck[b]].cost - UNIT_MAP[state.deck[a]].cost)[0];
    if (idx >= 0) state.deck[idx] = null;
    else break;
  }
}

/* ---------- 幽靈部隊部署 Modal ---------- */
function openDeployGhostModal() {
  $('#ghostCallsignInput').value = playerGhost.callsign;
  $('#ghostMottoInput').value = '立足國防，誓死捍衛！';
  $('#ghostDeployPreview').innerHTML = `<div class="ghost-card">
    <div class="ghost-top"><b>${esc(playerGhost.callsign)}</b><span class="ghost-rank">${playerGhost.rankTitle} · ${playerGhost.rp} RP</span></div>
    <div class="ghost-deck">${state.deck.map(id => `<span class="ghost-u" style="color:${CATS[UNIT_MAP[id].cat].color}">$${UNIT_MAP[id].cost} ${esc(UNIT_MAP[id].name)}</span>`).join('')}</div>
  </div>`;
  $('#ghostDeployModal').hidden = false;
}
$('#ghostDeployCancel').onclick = () => { $('#ghostDeployModal').hidden = true; };
$('#ghostDeployOk').onclick = () => {
  const callsign = $('#ghostCallsignInput').value.trim() || '無名指揮官';
  const motto = $('#ghostMottoInput').value.trim() || '立足國防，寸步不讓！';
  playerGhost.callsign = callsign;
  playerGhost.myGhostDeck = state.deck.slice();
  LS.set('wl15_player_ghost', playerGhost);
  const pool = getGhostPool();
  const existingIdx = pool.findIndex(g => g.isUser);
  const myGhost = {
    id: 'user_ghost_' + Date.now(),
    callsign, title: playerGhost.rankTitle, rating: playerGhost.rp,
    wins: playerGhost.wins, losses: playerGhost.losses,
    deck: state.deck.slice(), doctrine: state.doctrine,
    motto, isUser: true
  };
  if (existingIdx >= 0) pool[existingIdx] = myGhost;
  else pool.unshift(myGhost);
  saveGhostPool(pool);
  if (typeof LadderEngine !== 'undefined' && LadderEngine.setDefenseFleet) {
    LadderEngine.setDefenseFleet(state.deck.slice(), state.doctrine);
  }
  $('#ghostDeployModal').hidden = true;
  renderAll();
  toast('🎉 成功部署防守部隊至全球幽靈防衛庫！');
};

// Code modal listeners removed (code/presets feature deprecated)
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(() => {});
  else { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); }
}

/* ---------- 沙盒大數據模擬系統 (Sandbox 300 Simulation Engine) ---------- */
function runSandbox() {
  const deck = state.deck.slice();
  const errs = validateDeck(deck, budgetLimit(), currentBanned());
  if (errs.length > 0) {
    toast('⚠️ 陣容未就緒：' + (errs[0] || '請先組建合法的 5 槽陣容再啟動模擬'));
    return;
  }

  // 1. 取得對手風格群（支援指定對戰敵方陣容 custom_enemy）
  const enemySource = (state.sandEnemy === 'custom_enemy') ? (state.customSandEnemy || state.lastBattleEnemy) : null;
  const isCustomEnemy = enemySource && Array.isArray(enemySource.deck) && enemySource.deck.length === 5;
  const archs = isCustomEnemy
    ? [{ id: 'custom_enemy', name: `指定敵陣 (${enemySource.name})`, customDeck: enemySource.deck, customDoc: enemySource.doc }]
    : (state.sandEnemy === 'random' ? ARCHETYPES : [ARCHETYPES.find(a => a.id === state.sandEnemy)].filter(Boolean));
  const targetRuns = 300;
  const per = Math.ceil(targetRuns / archs.length);

  const total = {
    n: 0,
    win: 0,
    lose: 0,
    draw: 0,
    sumA: 0,
    sumB: 0,
    byEvent: {},
    byArch: {}
  };

  EVENTS.forEach(e => {
    total.byEvent[e.id] = { win: 0, lose: 0, draw: 0, n: 0, name: e.name, icon: e.icon };
  });
  archs.forEach(a => {
    total.byArch[a.id] = { win: 0, lose: 0, draw: 0, n: 0, name: a.name };
  });

  const baseSeed = (Date.now() ^ (Math.random() * 4294967296)) >>> 0;

  archs.forEach((a, k) => {
    const enemyDeck = a.customDeck ? a.customDeck.slice() : buildFromPlan(a.plan, mulberry32(baseSeed + k * 17 + 3));
    const eventTarget = (state.sandEvent === 'all') 
      ? null 
      : (state.sandEvent === 'last_event' && enemySource && enemySource.event)
        ? enemySource.event
        : (EVENTS.find(e => e.id === state.sandEvent) || null);

    const r = simulate(deck, enemyDeck, per, {
      docA: state.doctrine,
      docB: a.customDoc || null,
      seed: (baseSeed + k * 997) >>> 0,
      event: eventTarget
    });

    ['n', 'win', 'lose', 'draw', 'sumA', 'sumB'].forEach(f => {
      total[f] += r[f];
    });

    total.byArch[a.id].win += r.win;
    total.byArch[a.id].lose += r.lose;
    total.byArch[a.id].draw += r.draw;
    total.byArch[a.id].n += r.n;

    EVENTS.forEach(e => {
      if (r.byEvent[e.id]) {
        total.byEvent[e.id].win += r.byEvent[e.id].win;
        total.byEvent[e.id].n += r.byEvent[e.id].n;
      }
    });
  });

  state.sandResult = total;
  showSandboxModal(total);
}

function showSandboxModal(res) {
  const modal = $('#sandboxModal');
  const card = $('#sandboxCard');
  if (!modal || !card) return;

  const total = res.n || 1;
  const winRate = ((res.win / total) * 100).toFixed(1);
  const loseRate = ((res.lose / total) * 100).toFixed(1);
  const drawRate = ((res.draw / total) * 100).toFixed(1);
  const avgVpA = (res.sumA / total).toFixed(1);
  const avgVpB = (res.sumB / total).toFixed(1);

  // 綜合戰略評級 (Grade)
  let grade = 'B', gradeTitle = '戰 術 均 勢', gradeDesc = '與主流陣容互有勝負，建議針對弱點調整配件', gradeClass = 'grade-b';
  const numWinRate = parseFloat(winRate);
  if (numWinRate >= 70) {
    grade = 'S';
    gradeTitle = '戰 略 霸 權';
    gradeDesc = '大數據展現壓倒性勝率，具備強大泛用統治力';
    gradeClass = 'grade-s';
  } else if (numWinRate >= 55) {
    grade = 'A';
    gradeTitle = '優 勢 陣 容';
    gradeDesc = '整體戰術穩定克敵，大部分地形皆能佔據主動';
    gradeClass = 'grade-a';
  } else if (numWinRate >= 45) {
    grade = 'B';
    gradeTitle = '勢 均 力 敵';
    gradeDesc = '抗衡主流戰術，勝負取決於戰場隨機事件與臨場教條';
    gradeClass = 'grade-b';
  } else {
    grade = 'C';
    gradeTitle = '風 險 陣 容';
    gradeDesc = '抗壓能力受限，在特定極端環境中容易被強勢克制';
    gradeClass = 'grade-c';
  }

  // 陣容簡要
  const currentDoc = DOCTRINES.find(d => d.id === state.doctrine) || DOCTRINES[0];

  // 分析最強環境與最弱環境
  const evArr = Object.values(res.byEvent).filter(e => e.n > 0);
  evArr.sort((a, b) => (b.win / b.n) - (a.win / a.n));
  const bestEvent = evArr[0];
  const worstEvent = evArr[evArr.length - 1];

  // 分析最克制風格與最苦手風格
  const archArr = Object.values(res.byArch).filter(a => a.n > 0);
  archArr.sort((a, b) => (b.win / b.n) - (a.win / a.n));
  const bestArch = archArr[0];
  const worstArch = archArr[archArr.length - 1];

  card.innerHTML = `
    <button class="modal-x" id="sandCloseX" title="關閉大數據報告">✕</button>

    <!-- 頂部旗艦級橫幅 -->
    <div class="aar-header ${numWinRate >= 50 ? 'win' : 'lose'}" style="margin-bottom:14px">
      <div class="aar-grade-badge ${gradeClass}">
        <span class="grade-char">${grade}</span>
        <span class="grade-label">SIM-META</span>
      </div>
      <div class="aar-title-group">
        <div class="aar-meta-row">
          <span class="aar-mode-tag">⚡ MONTE CARLO · 蒙地卡羅大數據</span>
          <span class="aar-env-tag">已完成 ${res.n} 場模擬推演 · 採用【${esc(currentDoc.name)}】教條</span>
          <span class="mission-tag" style="font-size:11px;color:${state.sandEnemy === 'custom_enemy' ? 'var(--cyan)' : 'var(--amber)'};border-color:currentColor">
            ${state.sandEnemy === 'custom_enemy' ? '🎯 指定單一對手專項反制' : '🌐 全天候 6 大流派 Meta 壓力盲測'}
          </span>
        </div>
        <h2 class="aar-main-title">${gradeTitle} · 總勝率 ${winRate}%</h2>
        <div class="aar-sub-desc">${gradeDesc}</div>
      </div>
    </div>

    <!-- 核心數據 KPI 看板 -->
    <div class="sand-kpi-grid">
      <div class="sand-kpi-card highlight">
        <div class="sand-kpi-lbl">整體作戰勝率</div>
        <div class="sand-kpi-val ${numWinRate >= 50 ? 'green' : 'amber'}">${winRate}%</div>
        <div class="sand-kpi-sub">300 局確定性種子迭代</div>
      </div>
      <div class="sand-kpi-card">
        <div class="sand-kpi-lbl">戰績分佈統計</div>
        <div class="sand-record-pills">
          <span class="sand-pill win"><b>${res.win}</b> 勝</span>
          <span class="sand-pill lose"><b>${res.lose}</b> 敗</span>
          <span class="sand-pill draw"><b>${res.draw}</b> 平</span>
        </div>
        <div class="sand-kpi-sub">勝 ${winRate}% · 負 ${loseRate}% · 平 ${drawRate}%</div>
      </div>
      <div class="sand-kpi-card">
        <div class="sand-kpi-lbl">雙方平均戰略積分 (VP)</div>
        <div class="sand-kpi-val cyan">${avgVpA} <small style="font-size:12px;color:var(--muted)">vs</small> <span style="color:var(--red)">${avgVpB}</span></div>
        <div class="sand-kpi-sub">友軍平均 VP 領先 ${(avgVpA - avgVpB).toFixed(1)} 分</div>
      </div>
    </div>

    <!-- 雙欄進度分析：左側戰場環境適性 + 右側敵方風格抗性 -->
    <div class="sand-breakdown-grid">
      <!-- 戰場環境表現 -->
      <div class="sand-panel">
        <div class="sand-panel-head">
          <span>🌍 戰場環境適性矩陣</span>
          <small class="muted">各事件輪替 ${evArr[0]?.n || 0} 場</small>
        </div>
        <div class="sand-bar-list">
          ${evArr.map(e => {
            const wr = e.n > 0 ? Math.round((e.win / e.n) * 100) : 0;
            const barCol = wr >= 60 ? 'var(--green)' : wr >= 45 ? 'var(--cyan)' : wr >= 35 ? 'var(--amber)' : 'var(--red)';
            return `
              <div class="sand-bar-row">
                <div class="sand-bar-info">
                  <span class="sand-bar-name">${e.icon} ${esc(e.name)}</span>
                  <span class="sand-bar-num" style="color:${barCol}">${wr}% (${e.win}/${e.n})</span>
                </div>
                <div class="sand-bar-track">
                  <div class="sand-bar-fill" style="width:${wr}%;background:${barCol}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 敵方 AI 風格克制抗性 -->
      <div class="sand-panel">
        <div class="sand-panel-head">
          <span>⚔️ 假想敵風格克制分析</span>
          <small class="muted">對決主流戰術流派</small>
        </div>
        <div class="sand-bar-list">
          ${archArr.map(a => {
            const wr = a.n > 0 ? Math.round((a.win / a.n) * 100) : 0;
            const barCol = wr >= 60 ? 'var(--green)' : wr >= 45 ? 'var(--cyan)' : wr >= 35 ? 'var(--amber)' : 'var(--red)';
            return `
              <div class="sand-bar-row">
                <div class="sand-bar-info">
                  <span class="sand-bar-name">🎯 ${esc(a.name)}</span>
                  <span class="sand-bar-num" style="color:${barCol}">${wr}% (${a.win}/${a.n})</span>
                </div>
                <div class="sand-bar-track">
                  <div class="sand-bar-fill" style="width:${wr}%;background:${barCol}"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- 參謀本部戰略綜合診斷 -->
    <div class="sand-debrief-box">
      <div class="sand-debrief-title">💡 參謀本部大數據戰略診斷 (STRATEGIC INSIGHTS)</div>
      <div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.5;background:rgba(255,255,255,0.03);border:1px solid var(--line2)">
        ${state.sandEnemy === 'custom_enemy'
          ? '🎯 <b>專項對決模式</b>：本測試針對【' + esc((state.customSandEnemy || state.lastBattleEnemy)?.name || '指定假想敵') + '】進行 300 場確定性迭代，排除單場暴擊或閃避波動，反映點對點真實剋制勝率。'
          : '🌐 <b>全天候 Meta 壓力測試說明</b>：大數據推演會在 300 場中輪番經受 6 大極端氣候地形與 6 種不同假想敵流派（重裝、空優、刺蝟、電戰等）考驗。若陣容偏向特定戰術，在天敵流派與劣勢地形下勝率會受到壓制，因此<b>全天候綜合勝率通常會低於針對單一對手的實戰勝率</b>。若欲驗證剛才快速對戰的點對點勝率，可於上方切換對手為「🎯 最近對戰敵陣」。'}
      </div>
      <ul class="aar-debrief-list">
        ${bestEvent ? `
          <li class="d-good">
            <span class="d-bullet">✔</span>
            <span><b>最佳戰場優勢</b>：此陣容在【${bestEvent.icon} ${esc(bestEvent.name)}】表現最為強勁，勝率達 <b>${Math.round((bestEvent.win / bestEvent.n) * 100)}%</b>，部隊裝備與環境特性具備高度綜效。</span>
          </li>
        ` : ''}
        ${worstEvent && worstEvent !== bestEvent ? `
          <li class="${(worstEvent.win / worstEvent.n) < 0.45 ? 'd-bad' : 'd-neutral'}">
            <span class="d-bullet">${(worstEvent.win / worstEvent.n) < 0.45 ? '⚠' : 'ℹ'}</span>
            <span><b>環境適應警報</b>：在【${worstEvent.icon} ${esc(worstEvent.name)}】勝率降至 <b>${Math.round((worstEvent.win / worstEvent.n) * 100)}%</b>，面對該地形的特殊修正易處於火力劣勢。</span>
          </li>
        ` : ''}
        ${bestArch ? `
          <li class="d-good">
            <span class="d-bullet">🎯</span>
            <span><b>戰術克制掌握</b>：對戰【${esc(bestArch.name)}】具備壓制性優勢 (勝率 <b>${Math.round((bestArch.win / bestArch.n) * 100)}%</b>)。</span>
          </li>
        ` : ''}
        ${worstArch && worstArch !== bestArch ? `
          <li class="d-bad">
            <span class="d-bullet">🛡️</span>
            <span><b>潛在克制對手</b>：對陣【${esc(worstArch.name)}】遭遇較大阻力 (勝率僅 <b>${Math.round((worstArch.win / worstArch.n) * 100)}%</b>)，建議微調單位配比或更換戰術教條。</span>
          </li>
        ` : ''}
      </ul>
    </div>

    <!-- 底部行動指令列 -->
    <div class="aar-actions" style="margin-top:14px">
      <button class="btn primary aar-btn-main" id="sandRerun">⚡ 重新迭代 300 場模擬</button>
      <button class="btn ghost" id="sandCopyReport">📋 複製大數據評測結果</button>
      <button class="btn ghost" id="sandToBattle">⚔️ 以此陣容開戰一場</button>
      <button class="btn ghost" id="sandClose">返回調整陣容</button>
    </div>
  `;

  modal.hidden = false;

  // 事件綁定
  const closeModal = () => { modal.hidden = true; };
  $('#sandClose').onclick = closeModal;
  $('#sandCloseX').onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };

  $('#sandRerun').onclick = () => {
    toast('⚡ 正在運行新種子 300 場蒙地卡羅推演...');
    setTimeout(runSandbox, 50);
  };

  $('#sandCopyReport').onclick = () => {
    const text = `【頂尖對戰：15元聯合作戰 - 300場大數據沙盒評測報告】\\n` +
      `陣容代碼：${encodeDeck(state.deck)}\\n` +
      `戰術教條：${currentDoc.name}\\n` +
      `綜合勝率：${winRate}% (${res.win}勝 / ${res.lose}敗 / ${res.draw}平)\\n` +
      `平均積分：友軍 ${avgVpA} VP vs 敵軍 ${avgVpB} VP\\n` +
      `最佳戰場：${bestEvent?.name} (${Math.round((bestEvent?.win / bestEvent?.n) * 100)}%)\\n` +
      `最克制風格：${bestArch?.name} (${Math.round((bestArch?.win / bestArch?.n) * 100)}%)`;
    navigator.clipboard.writeText(text).then(() => {
      toast('📋 已複製 300 場大數據評測報告至剪貼簿！');
    }).catch(() => {
      toast('代碼：' + encodeDeck(state.deck));
    });
  };

  $('#sandToBattle').onclick = () => {
    modal.hidden = true;
    startBattle();
  };
}

/* ---------- 戰鬥啟動 ---------- */
function startBattle() {
  if (state.mode === 'bo3' && state.bo3 && state.bo3.finished) {
    showBo3SeriesResult(state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB);
    return;
  }
  const deck = state.deck.slice();
  if (validateDeck(deck, budgetLimit(), currentBanned()).length) return;
  if (!LS.get('wl15_onboard_done', false)) {
    state.forceShowOnboard = false;
    LS.set('wl15_onboard_done', true);
    const ob = $('#onboardCoachBar');
    if (ob) ob.hidden = true;
  }
  if (state.mode === 'bo3' && state.bo3) {
    state.bo3.locked = true;
    updateRerollMarketButtonState();
  }
  const seed = state.mode === 'daily' ? hashStr(dateKey() + deck.join('.') + state.doctrine) : (Math.random() * 4294967296) >>> 0;
  const res = resolveBattle(deck, state.enemy, { seed, event: state.event, docA: state.doctrine, docB: state.enemyDoc });
  state.lastRes = res;
  if (state.enemy && state.enemy.length === 5) {
    state.lastBattleEnemy = {
      name: state.enemyName || '最近交鋒對手',
      deck: state.enemy.slice(),
      doc: state.enemyDoc || 'defense',
      event: state.event || null
    };
  }
  showBattle(res);
}

function teamHtml(units, side, docId) {
  const totalCost = units.reduce((sum, u) => {
    const c = u.cost !== undefined ? u.cost : (UNIT_MAP[u.id]?.cost || 0);
    return sum + Number(c);
  }, 0);

  const costColor = (side === 'B' && totalCost > 15)
    ? (totalCost >= 25 ? '#ff3b30' : 'var(--amber)')
    : (side === 'B' ? 'var(--red)' : 'var(--cyan)');

  const budgetLabel = (side === 'B' && totalCost > 15)
    ? `$${totalCost} BUDGET · 超標 +$${totalCost - 15}`
    : `$${totalCost} BUDGET`;

  let titleHtml = '';
  if (state.isOnlinePvp) {
    const isHost = OnlinePvPEngine.isHostUser();
    const opp = OnlinePvPEngine.getOpponent();
    const player = LadderEngine.getState().player;
    const myName = (player && player.name && player.name !== '我方聯合戰術作戰群') ? player.name : (isHost ? '本部特遣隊' : '挑戰突擊隊');
    const myFlag = player?.flag || '🇹🇼';
    const oppName = (opp && opp.name && opp.name !== '我方聯合戰術作戰群') ? opp.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
    const oppFlag = opp?.flag || '🌐';

    if (side === 'A') {
      // 本部特遣隊在左 (Side A)
      titleHtml = isHost
        ? `👑 本部特遣隊 (我方) ▸ ${myFlag} ${esc(myName)}`
        : `👑 本部特遣隊 (敵方) ▸ ${oppFlag} ${esc(oppName)}`;
    } else {
      // 挑戰突擊隊在右 (Side B)
      titleHtml = isHost
        ? `🎯 挑戰突擊隊 (敵方) ▸ ${oppFlag} ${esc(oppName)}`
        : `🎯 挑戰突擊隊 (我方) ▸ ${myFlag} ${esc(myName)}`;
    }
  } else {
    titleHtml = side === 'A' ? '我 方 ▸ 戰鬥編組' : '敵 方 ▸ ' + esc(state.enemyName || '敵軍特遣部隊');
  }

  const TRAIT_SHORT_MAP = {
    CAS: '🐎蹂躪步陣',
    LR: '🏹百步穿楊',
    HEAVY: '🛡️玄甲鐵壁',
    APS: '⚔️格擋反震',
    AA_LONG: '🎯專克突騎',
    CIWS: '🔥密集弩陣',
    AEGIS: '🏯鐵桶拒馬',
    SUB: '🌊潛行渡江',
    ASW: '🔱水陸搜剿',
    AMBUSH: '🌑奇兵伏擊',
    SWARM: '🔥萬箭連發',
    EW: '📜奇門遁甲',
    SEAD: '⚡破除弓陣',
    DEEP: '🗡️斬將奪旗',
    ARTY: '☄️霹靂火砲',
    SAT: '🔥烈火燎原',
    TRUE_AT: '🪓破甲重擊',
    SPOT: '🚩登高瞭望'
  };

  const mobileTitleHtml = side === 'A' ? '🔵 我方部隊' : '🔴 敵方部隊';
  const mobileBudgetLabel = (side === 'B' && totalCost > 15) ? `$${totalCost} (+$${totalCost - 15})` : `$${totalCost}`;
  const docObj = DOCTRINES.find(x => x.id === docId) || (docId ? { name: docId, icon: '⚔' } : null);
  const docBadgeHtml = docObj ? `<span class="team-h3-doctrine doc-${side.toLowerCase()}" title="${side === 'A' ? '我方' : '敵方'}作戰教條：${esc(docObj.desc || docObj.name)}"><span class="doc-icon">${docObj.icon}</span> <span class="doc-name">${esc(docObj.name)}</span></span>` : '';
  const budgetHtml = `<span class="team-h3-budget" style="font-size:12.5px;font-family:var(--mono);color:${costColor};font-weight:700;flex:none;${side === 'B' ? 'margin-right:6px' : 'margin-left:6px'}" title="${side === 'B' && totalCost > 15 ? '精選對戰超標預算陣容' : '作戰總預算'}"><span class="team-budget-desk">${budgetLabel}</span><span class="team-budget-mob">${mobileBudgetLabel}</span></span>`;
  const metaInnerHtml = side === 'B' ? `${budgetHtml}${docBadgeHtml}` : `${docBadgeHtml}${budgetHtml}`;
  return `<h3><span class="team-h3-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="team-title-desk">${titleHtml}</span><span class="team-title-mob">${mobileTitleHtml}</span></span><span class="team-h3-right-meta">${metaInnerHtml}</span></h3>` + units.map(u => {
    const uData = UNIT_MAP[u.id] || {};
    const catObj = CATS[u.cat] || { short: 'UNIT', label: '作戰單位', color: '#38bdf8' };
    const imgSrc = uData.img || `assets/units/${u.id}.jpg`;
    const vBadge = uData.v ? `${uData.v}型` : '';
    const tagTxt = uData.tag || catObj.label;
    const wpnTxt = uData.weapon || '';
    const atkVal = u.atk ?? uData.atk ?? 0;
    const stVal = u.st ?? uData.st ?? 0;
    const ewVal = u.ew ?? uData.ew ?? 0;
    const traitList = u.traits || uData.traits || [];
    const traitsHtml = traitList.map(t => `<span class="bu-trait-pill" title="${esc(TRAITS[t] || t)}">${TRAIT_SHORT_MAP[t] || t}</span>`).join('');

    return `<div class="bu" id="bu-${u.uid}" data-unit-id="${u.id}" style="--c:${catObj.color}">
      <div class="bu-thumb">
        <img src="${imgSrc}" alt="${esc(u.name)}" loading="eager" />
        <span class="bu-cat-tag" style="background:${catObj.color}">${catObj.short}</span>
      </div>
      <div class="bu-body">
        <div class="bu-row-name">
          <div class="bu-title-group">
            <span class="bu-flag">${uData.flag || ''}</span>
            <span class="bu-name-txt" title="${esc(u.name)}">${esc(u.name)}</span>
          </div>
          <span class="bu-cost">$${u.cost}</span>
        </div>
        <div class="bu-row-wpn" title="${wpnTxt ? '主戰武裝：' + esc(wpnTxt) : ''}">
          <span class="bu-wpn-icon">🎯</span>
          <span class="bu-wpn-txt">${esc(wpnTxt || tagTxt)}</span>
        </div>
        <div class="bu-row-role">
          <span class="bu-role-tag" style="color:${catObj.color}">${esc(tagTxt)}</span>
          <div class="bu-traits-wrap">${traitsHtml}</div>
        </div>
        <div class="bu-row-meta">
          <div class="bu-metrics">
            <span class="bu-m-pill atk" title="攻擊火力 (ATK)">⚔️<b>${atkVal}</b></span>
            <span class="bu-m-pill sth" title="匿蹤與閃避 (STH)">🛡️<b>${stVal}</b></span>
            ${ewVal > 0 ? `<span class="bu-m-pill ew" title="電子戰強度 (EW)">📡<b>${ewVal}</b></span>` : ''}
          </div>
          <div class="bu-hp-num" id="hpt-${u.uid}">HP: ${u.hpMax}<span class="hp-max-part"> / ${u.hpMax}</span></div>
        </div>
      </div>
      <div class="bu-full-hpbar"><u id="hp-${u.uid}"></u></div>
    </div>`;
  }).join('');
}
function setHp(uid, hp, max) {
  if (hp === undefined || isNaN(hp)) return;
  const u = $('#hp-' + uid); if (!u) return;
  const p = max > 0 ? (hp / max) : 0;
  const pct = Math.max(0, Math.min(100, p * 100)) + '%';
  u.style.setProperty('width', pct, 'important');
  u.className = p <= 0 ? 'dead' : p < 0.25 ? 'low' : p < 0.55 ? 'mid' : '';
  const hptEl = $('#hpt-' + uid);
  if (hptEl) hptEl.innerHTML = 'HP: ' + Math.round(Math.max(0, hp)) + '<span class="hp-max-part"> / ' + max + '</span>';
  const row = $('#bu-' + uid);
  if (row && hp <= 0) row.classList.add('dead');
}

/* =====================================================
   左右兩翼全景實況大圖即時切換系統 (Split-Screen Hero Panoramic Engine)
   ===================================================== */
function setSideHero(side, unit, action, subtext) {
  if (!unit) return;
  const img = $('#teamBgImg' + side);
  const nameEl = $('#heroUnitName' + side);
  const statusEl = $('#heroStatus' + side);
  const colEl = $('#team' + side);

  // 1. 本地照片瞬發切換（0 延遲）
  const targetSrc = unit.img || `assets/units/${unit.id}.jpg`;
  if (img) {
    img.src = targetSrc;
  }

  // 2. HUD 軍規浮水印文字
  if (nameEl) {
    nameEl.innerHTML = `<span style="margin-right:4px">${unit.flag || ''}</span> <strong>${esc(unit.name)}</strong>`;
  }
  if (statusEl) {
    if (action === 'fire') {
      statusEl.innerHTML = `<span style="color:#38bdf8;font-weight:700">⚡ [OPEN FIRE] ${esc(subtext || unit.weapon || '火力齊射')}</span>`;
    } else if (action === 'hit') {
      statusEl.innerHTML = `<span style="color:#f43f5e;font-weight:700">💥 [TARGET HIT] ${esc(subtext || '承受打擊')}</span>`;
    } else {
      statusEl.innerHTML = `<span style="color:#94a3b8">📡 [ACTIVE PATROL] ${esc(subtext || '戰場全景巡航')}</span>`;
    }
  }

  // 3. 整側區域高光/震動特效
  if (colEl) {
    const flashClass = action === 'fire' ? 'fire-flash' : 'hit-flash';
    colEl.classList.remove('fire-flash', 'hit-flash');
    void colEl.offsetWidth;
    colEl.classList.add(flashClass);
    setTimeout(() => colEl.classList.remove(flashClass), 350);
  }
}

async function showBattle(res, opts = {}) {
  lastBattleRes = res;
  if (res) res._finished = false;
  const token = ++playToken; skip = false; paused = false;
  document.body.classList.add('in-battle');
  $('#viewBuild').hidden = true;
  $('#missionBar').hidden = true;
  $('#commandDeck').hidden = true;
  const viewLadder = $('#viewLadder'); if (viewLadder) viewLadder.hidden = true;
  const viewTournament = $('#viewTournament'); if (viewTournament) viewTournament.hidden = true;
  hideTooltip();
  $('#viewBattle').hidden = false;
  $('#resultModal').hidden = true;
  if ($('#btnPause')) {
    $('#btnPause').hidden = false;
    $('#btnPause').textContent = '⏸ 暫停';
    $('#btnPause').classList.remove('active');
  }
  $('#btnSpeed').hidden = false;
  $('#btnSpeed').textContent = '速度 ×' + speed;
  $('#btnSkip').hidden = false;
  if ($('#btnBattleReplay')) $('#btnBattleReplay').hidden = true;
  $('#btnReopenResult').hidden = true;
  $('#btnBattleExit').hidden = true;

  const btnBack = $('#btnBattleBack');
  const btnBackTxt = $('#btnBattleBackTxt');
  const btnExitTxt = $('#btnBattleExitTxt');
  if (btnBack) btnBack.hidden = false;
  if (state.mode === 'tournament') {
    if (btnBackTxt) btnBackTxt.textContent = '🏆 返回錦標賽';
    if (btnExitTxt) btnExitTxt.textContent = '🏆 返回錦標賽';
    if (btnBack) { btnBack.className = 'btn amber sm'; btnBack.title = '隨時一鍵返回世界盃淘汰錦標賽對抗樹'; }
  } else if (state.mode === 'ladder') {
    if (btnBackTxt) btnBackTxt.textContent = '🎖️ 返回天梯';
    if (btnExitTxt) btnExitTxt.textContent = '🎖️ 返回天梯';
    if (btnBack) { btnBack.className = 'btn primary sm'; btnBack.title = '隨時返回天梯競技防線'; }
  } else if (state.mode === 'bo3') {
    if (btnBackTxt) btnBackTxt.textContent = '⚔️ 返回鏖戰';
    if (btnExitTxt) btnExitTxt.textContent = '⚔️ 返回鏖戰';
    if (btnBack) { btnBack.className = 'btn amber sm'; btnBack.title = '隨時返回多局鏖戰系列賽'; }
  } else {
    if (btnBackTxt) btnBackTxt.textContent = '✕ 退出演習';
    if (btnExitTxt) btnExitTxt.textContent = '返回陣容編組';
    if (btnBack) { btnBack.className = 'btn ghost sm'; btnBack.title = '退出當前戰術演習'; }
  }
  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
  const radarEl = $('.radar');
  if (radarEl) radarEl.classList.remove('emp-active');

  window.scrollTo({ top: 0 });
  const T = res.final;
  
  // 注入左右部隊卡片列表（注入至 unitsCardList 容器，不覆蓋頂部 team-bg-hud）
  const uBoxA = $('#unitsCardListA') || $('#teamUnitsA');
  const uBoxB = $('#unitsCardListB') || $('#teamUnitsB');
  if (uBoxA) uBoxA.innerHTML = teamHtml(T.A, 'A', res.docs?.A);
  if (uBoxB) uBoxB.innerHTML = teamHtml(T.B, 'B', res.docs?.B);

  // 初始化並載入 3D 古戰場推演沙盤與合戰鼓角配樂
  try {
    if (typeof SoundEngine !== 'undefined') {
      if (typeof SoundEngine.playBgm === 'function') SoundEngine.playBgm('battle');
      if (typeof SoundEngine.play === 'function') SoundEngine.play('battleStart');
    }
    const c3d = $('#battle3DCanvas');
    if (c3d && typeof Battle3DEngine !== 'undefined') {
      Battle3DEngine.init(c3d);
      Battle3DEngine.loadBattle(res);
    }
  } catch (e3d) {
    console.warn('Battle3DEngine init warning:', e3d);
  }

  // 初始化左右全景大圖（預設各取第一順位旗艦裝備）
  const firstA = res.final.A[0], firstB = res.final.B[0];
  const uA = firstA ? UNIT_MAP[firstA.id] : null, uB = firstB ? UNIT_MAP[firstB.id] : null;
  if (uA) setSideHero('A', uA, 'patrol', uA.weapon || '主力戰備列陣');
  if (uB) setSideHero('B', uB, 'patrol', uB.weapon || '敵前沿列陣戒備');

  // 初始化中央火控態勢橫幅
  const sAtk = $('#stripAttacker'), sTgt = $('#stripTarget'), sVec = $('#stripVector');
  if (sAtk && uA) sAtk.textContent = `${uA.flag} ${uA.name}`;
  if (sTgt && uB) sTgt.textContent = `${uB.flag} ${uB.name}`;
  if (sVec) sVec.textContent = '⚡ 兩軍對峙列陣 ➔';

  const maxHp = {}; [...T.A, ...T.B].forEach(u => { maxHp[u.uid] = u.maxHp || u.hpMax || u.hp; });
  $('#battleLog').innerHTML = '';
  $('#phaseTitle').textContent = '戰 場 就 緒';
  const initTimer = $('#camTimer');
  if (initTimer) initTimer.textContent = '00:00';
  const evObj = res.ev || { id: 'clear', name: '晴朗無風', icon: '☀', desc: '標準環境' };
  const envBadge = $('#logEnvBadge');
  if (envBadge) {
    const envIcon = $('#logEnvIcon');
    const envName = $('#logEnvName');
    if (envIcon) envIcon.textContent = evObj.icon || '🌐';
    if (envName) envName.textContent = evObj.name || '常規戰區';
    envBadge.title = `戰場氣候環境：${esc(evObj.desc || evObj.name)}`;
    envBadge.className = `log-env-badge chip-weather chip-weather-${evObj.id || 'clear'}`;
  }
  let metaHtml = '';

  let tourneyMatchInfo = null;
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const prof = (typeof getTournamentPlayerProfile === 'function') ? getTournamentPlayerProfile() : null;

  if (state.mode === 'tournament') {
    if (onlineRoom && onlineRoom.matches) {
      const myMatch = Object.values(onlineRoom.matches).find(m => {
        if (!prof) return false;
        return (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid);
      });
      if (myMatch) {
        const hist = ensureArray(myMatch.history);
        const curRound = hist.length + 1;
        const totalRounds = onlineRoom.totalRounds || Math.log2(onlineRoom.size || 8);
        const reqWins = (typeof FirebaseTourneyEngine.getRequiredWins === 'function')
          ? FirebaseTourneyEngine.getRequiredWins(myMatch, onlineRoom.format, totalRounds)
          : (myMatch.requiredWins || 2);
        const maxG = reqWins === 3 ? 5 : (reqWins === 2 ? 3 : 1);
        const fmtStr = `BO${maxG}`;
        const armoryRule = onlineRoom.armoryRule || 'locked';
        const armoryLabel = armoryRule === 'locked' ? '開戰鎖定' : '自由調撥';
        const isTeamA = myMatch.teamA?.uid === prof.uid;
        const scoreMy = isTeamA ? (myMatch.scoreA || 0) : (myMatch.scoreB || 0);
        const scoreOpp = isTeamA ? (myMatch.scoreB || 0) : (myMatch.scoreA || 0);
        tourneyMatchInfo = { fmtStr, armoryLabel, curRound, maxG, scoreMy, scoreOpp };
      }
    } else if (typeof TournamentEngine !== 'undefined') {
      const myMatch = TournamentEngine.getMyMatch();
      const tState = TournamentEngine.getState();
      if (myMatch) {
        const curRound = (myMatch.history ? myMatch.history.length : 0) + 1;
        const reqWins = TournamentEngine.getRequiredWins(myMatch);
        const maxG = reqWins === 3 ? 5 : (reqWins === 2 ? 3 : 1);
        const fmtStr = `BO${maxG}`;
        const armoryRule = tState?.armoryRule || 'locked';
        const armoryLabel = armoryRule === 'locked' ? '開戰鎖定' : '自由調撥';
        const isTeamA = myMatch.teamA?.isMe;
        const scoreMy = isTeamA ? (myMatch.scoreA || 0) : (myMatch.scoreB || 0);
        const scoreOpp = isTeamA ? (myMatch.scoreB || 0) : (myMatch.scoreA || 0);
        tourneyMatchInfo = { fmtStr, armoryLabel, curRound, maxG, scoreMy, scoreOpp };
      }
    }
  }

  if (tourneyMatchInfo) {
    const { fmtStr, armoryLabel, curRound, maxG, scoreMy, scoreOpp } = tourneyMatchInfo;
    metaHtml = `<span class="chip-match-mode">⚔️ ${fmtStr} (${armoryLabel}) ▪ 第 ${curRound}/${maxG} 局 ( ${scoreMy} : ${scoreOpp} )</span>` + metaHtml;
  } else if (state.isOnlinePvp) {
    const maxG = (state.bo3 && state.bo3.maxGames) || 5;
    metaHtml = `<span class="chip-match-mode">⚔️ BO${maxG} ▪ 第 ${state.bo3.round}/${maxG} 局 (比分: 本部特遣隊 ${state.bo3.winsA} - 挑戰突擊隊 ${state.bo3.winsB})</span>` + metaHtml;
  } else if (state.mode === 'bo3') {
    const maxG = (state.bo3 && state.bo3.maxGames) || 5;
    metaHtml = `<span class="chip-match-mode">⚔️ BO${maxG} (開戰鎖定) ▪ 第 ${state.bo3.round}/${maxG} 局 ( ${state.bo3.winsA} : ${state.bo3.winsB} )</span>` + metaHtml;
  } else if (state.mode === 'ladder') {
    metaHtml = `<span class="chip-match-mode">🎖️ 天梯攻防決戰 ▪ 排位競逐</span>` + metaHtml;
  } else {
    metaHtml = `<span class="chip-match-mode">⚡ 戰術演習 ▪ 實兵對抗推演</span>` + metaHtml;
  }
  $('#battleMeta').innerHTML = metaHtml;
  document.querySelectorAll('.ph').forEach(p => p.className = 'ph');
  await sleep(700 / speed);
  let curPhase = 0, sec = 0;
  const log = $('#battleLog');
  try {
    for (const f of res.frames) {
      if (token !== playToken || res._finished) return;
      if (f.phase !== curPhase) {
        document.querySelectorAll('.ph').forEach(p => { const n = +p.dataset.p; p.className = 'ph' + (n < f.phase ? ' done' : n === f.phase ? ' on' : ''); });
        curPhase = f.phase;
        if (curPhase === 1 && radarEl) radarEl.classList.add('emp-active');
        else if (radarEl) radarEl.classList.remove('emp-active');
        updateHoloPhase(curPhase);
      }
      sec++;
      const timerEl = $('#camTimer');
      if (timerEl) {
        const tm = Math.floor(sec / 60);
        const ts = sec % 60;
        timerEl.textContent = `${String(tm).padStart(2, '0')}:${String(ts).padStart(2, '0')}`;
      }
      $('#phaseTitle').textContent = f.title;
      const h = document.createElement('div'); h.className = 'head'; h.textContent = '▌' + f.title;
      log.prepend(h);
      for (const ln of f.lines) {
        if (token !== playToken || res._finished) return;
        const d = document.createElement('div');
        d.className = `s${ln.side} ${ln.kind}`;
        const brevityBadge = ln.brevity ? `<span class="brevity-tag ${ln.kind}">${esc(ln.brevity)}</span>` : '';
        d.innerHTML = `${brevityBadge}<span class="log-text">${esc(ln.text)}</span>`;
        // 反敘倒序插入：最新戰況出現在最上方
        log.prepend(d);
        log.scrollTop = 0;
        if (ln.tuid) {
          setHp(ln.tuid, ln.hpAfter, maxHp[ln.tuid]);
        }
        playFx(ln);
        if (typeof Battle3DEngine !== 'undefined') {
          try { Battle3DEngine.playEvent(ln); } catch (_) {}
        }
        if (!skip) {
          const waitTime = ln.kind === 'miss' ? 140 : ln.kind === 'kill' ? 320 : 220;
          await sleep(waitTime / speed);
        }
      }
      Object.keys(f.hp).forEach(uid => setHp(uid, f.hp[uid], maxHp[uid]));
      if (!skip) await sleep(400 / speed);
    }
  } catch (loopErr) {
    console.error('showBattle animation loop caught unexpected error:', loopErr);
    fastForwardBattle(res, opts);
    return;
  }
  if (token !== playToken || res._finished) return;
  res._finished = true;
  if (radarEl) radarEl.classList.remove('emp-active');
  document.querySelectorAll('.ph').forEach(p => p.className = 'ph done');
  $('#phaseTitle').textContent = '交 戰 結 束';
  if (opts && opts.isReplay) {
    enterBattlefieldReviewState();
    if (res) {
      try {
        showResult(res);
        $('#resultModal').hidden = true;
      } catch (e) {
        console.warn('Pre-render replay result error:', e);
      }
    }
    toast('🎬 戰場重播完畢！可自由檢視戰場，或點擊頂部【📊 查看結算報告】');
  } else {
    finishBattle(res);
  }
}

function updateHoloPhase(phase) {
  document.querySelectorAll('.holo-domain').forEach(el => el.classList.remove('active'));
  if (phase === 1) {
    const elEW = $('#domain-ew'), elAA = $('#domain-aa');
    if (elEW) elEW.classList.add('active');
    if (elAA) elAA.classList.add('active');
  } else if (phase === 2) {
    const elAir = $('#domain-air'), elSea = $('#domain-sea');
    if (elAir) elAir.classList.add('active');
    if (elSea) elSea.classList.add('active');
  } else if (phase === 3) {
    const elArmor = $('#domain-armor');
    if (elArmor) elArmor.classList.add('active');
  }
}

function playFx(ln) {
  if (skip) return;
  try {
    const fxLayer = $('#combatFxLayer');
    if (!fxLayer) return;

  const aEl = ln.auid ? $('#bu-' + ln.auid) : null;
  const tEl = ln.tuid ? $('#bu-' + ln.tuid) : null;

  const aId = ln.auid ? ln.auid.split('-')[0] : null;
  const tId = ln.tuid ? ln.tuid.split('-')[0] : null;
  const aUnit = aId ? UNIT_MAP[aId] : null;
  const tUnit = tId ? UNIT_MAP[tId] : null;

  // 1. 即時動態切換左右兩半邊全景巨幕大圖與中央火控態勢！
  if (aUnit && tUnit) {
    const sAtk = $('#stripAttacker'), sTgt = $('#stripTarget'), sVec = $('#stripVector');
    const isClashOfTitans = (aUnit.cost >= 4 && tUnit.cost >= 4);

    if (ln.side === 'A') {
      // 我方開火攻擊 ➔ 左邊為攻擊武器大圖，右邊為受擊目標大圖
      setSideHero('A', aUnit, 'fire', aUnit.weapon);
      setSideHero('B', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sTgt) sTgt.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sVec) sVec.textContent = isClashOfTitans ? `🎯 頂峰對決 // CLASH ➔` : `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '開火'}] ➔`;
    } else {
      // 敵方開火攻擊 ➔ 右邊為攻擊武器大圖，左邊為受擊目標大圖
      setSideHero('B', aUnit, 'fire', aUnit.weapon);
      setSideHero('A', tUnit, 'hit', ln.text);
      if (sAtk) sAtk.textContent = `${tUnit.flag} ${tUnit.name}`;
      if (sTgt) sTgt.textContent = `${aUnit.flag} ${aUnit.name}`;
      if (sVec) sVec.textContent = isClashOfTitans ? `🎯 頂峰對決 // CLASH ➔` : `⚡ [${aUnit.weapon ? aUnit.weapon.split(' ')[0] : '突襲'}] ➔`;
    }

    // 連動全息雷達態勢帶
    const lockTag = $('#holoLockTag');
    if (lockTag) {
      if (ln.brevity === 'FOX-3') lockTag.textContent = '[TWS RADAR LOCK]';
      else if (ln.brevity && ln.brevity.startsWith('SABOT')) lockTag.textContent = '[LASER RANGE LOCK]';
      else if (ln.brevity && ln.brevity.startsWith('SEAD')) lockTag.textContent = '[ANTI-RAD TARGET]';
      else if (ln.brevity === 'ABM-KILL') lockTag.textContent = '[EXO-ATMOS HIT-TO-KILL]';
      else if (ln.brevity === 'APS-BLOCK') lockTag.textContent = '[APS HARD-KILL]';
      else if (ln.ammoTier === 3) lockTag.textContent = '[AUX GUNS / OVERHEAT]';
      else if (ln.ammoTier === 2) lockTag.textContent = '[SECONDARY MUNITION]';
      else if (ln.kind === 'kill') lockTag.textContent = '[TARGET SPLASHED]';
      else lockTag.textContent = '[FIRE CONTROL ON]';
    }

    // 觸發兵種態勢燈高亮
    const uCat = aUnit.cat;
    if (uCat) {
      const catMap = {
        air: 'domain-air',
        air_defense: 'domain-aa',
        armor: 'domain-armor',
        naval: 'domain-sea',
        support: 'domain-ew'
      };
      const domId = catMap[uCat];
      if (domId) {
        const domEl = $('#' + domId);
        if (domEl) {
          domEl.classList.add('active');
          setTimeout(() => domEl.classList.remove('active'), 600 / speed);
        }
      }
    }

    // 動態經緯度模擬
    const camCoords = $('#camCoords');
    if (camCoords && Math.random() < 0.35) {
      const minN = (18 + Math.random() * 0.9).toFixed(2);
      const minE = (34 + Math.random() * 0.9).toFixed(2);
      camCoords.textContent = `LAT 24°${minN}'N LON 120°${minE}'E`;
    }

    // 【以小博大・戰術奇蹟警報 (Tactical Upset Alarm)】
    // 當低成本兵種 (<= $2) 成功擊毀高價值旗艦 (>= $4)
    if (ln.kind === 'kill' && aUnit.cost <= 2 && tUnit.cost >= 4) {
      spawnTacticalUpset(aUnit, tUnit);
    }
  }

  // 2. 判定古代兵團打擊與聲學類型 (三國志古戰場刀槍/箭陣/戰鼓/火攻/軍師鑼)
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
    }
    const isSoundMuted = (typeof SoundEngine !== 'undefined' && typeof SoundEngine.isMuted === 'function')
      ? SoundEngine.isMuted()
      : (typeof SoundEngine !== 'undefined' && SoundEngine.enabled === false);
    if (typeof navigator !== 'undefined' && navigator.vibrate && !isSoundMuted) {
      try {
        if (ln.kind === 'kill') navigator.vibrate(20);
        else if (ln.kind === 'block') navigator.vibrate([14, 24, 14]);
      } catch (_) {}
    }
  }

  // 3. 卡片高亮連動與開火後座力
  if (aEl) {
    aEl.classList.remove('active-attacker');
    void aEl.offsetWidth;
    aEl.classList.add('active-attacker');
    setTimeout(() => aEl.classList.remove('active-attacker'), 380 / speed);

    const recoilClass = ln.side === 'A' ? 'fire-recoil-a' : 'fire-recoil-b';
    aEl.classList.remove('fire-recoil-a', 'fire-recoil-b');
    void aEl.offsetWidth;
    aEl.classList.add(recoilClass);
    setTimeout(() => aEl.classList.remove(recoilClass), 320 / speed);
  }
  if (tEl) {
    tEl.classList.remove('active-target');
    void tEl.offsetWidth;
    tEl.classList.add('active-target');
    setTimeout(() => tEl.classList.remove('active-target'), 380 / speed);
  }

  if (!tEl) return;

  const layerRect = fxLayer.getBoundingClientRect();
  const tRect = tEl.getBoundingClientRect();
  const tx = tRect.left + tRect.width / 2 - layerRect.left;
  const ty = tRect.top + tRect.height / 2 - layerRect.top;

  // 目標卡片浮現軍規火控鎖定準星 (Tactical HUD Lock Reticle)
  spawnLockReticle(tx, ty, wType);

  // 4. 7 大兵種實體 SVG 武器模型與物理彈道動畫
  if (aEl) {
    const aRect = aEl.getBoundingClientRect();
    const ax = (ln.side === 'A' ? aRect.right - 12 : aRect.left + 12) - layerRect.left;
    const ay = aRect.top + aRect.height / 2 - layerRect.top;
    const dx = tx - ax, dy = ty - ay;
    const dist = Math.hypot(dx, dy);
    const baseAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const sideColor = ln.side === 'A' ? '#3de0ff' : '#ff5d6e';

    // 開火端砲口爆閃 / 垂發白煙特效
    spawnMuzzleFx(ax, ay, baseAngle, wType, sideColor);

    if (wType === 'strategy') {
      // 【軍師奇謀：八卦金光法陣束流】
      spawnEwBeam(ax, ay, tx, ty, dist, baseAngle, '#4ade80');
      setTimeout(() => triggerImpact(), Math.max(90, 170 / speed));

    } else if (wType === 'arrow') {
      // 【神射強弩：三矢齊發火羽箭雨】
      const burstCount = 3;
      for (let i = 0; i < burstCount; i++) {
        setTimeout(() => {
          if (skip) return;
          const spreadY = (i - 1) * 12;
          launchSingleProjectile({
            ax, ay: ay + spreadY * 0.4,
            tx, ty: ty + spreadY,
            wType: 'arrow', arcHeight: -Math.min(76, dist * 0.18) - i * 10, waveAmp: 0,
            dur: Math.max(95, 195 / speed),
            side: ln.side,
            onHit: i === burstCount - 1 ? () => triggerImpact() : () => spawnMiniSparks(tx, ty + spreadY)
          });
        }, (i * 32) / speed);
      }

    } else if (wType === 'fire') {
      // 【火攻霹靂：烈焰火球拋射】
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'fire',
        arcHeight: -Math.min(95, dist * 0.22),
        waveAmp: 0,
        dur: Math.max(110, 225 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });

    } else if (wType === 'cavalry') {
      // 【奔雷突騎：長槊破陣金芒疾衝】
      spawnSabotMachLine(ax, ay, tx, ty, dist, baseAngle);
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'cavalry',
        arcHeight: 0,
        waveAmp: 0,
        dur: Math.max(65, 135 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });

    } else {
      // 【重甲／先登：冷兵器刀氣斬擊弧光】
      launchSingleProjectile({
        ax, ay, tx, ty,
        wType: 'blade',
        arcHeight: -Math.min(36, dist * 0.08),
        waveAmp: 0,
        dur: Math.max(80, 165 / speed),
        side: ln.side,
        onHit: () => triggerImpact()
      });
    }
  } else {
    triggerImpact();
  }

  // 古戰場冷兵器／火羽箭／烈火彈 SVG 實體特效
  function getWeaponSvgHtml(type, side) {
    const accent = side === 'A' ? '#38bdf8' : '#f59e0b';
    const flameColor = side === 'A' ? '#60a5fa' : '#fb7185';
    if (type === 'cavalry') {
      // 鎏金騎槍長槊破陣寒芒
      return `<svg class="fx-weapon-svg sabot-svg" viewBox="0 0 96 26" width="92" height="24">
        <polygon points="0,11 66,11 66,15 0,15" fill="${accent}" opacity="0.55"/>
        <rect x="24" y="11.5" width="46" height="3" fill="#b45309"/>
        <polygon points="64,7 72,13 64,19" fill="#ef4444"/>
        <polygon points="68,9.5 95,13 68,16.5" fill="#f8fafc" stroke="#fbbf24" stroke-width="1"/>
      </svg>`;
    } else if (type === 'arrow') {
      // 雕翎火羽箭
      return `<svg class="fx-weapon-svg cannon-svg" viewBox="0 0 84 22" width="78" height="20">
        <polygon points="6,5 18,9.5 8,9.5" fill="#f8fafc"/>
        <polygon points="6,17 18,12.5 8,12.5" fill="#f8fafc"/>
        <rect x="10" y="10" width="52" height="2.2" fill="#d97706"/>
        <circle cx="64" cy="11" r="5" fill="#f97316" opacity="0.85"/>
        <polygon points="60,7 82,11 60,15" fill="#fef08a"/>
      </svg>`;
    } else if (type === 'fire') {
      // 霹靂烈火流星彈
      return `<svg class="fx-weapon-svg salvo-svg" viewBox="0 0 76 28" width="72" height="26">
        <ellipse cx="28" cy="14" rx="24" ry="8" fill="#ea580c" opacity="0.78"/>
        <ellipse cx="42" cy="14" rx="16" ry="6" fill="#fbbf24" opacity="0.92"/>
        <circle cx="56" cy="14" r="8" fill="#fef08a" stroke="#dc2626" stroke-width="1.5"/>
      </svg>`;
    } else {
      // 偃月半月刀氣斬光
      return `<svg class="fx-weapon-svg missile-svg" viewBox="0 0 72 34" width="68" height="32">
        <path d="M18,4 Q64,17 18,30 Q42,17 18,4 Z" fill="${flameColor}" opacity="0.85"/>
        <path d="M28,6 Q68,17 28,28 Q50,17 28,6 Z" fill="#ffffff"/>
      </svg>`;
    }
  }

  // 發射單枚具備物理拋物線/弦波軌跡與動態切線轉向的武器實體
  function launchSingleProjectile({ ax, ay, tx, ty, wType, arcHeight, waveAmp, dur, side, onHit }) {
    const proj = document.createElement('div');
    proj.className = `fx-projectile fx-w-${wType} ${side === 'A' ? 'fx-side-a' : 'fx-side-b'}`;
    proj.innerHTML = getWeaponSvgHtml(wType, side);
    fxLayer.appendChild(proj);

    const dx = tx - ax, dy = ty - ay;
    const startTime = performance.now();
    let prevX = ax, prevY = ay;
    let frameCount = 0;

    function step(now) {
      if (skip || !proj.parentElement) { proj.remove(); return; }
      const p = Math.min(1, (now - startTime) / dur);

      // 計算基礎線性位置 + 拋物線仰角高度 + 弦波蛇行偏移
      const parabola = 4 * p * (1 - p) * arcHeight;
      const wave = waveAmp ? Math.sin(p * Math.PI * 2.5) * waveAmp * (1 - p * 0.3) : 0;
      const curX = ax + dx * p;
      const curY = ay + dy * p + parabola + wave;

      // 動態計算瞬時切線方向角，讓飛彈/火箭鼻錐真實隨拋物線抬頭與俯衝
      const vx = curX - prevX;
      const vy = curY - prevY;
      const curAngle = (Math.hypot(vx, vy) > 0.4)
        ? (Math.atan2(vy, vx) * 180 / Math.PI)
        : (Math.atan2(dy, dx) * 180 / Math.PI);

      proj.style.transform = `translate(${curX}px, ${curY}px) rotate(${curAngle}deg)`;
      prevX = curX;
      prevY = curY;
      frameCount++;

      // 沿途釋放推進尾煙或水下空泡粒子
      if (frameCount % 2 === 0 && p > 0.08 && p < 0.92) {
        if (wType === 'missile' || wType === 'salvo') {
          spawnTrailParticle(curX, curY, wType === 'salvo' ? 'smoke-fire' : 'contrail');
        } else if (wType === 'torpedo') {
          spawnTrailParticle(curX, curY, 'bubble');
        }
      }

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        proj.remove();
        if (onHit) onHit();
      }
    }
    requestAnimationFrame(step);
  }

  // 翼穩脫殼穿甲彈專屬：超音速金色穿甲音爆束線
  function spawnSabotMachLine(ax, ay, tx, ty, dist, angle) {
    const beam = document.createElement('div');
    beam.className = 'fx-sabot-beam';
    beam.style.width = dist + 'px';
    beam.style.left = ax + 'px';
    beam.style.top = ay + 'px';
    beam.style.transform = `rotate(${angle}deg)`;
    fxLayer.appendChild(beam);
    setTimeout(() => beam.remove(), 240 / speed);
  }

  // 電子戰 / 反輻射專屬：全息電磁脈衝干擾波束
  function spawnEwBeam(ax, ay, tx, ty, dist, angle, color) {
    const ew = document.createElement('div');
    ew.className = 'fx-ew-beam';
    ew.style.width = dist + 'px';
    ew.style.left = ax + 'px';
    ew.style.top = ay + 'px';
    ew.style.transform = `rotate(${angle}deg)`;
    ew.style.setProperty('--ew-color', color);
    fxLayer.appendChild(ew);
    setTimeout(() => ew.remove(), 340 / speed);
  }

  // 開火端砲口制退火光 / 垂發煙霧
  function spawnMuzzleFx(x, y, angle, wType, color) {
    const mz = document.createElement('div');
    mz.className = `fx-muzzle fx-muzzle-${wType}`;
    mz.style.left = x + 'px';
    mz.style.top = y + 'px';
    mz.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    mz.style.setProperty('--mz-color', color);
    fxLayer.appendChild(mz);
    setTimeout(() => mz.remove(), 220 / speed);
  }

  // 沿途尾煙 / 水下氣泡粒子
  function spawnTrailParticle(x, y, kind) {
    const pt = document.createElement('div');
    pt.className = `fx-trail-pt ${kind}`;
    pt.style.left = (x + (Math.random() - 0.5) * 6) + 'px';
    pt.style.top = (y + (Math.random() - 0.5) * 6) + 'px';
    fxLayer.appendChild(pt);
    setTimeout(() => pt.remove(), 320 / speed);
  }

  // 目標火控鎖定準星框
  function spawnLockReticle(x, y, wType) {
    const ret = document.createElement('div');
    ret.className = `fx-reticle ${wType === 'ew' ? 'ew-lock' : ''}`;
    ret.style.left = x + 'px';
    ret.style.top = y + 'px';
    fxLayer.appendChild(ret);
    setTimeout(() => ret.remove(), 340 / speed);
  }

  // 機砲連射微火花
  function spawnMiniSparks(x, y) {
    for (let i = 0; i < 4; i++) {
      const sp = document.createElement('div');
      sp.className = 'fx-spark';
      sp.style.left = x + 'px';
      sp.style.top = y + 'px';
      const ang = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 24;
      sp.style.setProperty('--dx', `${Math.cos(ang) * d}px`);
      sp.style.setProperty('--dy', `${Math.sin(ang) * d}px`);
      fxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), 220 / speed);
    }
  }

  // 5. 命中受擊、分級爆炸衝擊波與浮動戰鬥數字 (受擊方聲相為對手方位)
  function triggerImpact() {
    if (skip) return;
    const targetSide = ln.side === 'A' ? 'B' : 'A';
    if (ln.kind === 'kill') {
      tEl.classList.remove('hit-shake', 'kill-blast');
      void tEl.offsetWidth;
      tEl.classList.add('kill-blast', 'destroyed-badge');
      spawnExplosion(tx, ty, true, wType, 1.0);
      spawnFloater(tx, ty, '⚔️ 陣亡潰敗!', 'kill');
      SoundEngine.play('warlord_fall', targetSide);

      // 擊毀大型目標時觸發戰場畫面微震動 (Micro Screen Shake)
      const vb = $('#viewBattle');
      if (vb) {
        vb.classList.remove('battle-screen-shake');
        void vb.offsetWidth;
        vb.classList.add('battle-screen-shake');
        setTimeout(() => vb.classList.remove('battle-screen-shake'), 280 / speed);
      }
    } else if (ln.kind === 'hit') {
      tEl.classList.remove('hit-shake');
      void tEl.offsetWidth;
      tEl.classList.add('hit-shake');
      spawnExplosion(tx, ty, false, wType, 1.0);
      const dmgText = ln.dmg ? `−${ln.dmg}` : `命中!`;
      spawnFloater(tx, ty, dmgText, 'hit');
      SoundEngine.play('metal_clash', targetSide);
    } else if (ln.kind === 'block') {
      spawnShield(tx, ty);
      spawnFloater(tx, ty, '🛡️ 重盾格擋!', 'block');
      SoundEngine.play('shield_block', targetSide);
    } else if (ln.kind === 'miss') {
      spawnFloater(tx, ty, 'MISS', 'miss');
    }
  }

  // 多層次物理爆炸：核心火球 + 超音速震波環 + 金屬破片飛濺 + 濃煙 / 水柱
  function spawnExplosion(x, y, isKill = false, weaponType = 'missile', scale = 1.0) {
    // 1. 核心高熱火球
    const boom = document.createElement('div');
    boom.className = `fx-explosion ${isKill ? 'fx-explosion-kill' : ''} ${weaponType === 'ew' ? 'fx-explosion-ew' : ''}`;
    boom.style.left = x + 'px';
    boom.style.top = y + 'px';
    if (scale !== 1.0) boom.style.transform = `scale(${scale})`;
    fxLayer.appendChild(boom);
    setTimeout(() => boom.remove(), (isKill ? 520 : 380) / speed);

    // 2. 擴散超音速震波環 (Shockwave Ring)
    const ring = document.createElement('div');
    ring.className = `fx-shockwave ${isKill ? 'kill-ring' : ''} ${weaponType === 'ew' ? 'ew-ring' : ''}`;
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    fxLayer.appendChild(ring);
    setTimeout(() => ring.remove(), (isKill ? 480 : 340) / speed);

    // 3. 魚雷 / 制海武器專屬：衝天白色水柱 (Water Plume)
    if (weaponType === 'torpedo') {
      const plume = document.createElement('div');
      plume.className = 'fx-water-plume';
      plume.style.left = x + 'px';
      plume.style.top = y + 'px';
      fxLayer.appendChild(plume);
      setTimeout(() => plume.remove(), 460 / speed);
    }

    // 4. 飛濺高熱破片火花 (Debris Sparks)
    const sparkCount = isKill ? 12 : 6;
    for (let i = 0; i < sparkCount; i++) {
      const sp = document.createElement('div');
      sp.className = `fx-spark ${isKill ? 'kill-spark' : ''}`;
      sp.style.left = x + 'px';
      sp.style.top = y + 'px';
      const ang = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      const dist = (isKill ? 36 : 20) + Math.random() * (isKill ? 44 : 24);
      sp.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      sp.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      fxLayer.appendChild(sp);
      setTimeout(() => sp.remove(), (isKill ? 460 : 300) / speed);
    }

    // 5. 擊毀時竄升黑煙雲團
    if (isKill) {
      for (let s = 0; s < 2; s++) {
        const sm = document.createElement('div');
        sm.className = 'fx-smoke-cloud';
        sm.style.left = (x + (s === 0 ? -10 : 10)) + 'px';
        sm.style.top = y + 'px';
        fxLayer.appendChild(sm);
        setTimeout(() => sm.remove(), 620 / speed);
      }
    }
  }

  function spawnShield(x, y) {
    const shield = document.createElement('div');
    shield.className = 'fx-shield';
    shield.style.left = x + 'px'; shield.style.top = y + 'px';
    fxLayer.appendChild(shield);
    setTimeout(() => shield.remove(), 420 / speed);
  }

  function spawnFloater(x, y, text, type) {
    const fl = document.createElement('div');
    fl.className = `fx-floater ${type}`;
    fl.textContent = text;
    fl.style.left = x + 'px'; fl.style.top = y + 'px';
    fxLayer.appendChild(fl);
    setTimeout(() => fl.remove(), 680 / speed);
  }

  function spawnTacticalUpset(attacker, victim) {
    const banner = document.createElement('div');
    banner.className = 'tactical-upset-banner';
    banner.innerHTML = `
      <div class="upset-title">⚡ 戰 術 奇 蹟 // ASYMMETRIC UPSET ⚡</div>
      <div class="upset-desc">${attacker.flag} ${attacker.name} ($${attacker.cost}) 擊墜 ${victim.flag} ${victim.name} ($${victim.cost})！</div>
    `;
    const viewBattle = $('#viewBattle');
    if (viewBattle) {
      viewBattle.appendChild(banner);
      setTimeout(() => banner.remove(), 2300);
    }
  }
  } catch (fxErr) {
    console.warn('playFx error safely caught:', fxErr);
  }
}

$('#btnPause')?.addEventListener('click', () => {
  paused = !paused;
  const btn = $('#btnPause');
  if (btn) {
    btn.textContent = paused ? '▶ 繼續' : '⏸ 暫停';
    btn.classList.toggle('active', paused);
  }
  toast(paused ? '⏸ 戰場推演已暫停（可自由檢視日誌與裝備血量）' : '▶ 繼續戰場推演');
});
function fastForwardBattle(res, opts = {}) {
  if (!res) res = lastBattleRes;
  if (!res) return;
  paused = false;
  skip = true;
  wakeSleep();

  const fxLayer = $('#combatFxLayer');
  if (fxLayer) fxLayer.innerHTML = '';
  const radarEl = $('.radar');
  if (radarEl) radarEl.classList.remove('emp-active');
  const vb = $('#viewBattle');
  if (vb) vb.classList.remove('battle-screen-shake');

  // 1. 瞬發補齊日誌最後階段標題
  const log = $('#battleLog');
  if (log && res.frames) {
    const existingHeads = new Set(Array.from(log.querySelectorAll('.head')).map(el => el.textContent.trim()));
    const docFrag = document.createDocumentFragment();
    for (const f of res.frames) {
      const headKey = '▌' + f.title;
      if (!existingHeads.has(headKey)) {
        const h = document.createElement('div');
        h.className = 'head';
        h.textContent = headKey;
        docFrag.appendChild(h);
      }
    }
    if (docFrag.childNodes.length > 0) {
      log.prepend(docFrag);
    }
  }

  // 2. 立即將雙方全體裝備生命值更新為最終結算 HP 與陣亡樣式
  if (res.final) {
    const maxHp = {};
    [...res.final.A, ...res.final.B].forEach(u => { maxHp[u.uid] = u.maxHp || u.hpMax || u.hp; });
    [...res.final.A, ...res.final.B].forEach(u => setHp(u.uid, u.hp, maxHp[u.uid]));
  }

  // 3. 推進三階段全數完成
  document.querySelectorAll('.ph').forEach(p => p.className = 'ph done');
  const pTitle = $('#phaseTitle');
  if (pTitle) pTitle.textContent = '交 戰 結 束';
  const timerEl = $('#camTimer');
  if (timerEl) timerEl.textContent = '00:15';

  // 4. 結算流程防重入與強制收束
  if (!res._finished) {
    res._finished = true;
    if (opts && opts.isReplay) {
      enterBattlefieldReviewState();
      if (res) {
        try {
          showResult(res);
          $('#resultModal').hidden = true;
        } catch (e) {
          console.warn('Fast-forward replay error:', e);
        }
      }
      toast('🎬 戰場推演已直接跳至結尾！');
    } else {
      finishBattle(res);
    }
  }
}

$('#btnSkip').onclick = () => {
  fastForwardBattle(lastBattleRes);
};
const SPEED_STEPS = [0.6, 1, 2, 4];
$('#btnSpeed').onclick = () => {
  const idx = SPEED_STEPS.indexOf(Number(speed));
  speed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
  LS.set('wl15_speed', speed);
  $('#btnSpeed').textContent = '速度 ×' + speed;
  toast(`⏱️ 戰鬥推演速度已切換為 ×${speed}`);
};

function enterBattlefieldReviewState() {
  if ($('#btnPause')) $('#btnPause').hidden = true;
  if ($('#btnSpeed')) $('#btnSpeed').hidden = true;
  if ($('#btnSkip')) $('#btnSkip').hidden = true;
  if ($('#btnBattleBack')) $('#btnBattleBack').hidden = true;
  if ($('#btnBattleReplay')) $('#btnBattleReplay').hidden = false;
  if ($('#btnReopenResult')) $('#btnReopenResult').hidden = false;
  if ($('#btnBattleExit')) $('#btnBattleExit').hidden = false;

  // 進入戰場檢視狀態：隱藏所有彈窗，避免覆蓋戰場與按鈕點擊
  if ($('#resultModal')) $('#resultModal').hidden = true;
  if ($('#ladderResultModal')) $('#ladderResultModal').hidden = true;
  if ($('#bo3CounterModal')) $('#bo3CounterModal').hidden = true;
  if ($('#bo3SeriesModal')) $('#bo3SeriesModal').hidden = true;

  if (state.mode === 'bo3' && state.bo3 && state.bo3.finished) {
    const btnExitTxt = $('#btnBattleExitTxt');
    if (btnExitTxt) btnExitTxt.textContent = '🏆 返回系列賽';
    const reopenTxt = $('#btnReopenResult')?.querySelector('.reopen-txt');
    if (reopenTxt) reopenTxt.textContent = '📊 系列賽戰報';
  } else if (state.mode === 'ladder') {
    const btnExitTxt = $('#btnBattleExitTxt');
    if (btnExitTxt) btnExitTxt.textContent = '⚔️ 返回天梯';
    const reopenTxt = $('#btnReopenResult')?.querySelector('.reopen-txt');
    if (reopenTxt) reopenTxt.textContent = '📊 查看結算報告';
  }
}

$('#btnBattleReplay')?.addEventListener('click', () => {
  if (!lastBattleRes) return;
  if (currentActiveModal) currentActiveModal.hidden = true;
  $('#resultModal').hidden = true;
  if ($('#ladderResultModal')) $('#ladderResultModal').hidden = true;
  toast(`🎬 重新重播本場戰鬥過程 (播放速度 ×${speed})...`);
  showBattle(lastBattleRes, { isReplay: true });
});

$('#btnReopenResult').onclick = () => {
  const targetRes = lastBattleRes || state.lastRes;

  if (state.mode === 'bo3' && state.bo3 && state.bo3.finished) {
    showBo3SeriesResult(state.bo3.winner === 'A' || state.bo3.winsA > state.bo3.winsB);
    return;
  }

  if (state.mode === 'ladder') {
    const ladderCard = $('#ladderResultCard');
    if (ladderCard && ladderCard.children && ladderCard.children.length > 0 && currentActiveModal === $('#ladderResultModal')) {
      $('#ladderResultModal').hidden = false;
      return;
    }
  }

  if (targetRes) {
    showResult(targetRes);
    return;
  }

  if (currentActiveModal && currentActiveModal.children && currentActiveModal.children.length > 0) {
    currentActiveModal.hidden = false;
    return;
  }

  // 兜底防禦：若無任何緩存，安全填充 resultModal 並開啟
  if ($('#resultModal')) {
    $('#resultCard').innerHTML = `
      <button class="modal-x" id="rCloseX" onclick="$('#resultModal').hidden=true">✕</button>
      <div style="padding:28px 20px;text-align:center">
        <h3 style="font-family:var(--head);font-size:20px;margin-bottom:8px">📊 戰況推演結算報告</h3>
        <p class="muted" style="font-size:14px;margin-bottom:18px">本局戰鬥推演已告一段落。可返回指揮部重新佈署。</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" onclick="$('#resultModal').hidden=true;handleExitBattleToCurrentMode();">⚔️ 返回戰術指揮中心</button>
          <button class="btn ghost" onclick="$('#resultModal').hidden=true;">關閉報告</button>
        </div>
      </div>
    `;
    currentActiveModal = $('#resultModal');
    const rModal = $('#resultModal');
    const rCard = $('#resultCard');
    if (rModal) {
      rModal.hidden = false;
      rModal.scrollTop = 0;
    }
    if (rCard) {
      rCard.scrollTop = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    requestAnimationFrame(() => {
      if (rModal) rModal.scrollTop = 0;
      if (rCard) rCard.scrollTop = 0;
    });
    setTimeout(() => {
      if (rModal) rModal.scrollTop = 0;
      if (rCard) rCard.scrollTop = 0;
    }, 40);
    setTimeout(() => {
      if (rModal) rModal.scrollTop = 0;
      if (rCard) rCard.scrollTop = 0;
    }, 120);
  }
};
function handleExitBattleToCurrentMode() {
  if (state.mode === 'tournament') {
    // 【戰鬥中返回錦標賽：自動瞬發推演結算，絕不重來！】
    const myMatch = (typeof TournamentEngine !== 'undefined') ? TournamentEngine.getMyMatch() : null;
    if (myMatch && lastBattleRes) {
      handleTournamentRoundEnd(lastBattleRes);
    }
    closeBattle();
    setMode('tournament');
    toast(`🏆 戰局已自動推演結算完畢！已返回世界盃淘汰錦標賽對抗樹！`);
    return;
  } else if (state.mode === 'bo3') {
    if (state.bo3 && !state.bo3.finished && lastBattleRes && !lastBattleRes._bo3Handled) {
      handleBo3RoundEnd(lastBattleRes);
    }
    closeBattle();
    setMode('bo3');
    return;
  } else if (state.mode === 'ladder') {
    // 【天梯戰鬥中返回防線：自動瞬發推演結算，杜絕中途退出SL漏洞！】
    if (state.ladderEnemy && lastBattleRes && !lastBattleRes._ladderHandled) {
      lastBattleRes._ladderHandled = true;
      const isWin = lastBattleRes.winner === 'A';
      const rep = LadderEngine.resolveMatch(isWin, state.ladderEnemy, lastBattleRes);
      stats.played++;
      if (isWin) {
        stats.win++;
        stats.streak++;
        stats.best = Math.max(stats.best, stats.streak);
      } else {
        stats.streak = 0;
      }
      LS.set('wl15_stats', stats);
      renderHud();
      toast(isWin 
        ? `🎖️ 戰局已在背景完成推演結算：戰術獲勝 (+${rep.totalDelta} RP)！已返回天梯戰情室。` 
        : `⚠️ 戰局已在背景完成推演結算：作戰失利 (${rep.totalDelta} RP)！已返回天梯戰情室。`);
      state.ladderEnemy = null;
    } else {
      toast('🎖️ 已返回天梯競技防線');
    }
    closeBattle();
    setMode('ladder');
    return;
  } else {
    closeBattle();
    setupMatch();
    renderAll();
  }
}
$('#btnBattleBack')?.addEventListener('click', handleExitBattleToCurrentMode);
$('#btnBattleExit')?.addEventListener('click', handleExitBattleToCurrentMode);

/* ---------- 戰鬥結算與 BO3 / 幽靈處理 ---------- */
function finishBattle(res) {
  enterBattlefieldReviewState();
  const won = res.winner === 'A', draw = res.winner === 'draw';
  if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.play === 'function') {
    SoundEngine.play(won ? 'victory' : 'defeat');
  }
  if (state.mode !== 'sandbox') {
    const mySideForMastery = (state.isOnlinePvp && typeof OnlinePvPEngine !== 'undefined' && !OnlinePvPEngine.isHostUser()) ? 'B' : 'A';
    if (typeof recordUnitMasteryFromBattle === 'function') {
      recordUnitMasteryFromBattle(res, mySideForMastery);
    }
    stats.played++;
    if (won) { stats.win++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); }
    else if (!draw) stats.streak = 0;
    LS.set('wl15_stats', stats);
    if (typeof CloudSync !== 'undefined') {
      CloudSync.syncToCloud();
    }
  }

  // 雙軌全域遙測：上報戰果至 Firebase RTDB 原子計數器與 GA4 事件
  if (typeof Telemetry !== 'undefined') {
    Telemetry.recordBattle({
      mode: state.mode,
      won: won,
      draw: draw,
      turns: res.rounds ? res.rounds.length : 0,
      flagshipId: (state.deck && state.deck[0]) || null
    });
  }

  /* 幽靈天梯積分結算 */
  if (state.mode === 'ghost' || (state.mode === 'quick' && state.quickSubMode === 'ghost')) {
    if (won) {
      playerGhost.rp += 25; playerGhost.wins++;
      if (state.ghostTarget) state.ghostTarget.losses++;
      toast(`🎖 天梯勝利！獲得 +25 RP (目前: ${playerGhost.rp} RP)`);
    } else if (!draw) {
      playerGhost.rp = Math.max(800, playerGhost.rp - 15); playerGhost.losses++;
      if (state.ghostTarget) state.ghostTarget.wins++;
      toast(`天梯失利：−15 RP (目前: ${playerGhost.rp} RP)`);
    }
    playerGhost.rankTitle = calcRankTitle(playerGhost.rp);
    LS.set('wl15_player_ghost', playerGhost);
    saveGhostPool(getGhostPool());
  }

  if (state.mode === 'daily') {
    const k = state.dailyPlanId === 'today' ? ('wl15_daily_' + dateKey()) : ('wl15_daily_' + dateKey() + '_' + state.dailyPlanId);
    const r = LS.get(k, { won: false, tries: 0 });
    r.tries++; r.won = r.won || won; LS.set(k, r);
  }

  renderHud();

  /* 錦標賽 / 天梯 / BO3 系列賽邏輯分流 */
  if (state.mode === 'tournament') {
    handleTournamentRoundEnd(res);
  } else if (state.mode === 'bo3') {
    handleBo3RoundEnd(res);
  } else if (state.mode === 'ladder' && state.ladderEnemy) {
    handleLadderMatchEnd(res);
  } else {
    showResult(res);
  }
}

/* ---------- 🏆 天梯戰功勝點結算 ---------- */
function handleLadderMatchEnd(res) {
  if (res && res._ladderHandled) return;
  if (res) res._ladderHandled = true;
  const isWin = res.winner === 'A';
  const enemy = state.ladderEnemy;
  if (!enemy) {
    showResult(res);
    return;
  }
  const rep = LadderEngine.resolveMatch(isWin, enemy, res);
  renderHud();

  currentActiveModal = $('#ladderResultModal');
  const card = $('#ladderResultCard');
  if (!card) {
    showResult(res);
    return;
  }

  card.innerHTML = `
    <div class="l-res-banner ${isWin ? 'win' : 'lose'}">
      ${isWin ? '🏆 戰 術 獲 勝 · VICTORY' : '✘ 作 戰 失 利 · DEFEAT'}
    </div>
    <div class="muted">天梯對決目標：${enemy.flag} ${esc(enemy.name)} (${enemy.rp} RP)</div>

    <div class="l-res-rp-change">
      <span class="l-res-old-rp">${rep.oldRP} RP</span>
      <span class="l-res-arrow">➔</span>
      <span class="l-res-new-rp">${rep.newRP} RP</span>
      <span class="l-res-delta ${rep.totalDelta >= 0 ? 'up' : 'down'}">
        ${rep.totalDelta >= 0 ? '+' : ''}${rep.totalDelta} RP
      </span>
    </div>

    ${rep.rankDelta > 0 ? `
      <div class="l-rank-jump">
        🚀 全球天梯名次躍升：第 ${rep.oldRank} 名 ➔ <b>第 ${rep.newRank} 名</b>（上升 ${rep.rankDelta} 位！）
      </div>
    ` : rep.rankDelta < 0 ? `
      <div class="l-rank-jump" style="background:rgba(244,63,94,0.12);border-color:rgba(244,63,94,0.35);color:#f43f5e">
        名次微調：第 ${rep.oldRank} 名 ➔ 第 ${rep.newRank} 名
      </div>
    ` : `
      <div class="l-rank-jump" style="color:#94a3b8">
        名次維持在：第 ${rep.newRank} 名
      </div>
    `}

    <div class="l-breakdown-box">
      <div class="l-breakdown-row"><span>基礎戰功評級 (${rep.tierIcon || '⚔️'} ${rep.tierName || '推進'})</span><b>${rep.baseDelta >= 0 ? '+' : ''}${rep.baseDelta} RP</b></div>
      ${rep.diffBonus !== 0 ? `<div class="l-breakdown-row"><span>分差難度校正 (${rep.diffBonus >= 0 ? '越級強攻' : '弱勢對陣'})</span><b>${rep.diffBonus >= 0 ? '+' : ''}${rep.diffBonus} RP</b></div>` : ''}
      ${rep.aceBonus ? `<div class="l-breakdown-row" style="color:#4ade80"><span>🎖️ ACE 完勝獎章 (全隊全員生還)</span><b>倍率 +25%</b></div>` : ''}
      ${rep.blitzBonus ? `<div class="l-breakdown-row" style="color:#38bdf8"><span>⚡ 閃擊先制獎章 (前置階段全殲)</span><b>倍率 +15%</b></div>` : ''}
      ${rep.miracleBonus > 0 ? `<div class="l-breakdown-row" style="color:#fbbf24"><span>🌟 以小博大奇蹟賞金 (${rep.miracleCount} 次)</span><b>+${rep.miracleBonus} RP</b></div>` : ''}
      ${rep.streakBreakerBonus > 0 ? `<div class="l-breakdown-row" style="color:#f59e0b"><span>💥 終結者大捷 (擊墜霸榜守將)</span><b>+${rep.streakBreakerBonus} RP</b></div>` : ''}
    </div>

    <div class="res-actions">
      <button class="btn primary block" id="btnLadderReturn">返回天梯戰情室</button>
      <button class="btn ghost block" id="btnLadderDetailedAar">📊 查看 C4ISR 詳細作戰戰報 (傷害/MVP)</button>
      <button class="btn ghost block" id="btnLadderReview">檢視戰場情形 🔍</button>
    </div>
  `;

  $('#ladderResultModal').hidden = false;

  $('#btnLadderReturn').onclick = () => {
    $('#ladderResultModal').hidden = true;
    closeBattle();
    setMode('ladder');
  };

  $('#btnLadderDetailedAar').onclick = () => {
    $('#ladderResultModal').hidden = true;
    showResult(res);
  };

  $('#btnLadderReview').onclick = () => {
    $('#ladderResultModal').hidden = true;
    enterBattlefieldReviewState();
    toast('🔍 已進入戰場檢視：可點擊頂部【重新戰場重播】或【查看結算報告】');
  };
}

/* ---------- BO3 系列賽輪次推進 ---------- */
function handleBo3RoundEnd(res) {
  if (!res || res._bo3Handled) return;
  res._bo3Handled = true;
  if (state.bo3 && state.bo3.finished) return;

  const isHost = OnlinePvPEngine.isHostUser();
  const won = state.isOnlinePvp ? (isHost ? res.winner === 'A' : res.winner === 'B') : (res.winner === 'A');
  const draw = res.winner === 'draw';
  const bo3 = state.bo3;

  if (res.winner === 'A') bo3.winsA++;
  else if (res.winner === 'B') bo3.winsB++;

  bo3.history.push({
    round: bo3.round, winner: res.winner,
    scoreA: res.vp.A.total, scoreB: res.vp.B.total,
    event: res.ev,
    deckA: (state.isOnlinePvp ? (isHost ? state.deck : state.pvpOpponentDeck) : state.deck).slice(),
    deckB: (state.isOnlinePvp ? (isHost ? state.pvpOpponentDeck : state.deck) : state.enemy).slice()
  });

  // 判斷是否有人獲得系列賽所需勝場 (BO3/BO5/BO7)
  const winsNeeded = getBo3WinsNeeded();
  if (bo3.winsA >= winsNeeded || bo3.winsB >= winsNeeded) {
    const isSeriesWon = state.isOnlinePvp ? (isHost ? bo3.winsA >= winsNeeded : bo3.winsB >= winsNeeded) : (bo3.winsA >= winsNeeded);
    bo3.finished = true;
    bo3.winner = isSeriesWon ? (state.isOnlinePvp ? (isHost ? 'A' : 'B') : 'A') : (state.isOnlinePvp ? (isHost ? 'B' : 'A') : 'B');
    showBo3SeriesResult(isSeriesWon);
    return;
  }

  // 尚未結束，準備進入下一局 (至多第 5 局)
  const nextRound = bo3.round + 1;
  const nextEvent = pick(EVENTS.filter(e => e.id !== res.ev.id));
  bo3.nextEvent = nextEvent;

  if (state.isOnlinePvp) {
    // 線上對抗：小局結束，立即推進局數並安全重置就緒狀態（全系列賽永久累計禁用，絕不清空 bannedList）
    bo3.round = nextRound;
    state.pvpMyReady = false;
    state.pvpOpponentReady = false;
    state.pvpOpponentDeck = null;
    state.pvpOpponentDoc = null;
  }

  if (draw) {
    showResult(res, {
      bo3NextText: `進入第 ${nextRound} 局（平局重賽）`,
      bo3Callback: () => {
        closeBattle();
        renderAll();
        toast(`⚖️ 本局戰平！雙方戰略積分相同，第 ${nextRound} 局直接交火！`);
      }
    });
    return;
  }

  if (won) {
    if (state.isOnlinePvp) {
      // 線上對抗：我方獲勝，由對手進行戰術反制
      showResult(res, {
        bo3NextText: `進入第 ${nextRound} 局（等待對手反制）`,
        bo3Callback: () => {
          closeBattle();
          renderAll();
          toast(state.bo3.bannedByB 
            ? `⚠️ 對手已禁用了你的【${UNIT_MAP[state.bo3.bannedByB]?.name || '主力裝備'}】！請調整陣容出擊。`
            : `🏆 本局獲勝！正在等待對手指揮官進行戰術禁用反制...`);
        }
      });
      return;
    }

    // 電腦在上一局失利，觸發電腦智能戰術反制！
    const banCount = getBo3BanCount();
    if (!bo3.bannedListB) bo3.bannedListB = [];
    const playerDeckUnits = state.deck.filter(Boolean);
    const unbannedPlayerUnits = playerDeckUnits.filter(id => !bo3.bannedListB.includes(id));
    const playerMvp = res.mvp.A;

    // 智能威脅評估排序：MVP 傷害優先，高額費用次之
    const sortedThreats = unbannedPlayerUnits.slice().sort((a, b) => {
      const uA = UNIT_MAP[a];
      const uB = UNIT_MAP[b];
      const isMvpA = (playerMvp && playerMvp.id === a) ? 1000 : 0;
      const isMvpB = (playerMvp && playerMvp.id === b) ? 1000 : 0;
      return (isMvpB + (uB?.cost || 0) * 10) - (isMvpA + (uA?.cost || 0) * 10);
    });

    const aiChosenBans = sortedThreats.slice(0, banCount);
    aiChosenBans.forEach(id => {
      if (!bo3.bannedListB.includes(id)) bo3.bannedListB.push(id);
    });
    bo3.bannedByB = aiChosenBans[aiChosenBans.length - 1] || null;

    // 電腦自身進行陣容微調 (避開所有被累計禁用的裝備)
    bo3.enemyDeck = refitEnemyDeck(state.enemy, state.deck, nextEvent);

    const bannedNames = aiChosenBans.map(id => UNIT_MAP[id]?.name || id).join('、');

    showResult(res, {
      bo3NextText: `進入第 ${nextRound} 局（戰術反制）`,
      bo3Callback: () => {
        closeBattle();
        bo3.round = nextRound;
        setupMatch();
        // 檢查玩家卡槽中所有被累計禁用的裝備，強制卸下
        const allBanned = currentBanned();
        state.deck.forEach((id, idx) => {
          if (id && allBanned.includes(id)) {
            state.deck[idx] = null;
            state.active = idx;
          }
        });
        renderAll();
        toast(`⚠️ 電腦失利啟動反制！鎖定你上一局主力裝備，全系列賽永久禁用了【${bannedNames}】！(累計禁用 ${bo3.bannedListB.length} 件)`);
      }
    });
  } else {
    // 玩家在上一局失利，賦予玩家戰術反制特權（跳出 Ban 選單）
    showResult(res, {
      bo3NextText: `啟動戰術反制 (BAN 敵方裝備)`,
      bo3Callback: () => {
        closeBattle();
        // 線上對抗中：本部特遣隊失利禁用 Side B (挑戰突擊隊)，挑戰突擊隊失利禁用 Side A (本部特遣隊)
        const winnerTeam = state.isOnlinePvp ? (isHost ? res.final.B : res.final.A) : res.final.B;
        openBo3CounterModal(winnerTeam, nextRound, nextEvent);
      }
    });
  }
}

function refitEnemyDeck(currentEnemyDeck, playerDeck, nextEvent, customBanned = null) {
  // 電腦依據戰場事件或玩家高費單位進行微調，且嚴格避開所有被玩家累計禁用的裝備
  const newDeck = currentEnemyDeck.slice();
  let banned = customBanned;
  if (!banned) {
    if (state.mode === 'tournament') {
      const m = (typeof TournamentEngine !== 'undefined') ? TournamentEngine.getMyMatch() : null;
      if (m) {
        const isTeamA = m.teamA && m.teamA.isMe;
        banned = isTeamA ? (m.bannedListA || []) : (m.bannedListB || []);
      }
    } else {
      banned = (state.bo3 && state.bo3.bannedListA) || [];
    }
  }
  banned = banned || [];
  
  // 先替換已被玩家禁用的單位
  newDeck.forEach((id, idx) => {
    if (banned.includes(id)) {
      const slotFixed = SLOTS[idx].fixed;
      const cat = slotFixed || UNIT_MAP[id]?.cat || 'air';
      const alts = UNITS.filter(u => u.cat === cat && !banned.includes(u.id) && !newDeck.includes(u.id));
      if (alts.length) newDeck[idx] = pick(alts).id;
    }
  });

  const playerAir = playerDeck.some(id => UNIT_MAP[id]?.cat === 'air' && UNIT_MAP[id]?.cost >= 4);
  if (playerAir) {
    // 強化防空槽位
    const adUnits = UNITS.filter(u => u.cat === 'air_defense' && u.cost >= 3 && !banned.includes(u.id));
    if (adUnits.length) newDeck[2] = pick(adUnits).id;
  }
  return newDeck;
}

/* 玩家戰術反制 Modal */
function openBo3CounterModal(enemyFinalTeam, nextRound, nextEvent) {
  const isTourney = (state.mode === 'tournament');
  const onlineRoom = (isTourney && typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const prof = (typeof getTournamentPlayerProfile === 'function') ? getTournamentPlayerProfile() : null;
  let tMatch = null;
  let tState = null;
  let isTeamA = false;

  if (isTourney) {
    if (onlineRoom && onlineRoom.matches) {
      tState = onlineRoom;
      tMatch = Object.values(onlineRoom.matches).find(m => (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid));
      if (tMatch) isTeamA = (tMatch.teamA?.uid === prof.uid);
    } else if (typeof TournamentEngine !== 'undefined') {
      tMatch = TournamentEngine.getMyMatch();
      tState = TournamentEngine.getState();
      if (tMatch) isTeamA = !!(tMatch.teamA && tMatch.teamA.isMe);
    }
  }

  let bannedList = [];
  let banCount = 2;
  let maxG = 5;

  if (isTourney && tMatch) {
    if (!tMatch.bannedListA) tMatch.bannedListA = [];
    if (!tMatch.bannedListB) tMatch.bannedListB = [];
    bannedList = isTeamA ? tMatch.bannedListA : tMatch.bannedListB;
    const reqWins = onlineRoom
      ? FirebaseTourneyEngine.getRequiredWins(tMatch, onlineRoom.format, onlineRoom.totalRounds)
      : TournamentEngine.getRequiredWins(tMatch);
    maxG = reqWins === 3 ? 5 : (reqWins === 2 ? 3 : 1);
    banCount = (tState && tState.armoryRule === 'locked') ? 1 : 2;
  } else {
    const bo3 = state.bo3 || {};
    if (!bo3.bannedListA) bo3.bannedListA = [];
    bannedList = bo3.bannedListA;
    maxG = bo3.maxGames || 5;
    banCount = getBo3BanCount();
  }

  const alreadyBanned = bannedList;
  const eligibleTeam = (enemyFinalTeam || []).filter(u => u && !alreadyBanned.includes(u.id));
  const candidateList = eligibleTeam.length ? eligibleTeam : (enemyFinalTeam || []);
  banCount = Math.min(banCount, candidateList.length);

  const currentRoundNum = isTourney && tMatch ? (tMatch.history ? tMatch.history.length : 1) : ((state.bo3 && state.bo3.round) || 1);

  $('#bo3CounterTitle').textContent = `第 ${currentRoundNum} 局失利：啟動戰術反制 (BO${maxG} 全系列賽永久鎖定)`;
  $('#bo3CounterDesc').textContent = banCount > 1
    ? `自由調撥模式特權：點選並指定禁用敵方上一局的 ${banCount} 件關鍵裝備，被禁用的裝備將於後續所有賽局永久鎖定不可再選！`
    : `開戰鎖定反制特權：點選並指定禁用敵方上一局的 1 件關鍵裝備，被禁用的裝備將於後續所有賽局永久鎖定不可再選！`;

  // 預設選取前 banCount 個候選裝備
  let cBans = candidateList.slice(0, banCount).map(u => u.id);
  window.__currentTourneyCandidateBans = cBans;
  if (state.bo3) {
    state.bo3.candidateBans = cBans;
    state.bo3.candidateBan = cBans[0] || null;
  }

  const updateCardSelectionVisuals = () => {
    const activeBans = window.__currentTourneyCandidateBans || (state.bo3 && state.bo3.candidateBans) || [];
    document.querySelectorAll('.bo3-ban-card').forEach(c => {
      const id = c.dataset.ban;
      c.classList.toggle('selected', activeBans.includes(id));
    });
    const confirmBtn = $('#bo3CounterConfirm');
    if (confirmBtn) {
      const isReady = activeBans.length === banCount;
      confirmBtn.disabled = !isReady;
      confirmBtn.textContent = isReady
        ? (banCount > 1 ? `確認禁用此 ${banCount} 件裝備並進入備戰` : `確認禁用【${UNIT_MAP[activeBans[0]]?.name || ''}】並進入備戰`)
        : `請選擇 ${banCount} 件要禁用的裝備 (已選 ${activeBans.length}/${banCount})`;
    }
  };

  $('#bo3BanGrid').innerHTML = candidateList.map((u, idx) => {
    const isSel = (window.__currentTourneyCandidateBans || []).includes(u.id);
    return `<div class="bo3-ban-card ${isSel ? 'selected' : ''}" data-ban="${u.id}">
      <div class="u-name">${esc(u.name)}</div>
      <div class="u-cost">$${u.cost} · ${CATS[u.cat].label}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">輸出傷害: ${Math.round(u.dmgDone || 0)}</div>
    </div>`;
  }).join('');

  $('#bo3NextInfo').innerHTML = `<div class="panel" style="padding:10px">
    <b>第 ${nextRound} 局戰場情報：</b> ${nextEvent.icon} ${esc(nextEvent.name)}（${esc(nextEvent.desc)}）
    <div class="bo3-ban-timer-bar" id="bo3BanTimerBar" style="margin-top:8px">
      <span>⏱️ 戰術反制時限：<b id="bo3BanSec">25</b>s（逾時將由參謀本部自動鎖定傷害最高 MVP 裝備）</span>
      <div class="bo3-ban-timer-track">
        <div class="bo3-ban-timer-fill" id="bo3BanTimerFill" style="width:100%"></div>
      </div>
    </div>
  </div>`;

  $('#bo3CounterModal').hidden = false;
  updateCardSelectionVisuals();

  // 啟動 25 秒戰術反制倒數計時
  PvPTimerManager.start('ban', 25, (rem, dur) => {
    const secEl = $('#bo3BanSec');
    const fillEl = $('#bo3BanTimerFill');
    if (secEl) secEl.textContent = rem;
    if (fillEl) fillEl.style.width = `${Math.round((rem / dur) * 100)}%`;
  }, () => {
    // 25 秒超時：自動挑選上一局傷害 (dmgDone) 最高的 banCount 件武器
    const sortedByDmg = candidateList.slice().sort((a, b) => ((b.dmgDone || 0) + (UNIT_MAP[b.id]?.cost || 0) * 0.1) - ((a.dmgDone || 0) + (UNIT_MAP[a.id]?.cost || 0) * 0.1));
    const autoBans = sortedByDmg.slice(0, banCount).map(u => u.id);
    window.__currentTourneyCandidateBans = autoBans;
    if (state.bo3) {
      state.bo3.candidateBans = autoBans;
      state.bo3.candidateBan = autoBans[0] || null;
    }
    updateCardSelectionVisuals();
    PvPTimerManager.incrementStreak();
    toast(`⚠️ 戰術反制時限已屆！參謀本部已自動為你鎖定敵方上一局核心裝備【${autoBans.map(id => UNIT_MAP[id]?.name || id).join('、')}】！`);
    const confirmBtn = $('#bo3CounterConfirm');
    if (confirmBtn) confirmBtn.click();
  });

  $('#bo3BanGrid').onclick = e => {
    const card = e.target.closest('.bo3-ban-card'); if (!card) return;
    const clickedId = card.dataset.ban;
    let curBans = window.__currentTourneyCandidateBans || (state.bo3 && state.bo3.candidateBans) || [];
    if (banCount === 1) {
      curBans = [clickedId];
    } else {
      if (curBans.includes(clickedId)) {
        curBans = curBans.filter(id => id !== clickedId);
      } else {
        if (curBans.length >= banCount) curBans.shift();
        curBans.push(clickedId);
      }
    }
    window.__currentTourneyCandidateBans = curBans;
    if (state.bo3) {
      state.bo3.candidateBans = curBans;
      state.bo3.candidateBan = curBans[0] || null;
    }
    updateCardSelectionVisuals();
  };
}

$('#bo3CounterConfirm').onclick = () => {
  const bansToApply = (state.bo3 && state.bo3.candidateBans && state.bo3.candidateBans.length)
    ? state.bo3.candidateBans
    : (window.__currentTourneyCandidateBans && window.__currentTourneyCandidateBans.length)
      ? window.__currentTourneyCandidateBans
      : (state.bo3 && state.bo3.candidateBan ? [state.bo3.candidateBan] : []);

  if (!bansToApply.length) return;

  if (state.mode === 'tournament') {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    const prof = (typeof getTournamentPlayerProfile === 'function') ? getTournamentPlayerProfile() : null;
    let myMatch = null;
    let isTeamA = false;

    if (onlineRoom && onlineRoom.matches) {
      myMatch = Object.values(onlineRoom.matches).find(m => (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid));
      if (myMatch) isTeamA = (myMatch.teamA?.uid === prof.uid);
    } else if (typeof TournamentEngine !== 'undefined') {
      myMatch = TournamentEngine.getMyMatch();
      if (myMatch) isTeamA = !!(myMatch.teamA && myMatch.teamA.isMe);
    }

    if (myMatch) {
      const targetBans = isTeamA ? (myMatch.bannedListA = myMatch.bannedListA || []) : (myMatch.bannedListB = myMatch.bannedListB || []);
      bansToApply.forEach(bId => {
        if (!targetBans.includes(bId)) targetBans.push(bId);
      });
      // 替換敵方被 Ban 的裝備 (避開所有累計被禁用的武器)
      const opp = isTeamA ? myMatch.teamB : myMatch.teamA;
      if (opp && opp.deck) {
        opp.deck = refitEnemyDeck(opp.deck, state.deck, state.event, targetBans);
      }
      $('#bo3CounterModal').hidden = true;
      const names = bansToApply.map(id => UNIT_MAP[id]?.name || id).join('、');
      setMode('tournament');
      renderTournamentView();
      const histLen = myMatch.history ? ensureArray(myMatch.history).length : 0;
      toast(`🎯 戰術反制生效：已封鎖對手的【${names}】（系列賽累計禁用 ${targetBans.length} 件）！請調配陣容迎戰第 ${histLen + 1} 局！`);
      return;
    }
  }

  const bo3 = state.bo3;

  if (!bo3.bannedListA) bo3.bannedListA = [];
  bansToApply.forEach(bannedId => {
    if (!bo3.bannedListA.includes(bannedId)) {
      bo3.bannedListA.push(bannedId);
    }
  });
  bo3.bannedByA = bansToApply[bansToApply.length - 1];
  $('#bo3CounterModal').hidden = true;

  const names = bansToApply.map(id => UNIT_MAP[id]?.name || id).join('、');

  PvPTimerManager.stop();
  PvPTimerManager.resetStreak();

  if (state.isOnlinePvp) {
    // 線上真人對抗：發送 BAN_COMMIT 給對手，附帶全系列賽累計禁用清單與本次禁用陣列
    OnlinePvPEngine.sendPacket('BAN_COMMIT', { 
      bannedUnitIds: bansToApply,
      bannedUnitId: bansToApply[0],
      bannedList: bo3.bannedListA.slice()
    });
    state.pvpMyReady = false;
    renderAll();
    const refitSec = (state.bo3.marketMode === 'free') ? 60 : 45;
    startPvpDeploymentTimer(refitSec);
    toast(`🎯 戰術反制生效：已永久鎖定對手的【${names}】（累計禁用 ${bo3.bannedListA.length} 件）！請重新調整第 ${bo3.round} 局陣容 (⏱️ 備戰限時 ${refitSec}s)。`);
    return;
  }

  bo3.round++;
  // 替換敵方被 Ban 的裝備 (避開所有累計被禁用的武器)
  bansToApply.forEach(bannedId => {
    const banIdx = bo3.enemyDeck.indexOf(bannedId);
    if (banIdx >= 0) {
      const slotFixed = SLOTS[banIdx].fixed;
      const cat = slotFixed || UNIT_MAP[bannedId].cat;
      const alternatives = UNITS.filter(u => u.cat === cat && !bo3.bannedListA.includes(u.id) && !bo3.enemyDeck.includes(u.id));
      if (alternatives.length) bo3.enemyDeck[banIdx] = pick(alternatives).id;
    }
  });

  setupMatch();
  renderAll();
  toast(`🎯 戰術反制生效：已永久鎖定敵方的【${names}】（累計禁用 ${bo3.bannedListA.length} 件）！請調整陣容應戰。`);
};

/* BO3 系列賽冠軍結算 */
function showBo3SeriesResult(isPlayerWon) {
  if ($('#resultModal')) $('#resultModal').hidden = true;
  if ($('#bo3CounterModal')) $('#bo3CounterModal').hidden = true;
  const bo3 = state.bo3;
  if (bo3) {
    bo3.finished = true;
    bo3.winner = isPlayerWon ? (state.isOnlinePvp ? (OnlinePvPEngine.isHostUser() ? 'A' : 'B') : 'A') : (state.isOnlinePvp ? (OnlinePvPEngine.isHostUser() ? 'B' : 'A') : 'B');
  }
  const maxG = bo3.maxGames || 5;
  const winsNeeded = getBo3WinsNeeded();
  const isHost = OnlinePvPEngine.isHostUser();
  if (isPlayerWon && !bo3._statsRecorded) {
    bo3._statsRecorded = true;
    stats.bo3Won = (stats.bo3Won || 0) + 1;
    LS.set('wl15_stats', stats);
    if (typeof CloudSync !== 'undefined') {
      CloudSync.syncToCloud();
    }
  }
  currentActiveModal = $('#bo3SeriesModal');
  const scoreText = state.isOnlinePvp
    ? `(本部 ${bo3.winsA} - 突擊 ${bo3.winsB})`
    : `(${bo3.winsA} - ${bo3.winsB})`;

  $('#bo3SeriesCard').innerHTML = `
    <button class="modal-x" id="bo3CloseX" title="關閉彈窗並檢視戰場情形">✕</button>
    <div class="trophy-banner">
      <div class="tag">BO${maxG} SERIES ${isPlayerWon ? 'VICTORY' : 'DEFEAT'}</div>
      <h2>${isPlayerWon ? `🏆 贏得 BO${maxG} 系列賽！${scoreText}` : `BO${maxG} 系列賽惜敗 ${scoreText}`}</h2>
      <p class="muted" style="margin-top:6px">${isPlayerWon ? `恭喜你在殘酷的戰術禁用與兵種相剋博弈中奪得 ${winsNeeded} 勝，贏得系列賽勝利！` : '對手指揮官在關鍵局完成了針對性反制。再接再厲！'}</p>
    </div>
    <div class="bo3-timeline">
      ${bo3.history.map(h => {
        const roundWon = state.isOnlinePvp ? (isHost ? h.winner === 'A' : h.winner === 'B') : (h.winner === 'A');
        const isDraw = h.winner === 'draw';
        const resultLabel = isDraw ? '平 局 ⚖' : (roundWon ? '勝 利 ✔' : '敗 北 ✘');
        const resultColor = isDraw ? 'var(--amber)' : (roundWon ? 'var(--green)' : 'var(--red)');
        const scoreLine = state.isOnlinePvp
          ? `本部 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)} 突擊`
          : `我方 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)} 敵方`;
        return `<div class="bo3-round-row">
          <span><b>第 ${h.round}/${maxG} 局</b> · ${h.event.icon} ${h.event.name}</span>
          <span>${scoreLine}</span>
          <b style="color:${resultColor}">${resultLabel}</b>
        </div>`;
      }).join('')}
    </div>
    <div class="res-actions">
      <button class="btn primary" id="bo3NewSeries">${state.isOnlinePvp ? '結束對戰並返回大廳' : `重啟新一輪 BO${maxG} 對抗賽`}</button>
      <button class="btn" id="bo3Review">檢視戰場情形 🔍</button>
      ${state.isOnlinePvp ? '' : '<button class="btn ghost" id="bo3Close">返回大廳</button>'}
    </div>
  `;
  $('#bo3SeriesModal').hidden = false;

  const reviewBo3Battlefield = () => {
    $('#bo3SeriesModal').hidden = true;
    enterBattlefieldReviewState();
    toast('🔍 已進入戰場檢視：可點擊右上角【🔄 戰場重播】、【📊 查看系列賽戰報】或【↩️ 返回陣容查看】');
  };

  $('#bo3Review').onclick = reviewBo3Battlefield;
  $('#bo3CloseX').onclick = reviewBo3Battlefield;
  $('#bo3SeriesModal').onclick = (e) => {
    if (e.target === $('#bo3SeriesModal')) reviewBo3Battlefield();
  };

  $('#bo3NewSeries').onclick = () => {
    $('#bo3SeriesModal').hidden = true;
    closeBattle();
    if (state.isOnlinePvp) {
      OnlinePvPEngine.closeConnection();
      state.isOnlinePvp = false;
      state.pvpMyReady = false;
      state.pvpOpponentReady = false;
      state.pvpOpponentDeck = null;
      initBo3Series();
      renderAll();
      toast('已結束線上雙人對戰，回到常規模式。');
    } else {
      initBo3Series();
      renderAll();
    }
  };
  if ($('#bo3Close')) {
    $('#bo3Close').onclick = () => {
      $('#bo3SeriesModal').hidden = true;
      closeBattle();
      if (state.isOnlinePvp) {
        OnlinePvPEngine.closeConnection();
        state.isOnlinePvp = false;
      }
      state.bo3.active = false;
      setMode('quick');
    };
  }
}

/* ---------- 旗艦級戰鬥結算報告 (C4ISR Tactical After-Action Report, AAR) ---------- */
function showResult(res, bo3Custom) {
  if (!res) return;
  try {
    const isHost = (typeof OnlinePvPEngine !== 'undefined' && typeof OnlinePvPEngine.isHostUser === 'function') ? OnlinePvPEngine.isHostUser() : true;
    const won = state.isOnlinePvp ? (isHost ? res.winner === 'A' : res.winner === 'B') : (res.winner === 'A');
    const draw = res.winner === 'draw';
    const A = (res.vp && res.vp.A) ? res.vp.A : { total: 0, remain: 0, control: 0, upset: 0 };
    const B = (res.vp && res.vp.B) ? res.vp.B : { total: 0, remain: 0, control: 0, upset: 0 };
    const f = x => (typeof x === 'number' && !isNaN(x)) ? x.toFixed(1) : '0.0';
    const why = buildWhy(res);

    // 雙方存活統計與優劣勢
    const finalA = (res.final && Array.isArray(res.final.A)) ? res.final.A : [];
    const finalB = (res.final && Array.isArray(res.final.B)) ? res.final.B : [];
    const aliveCountA = finalA.filter(u => u.alive).length;
    const aliveCountB = finalB.filter(u => u.alive).length;
    const mySide = state.isOnlinePvp ? (isHost ? 'A' : 'B') : 'A';
    const enemySide = mySide === 'A' ? 'B' : 'A';
    const myAlive = mySide === 'A' ? aliveCountA : aliveCountB;
    const enemyAlive = mySide === 'A' ? aliveCountB : aliveCountA;
    const myTotalVP = (res.vp && res.vp[mySide] && typeof res.vp[mySide].total === 'number') ? res.vp[mySide].total : 0;
    const enemyTotalVP = (res.vp && res.vp[enemySide] && typeof res.vp[enemySide].total === 'number') ? res.vp[enemySide].total : 0;
    const diffVP = myTotalVP - enemyTotalVP;
    const enemyWiped = enemyAlive === 0;

    // 1. 計算作戰評級 (Combat Grade)
    let grade = 'B', gradeTitle = '戰術險勝', gradeDesc = '戰況焦灼，力克獲勝', gradeClass = 'grade-b';
    if (myAlive === 0 && enemyAlive === 0) {
      grade = '⚖';
      gradeTitle = '同歸於盡';
      gradeDesc = '雙方全員戰歿無人生還，戰場以玉石俱焚告終！';
      gradeClass = 'grade-draw';
    } else if (won) {
      if (myAlive === 5) {
        grade = 'S';
        gradeTitle = '戰略完勝';
        gradeDesc = '全隊ACE 全員存活 · 完美殲敵';
        gradeClass = 'grade-s';
      } else if (myAlive >= 4 && (diffVP >= 8 || enemyWiped)) {
        grade = 'S';
        gradeTitle = '戰略完勝';
        gradeDesc = `主力建制極度完好 (${myAlive}/5 存活) · 壓倒性戰術優勢`;
        gradeClass = 'grade-s';
      } else if (myAlive >= 3 && (diffVP >= 5 || enemyWiped)) {
        grade = 'A';
        gradeTitle = '作戰大勝';
        gradeDesc = `戰術全面壓制，重創敵主力建制 (${myAlive}/5 存活)`;
        gradeClass = 'grade-a';
      } else if (myAlive >= 4) {
        grade = 'A';
        gradeTitle = '作戰勝利';
        gradeDesc = `主力戰力保持穩固 (${myAlive}/5 存活)，奪得戰場主導權`;
        gradeClass = 'grade-a';
      } else if (myAlive >= 2) {
        grade = 'B';
        gradeTitle = '戰術險勝';
        gradeDesc = `雙方激烈交火後慘勝 (${myAlive}/5 存活)，成功擊潰敵主力輸出`;
        gradeClass = 'grade-b';
      } else {
        grade = 'C';
        gradeTitle = '慘勝突圍';
        gradeDesc = `浴血苦戰！特遣部隊遭受重創 (僅 ${myAlive}/5 存活)，險峻逆轉獲勝`;
        gradeClass = 'grade-c';
      }
    } else if (draw) {
      grade = '—';
      gradeTitle = '勢均平局';
      gradeDesc = '雙方旗鼓相當，戰力耗盡平分秋色';
      gradeClass = 'grade-draw';
    } else {
      if (diffVP > -6 || enemyAlive <= 2) {
        grade = 'C';
        gradeTitle = '惜敗撤退';
        gradeDesc = '重創對方主力建制，僅以微幅戰術分差落敗';
        gradeClass = 'grade-c';
      } else {
        grade = 'D';
        gradeTitle = '戰役潰敗';
        gradeDesc = '戰線全面壓制潰退，建議調整教條配置';
        gradeClass = 'grade-d';
      }
    }

    // 2. 計算 MVP 與名將名
    const mvpSide = won ? mySide : enemySide;
    const myFinal = mySide === 'A' ? finalA : finalB;
    const enemyFinal = mySide === 'A' ? finalB : finalA;
    const mvpUnit = (res.mvp && res.mvp[mvpSide]) || (won ? myFinal[0] : enemyFinal[0]) || myFinal[0] || enemyFinal[0] || {
      id: '', name: '作戰主力', cost: 0, v: 1, dmgDone: 0, alive: true
    };
    const mvpMeta = (mvpUnit.id && UNIT_MAP[mvpUnit.id]) || {};
    const mvpIsMine = mvpSide === mySide;

    // 3. 戰略得分比例
    const sumVP = (A.total || 0) + (B.total || 0);
    const pctA = sumVP > 0 ? Math.round(((A.total || 0) / sumVP) * 100) : 50;
    const pctB = 100 - pctA;

    const evObj = res.ev || state.event || (typeof EVENTS !== 'undefined' ? EVENTS[0] : { icon: '🌐', name: '標準空域' });
    let subtitle = `${esc((evObj.icon || '🌐') + ' ' + (evObj.name || '標準海空域'))}`;
    if (state.mode === 'daily') subtitle += ' · 精選對戰 #' + dailyNo();
    else if (state.mode === 'bo3' && state.bo3) subtitle += ` · BO${getBo3WinsNeeded() * 2 - 1} 第 ${state.bo3.round} 局 (比分 ${state.bo3.winsA} - ${state.bo3.winsB})`;
    else if (state.mode === 'ladder') subtitle += ' · 天梯競技爭鋒';
    else subtitle += ' · 快速交鋒 · 聯合戰術推演';

    const isWinchester = Boolean(res.ammoDepleted) || (!enemyWiped && myAlive > 0 && enemyAlive > 0);
    if (isWinchester) {
      if (won) {
        gradeTitle = diffVP >= 12 ? '彈盡裁定大勝' : '彈盡戰略勝出';
        gradeDesc = `雙方彈藥與油料耗盡脫離接觸，依戰略積分（+${f(diffVP)} VP）裁定勝出！`;
      } else if (draw) {
        gradeTitle = '彈盡勢均平局';
        gradeDesc = '雙方彈藥耗盡脫離接觸，戰略積分旗鼓相當握手言和';
      } else {
        gradeTitle = diffVP > -8 ? '彈盡戰略惜敗' : '彈盡戰略受挫';
        gradeDesc = `雙方彈藥耗盡脫離接觸，以戰略積分差距（${f(diffVP)} VP）落敗`;
      }
    }

    const modeTagText = (myAlive === 0 && enemyAlive === 0)
      ? '⚔️ 同歸於盡'
      : (isWinchester
          ? (won ? '📦 彈藥耗盡 · VP 勝出' : (draw ? '📦 彈藥耗盡 · 平局' : '📦 彈藥耗盡 · VP 惜敗'))
          : (won 
              ? (enemyWiped ? '🎯 全殲勝局' : '⭐ 戰略大勝') 
              : (myAlive === 0 ? '💥 部隊覆滅' : (draw ? '⚖️ 平局握手' : '🛡️ 戰略受挫'))));

    $('#resultCard').innerHTML = `
      <button class="modal-x" id="rCloseX" title="關閉彈窗並檢視戰場情形">✕</button>

      <!-- 一體化戰略評級頂部戰況條 (Unified Outcome Bar) -->
      <div class="aar-outcome-bar ${won ? 'win' : draw ? 'draw' : 'lose'}">
        <div class="outcome-badge-col">
          <div class="aar-grade-badge-sm ${gradeClass}">
            <span class="grade-char">${grade}</span>
            <span class="grade-label">GRADE</span>
          </div>
        </div>
        <div class="outcome-title-col">
          <div class="outcome-headline">
            <h2 class="outcome-main-title">${gradeTitle}</h2>
            <span class="outcome-mode-tag">${modeTagText}</span>
            <span class="outcome-sub-desc">${gradeDesc}</span>
          </div>
          <div class="outcome-meta-row">
            <span class="aar-env-tag">${subtitle}</span>
          </div>
        </div>
        <div class="outcome-gauge-col">
          <div class="gauge-labels-compact">
            <span class="g-side g-a">${state.isOnlinePvp ? (isHost ? '🔵 司令部特遣隊 (我方)' : '🔵 司令部特遣隊 (對方)') : '我方'} <b>${f(A.total)} VP</b> <span class="g-alive">(${aliveCountA}/5 存活)</span></span>
            <span class="g-vs">VS</span>
            <span class="g-side g-b">${state.isOnlinePvp ? (isHost ? '🔴 假想敵突擊隊 (對方)' : '🔴 假想敵突擊隊 (我方)') : (state.mode === 'quick' && state.enemyName ? `🔴 敵方 (${esc(state.enemyName)})` : (state.mode === 'ladder' && state.ladderEnemy ? `🔴 天梯對手 (${esc(state.ladderEnemy.name)})` : '敵方'))} <b>${f(B.total)} VP</b> <span class="g-alive">(${aliveCountB}/5 存活)</span></span>
          </div>
          <div class="gauge-bar-track">
            <div class="gauge-fill-a" style="width:${pctA}%"></div>
            <div class="gauge-fill-b" style="width:${pctB}%"></div>
          </div>
        </div>
      </div>

      <!-- 中部網格：全場MVP 寫真展台 + 戰略積分三維度解析 -->
      <div class="aar-body-grid">
        <!-- 左側：全場MVP 榮譽寫真展台 (純淨頂部單行標示 + 右下角戰術打擊傷害，載具100%零遮擋) -->
        <div class="aar-mvp-showcase ${mvpIsMine ? 'mine' : 'enemy'}">
          ${mvpMeta.img ? `<img class="mvp-bg-img" src="${mvpMeta.img}" alt="${esc(mvpMeta.name || '')}" onerror="this.style.display=\'none\'"/>` : ''}
          <div class="mvp-vignette-overlay"></div>
          <!-- 頂部單行滿寬展開，不換行，超出以...截斷 (移除 Windows 顯示為黑字單色代碼之 emoji 國旗，由後方來源國如「美國」統一標示) -->
          <div class="mvp-top-line" title="${esc(mvpUnit.name || '')} ${esc(mvpMeta.origin || '')} · $${mvpUnit.cost || 0} · ${mvpUnit.v ? `${mvpUnit.v}型` : '主力'}">
            <span class="mvp-hero-badge">👑 MVP</span>
            <strong class="mvp-hero-name">${esc(mvpUnit.name || '核心部隊')}</strong>
            <span class="mvp-hero-meta">${esc(mvpMeta.origin || '')} · $${mvpUnit.cost || 0} · ${mvpUnit.v ? `${mvpUnit.v}型` : '主力'}</span>
          </div>
          <!-- 右下角傷害數值，無文字，以專屬戰術打擊準心 SVG 代替 -->
          <div class="mvp-bottom-dmg" title="本場累計輸出傷害">
            <svg class="mvp-dmg-svg" viewBox="0 0 24 24" width="20" height="20" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="2.5 2" opacity="0.85"></circle>
              <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></line>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></line>
              <line x1="1" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></line>
              <line x1="19" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></line>
              <polygon points="12 6.5 14.5 10.5 18.5 12 14.5 13.5 12 17.5 9.5 13.5 5.5 12 9.5 10.5" fill="currentColor"></polygon>
            </svg>
            <strong class="mvp-dmg-val">${Math.round(mvpUnit.dmgDone || 0)}</strong>
          </div>
        </div>

        <!-- 右側：戰略積分三維度深度解析 (清楚揭露計算邏輯與分數意義) -->
        <div class="aar-vp-breakdown-card">
          <div class="breakdown-head">📊 戰略積分維度結算 <small style="font-size:10px;color:var(--muted);font-weight:normal">(戰損比/掌控權/奇襲)</small></div>
          <div class="vp-dimension-item" title="【殘存戰力】：生還部隊保留之造價與耐久度折算（造價 × 殘餘HP% × 4）。保存主力裝備越完整，戰略資產得分越高。">
            <div class="vp-dim-info">
              <span class="dim-name">🛡️ 殘存戰力 (Force Survival)</span>
              <small class="dim-desc">生還主力造價與殘餘耐久度折算</small>
            </div>
            <div class="vp-dim-scores">
              <b class="s-a ${(A.remain || 0) >= (B.remain || 0) ? 'lead' : ''}">${f(A.remain)}</b>
              <span class="s-sep">:</span>
              <b class="s-b ${(B.remain || 0) >= (A.remain || 0) ? 'lead' : ''}">${f(B.remain)}</b>
            </div>
          </div>
          <div class="vp-dimension-item" title="【戰場控制】：海陸空三大作戰主導權總計（滿分30分）。包含地面裝甲防線控制(最高15分)、制空權掌控(10分)、制海權掌控(5分)。">
            <div class="vp-dim-info">
              <span class="dim-name">🌐 戰場控制 (Zone Dominance)</span>
              <small class="dim-desc">海陸空三大主導權 (陸15/空10/海5)</small>
            </div>
            <div class="vp-dim-scores">
              <b class="s-a ${(A.control || 0) >= (B.control || 0) ? 'lead' : ''}">${f(A.control)}</b>
              <span class="s-sep">:</span>
              <b class="s-b ${(B.control || 0) >= (A.control || 0) ? 'lead' : ''}">${f(B.control)}</b>
            </div>
          </div>
          <div class="vp-dimension-item" title="【以弱勝強】：平價輕型部隊成功越級狙殺敵方高價主力的戰術奇襲獎勵！（越級價差 × 2，單局上限12分）。小成本消滅昂貴裝備可獲高額加分。">
            <div class="vp-dim-info">
              <span class="dim-name">⚡ 以弱勝強 (Tactical Upset)</span>
              <small class="dim-desc">平價部隊越級奇襲敵主力 (價差×2)</small>
            </div>
            <div class="vp-dim-scores">
              <b class="s-a ${(A.upset || 0) >= (B.upset || 0) ? 'lead' : ''}">${f(A.upset)}</b>
              <span class="s-sep">:</span>
              <b class="s-b ${(B.upset || 0) >= (A.upset || 0) ? 'lead' : ''}">${f(B.upset)}</b>
            </div>
          </div>
        </div>
      </div>

      <!-- 各單位傷害輸出戰力統計條 (Unit Damage Meter) -->
      ${(() => {
        const renderSideDmg = (rawUnits, sideLabel, sideClass) => {
          const units = Array.isArray(rawUnits) ? rawUnits : [];
          if (!units.length) return `<div class="dmg-side-col ${sideClass}"><div class="dmg-side-head"><span>${sideLabel}</span><small>無數據</small></div></div>`;
          const totalDmg = Math.max(1, units.reduce((acc, u) => acc + Math.round((u && u.dmgDone) || 0), 0));
          const maxDmg = Math.max(1, ...units.map(u => Math.round((u && u.dmgDone) || 0)));
          return `<div class="dmg-side-col ${sideClass}">
            <div class="dmg-side-head">
              <span>${sideLabel}</span>
              <small>總輸出 <b>${totalDmg}</b></small>
            </div>
            <div class="dmg-unit-list">
              ${units.map((u, idx) => {
                const d = Math.round((u && u.dmgDone) || 0);
                const barPct = Math.round((d / maxDmg) * 100);
                const sharePct = Math.round((d / totalDmg) * 100);
                const hpPct = Math.max(0, Math.round(((u.hp || 0) / (u.hpMax || 1)) * 100));
                const uMeta = (u && u.id && UNIT_MAP[u.id]) || {};
                const catInfo = (typeof CATS !== 'undefined' && u && u.cat && CATS[u.cat]) ? CATS[u.cat] : {};
                const isMvp = ((sideClass === 'side-a' && mvpSide === 'A') || (sideClass === 'side-b' && mvpSide === 'B')) && Boolean(mvpUnit && u && (u === mvpUnit || (u.id && mvpUnit.id && u.id === mvpUnit.id) || (u.uid && mvpUnit.uid && u.uid === mvpUnit.uid)));
                return `<div class="dmg-unit-row ${u && u.alive ? '' : 'is-dead'} ${isMvp ? 'is-mvp' : ''}">
                  <div class="dmg-u-info">
                    <span class="dmg-u-name">
                      ${isMvp ? '<span class="dmg-mvp-badge">👑 MVP</span>' : ''}
                      <span style="font-family:var(--mono);font-size:10px;color:${catInfo.color || 'var(--muted)'};font-weight:700;margin-right:3px">${catInfo.short || `#${idx+1}`}</span>
                      ${uMeta.flag || ''} <b>${esc((u && u.name) || '作戰單位')}</b> <small>$${(u && u.cost) || 0}</small>
                    </span>
                    <span class="dmg-u-stat">${d} 傷害 <small>(${sharePct}%)</small> · <i class="${u && u.alive ? 'alive' : 'dead'}">${u && u.alive ? `存活 ${hpPct}%` : '陣亡'}</i></span>
                  </div>
                  <div class="dmg-bar-track">
                    <div class="dmg-bar-fill" style="width:${barPct}%;background:${isMvp ? 'linear-gradient(90deg, #f59e0b, #fbbf24);box-shadow:0 0 10px rgba(251,191,36,0.6)' : (catInfo.color || 'var(--cyan)')}"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        };
        return `<div class="aar-dmg-meter-card">
          <div class="intel-card-title">⚔️ 各單位傷害輸出戰果明細 (UNIT DAMAGE METER)</div>
          <div class="aar-dmg-grid">
            ${renderSideDmg(finalA, '🔵 我方特遣隊伍', 'side-a')}
            ${renderSideDmg(finalB, '🔴 敵方作戰特遣隊', 'side-b')}
          </div>
        </div>`;
      })()}

      <!-- 下部網格：戰局關鍵轉折點 + 參謀總部戰術復盤 -->
      <div class="aar-intel-grid">
        <div class="aar-intel-card">
          <div class="intel-card-title">⚡ 戰局關鍵轉折點 (KEY TURNING POINTS)</div>
          <ul class="aar-turn-list">
            ${res.key && res.key.length ? res.key.slice(0, 2).map(k => `
              <li class="${k.side === 'A' ? 'k-side-a' : 'k-side-b'}">
                <span class="k-marker">${k.side === 'A' ? '我方優勢' : '敵方突破'}</span>
                <span class="k-text">${esc(k.text)}</span>
              </li>
            `).join('') : '<li class="k-neutral">雙方平穩消耗，未發生決定性突變</li>'}
          </ul>
        </div>

        <div class="aar-intel-card">
          <div class="intel-card-title">💡 參謀總部戰術復盤 (TACTICAL DEBRIEF)</div>
          <ul class="aar-debrief-list">
            ${why.slice(0, 2).map(w => `
              <li class="${w.t === 'good' ? 'd-good' : w.t === 'bad' ? 'd-bad' : 'd-neutral'}">
                <span class="d-bullet">${w.t === 'good' ? '✔' : w.t === 'bad' ? '✖' : '●'}</span>
                <span>${esc(w.s)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>

      ${(Boolean(state.isOnlinePvp || state.mode === 'tournament' || bo3Custom)) ? `
        <div class="aar-timeout-bar" id="aarTimeoutBar">
          <div class="aar-timeout-bar-head">
            <span>⏱️ 戰報停留倒數 <b id="aarCountdownSec">15</b>s</span>
            <small>點擊按鈕或倒數歸零後將推進下一局</small>
          </div>
          <div class="aar-timeout-track">
            <div class="aar-timeout-fill" id="aarTimeoutFill" style="width:100%"></div>
          </div>
        </div>
      ` : ''}

      <!-- 底部當代軍事行動命令區 -->
      <div class="aar-actions">
        ${bo3Custom 
          ? `<button class="btn amber aar-btn-main" id="rBo3Next">${esc(bo3Custom.bo3NextText)}</button>` 
          : (state.mode === 'tournament' 
              ? `<button class="btn amber aar-btn-main" id="rRematch">🏆 返回錦標賽</button>` 
              : (state.mode === 'ladder'
                  ? `<button class="btn primary aar-btn-main" id="rRematch">⚔️ 返回天梯指揮中心</button>`
                  : `<button class="btn primary aar-btn-main" id="rRematch">⚔️ ${state.mode === 'daily' ? '調整陣容再戰' : '再戰一局'}</button>`))}
        <button class="btn ghost aar-btn-sub" id="rReview">🔍 檢視戰場情形</button>
        <button class="btn ghost aar-btn-sub" id="rShareReplay" title="複製一鍵重播網址，戰術同好點擊即可100%精準重現推演">🔗 分享重播網址</button>
        ${state.mode === 'tournament' ? '' : (state.mode === 'ladder' ? '<button class="btn ghost aar-btn-sub" id="rLadderScoreToggle">🏅 查看天梯積分變動</button>' : `<button class="btn ghost aar-btn-sub" id="rEdit">🛠️ 返回編輯編組</button>`)}
      </div>
    `;

    currentActiveModal = $('#resultModal');
    $('#resultModal').hidden = false;

    const isMultiRoundMatch = Boolean(state.isOnlinePvp || state.mode === 'tournament' || bo3Custom);
    if (isMultiRoundMatch) {
      PvPTimerManager.start('result', 15, (rem, dur) => {
        const secEl = $('#aarCountdownSec');
        const fillEl = $('#aarTimeoutFill');
        if (secEl) secEl.textContent = rem;
        if (fillEl) fillEl.style.width = `${Math.round((rem / dur) * 100)}%`;
      }, () => {
        if (bo3Custom && bo3Custom.bo3Callback) {
          bo3Custom.bo3Callback();
        } else {
          const nextBtn = $('#rRematch') || $('#rBo3Next');
          if (nextBtn) nextBtn.click();
        }
      });
    }

    const reviewBattlefield = () => {
      PvPTimerManager.stop();
      $('#resultModal').hidden = true;
      enterBattlefieldReviewState();
      toast('🔍 已進入戰場檢視：可點擊頂部【重新戰場重播】或【查看結算報告】');
    };

    if ($('#rReview')) $('#rReview').onclick = reviewBattlefield;
    if ($('#rCloseX')) $('#rCloseX').onclick = reviewBattlefield;
    $('#resultModal').onclick = (e) => {
      if (e.target === $('#resultModal')) reviewBattlefield();
    };

    // 複製一鍵戰鬥重播網址
    if ($('#rShareReplay')) {
      $('#rShareReplay').onclick = () => {
        const url = buildReplayShareUrl(res);
        copyText(url);
        toast('🔗 已複製精準戰鬥重播網址！分享給好友即可100%重現戰場交火動畫！');
      };
    }

    // 天梯積分切換按鈕
    if ($('#rLadderScoreToggle')) {
      $('#rLadderScoreToggle').onclick = () => {
        $('#resultModal').hidden = true;
        currentActiveModal = $('#ladderResultModal');
        $('#ladderResultModal').hidden = false;
      };
    }

    // 複製戰報功能
    if ($('#rShareDebrief')) $('#rShareDebrief').onclick = () => {
      const txt = shareText(res);
      navigator.clipboard.writeText(txt).then(() => {
        toast('📋 已複製精彩戰役摘要至剪貼簿！可直接貼上分享給戰友！');
      }).catch(() => {
        toast('隊碼: ' + encodeDeck(state.deck));
      });
    };

    if (bo3Custom) {
      if ($('#rBo3Next')) {
        $('#rBo3Next').onclick = () => {
          PvPTimerManager.stop();
          bo3Custom.bo3Callback();
        };
      }
    } else {
      if ($('#rRematch')) {
        $('#rRematch').onclick = () => {
          PvPTimerManager.stop();
          closeBattle();
          if (state.mode === 'tournament') {
            setMode('tournament');
            return;
          }
          if (state.mode === 'ladder') {
            setMode('ladder');
            return;
          }
          if (state.mode !== 'daily') {
            setupMatch();
                      renderAll();
            if (state.deck.every(Boolean)) startBattle(); else toast('請先補齊編組');
          }
        };
      }
    }

    const editBtn = $('#rEdit');
    if (editBtn) {
      if (state.mode === 'tournament') {
        editBtn.style.display = 'none';
      } else if (state.mode === 'ladder') {
        editBtn.textContent = '⚔️ 返回天梯榜';
        editBtn.onclick = handleExitBattleToCurrentMode;
      } else {
        editBtn.textContent = '🛠️ 返回編輯編組';
        editBtn.onclick = handleExitBattleToCurrentMode;
      }
    }
  } catch (renderErr) {
    console.error('showResult critical render error:', renderErr);
    $('#resultCard').innerHTML = `
      <button class="modal-x" id="rCloseX" onclick="$('#resultModal').hidden=true">✕</button>
      <div style="padding:28px 20px;text-align:center">
        <h3 style="font-family:var(--head);font-size:20px;margin-bottom:8px">📊 戰況推演結算報告</h3>
        <p class="muted" style="font-size:14px;margin-bottom:18px">本局戰役推演已完成 (${res && res.winner === 'A' ? '我方獲勝' : (res && res.winner === 'draw' ? '平局' : '作戰受挫')})</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary" onclick="$('#resultModal').hidden=true;handleExitBattleToCurrentMode();">⚔️ 返回戰術指揮中心</button>
          <button class="btn ghost" onclick="$('#resultModal').hidden=true;">關閉報告</button>
        </div>
      </div>
    `;
    currentActiveModal = $('#resultModal');
    $('#resultModal').hidden = false;
  }
}
window.showResult = showResult;

function buildWhy(res) {
  if (!res) return [];
  const A = res.vp?.A || { remain: 0, control: 0 };
  const B = res.vp?.B || { remain: 0, control: 0 };
  const out = [];
  const won = res.winner === 'A';
  if (res.ammoDepleted) {
    out.push({
      t: won ? 'good' : (res.winner === 'draw' ? '' : 'bad'),
      s: `彈藥耗盡裁定（WINCHESTER）：雙方激戰滿 10 輪後彈藥與油料見底脫離接觸，依戰略積分 ${ (A.total || 0).toFixed(1) } : ${ (B.total || 0).toFixed(1) } VP 裁定勝負。`
    });
  }
  const ewA = Number(res.ewA) || 0;
  const ewB = Number(res.ewB) || 0;
  if (res.advSide) {
    const big = Math.abs(ewA - ewB) >= 25, mine = res.advSide === 'A';
    out.push({ t: mine ? 'good' : 'bad', s: `軍師奇謀：我方 ${ewA.toFixed(0)} vs 敵方 ${ewB.toFixed(0)}，${mine ? (big ? '我軍算無遺策，敵陣動搖、命中率顯著下降。' : '我軍略占奇謀先機。') : (big ? '敵軍奇門八陣壓制我軍，攻勢屢屢受挫。' : '敵軍略占奇謀之利。')}` });
  } else {
    out.push({ t: '', s: `軍師奇謀：我方 ${ewA.toFixed(0)} vs 敵方 ${ewB.toFixed(0)}，雙方軍師鬥法旗鼓相當。` });
  }
  const dRemain = (A.remain || 0) - (B.remain || 0);
  out.push({ t: dRemain >= 0 ? 'good' : 'bad', s: `殘餘兵力${dRemain >= 0 ? '領先' : '落後'} ${Math.abs(dRemain).toFixed(1)} 分——${dRemain >= 0 ? '我軍主力保存更為完整。' : '我軍主力折損較重。'}` });
  if ((A.control || 0) !== (B.control || 0)) {
    out.push({ t: (A.control || 0) > (B.control || 0) ? 'good' : 'bad', s: `陣地奪控 ${(A.control || 0).toFixed(0)} vs ${(B.control || 0)}：${(A.control || 0) > (B.control || 0) ? '我軍牢牢掌控中軍重甲、突騎與渡口主動權。' : '敵軍於重甲步陣與兩翼突擊取得優勢。'}` });
  }
  const mvpSide = won ? 'A' : 'B';
  const m = res.mvp ? (res.mvp[mvpSide] || res.mvp.A || res.mvp.B) : null;
  if (m && m.name) {
    out.push({ t: '', s: `${won ? '我軍' : '敵軍'}破陣首功：${esc(m.name)}（累計殺傷 ${Math.round(m.dmgDone || 0)}，出擊 ${m.shots || 0} 合）` });
  }
  // 擷取戰場關鍵攔截與首波斬首事件
  const allLines = (res.frames || []).flatMap(f => (f && f.lines) ? f.lines.map(l => Object.assign({ phase: f.phase }, l)) : []);
  const abmLine = allLines.find(l => l.brevity === 'ABM-KILL');
  if (abmLine) {
    out.push({ t: abmLine.side === 'A' ? 'good' : 'bad', s: `強弩截擊破敵：${esc(abmLine.text.replace(/^\[[^\]]+\]\s*/, ''))}` });
  }
  const p1Kill = allLines.find(l => l.phase === 1 && l.kind === 'kill');
  if (p1Kill) {
    out.push({ t: p1Kill.side === 'A' ? 'good' : 'bad', s: `先制斬將奪旗：階段一 ${esc(p1Kill.text.replace(/^\[[^\]]+\]\s*/, ''))}` });
  }
  if (!won && res.winner !== 'draw' && res.final?.A) {
    const enemyMvp = res.mvp?.B;
    const lostP1Ads = res.final.A.find(u => u && u.cat === 'air_defense' && !u.alive && allLines.some(l => l.phase === 1 && l.kind === 'kill' && l.tuid === u.uid));
    if (lostP1Ads) {
      out.push({ t: 'bad', s: `軍師獻策：我軍神射營【${esc(lostP1Ads.name)}】於開戰先制遭敵奇襲潰滅；建議改配高隱匿伏弓或鐵桶拒馬弓將鞏固後陣。` });
    } else if (ewB - ewA >= 20) {
      out.push({ t: 'bad', s: `軍師獻策：敵方奇謀大幅領先（+${(ewB - ewA).toFixed(0)} 奇謀）惑亂我軍陣腳；建議起用諸葛亮、竹中半兵衛、郭嘉等大軍師，或改採「難知如陰」兵法反制。` });
    } else if (enemyMvp && enemyMvp.traits && enemyMvp.traits.includes('SUB')) {
      out.push({ t: 'bad', s: `軍師獻策：敵方潛行奇兵【${esc(enemyMvp.name)}】奇襲得手；建議配置具備【水陸搜剿】或【登高瞭望】特技之先登名將識破伏兵。` });
    } else if (enemyMvp && enemyMvp.cat === 'support' && enemyMvp.traits && enemyMvp.traits.includes('TRUE_AT')) {
      out.push({ t: 'bad', s: `軍師獻策：敵軍破甲火器重創我軍盾陣；建議部署具備【密集弩陣】特性之神射名將壓制敵方奇器。` });
    } else {
      const air = res.final.A.find(u => u && u.cat === 'air');
      if (air && !air.alive) out.push({ t: 'bad', s: '軍師獻策：我軍奔雷突騎遭敵強弩拒馬重創，可改遣高隱匿輕騎迂迴側擊，或以先制破弓戰法開路。' });
      else out.push({ t: 'bad', s: '軍師獻策：可調整風林火山兵法教條，或湊齊「八陣圖／奇正相生／步騎合圍」古兵法陣勢以扭轉乾坤。' });
    }
  }
  return out;
}

function buildReplayShareUrl(res) {
  const deckA = (res.final?.A || []).map(u => u.id);
  const deckB = (res.final?.B || []).map(u => u.id);
  const payload = [
    deckA.join('.'),
    deckB.join('.'),
    res.seed >>> 0,
    res.ev?.id || 'clear',
    res.docs?.A || 'defense',
    res.docs?.B || 'defense'
  ].join('~');
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('replay', btoa(payload));
  return url.toString();
}

function shareText(res) {
  const won = res.winner === 'A';
  const modeName = state.mode === 'daily' ? '精選對戰 #' + dailyNo() : '快速交鋒';
  const names = (res.final?.A || []).map(u => u.name).join(' / ') || state.deck.map(id => UNIT_MAP[id]?.name || id).join(' / ');
  const replayUrl = buildReplayShareUrl(res);
  return `【頂尖對戰】${modeName} ${won ? '勝利 ✅' : res.winner === 'draw' ? '平手 ⚖' : '敗北 ❌'}\n戰場：${res.ev.name}　積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)}\n我的 $${deckCost(state.deck)} 陣容：${names}\n陣容代碼：${encodeDeck(state.deck)}\n重播連結：${replayUrl}`;
}

function closeBattle() {
  exitActiveBattle();
  if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.playBgm === 'function') {
    SoundEngine.playBgm('prep');
  }
  const vb = $('#viewBuild'); if (vb) vb.hidden = false;
  const mb = $('#missionBar'); if (mb) mb.hidden = false;
  const cd = $('#commandDeck'); if (cd) cd.hidden = false;
}

/* ---------- 戰術海報生成與遊戲說明手冊 (已獨立抽離至 js/poster-help.js) ---------- */
function downloadPoster(res) {
  if (typeof PosterHelpModule !== 'undefined' && typeof PosterHelpModule.downloadPoster === 'function') {
    PosterHelpModule.downloadPoster(res, { state, dailyNo, dateKey, encodeDeck, toast });
  }
}

window.addEventListener('appinstalled', () => {
  window.__deferredPwaPrompt = null;
  toast('🎉 《頂尖對決》已成功安裝至您的裝置主畫面！');
  const btn = document.getElementById('btnPwaInstallPrompt');
  if (btn) btn.innerHTML = '✅ 目前已是 APP 獨立模式';
});

function showHelp(activeTab = 'rules') {
  if (typeof PosterHelpModule !== 'undefined' && typeof PosterHelpModule.showHelp === 'function') {
    PosterHelpModule.showHelp(activeTab, { $, LS, toast });
  }
}
$('#btnHelp').onclick = () => showHelp('rules');
/* ---------- 深色 / 淺色主題管理 ---------- */
function applyTheme(theme, showNotice = false) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const iconEl = $('#themeIcon');
  const btn = $('#btnTheme');
  if (iconEl) iconEl.textContent = theme === 'light' ? '🌙' : '☀️';
  if (btn) btn.title = theme === 'light' ? '切換為深色模式 (夜間指揮所)' : '切換為淺色模式 (日間戰情室)';
  LS.set('wl15_theme', theme);
  if (showNotice) {
    toast(theme === 'light' ? '已切換為日間戰情室 (淺色模式)' : '已切換為夜間指揮中心 (深色模式)');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || state.theme || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next, true);
}

$('#btnTheme')?.addEventListener('click', toggleTheme);
$('#btnAudio')?.addEventListener('click', () => SoundEngine.toggle());

// 已依使用者指示全面移除所有快捷鍵監聽器 (包括 Space、Enter、R、C、Q、1、2、3、D 及 Escape 鍵)，全面改由滑鼠/觸控直覺點擊操作，徹底杜絕誤觸干擾。

$('#btnRerollMarket')?.addEventListener('click', rerollMarketPool);

/* ---------- 🌐 線上真人雙人對戰 (Online PvP) 處理 ---------- */
function openOnlinePvpModal(forceJoinCode = null) {
  const modal = $('#onlinePvpModal');
  if (!modal) return;
  currentActiveModal = modal;
  modal.hidden = false;

  const player = LadderEngine.getState().player;
  const pUid = player.uid || LadderEngine.getPlayerUID();
  const isHostRole = !forceJoinCode;
  const myName = (player && player.name && player.name !== '我方聯合戰術作戰群') ? player.name : (isHostRole ? '本部特遣隊' : '挑戰突擊隊');

  $('#pvpMyFlag').textContent = player.flag || '🇹🇼';
  $('#pvpMyName').textContent = myName;
  $('#pvpMyUid').textContent = pUid;

  if (forceJoinCode) {
    switchPvpTab('join');
    $('#pvpJoinCodeInput').value = forceJoinCode;
  } else {
    switchPvpTab('host');
    initHostRoom();
  }
}

function switchPvpTab(tab) {
  document.querySelectorAll('.pvp-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#pvpPanelHost').hidden = (tab !== 'host');
  $('#pvpPanelJoin').hidden = (tab !== 'join');
  $('#pvpVersusBox').hidden = true;
  $('#btnPvpStartBattle').hidden = true;
}

async function initHostRoom() {
  const codeDisplay = $('#pvpRoomCodeDisplay');
  const waitingStatus = $('#pvpWaitingStatus');
  if (!codeDisplay) return;

  codeDisplay.textContent = '連線配對中...';
  waitingStatus.innerHTML = '<span class="radar-dot"></span><span>正在向 WebRTC 訊令伺服器註冊房間...</span>';

  const player = LadderEngine.getState().player;
  const profile = { name: player.name, uid: player.uid || LadderEngine.getPlayerUID(), flag: player.flag };

  try {
    const res = await OnlinePvPEngine.createRoom(profile);
    codeDisplay.textContent = res.roomCode;
    waitingStatus.innerHTML = `<span class="radar-dot"></span><span>房間已就緒！請分享代碼 <b>${res.roomCode}</b> 給好友加入...</span>`;
  } catch (err) {
    codeDisplay.textContent = '連線失敗';
    waitingStatus.innerHTML = `<span style="color:var(--red)">⚠️ 連線失敗：${err.message || '請檢查網路連線'}</span>`;
  }
}

async function joinTargetRoom() {
  const input = $('#pvpJoinCodeInput');
  const btn = $('#btnSubmitJoinRoom');
  const waitingStatus = $('#pvpJoinWaitingStatus');
  const waitingText = $('#pvpJoinWaitingText');

  const rawCode = (input?.value || '').trim().toUpperCase();
  if (!rawCode) {
    toast('⚠️ 請輸入 6 位房間代碼！');
    if (input) input.focus();
    return;
  }
  const cleanCode = rawCode.replace(/^TOPCLASH-BO5-/, '');
  if (cleanCode.length < 5) {
    toast('⚠️ 房間代碼格式不符，請輸入 6 位代碼！');
    return;
  }

  // 立即提供視覺反饋與防連點防抖
  if (btn) {
    btn.disabled = true;
    btn.textContent = '連線中... ⏳';
  }
  if (waitingStatus) waitingStatus.hidden = false;
  if (waitingText) waitingText.textContent = `正在連線至房間 [${cleanCode}]...`;

  const player = LadderEngine.getState().player;
  const profile = { name: player.name, uid: player.uid || LadderEngine.getPlayerUID(), flag: player.flag };

  toast(`正在連線進入房間 [${cleanCode}]...`);
  try {
    await OnlinePvPEngine.joinRoom(cleanCode, profile);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '立即加入 ➔';
    }
    if (waitingStatus) waitingStatus.hidden = true;
    toast(`⚠️ 加入失敗：${err.message || '找不到該房間'}`);
  }
}

// 支援在房間代碼輸入框按 Enter 鍵直接連線
$('#pvpJoinCodeInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    joinTargetRoom();
  }
});

// 綁定 onlinePvpModal 互動
$('#pvpTabsRow')?.addEventListener('click', e => {
  const btn = e.target.closest('.pvp-tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  switchPvpTab(tab);
  if (tab === 'host') initHostRoom();
});

$('#btnCopyRoomCode')?.addEventListener('click', () => {
  const code = OnlinePvPEngine.getCurrentRoomCode();
  if (!code) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => toast(`📋 房間代碼 [${code}] 已複製！`));
  } else {
    toast(`📋 房間代碼: ${code}`);
  }
});

$('#btnCopyShareUrl')?.addEventListener('click', () => {
  const code = OnlinePvPEngine.getCurrentRoomCode();
  if (!code) return;
  const loc = window.location;
  const base = loc.protocol + '//' + loc.host + loc.pathname;
  const shareUrl = `${base}?room=${code}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareUrl).then(() => toast(`🔗 邀請網址已複製！好友開啟即可直連加入！`));
  } else {
    toast(`🔗 邀請網址: ${shareUrl}`);
  }
});

$('#btnSubmitJoinRoom')?.addEventListener('click', joinTargetRoom);

OnlinePvPEngine.on('error', err => {
  const joinBtn = $('#btnSubmitJoinRoom');
  if (joinBtn) {
    joinBtn.disabled = false;
    joinBtn.textContent = '立即加入 ➔';
  }
  const joinStatus = $('#pvpJoinWaitingStatus');
  if (joinStatus) joinStatus.hidden = true;
  toast(`⚠️ 線上對戰提示：${err}`);
});

$('#btnPvpCancel')?.addEventListener('click', () => {
  OnlinePvPEngine.closeConnection();
  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  clearUrlSearchParam('room');
});

// 當對手連線加入時
OnlinePvPEngine.on('opponent_joined', ({ opponent, isHost }) => {
  const joinBtn = $('#btnSubmitJoinRoom');
  if (joinBtn) {
    joinBtn.disabled = false;
    joinBtn.textContent = '立即加入 ➔';
  }
  const joinStatus = $('#pvpJoinWaitingStatus');
  if (joinStatus) joinStatus.hidden = true;
  $('#pvpPanelHost').hidden = true;
  $('#pvpPanelJoin').hidden = true;
  $('#pvpVersusBox').hidden = false;

  const oppName = (opponent && opponent.name && opponent.name !== '我方聯合戰術作戰群') ? opponent.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
  $('#pvpEnemyFlag').textContent = opponent.flag || '🌐';
  $('#pvpEnemyName').textContent = oppName;
  $('#pvpEnemyUid').textContent = opponent.uid || 'CMD-ONLINE';

  // 只有房主顯示開戰按鈕
  $('#btnPvpStartBattle').hidden = !isHost;
  toast(`⚡ 玩家【${opponent.flag || '🌐'} ${oppName}】(${opponent.uid}) 已成功連線進房！`);
});

function handleOnlinePvpSubmit() {
  if (state.pvpMyReady) {
    if (state.pvpOpponentReady) {
      if (OnlinePvPEngine.isHostUser() && state.pvpOpponentDeck && state.pvpOpponentDeck.length === 5) {
        toast('🎯 雙方皆已就緒，立即發起戰鬥推演！');
        checkBothReadyAndStartCombat();
      } else {
        toast('📡 已再次向對手發送陣容揭曉信號...');
        state.pvpMyRevealed = true;
        OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
          deck: state.deck.slice(),
          doctrine: state.doctrine,
          salt: state.pvpMySalt,
          commitHash: state.pvpMyCommitHash,
          round: state.bo3.round
        });
      }
    } else {
      toast('⏳ 你的陣容已提交並鎖定，正在等待對手完成配置 (已重新發送加密雜湊就緒信號)...');
      OnlinePvPEngine.sendPacket('DECK_COMMIT', {
        commitHash: state.pvpMyCommitHash,
        round: state.bo3.round
      });
    }
    return;
  }
  const full = state.deck.every(Boolean);
  const errs = full ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['請先配置滿 5 個槽位'];
  if (errs.length > 0) {
    toast('⚠️ 陣容未就緒：' + errs[0]);
    return;
  }

  // 1. 本地標記我方已準備並生成 Commit-Reveal 雜湊摘要 (支援 Web Crypto SHA-256 與 128-bit 安全鹽值)
  PvPTimerManager.stop();
  PvPTimerManager.resetStreak();
  state.pvpMyReady = true;
  state.pvpMySalt = (typeof OnlinePvPEngine.generateSecureSalt === 'function')
    ? OnlinePvPEngine.generateSecureSalt()
    : Math.random().toString(36).slice(2, 12);
  state.pvpMyCommitHash = OnlinePvPEngine.computeCommitHash(state.deck, state.doctrine, state.pvpMySalt);
  if (typeof OnlinePvPEngine.computeCommitHashAsync === 'function') {
    OnlinePvPEngine.computeCommitHashAsync(state.deck, state.doctrine, state.pvpMySalt).then(shaHash => {
      if (shaHash) state.pvpMyCommitHash = shaHash;
    }).catch(() => {});
  }
  if (state.mode === 'bo3' && state.bo3) {
    state.bo3.locked = true;
    updateRerollMarketButtonState();
  }

  // 2. Commit-Reveal：若對手尚未鎖定，僅發送 DECK_COMMIT 雜湊杜絕 F12 窺探；若對手已鎖定則直接揭曉 DECK_SUBMIT
  if (state.pvpOpponentReady) {
    state.pvpMyRevealed = true;
    OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
      deck: state.deck.slice(),
      doctrine: state.doctrine,
      salt: state.pvpMySalt,
      commitHash: state.pvpMyCommitHash,
      round: state.bo3.round
    });
  } else {
    state.pvpMyRevealed = false;
    OnlinePvPEngine.sendPacket('DECK_COMMIT', {
      commitHash: state.pvpMyCommitHash,
      round: state.bo3.round
    });
  }

  SoundEngine.play('equip');
  renderCommandDeck();
  renderMissionBar();

  if (state.pvpOpponentReady) {
    toast('🎯 雙方陣容皆已就緒！系統正在同步戰場，即將交火！');
    checkBothReadyAndStartCombat();
  } else {
    toast('✅ 你的陣容已加密提交並鎖定！正在等待對手完成配置...');
  }
}

function checkBothReadyAndStartCombat() {
  if (!state.pvpMyReady || !state.pvpOpponentReady || !state.pvpOpponentDeck || !state.pvpOpponentDeck.length) return;

  if (OnlinePvPEngine.isHostUser()) {
    // 房主生成同一個公平隨機種子與動態戰場事件 (優先使用下局預告事件)
    const seed = (Math.random() * 4294967296) >>> 0;
    const event = state.bo3.nextEvent || pick(EVENTS.filter(e => !state.event || e.id !== state.event.id));
    state.bo3.nextEvent = null;
    // 同時在 COMBAT_SYNC 攜帶備援卡組資訊，徹底杜絕網路延遲競爭
    OnlinePvPEngine.sendPacket('COMBAT_SYNC', {
      seed,
      event,
      deck: state.deck.slice(),
      doctrine: state.doctrine,
      salt: state.pvpMySalt,
      commitHash: state.pvpMyCommitHash
    });
    startOnlinePvpBattle(seed, event);
  }
}

function startOnlinePvpBattle(seed, event) {
  if (!state.pvpOpponentDeck) {
    toast('⚠️ 戰術資料同步中，請稍候...');
    return;
  }
  $('#onlinePvpModal').hidden = true;
  $('#resultModal').hidden = true;
  $('#bo3CounterModal').hidden = true;
  if (currentActiveModal) currentActiveModal.hidden = true;
  currentActiveModal = null;
  state.event = event;

  const isHost = OnlinePvPEngine.isHostUser();
  // 核心對稱保證：房主固定在左 (Side A), 挑戰者固定在右 (Side B)
  const hostDeck = (isHost ? state.deck : state.pvpOpponentDeck).slice();
  const guestDeck = (isHost ? state.pvpOpponentDeck : state.deck).slice();
  const hostDoc = isHost ? state.doctrine : (state.pvpOpponentDoc || 'defense');
  const guestDoc = isHost ? (state.pvpOpponentDoc || 'defense') : state.doctrine;

  const opp = OnlinePvPEngine.getOpponent();
  state.enemy = state.pvpOpponentDeck.slice();
  state.enemyDoc = state.pvpOpponentDoc || 'defense';
  if (opp) {
    const oppCleanName = (opp.name && opp.name !== '我方聯合戰術作戰群') ? opp.name : (isHost ? '挑戰突擊隊' : '本部特遣隊');
    state.enemyName = `${opp.flag || '🌐'} ${oppCleanName}`;
  }

  // 雙方以完全相同的隊伍順序調用推演引擎，保證隨機數完全對稱且 100% 同步
  const res = resolveBattle(hostDeck, guestDeck, {
    seed,
    event: state.event,
    docA: hostDoc,
    docB: guestDoc
  });
  state.lastRes = res;
  showBattle(res);
}

OnlinePvPEngine.on('game_session_started', payload => {
  const opp = OnlinePvPEngine.getOpponent();
  state.isOnlinePvp = true;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  state.bo3.active = true;
  state.bo3.round = payload.round || 1;
  state.bo3.winsA = payload.winsA || 0;
  state.bo3.winsB = payload.winsB || 0;
  if (payload.maxGames) state.bo3.maxGames = payload.maxGames;
  if (payload.marketMode) state.bo3.marketMode = payload.marketMode;
  state.bo3.bannedByA = null;
  state.bo3.bannedByB = null;
  state.bo3.bannedListA = [];
  state.bo3.bannedListB = [];
  if (opp) state.bo3.rivalName = `${opp.flag} ${opp.name} (${opp.uid})`;
  state.mode = 'bo3';

  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  startPvpDeploymentTimer(60);
  renderAll();
  const maxG = state.bo3.maxGames || 5;
  toast(`⚡ 本部特遣隊已發起 BO${maxG} 系列賽！請挑選 5 槽陣容並點擊【鎖定陣容】(⏱️ 戰備倒數 60s)！`);
});

OnlinePvPEngine.on('room_settings_updated', payload => {
  if (state.bo3) {
    if (payload.maxGames) state.bo3.maxGames = payload.maxGames;
    if (payload.marketMode) state.bo3.marketMode = payload.marketMode;
    renderMissionBar();
    updateTopHud();
    updateRerollMarketButtonState();
    toast(`房主更新了系列賽設定：BO${state.bo3.maxGames} · ${state.bo3.marketMode === 'free' ? '自由調撥 (Ban 2)' : '開戰鎖定 (Ban 1)'}`);
  }
});

OnlinePvPEngine.on('opponent_deck_committed', payload => {
  state.pvpOpponentCommitHash = payload && payload.commitHash ? payload.commitHash : null;
  state.pvpOpponentReady = true;

  renderCommandDeck();
  renderMissionBar();

  if (state.pvpMyReady) {
    if (!state.pvpMyRevealed) {
      state.pvpMyRevealed = true;
      OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
        deck: state.deck.slice(),
        doctrine: state.doctrine,
        salt: state.pvpMySalt,
        commitHash: state.pvpMyCommitHash,
        round: state.bo3.round
      });
    }
    toast(`⚡ 對手已鎖定陣容！雙方正在交換戰術明文...`);
  } else {
    toast(`⚡ 對手已加密鎖定陣容！等待你完成陣容配置並鎖定！`);
  }
});

OnlinePvPEngine.on('opponent_deck_ready', payload => {
  if (state.pvpOpponentCommitHash && payload.salt) {
    if (String(state.pvpOpponentCommitHash).startsWith('sha256:') && typeof OnlinePvPEngine.computeCommitHashAsync === 'function') {
      OnlinePvPEngine.computeCommitHashAsync(payload.deck, payload.doctrine, payload.salt).then(verifyHash => {
        if (verifyHash !== state.pvpOpponentCommitHash) {
          console.warn('[Security] PvP SHA-256 Commit-Reveal hash mismatch detected!');
        }
      });
    } else {
      const verifyHash = OnlinePvPEngine.computeCommitHash(payload.deck, payload.doctrine, payload.salt);
      if (verifyHash !== state.pvpOpponentCommitHash) {
        console.warn('[Security] PvP Commit-Reveal hash mismatch detected!');
      }
    }
  }
  state.pvpOpponentDeck = payload.deck;
  state.pvpOpponentDoc = payload.doctrine || 'defense';
  state.pvpOpponentReady = true;

  renderCommandDeck();
  renderMissionBar();

  if (state.pvpMyReady) {
    if (!state.pvpMyRevealed) {
      state.pvpMyRevealed = true;
      OnlinePvPEngine.sendPacket('DECK_SUBMIT', {
        deck: state.deck.slice(),
        doctrine: state.doctrine,
        salt: state.pvpMySalt,
        commitHash: state.pvpMyCommitHash,
        round: state.bo3.round
      });
    }
    toast(`⚡ 對手已完成配置！雙方就緒，即將開打！`);
    checkBothReadyAndStartCombat();
  } else {
    toast(`⚡ 對手已就緒！等待你完成陣容配置並鎖定！`);
  }
});

OnlinePvPEngine.on('combat_start_sync', payload => {
  if (payload.deck && (!state.pvpOpponentDeck || !state.pvpOpponentDeck.length)) {
    state.pvpOpponentDeck = payload.deck;
    state.pvpOpponentDoc = payload.doctrine || 'defense';
    state.pvpOpponentReady = true;
  }
  startOnlinePvpBattle(payload.seed, payload.event);
});

OnlinePvPEngine.on('opponent_ban_committed', payload => {
  const bannedIds = Array.isArray(payload.bannedUnitIds) 
    ? payload.bannedUnitIds 
    : (payload.bannedUnitId ? [payload.bannedUnitId] : []);
  if (!state.bo3.bannedListB) state.bo3.bannedListB = [];
  if (payload.bannedList && Array.isArray(payload.bannedList)) {
    state.bo3.bannedListB = payload.bannedList.slice();
  } else {
    bannedIds.forEach(id => {
      if (!state.bo3.bannedListB.includes(id)) state.bo3.bannedListB.push(id);
    });
  }
  state.bo3.bannedByB = bannedIds[bannedIds.length - 1] || payload.bannedUnitId;
  const names = bannedIds.map(id => UNIT_MAP[id]?.name || id).join('、');
  toast(`⚠️ 對手啟動戰術反制！永久禁用了你的【${names}】（累計被禁用 ${state.bo3.bannedListB.length} 件）！`);
  
  // 檢查所有卡槽：若當前卡槽中正好有任何被累計禁用的單位，強制卸下並解鎖提交
  const allBanned = currentBanned();
  let unmounted = false;
  state.deck.forEach((id, idx) => {
    if (id && allBanned.includes(id)) {
      state.deck[idx] = null;
      state.active = idx;
      unmounted = true;
    }
  });
  if (unmounted) {
    state.pvpMyReady = false;
  }
  
  const refitSec = (state.bo3.marketMode === 'free') ? 60 : 45;
  startPvpDeploymentTimer(refitSec);
  renderAll();
});

OnlinePvPEngine.on('opponent_left', () => {
  toast('⚠️ 對手已斷開連線！');
  state.isOnlinePvp = false;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  $('#pvpVersusBox').hidden = true;
  $('#btnPvpStartBattle').hidden = true;
  renderAll();
  switchPvpTab('host');
  initHostRoom();
});

OnlinePvPEngine.on('player_forfeit_received', payload => {
  const isHost = OnlinePvPEngine.isHostUser();
  const mySide = isHost ? 'A' : 'B';
  const opponentSide = (mySide === 'A') ? 'B' : 'A';
  handlePlayerForfeit(opponentSide, payload?.reason || '對手棄權判負');
});

OnlinePvPEngine.on('error', msg => {
  toast(`⚠️ 連線提示：${msg}`);
});

$('#btnPvpStartBattle')?.addEventListener('click', () => {
  const opp = OnlinePvPEngine.getOpponent();
  if (!opp) return;

  // 房主啟動連線遊戲會話
  state.isOnlinePvp = true;
  state.pvpMyReady = false;
  state.pvpOpponentReady = false;
  state.pvpOpponentDeck = null;
  state.bo3.rivalName = `${opp.flag} ${opp.name} (${opp.uid})`;
  state.bo3.active = true;
  state.bo3.winsA = 0;
  state.bo3.winsB = 0;
  state.bo3.round = 1;
  state.bo3.bannedByA = null;
  state.bo3.bannedByB = null;
  state.mode = 'bo3';

  // 通知挑戰者同步開局
  OnlinePvPEngine.sendPacket('GAME_START_SESSION', {
    round: 1,
    winsA: 0,
    winsB: 0,
    maxGames: state.bo3.maxGames || 5,
    marketMode: state.bo3.marketMode || 'locked'
  });

  $('#onlinePvpModal').hidden = true;
  currentActiveModal = null;
  startPvpDeploymentTimer(60);
  renderAll();
  const maxG = state.bo3.maxGames || 5;
  toast(`🏆 線上 BO${maxG} 系列賽正式開戰！請挑選 5 槽陣容並點擊【鎖定陣容】(⏱️ 戰備倒數 60s)！`);
});

/* =====================================================
   🥇 世界盃淘汰錦標賽 (Tournament Championship) 前端控制器
   支援：👤 單人闖關 ｜ 👥 私人好友開房 ｜ 🌐 公開大廳隨機匹配
   ===================================================== */
let tourneySelectedSize = 16;
let tourneySelectedFormat = 'hybrid';
let tourneySelectedArmory = 'locked'; // 'locked' (開戰鎖定) | 'free' (自由調撥)
let currentTourneyTab = 'solo'; // 'solo' | 'private' | 'public'
let privateSelectedSize = 4;
let privateSelectedFormat = 'hybrid';
let privateSelectedArmory = 'locked';
let publicSelectedSize = 4;
let publicSelectedFormat = 'hybrid';
let publicSelectedArmory = 'locked';
let publicRoomsUnsub = null;

function getTournamentPlayerProfile() {
  const p = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState().player : null;
  let localUid = localStorage.getItem('topwarlords_user_uid');
  if (!localUid) {
    localUid = (typeof LadderEngine !== 'undefined' && LadderEngine.generateCommanderUID)
      ? LadderEngine.generateCommanderUID()
      : ('CMD-' + Math.floor(1000 + Math.random() * 9000));
    localStorage.setItem('topwarlords_user_uid', localUid);
  }
  const myUid = (p && p.uid && p.uid !== 'CMD-7392') ? p.uid : localUid;

  let myName = p?.name;
  if (!myName || myName === '我方聯合戰術作戰群' || myName === '我方特遣隊') {
    let savedAutoName = localStorage.getItem('topwarlords_auto_callsign');
    if (!savedAutoName) {
      savedAutoName = generateProceduralCallsign();
      localStorage.setItem('topwarlords_auto_callsign', savedAutoName);
      if (typeof LadderEngine !== 'undefined' && LadderEngine.setPlayerName) {
        LadderEngine.setPlayerName(savedAutoName, p?.flag || '🇹🇼');
      }
    }
    myName = savedAutoName;
  }

  return {
    uid: myUid,
    name: myName,
    flag: p?.flag || '🇹🇼',
    isMe: true,
    isAI: false,
    deck: state.deck.every(Boolean) ? state.deck.slice() : null,
    doctrine: state.doctrine || 'defense'
  };
}

function renderTourneyDeckBar() {
  const deckBar = $('#tourneyMyDeckBar');
  if (!deckBar) return;

  const isFull = state.deck.every(Boolean);
  const errs = isFull ? validateDeck(state.deck, budgetLimit(), currentBanned()) : ['尚未選滿 5 個槽位'];
  const cost = deckCost(state.deck.filter(Boolean));
  const prof = getTournamentPlayerProfile();
  const shortUid = prof.uid.replace('CMD-', '').slice(-4);

  if (errs.length === 0) {
    const unitsHtml = state.deck.map(id => {
      const u = UNIT_MAP[id];
      return u ? `<span style="font-size:12.5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:3px 8px;border-radius:5px;color:var(--text)"><b style="color:${CATS[u.cat].color}">$${u.cost}</b> ${esc(u.name.split(' ')[0])}</span>` : '';
    }).join(' ');
    deckBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-weight:800;font-size:14px;color:var(--cyan);display:flex;align-items:center;gap:5px" title="指揮官暱稱（如需更改請點擊上方導航欄「我」個人檔案）">
          <span>${prof.flag}</span> 👑 ${esc(prof.name)} <span style="font-family:var(--mono);font-size:12px;color:var(--muted)">#${shortUid}</span>
        </span>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${unitsHtml}</div>
        <span style="font-family:var(--mono);font-size:12.5px;color:var(--muted)">$${cost}/15</span>
        <span class="badge badge-ok" style="font-size:11.5px">✔ 陣容整備完畢</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn ghost sm" id="btnTourneyLobbyTune">🛠️ 調配陣容</button>
      </div>
    `;
  } else {
    deckBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:800;color:var(--amber);display:flex;align-items:center;gap:5px" title="指揮官暱稱（如需更改請點擊上方導航欄「我」個人檔案）">
          <span>${prof.flag}</span> ⚠️ 參賽部隊整備中：${esc(prof.name)}
        </span>
        <span class="muted" style="font-size:12px">${errs[0]}</span>
        <span style="font-family:var(--mono);font-size:11.5px;color:var(--amber)">($${cost}/15)</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn primary sm" id="btnTourneyLobbyRand">🎲 隨機組隊</button>
        <button class="btn ghost sm" id="btnTourneyLobbyTune">🛠️ 調配陣容</button>
      </div>
    `;
  }

  $('#btnTourneyLobbyTune')?.addEventListener('click', () => {
    startTourneyBuild();
  });
  $('#btnTourneyLobbyRand')?.addEventListener('click', () => {
    if (!state.marketPool) initMarketPool();
    let d = null;
    const banned = currentBanned();
    const cats = ['air', 'ground', 'airdef', 'sea', 'drone'];
    for (let tryCount = 0; tryCount < 200; tryCount++) {
      const cand = [];
      let spent = 0;
      for (const cat of cats) {
        const rawUnits = state.marketPool[cat] || [];
        const units = rawUnits.filter(u => !banned.includes(u.id));
        if (!units.length) break;
        const u = units[Math.floor(Math.random() * units.length)];
        cand.push(u.id);
        spent += u.cost;
      }
      if (cand.length === 5 && spent <= budgetLimit()) {
        d = cand;
        break;
      }
    }
    if (!d) {
      d = randomDeck(Math.random, budgetLimit(), [], banned) || randomDeck(Math.random, budgetLimit(), [], banned);
    }
    if (d) {
      state.deck = d.slice();
      if (state.deckSlot === 'B') state.dualDecks.B = d.slice();
      else state.dualDecks.A = d.slice();
      renderTournamentView();
      toast('🎲 已由戰區軍火庫抽取並組建合法 15 元參賽部隊！');
    }
  });
}

function renderTournamentView() {
  // 檢查是否處於 Firebase 線上多人房間中 (若當前分頁為 solo 則優先切回單人世界盃)
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const isOnlineActive = !!onlineRoom && (currentTourneyTab !== 'solo');

  let t = null;
  let isLobby = false;

  if (isOnlineActive) {
    t = onlineRoom;
    isLobby = (t.status === 'waiting');
  } else {
    t = TournamentEngine.getState();
    if (!t || (t.status === 'registration' && t.size !== tourneySelectedSize)) {
      t = TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
    } else if (t.status === 'registration' && t.participants && t.participants[0]) {
      const prof = getTournamentPlayerProfile();
      t.participants[0].name = prof.name;
      t.participants[0].flag = prof.flag;
      t.participants[0].deck = prof.deck;
      t.participants[0].doctrine = prof.doctrine;
    }
    isLobby = (t.status === 'registration');
  }

  const tourneyHeader = $('#tourneyHeader');
  const lobbyCard = $('#tourneyLobbyCard');
  const bracketVp = $('#tourneyBracketViewport');
  const tourneyLayout = $('#viewTournament');

  if (tourneyLayout) tourneyLayout.classList.toggle('is-lobby', isLobby);
  if (tourneyHeader) tourneyHeader.hidden = isLobby; // 大廳備戰時隱藏獨立 HUD，徹底消除重複卡片
  if (lobbyCard) lobbyCard.hidden = !isLobby;
  if (bracketVp) bracketVp.hidden = isLobby;

  if (isLobby) {
    renderTourneyLobby(t, isOnlineActive);
  } else {
    renderTourneyHeader(t, isOnlineActive);
    renderTournamentBracket(t);
  }
}

function renderTourneyHeader(t, isOnline = false) {
  const currentYear = new Date().getFullYear();
  const badgeEl = $('#tourneyBadge');
  if (badgeEl) badgeEl.textContent = `🏆 ${currentYear} 名將世界盃淘汰錦標賽`;
  const roundNames = {
    1: t.size === 32 ? '32 強淘汰賽' : t.size === 16 ? '16 強全域聯合' : t.size === 8 ? '半準決賽 (8強)' : '準決賽 (4強)',
    2: t.size === 32 ? '16 強賽' : t.size === 16 ? '半準決賽 (8強)' : '決賽圈',
    3: t.size === 32 ? '半準決賽 (8強)' : t.size === 16 ? '準決賽 (4強)' : '總決賽',
    4: t.size === 32 ? '準決賽 (4強)' : '世界總決賽',
    5: '世界總決賽 (World Final)'
  };

  const formatNames = {
    bo1: '⚡ 極速單淘汰 (全程 BO1·決賽BO3)',
    hybrid: '⭐ 決賽升級制 (四強前BO3·決賽BO5)',
    bo3: '⚔️ 大師征服 (全程 BO5)',
    bo5: '⚔️ 大師征服 (全程 BO5)'
  };

  const prof = getTournamentPlayerProfile();
  let myMatch = null;

  if (isOnline) {
    // 從雲端 room.matches 尋找自己參與的對戰
    myMatch = Object.values(t.matches || {}).find(m => {
      if (m.status === 'finished') return false;
      const aIsMe = m.teamA && m.teamA.uid === prof.uid;
      const bIsMe = m.teamB && m.teamB.uid === prof.uid;
      return (aIsMe || bIsMe) && (m.teamA && m.teamB);
    }) || null;
  } else {
    myMatch = TournamentEngine.getMyMatch();
  }

  const amIEliminated = !myMatch && (t.status === 'in_progress');

  $('#tourneyRoundPill').textContent = `第 ${t.currentRound}/${t.totalRounds} 輪 · ${roundNames[t.currentRound] || '淘汰賽'}`;
  $('#tourneyFormatName').textContent = formatNames[t.format || t.matchType] || '標準賽制';

  // 戰區環境情報標籤 (全場統一輪次環境)
  const weatherEl = $('#tourneyRoundWeather');
  if (weatherEl) {
    let curTheater = null;
    if (typeof TournamentEngine !== 'undefined' && TournamentEngine.getCurrentRoundTheater) {
      curTheater = TournamentEngine.getCurrentRoundTheater();
    }
    if (!curTheater && t.roundTheaters && t.roundTheaters[t.currentRound]) {
      curTheater = t.roundTheaters[t.currentRound];
    }
    if (curTheater) {
      weatherEl.innerHTML = `${curTheater.icon || '🌪️'} 戰區：<b>${curTheater.name}</b>`;
      weatherEl.title = `第 ${t.currentRound} 輪全場統一戰區環境：${curTheater.name} (${curTheater.desc || ''})`;
    } else {
      weatherEl.innerHTML = `🌪️ 戰區：全天候演練`;
    }
  }

  // 軍備配給標籤與狀態
  const isLockedArmory = (t.armoryRule === 'locked');
  const armoryPillEl = $('#tourneyArmoryPill');
  if (armoryPillEl) {
    armoryPillEl.className = isLockedArmory ? 'tourney-armory-pill is-locked' : 'tourney-armory-pill is-free';
    armoryPillEl.innerHTML = isLockedArmory ? '🔒 開戰鎖定' : '🎲 自由調撥';
    armoryPillEl.title = isLockedArmory ? '開戰鎖定賽制：全系列賽陣容與教條一套到底，禁止更換！' : '自由調撥賽制：每輪晉級後可進軍火庫重新調撥陣容';
  }
  const armoryNameEl = $('#tourneyArmoryName');
  if (armoryNameEl) {
    armoryNameEl.textContent = isLockedArmory ? '開戰鎖定 (陣容教條一套到底)' : '自由調撥 (每輪可調整名將)';
    armoryNameEl.style.color = isLockedArmory ? '#fbbf24' : 'var(--cyan)';
  }

  const statusTagEl = $('#tourneyStatusTag');
  if (statusTagEl) {
    if (t.status === 'completed') {
      statusTagEl.textContent = '🏁 賽事圓滿完結';
      statusTagEl.style.background = 'rgba(245, 158, 11, 0.15)';
      statusTagEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      statusTagEl.style.color = '#fbbf24';
    } else if (amIEliminated) {
      statusTagEl.textContent = '👀 戰術觀戰中';
      statusTagEl.style.background = 'rgba(148, 163, 184, 0.15)';
      statusTagEl.style.borderColor = 'rgba(148, 163, 184, 0.4)';
      statusTagEl.style.color = '#94a3b8';
    } else {
      statusTagEl.textContent = '🟢 激戰進行中';
      statusTagEl.style.background = 'rgba(16, 185, 129, 0.15)';
      statusTagEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      statusTagEl.style.color = '#34d399';
    }
  }

  const myStateEl = $('#tourneyMyState');
  if (myStateEl) {
    if (t.status === 'completed') {
      const won = t.champion && (t.champion.uid === prof.uid || t.champion.isMe);
      myStateEl.innerHTML = won ? '🏆 <b style="color:#fbbf24">榮獲世界盃總冠軍！</b>' : '🏁 賽事圓滿完結';
    } else if (amIEliminated) {
      myStateEl.innerHTML = '👀 <span style="color:#94a3b8">特邀戰術觀摩員 (點選對抗樹即時觀戰)</span>';
    } else if (myMatch) {
      myStateEl.innerHTML = '🟢 <b style="color:var(--cyan)">席位在線 · 準備迎戰</b>';
    } else {
      myStateEl.innerHTML = '⏳ 備戰大廳';
    }
  }

  // 計算當前輪次剩餘隊伍（對戰結束時移除「剩餘爭冠隊伍」資訊）
  const remWrap = $('#tourneyRemainingWrap');
  if (t.status === 'completed') {
    if (remWrap) remWrap.style.display = 'none';
  } else {
    if (remWrap) remWrap.style.display = 'inline-flex';
    const activeTeams = Object.values(t.matches || {}).filter(m => m.round === t.currentRound && m.status !== 'finished').length * 2;
    const countEl = $('#tourneyRemainingCount');
    if (countEl) countEl.textContent = `${Math.max(activeTeams, 2)} 隊`;
  }

  // 操作按鈕列
  const actBox = $('#tourneyActionBox');
  if (actBox) {
    if (t.status === 'registration' || t.status === 'waiting') {
      actBox.innerHTML = '';
    } else if (myMatch && t.status === 'in_progress') {
      const isTeamA = myMatch.teamA && myMatch.teamA.uid === prof.uid;
      const opp = isTeamA ? myMatch.teamB : myMatch.teamA;
      const readyKey = isTeamA ? 'readyA' : 'readyB';
      const isIReady = myMatch[readyKey] === true;

      const totalRounds = t.totalRounds || Math.log2(t.size);
      const reqWins = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
        ? FirebaseTourneyEngine.getRequiredWins(myMatch, t.format, totalRounds)
        : 1;
      const roundNum = ensureArray(myMatch.history).length + 1;
      // 單機錦標賽：每局戰鬥結束（或小局推進、或戰鬥返回、或倒數過期）時，精準重置為全新的 60 秒作戰準備倒數
      if (!isOnline) {
        if (!myMatch.deadline || myMatch.deadlineRound !== roundNum || myMatch.deadline <= Date.now()) {
          myMatch.deadline = Date.now() + 60000;
          myMatch.deadlineRound = roundNum;
        }
      } else {
        if (!myMatch.deadline) {
          myMatch.deadline = Date.now() + 60000;
        }
      }
      const secLeft = Math.max(0, Math.ceil((myMatch.deadline - Date.now()) / 1000));
      const oppFlag = opp?.flag || '🌐';
      const rawTitle = opp?.name || '待定對手';
      const cleanOpp = rawTitle.replace(/戰術群|打擊旅|裝甲旅|特遣隊|突擊團/g, '').trim() || rawTitle;
      const oppTitle = cleanOpp.length > 7 ? cleanOpp.slice(0, 7) : cleanOpp;

      let fightBtnText = '';
      const deadlineSuffix = myMatch.deadline ? ` · ⏱️${secLeft}s` : '';
      if (isIReady) {
        fightBtnText = `⏳ 陣容已鎖定 · 候敵出擊 (${secLeft}s)...`;
      } else if (reqWins > 1) {
        fightBtnText = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (第${roundNum}局 ${myMatch.scoreA || 0}:${myMatch.scoreB || 0}${deadlineSuffix})`;
      } else {
        fightBtnText = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (出擊${deadlineSuffix})`;
      }

      const waitPct = Math.max(0, Math.min(100, Math.round((secLeft / 60) * 100)));
      const waitProgressHtml = isIReady ? `
        <div class="tourney-wait-bar-wrap" id="tourneyWaitBarWrap" data-deadline="${myMatch.deadline || (Date.now() + 60000)}">
          <div class="tourney-wait-bar-track"><div class="tourney-wait-bar-fill" id="tourneyWaitBarFill" style="width:${waitPct}%"></div></div>
          <span class="tourney-wait-status" id="tourneyWaitStatus">📡 對手正在調配戰術陣容 · 倒數 <b>${secLeft}s</b> 後自動由 AI 特遣隊接管開戰</span>
        </div>
      ` : '';
      const hasEmptySlot = !state.deck.every(Boolean);
      const tuneBtnHtml = isLockedArmory
        ? (hasEmptySlot
            ? `<button class="btn ghost sm" id="btnTourneyTuneDeck" style="color:var(--amber);border-color:rgba(245,158,11,.6);box-shadow:0 0 10px rgba(245,158,11,.3)" title="主力遭對手禁用！請進入軍火庫完成替補配給">🛠️ 陣容補位</button>`
            : `<button class="btn ghost sm is-locked-armory" id="btnTourneyTuneDeck" title="開戰鎖定賽制：全系列賽陣容與教條已鎖定，禁止更換！">🔒 陣容鎖定</button>`)
        : `<button class="btn ghost sm" id="btnTourneyTuneDeck" title="調整當前作戰陣容">🛠️ 調配陣容</button>`;

      actBox.innerHTML = `
        <button class="btn amber sm" id="btnTourneyGoFight">
          ${fightBtnText}
        </button>
        ${tuneBtnHtml}
        ${isOnline ? '<button class="btn ghost sm" id="btnTourneyLeaveOnline" style="color:var(--red);border-color:rgba(255,93,110,.3)">退出房間 ✕</button>' : '<button class="btn ghost sm" id="btnTourneyResetAll" data-tourney-action="forfeit" style="color:var(--red);border-color:rgba(255,93,110,.3)" title="主動放棄本屆錦標賽並返回大廳">🏳️ 放棄錦標賽 ✕</button>'}
        ${waitProgressHtml}
      `;
      if (window.__tourneyWaitTicker) clearInterval(window.__tourneyWaitTicker);
      if (myMatch.deadline) {
        window.__tourneyWaitTicker = setInterval(() => {
          const wrap = document.getElementById('tourneyWaitBarWrap');
          const dl = Number(myMatch.deadline) || (wrap ? Number(wrap.dataset.deadline) : 0) || 0;
          const rem = Math.max(0, Math.ceil((dl - Date.now()) / 1000));
          const btnEl = document.getElementById('btnTourneyGoFight');
          if (btnEl) {
            if (isIReady) {
              btnEl.textContent = `⏳ 陣容已鎖定 · 候敵出擊 (${rem}s)...`;
            } else if (reqWins > 1) {
              btnEl.textContent = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (第${roundNum}局 ${myMatch.scoreA || 0}:${myMatch.scoreB || 0} · ⏱️${rem}s)`;
            } else {
              btnEl.textContent = `⚔️ 迎戰 ${oppFlag} ${esc(oppTitle)} (出擊 · ⏱️${rem}s)`;
            }
            if (rem <= 10) {
              btnEl.style.animation = 'pulseRedWarning 0.8s infinite';
            } else {
              btnEl.style.animation = '';
            }
          }
          if (wrap) {
            const pct = Math.max(0, Math.min(100, Math.round((rem / 60) * 100)));
            const fillEl = document.getElementById('tourneyWaitBarFill');
            const statEl = document.getElementById('tourneyWaitStatus');
            if (fillEl) fillEl.style.width = pct + '%';
            if (statEl) statEl.innerHTML = `📡 對手正在調配戰術陣容 · 倒數 <b>${rem}s</b> 後自動由 AI 特遣隊接管開戰`;
          }
          if (rem <= 0) clearInterval(window.__tourneyWaitTicker);
        }, 1000);
      }
    } else {
      const isCompleted = (t.status === 'completed');
      let resetBtnHtml = '';
      if (isOnline) {
        const prof = getTournamentPlayerProfile();
        const isHost = (t.hostUid === prof.uid);
        if (isCompleted && isHost) {
          resetBtnHtml = '<button class="btn amber sm" id="btnTourneyRematchOnline" style="margin-right:6px">🏆 再戰一屆 🔄</button><button class="btn ghost sm" id="btnTourneyLeaveOnline" style="color:var(--red);border-color:rgba(255,93,110,.3)">退出房間 ✕</button>';
        } else {
          resetBtnHtml = '<button class="btn ghost sm" id="btnTourneyLeaveOnline" style="color:var(--red);border-color:rgba(255,93,110,.3)">' + (isCompleted ? '返回大廳 ✕' : '退出房間 ✕') + '</button>';
        }
      } else {
        resetBtnHtml = isCompleted
          ? '<button class="btn ghost sm" id="btnTourneyResetAll" data-tourney-action="restart" style="color:var(--amber);border-color:rgba(245,158,11,.4)">🏆 重新開賽 🔄</button>'
          : '<button class="btn ghost sm" id="btnTourneyResetAll" data-tourney-action="leave_spec" style="color:var(--muted);border-color:rgba(148,163,184,.3)" title="退出觀戰模式，返回備戰大廳">↩ 退出觀戰 ✕</button>';
      }

      actBox.innerHTML = `
        <span class="muted tourney-spec-hint" style="font-size:12px;margin-right:6px">點選場次可觀摩推演</span>
        <button class="btn ghost sm" id="btnTourneyTuneDeck">🛠️ 瀏覽軍火庫</button>
        ${resetBtnHtml}
      `;
    }
  }
}

function renderTourneyLobby(t, isOnline = false) {
  const currentYear = new Date().getFullYear();
  const mainTitleEl = document.querySelector('.lobby-main-title');
  if (mainTitleEl) mainTitleEl.innerHTML = `🏆 ${currentYear} 名將世界盃淘汰錦標賽 (Tournament Arena)`;
  renderTourneyDeckBar();

  // 若處於線上多人房間
  if (isOnline) {
    const prof = getTournamentPlayerProfile();
    const isHost = t.hostUid === prof.uid;
    const roomCode = t.id;

    // 切換至私人房間活躍面板
    currentTourneyTab = 'private';
    updateTourneyTabPanels();

    $('#privateLobbyEntrance').hidden = true;
    $('#privateRoomActiveView').hidden = false;
    $('#privateRoomCodeDisplay').textContent = roomCode;
    $('#privateTotalCount').textContent = t.size;

    const rawParticipants = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
    const participants = [];
    for (let i = 0; i < t.size; i++) {
      participants.push(rawParticipants[i] || null);
    }
    const filled = participants.filter(Boolean).length;
    $('#privateFilledCount').textContent = filled;

    // 只有房主能開賽或 AI 補位
    $('#btnPrivateStart').disabled = !isHost;
    if (!isHost) {
      $('#btnPrivateStart').textContent = '⌛ 等待房主點擊正式開賽...';
      $('#btnPrivateStart').className = 'btn ghost lg block';
    } else {
      $('#btnPrivateStart').textContent = '⚔️ 正式開賽 · 啟動多人錦標賽 (START TOURNAMENT)';
      $('#btnPrivateStart').className = 'btn amber lg block';
    }

    const grid = $('#privateParticipantsGrid');
    if (grid) {
      grid.innerHTML = participants.map((p, idx) => {
        if (!p) {
          return `<div class="p-slot-chip empty">
            <span class="muted">#${idx + 1}</span>
            <span class="p-name muted" style="font-style:italic">待抽籤席位</span>
            <span class="muted" style="font-size:9.5px">空席</span>
          </div>`;
        }
        const isMe = (p.uid === prof.uid);
        return `<div class="p-slot-chip ${isMe ? 'me' : (p.isAI ? 'ai' : 'online-peer')}">
          <span>${p.flag || '🌐'}</span>
          <span class="p-name" style="${isMe ? 'font-weight:800;color:var(--cyan)' : ''}" title="${esc(p.name)}">${esc(p.name)}</span>
          <span class="badge ${isMe ? 'badge-ok' : (p.isAI ? '' : 'badge-ok')}" style="font-size:9px;padding:1px 4px;margin-left:auto">
            ${isMe ? '你親率參賽' : (p.isAI ? 'AI 特遣隊' : '🟢 真人選手')}
          </span>
        </div>`;
      }).join('');
    }
    return;
  }

  // 單人闖關大廳
  $('#lobbyTotalCount').textContent = t.size;
  if ($('#lobbyTotalCountShort')) $('#lobbyTotalCountShort').textContent = t.size;
  const rawParticipants = Array.isArray(t.participants) ? t.participants : Object.values(t.participants || {});
  const participants = [];
  for (let i = 0; i < t.size; i++) {
    participants.push(rawParticipants[i] || null);
  }
  const filled = participants.filter(Boolean).length;
  $('#lobbyFilledCount').textContent = filled;
  if ($('#lobbyFilledCountShort')) $('#lobbyFilledCountShort').textContent = filled;

  const rosterDescEl = $('#soloRosterDesc');
  const rosterBarEl = $('#soloSlimRosterBar');
  const btnFillEl = $('#btnTourneyFillAI');
  const btnStartEl = $('#btnTourneyStart');
  const headTxtEl = $('#soloParticipantsHeadTxt');

  if (rosterDescEl) {
    if (filled < t.size) {
      rosterDescEl.className = 'solo-roster-desc status-waiting';
      rosterDescEl.innerHTML = `（已就位 <span id="lobbyFilledCountShort">${filled}</span> / <span id="lobbyTotalCountShort">${t.size}</span> 隊 · 開賽自動隨機抽籤補齊）`;
      if (rosterBarEl) rosterBarEl.classList.remove('bar-ready');
      if (btnFillEl) {
        btnFillEl.textContent = '🤖 隨機抽籤補齊';
        btnFillEl.className = 'btn ghost sm';
        btnFillEl.title = '手動立即隨機抽籤補滿剩餘各強席位';
      }
      if (btnStartEl) {
        btnStartEl.textContent = '⚔️ 正式開賽 · 率隊出征世界盃 (START TOURNAMENT)';
        btnStartEl.classList.remove('ready-pulse');
      }
      if (headTxtEl) {
        headTxtEl.innerHTML = `參賽席位預覽 (你 + 待抽籤各強代表隊：<span id="lobbyFilledCount">${filled}</span> / <span id="lobbyTotalCount">${t.size}</span> 隊)`;
      }
    } else {
      rosterDescEl.className = 'solo-roster-desc status-ready';
      rosterDescEl.innerHTML = `（全球 <b>${t.size}</b> 強特遣隊已全部抽籤就位 · 隨時可開賽出征）`;
      if (rosterBarEl) rosterBarEl.classList.add('bar-ready');
      if (btnFillEl) {
        btnFillEl.textContent = `✅ ${t.size} 強已滿額就位`;
        btnFillEl.className = 'btn ghost sm btn-filled-done';
        btnFillEl.title = '全球各強特遣隊已全部補滿席位，可直接點擊下方開賽出征！';
      }
      if (btnStartEl) {
        btnStartEl.textContent = '⚔️ 全員就位 · 率隊出征世界盃 (START TOURNAMENT)';
        btnStartEl.classList.add('ready-pulse');
      }
      if (headTxtEl) {
        headTxtEl.innerHTML = `參賽席位預覽 (全球 <b>${t.size}</b> 強特遣隊已全部抽籤就位 · 隨時可開賽出征)`;
      }
    }
  }

  const grid = $('#lobbyParticipantsGrid');
  if (!grid) return;

  grid.innerHTML = participants.map((p, idx) => {
    if (!p) {
      return `<div class="p-slot-chip empty">
        <span class="muted">#${idx + 1}</span>
        <span class="p-name muted" style="font-style:italic">待抽籤席位</span>
        <span class="muted" style="font-size:9.5px">AI 抽籤</span>
      </div>`;
    }
    return `<div class="p-slot-chip ${p.isMe ? 'me' : 'ai'}">
      <span>${p.flag || '🌐'}</span>
      <span class="p-name" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="muted" style="font-size:9.5px">${p.isMe ? '你親率參賽' : '各強特遣隊'}</span>
    </div>`;
  }).join('');
}

function getTourneySizeNameShort(size) {
  if (size === 4) return '⚡ 4 強 前哨突擊';
  if (size === 8) return '🎯 8 強 戰區爭端';
  if (size === 16) return '🌐 16 強 全域聯合';
  if (size === 32) return '🏆 32 強 巔峰會戰';
  return `${size} 強`;
}

function getFormatNameShort(fmt) {
  if (fmt === 'bo1') return '⚡ 極速單淘汰 (BO1/BO3)';
  if (fmt === 'bo3' || fmt === 'bo5') return '⚔️ 大師征服 (BO5)';
  return '⭐ 決賽升級制 (BO3/BO5)';
}

function updateTourneyLobbyBadge() {
  const badge = $('#tourneyLobbyModeBadge');
  if (!badge) return;

  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  if (onlineRoom && onlineRoom.status === 'waiting') {
    badge.innerHTML = `👥 私人房間 [#${esc(onlineRoom.id)}] · <b>${getTourneySizeNameShort(onlineRoom.size)}</b> <span style="opacity:0.85">(${getFormatNameShort(onlineRoom.format || onlineRoom.matchType)})</span>`;
    badge.style.color = 'var(--amber)';
    badge.style.borderColor = 'rgba(245,158,11,.45)';
    badge.style.background = 'rgba(245,158,11,.12)';
    return;
  }

  if (currentTourneyTab === 'solo') {
    const armoryLabel = tourneySelectedArmory === 'locked' ? '🔒開戰鎖定' : '🎲自由調撥';
    badge.innerHTML = `👤 單人闖關 · <b>${getTourneySizeNameShort(tourneySelectedSize)}</b> <span style="opacity:0.85">(${getFormatNameShort(tourneySelectedFormat)} · ${armoryLabel})</span>`;
    badge.style.color = 'var(--cyan)';
    badge.style.borderColor = 'rgba(61,224,255,.45)';
    badge.style.background = 'rgba(61,224,255,.12)';
  } else if (currentTourneyTab === 'private') {
    const armoryLabel = privateSelectedArmory === 'locked' ? '🔒開戰鎖定' : '🎲自由調撥';
    badge.innerHTML = `👥 私人好友 · <b>${getTourneySizeNameShort(privateSelectedSize)}</b> <span style="opacity:0.85">(${getFormatNameShort(privateSelectedFormat)} · ${armoryLabel})</span>`;
    badge.style.color = 'var(--amber)';
    badge.style.borderColor = 'rgba(245,158,11,.45)';
    badge.style.background = 'rgba(245,158,11,.12)';
  } else {
    const armoryLabel = publicSelectedArmory === 'locked' ? '🔒開戰鎖定' : '🎲自由調撥';
    badge.innerHTML = `🌐 公開隨機 · <b>${getTourneySizeNameShort(publicSelectedSize)}</b> <span style="opacity:0.85">(${getFormatNameShort(publicSelectedFormat)} · ${armoryLabel})</span>`;
    badge.style.color = 'var(--green)';
    badge.style.borderColor = 'rgba(93,255,176,.45)';
    badge.style.background = 'rgba(93,255,176,.12)';
  }
}

function syncTourneySelectorsUI() {
  // Solo 面板按鈕選取同步
  document.querySelectorAll('#tourneySizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === tourneySelectedSize);
  });
  document.querySelectorAll('#tourneyFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === tourneySelectedFormat);
  });
  // Private 面板按鈕選取同步
  document.querySelectorAll('#privateSizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === privateSelectedSize);
  });
  document.querySelectorAll('#privateFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === privateSelectedFormat);
  });
  // Public 面板按鈕選取同步
  document.querySelectorAll('#publicSizeSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.size === publicSelectedSize);
  });
  document.querySelectorAll('#publicFormatSelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.format === publicSelectedFormat);
  });
  // Armory rule selection sync
  document.querySelectorAll('#tourneyArmorySelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.armory === tourneySelectedArmory);
  });
  document.querySelectorAll('#privateArmorySelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.armory === privateSelectedArmory);
  });
  document.querySelectorAll('#publicArmorySelector .pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.armory === publicSelectedArmory);
  });
}

function updateTourneyTabPanels() {
  document.querySelectorAll('#tourneyModeTabs .t-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === currentTourneyTab);
  });

  $('#panelTourneySolo').hidden = (currentTourneyTab !== 'solo');
  $('#panelTourneyPrivate').hidden = (currentTourneyTab !== 'private');
  $('#panelTourneyPublic').hidden = (currentTourneyTab !== 'public');

  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();

  if (currentTourneyTab === 'public' && typeof FirebaseTourneyEngine !== 'undefined') {
    startListeningPublicRooms();
  }
}

function startListeningPublicRooms() {
  if (publicRoomsUnsub) publicRoomsUnsub();
  const listEl = $('#tourneyPublicRoomsList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">⏳ 正在同步雲端即時大廳房間清單...</div>';

  publicRoomsUnsub = FirebaseTourneyEngine.listenPublicRooms(rooms => {
    if (!rooms || rooms.length === 0) {
      listEl.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:30px;background:rgba(255,255,255,.02);border:1px dashed var(--line);border-radius:8px">
          <div style="font-size:24px;margin-bottom:6px">🌐</div>
          <div style="font-weight:700;color:var(--text);font-size:14px">目前沒有等待中的公開房間</div>
          <div class="muted" style="font-size:12px;margin-top:4px">點擊上方【⚡ 一鍵快速匹配出擊】立即發起湊桌，300 秒 (5 分鐘) 必開賽！</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = rooms.map(r => {
      const remainingSec = r.countdownEnd ? Math.max(0, Math.floor((r.countdownEnd - Date.now()) / 1000)) : 300;
      return `<div class="room-live-card" data-code="${esc(r.code)}">
        <div class="r-top">
          <div class="r-name">${esc(r.name)}</div>
          <span class="badge ${remainingSec > 0 ? 'badge-ok' : ''}" style="font-size:10px">
            ${remainingSec > 0 ? `⏱️ 倒數 ${remainingSec}s` : '🔥 滿員即開'}
          </span>
        </div>
        <div class="r-meta">
          <span>${esc(r.hostFlag || '🌐')} ${esc(r.hostName)}</span>
          <span>·</span>
          <span><b>${r.size} 強</b> (${r.format === 'bo1' ? '⚡ BO1' : (r.format === 'bo3' ? '⚔️ BO3' : '⭐ 升級制')})</span>
          <span>·</span>
          <span>${r.armoryRule === 'locked' ? '🔒 鎖定' : '🎲 自由'}</span>
          <span>·</span>
          <span style="color:var(--cyan);font-weight:700">${r.filledCount}/${r.size} 席位</span>
        </div>
        <div style="margin-top:4px">
          <button class="btn primary sm block btnJoinLiveRoom" data-code="${esc(r.code)}">一鍵加入房間 ➔</button>
        </div>
      </div>`;
    }).join('');
  });
}

/* 繪製仿照世足 2026 的左右雙翼對抗樹 (FIFA World Cup Bracket) */
/* =====================================================
   方案 A：心智圖雙向向心樹 (Bilateral Mindmap Arena)
   具備實體動態 SVG 貝茲流光連線、自適應向心聚攏與電競 2.0 對抗節點
   ===================================================== */
function renderTournamentBracket(t) {
  const container = $('#bracketContainer');
  if (!container) return;

  const totalRounds = t.totalRounds;

  // 1. 生成左半區欄位 (Left Wing: R1 -> R2 -> Semi-Finals 向心)
  const leftWingCols = [];
  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = Object.values(t.matches).filter(m => m.round === r && m.isLeft);
    leftWingCols.push({
      round: r,
      title: getRoundTitle(r, t.size),
      matches: matchesInRound
    });
  }

  // 2. 生成右半區欄位 (Right Wing: Semi-Finals <- R2 <- R1 向心)
  const rightWingCols = [];
  for (let r = totalRounds - 1; r >= 1; r--) {
    const matchesInRound = Object.values(t.matches).filter(m => m.round === r && !m.isLeft && m.id !== t.finalMatchId && m.id !== t.bronzeMatchId);
    rightWingCols.push({
      round: r,
      title: getRoundTitle(r, t.size),
      matches: matchesInRound
    });
  }

  // 3. 中央決賽與季軍賽
  const finalMatch = t.matches[t.finalMatchId];
  const bronzeMatch = t.matches[t.bronzeMatchId];

  // 容器尺度自適應類別 (針對 4/8/16/32 強縮放)
  container.className = `bracket-container bracket-size-${t.size}`;

  container.innerHTML = `
    <!-- 戰術極座標同心圓雷達底座 (Tactical Radar Backdrop) -->
    <div class="bracket-tactical-backdrop" aria-hidden="true">
      <div class="radar-crosshair-h"></div>
      <div class="radar-crosshair-v"></div>
      <div class="radar-ring rr-1"></div>
      <div class="radar-ring rr-2"></div>
      <div class="radar-ring rr-3"></div>
      <div class="radar-label top">TACTICAL ARENA · WORLD CUP ${new Date().getFullYear()}</div>
    </div>

    <!-- 全畫布動態 SVG 貝茲連線圖層 (Bézier Flow Layer) -->
    <svg class="bracket-svg-layer" id="bracketSvgLayer"></svg>

    <!-- 左翼 (上半區 向心聚合) -->
    <div class="bracket-wing left-wing">
      ${leftWingCols.map(col => renderBracketColHtml(col, t, 'left')).join('')}
    </div>

    <!-- 中央世界冠軍王座 (歐冠 2024 神殿風格：上方冠亞軍 · 正中央大獎盃 · 下方季殿軍) -->
    <div class="bracket-center">
      <!-- 上方：總冠軍決賽 (GOLD FINAL 冠亞軍爭霸) -->
      <div class="final-match-box">
        <div class="match-box-title gold-title">
          <span>★ 巔峰總決賽 · 冠亞軍爭霸 ★</span>
        </div>
        ${finalMatch ? renderMatchCardHtml(finalMatch, t, true) : ''}
      </div>

      <!-- 正中央：大獎盃榮譽神壇 (World Champion Center Trophy) -->
      <div class="trophy-podium center-trophy">
        <div class="trophy-halo"></div>
        <div class="trophy-icon-glow">🏆</div>
        <div class="trophy-title">WORLD CHAMPION</div>
        <div class="trophy-sub-tag">${new Date().getFullYear()} 頂尖霸主王座</div>
        <div class="trophy-champion-box" id="trophyChampionDisplay">
          ${t.champion ? `<span class="champ-flag">${t.champion.flag}</span> <strong class="champ-name">${esc(t.champion.name)}</strong> <span class="crown">👑</span>` : '<span class="champ-wait">⏳ 待世界冠軍誕生...</span>'}
        </div>
      </div>

      <!-- 下方：季殿軍爭奪戰 (BRONZE FINAL) -->
      <div class="bronze-match-box">
        <div class="match-box-title bronze-title">
          <span>◆ 季殿軍榮譽戰 · BRONZE FINAL ◆</span>
        </div>
        ${bronzeMatch ? renderMatchCardHtml(bronzeMatch, t, false, true) : ''}
      </div>
    </div>

    <!-- 右翼 (下半區 向心聚合) -->
    <div class="bracket-wing right-wing">
      ${rightWingCols.map(col => renderBracketColHtml(col, t, 'right')).join('')}
    </div>
  `;

  // 保持滾動位置避免更新對戰狀態時抖動
  const viewport = $('#tourneyBracketViewport');
  const isAlreadyFocused = viewport && viewport.dataset.hasInitialFocused === 'true';
  const savedScrollTop = (viewport && isAlreadyFocused) ? viewport.scrollTop : null;
  const savedScrollLeft = (viewport && isAlreadyFocused) ? viewport.scrollLeft : null;

  applyBracketFitToViewport();
  renderBracketSvgLinks(t);
  requestAnimationFrame(() => {
    renderBracketSvgLinks(t);
    if (viewport) {
      if (isAlreadyFocused && savedScrollTop !== null) {
        viewport.scrollTop = savedScrollTop;
        viewport.scrollLeft = savedScrollLeft;
      } else {
        viewport.dataset.hasInitialFocused = 'true';
      }
    }
  });
}

/* =====================================================
   智慧一屏流自適應縮放引擎 (Scale-to-fit Engine)
   自動量測可用視窗寬高，保證 4/8/16/32 強均在單一螢幕完全顯示，徹底消滅滾動條
   ===================================================== */
function applyBracketFitToViewport() {
  const viewport = $('#tourneyBracketViewport');
  const container = $('#bracketContainer');
  if (!viewport || !container) return 1;

  container.style.height = 'auto';
  container.classList.remove('is-mobile-pan');
  // 不在此重置 transform 以免引發縮放跳動/閃爍
  const natW = container.offsetWidth;
  const natH = container.offsetHeight;
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;
  if (!natW || !natH || !vpW || !vpH) {
    setTimeout(() => {
      applyBracketFitToViewport();
      const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
      const isOnline = !!onlineRoom && (currentTourneyTab !== 'solo');
      const t = isOnline ? onlineRoom : (typeof TournamentEngine !== 'undefined' ? TournamentEngine.getState() : null);
      if (t) renderBracketSvgLinks(t);
    }, 60);
    return 1;
  }

  // 手機與窄螢幕 (<= 768px)：維持最小可讀字級縮放 (0.68x ~ 0.90x)，啟用觸控平移並自動聚焦至「我方作戰線」
  if (window.innerWidth <= 768) {
    const mScale = Math.max(0.68, Math.min((vpW - 16) / natW, 0.92));
    container.classList.remove('is-fitted');
    container.classList.add('is-mobile-pan');
    container.style.transform = `scale(${mScale.toFixed(4)})`;
    container.dataset.scale = String(mScale);
    container.style.visibility = 'visible';
    requestAnimationFrame(() => {
      const myCard = container.querySelector('.b-match-card.is-my-match') || container.querySelector('.bracket-center');
      if (myCard && !viewport.dataset.userScrolled) {
        const cRect = container.getBoundingClientRect();
        const mRect = myCard.getBoundingClientRect();
        const targetLeft = (mRect.left - cRect.left) - (vpW - mRect.width) / 2;
        viewport.scrollLeft = Math.max(0, targetLeft);
      }
    });
    return mScale;
  }

  // 判斷是否為 32 強大型對抗樹 (每翼 8 場，縱向高度顯著)
  const isSize32 = container.classList.contains('bracket-size-32');

  // 桌機與平板橫向 (> 768px)：
  if (isSize32) {
    // 🎯 32 強專屬優化：解鎖垂直高度限制，寬度自適應適配並保底放大（0.82x ~ 1.08x），啟用滑鼠滾輪上下平滑捲動
    viewport.classList.add('is-scrollable-32');
    container.classList.remove('is-fitted');
    container.classList.add('is-scrollable-32');

    const availW = vpW - 32;
    // 依可用寬度計算縮放比例，給予至少 0.82 的舒適高清晰度保底
    const s32Scale = Math.max(0.82, Math.min(availW / natW, 1.08));
    container.style.transform = `scale(${s32Scale.toFixed(4)})`;
    container.dataset.scale = String(s32Scale);

    // 補償 CSS scale 在 layout 上的下外邊距，使滾動條長度精確吻合實際卡片內容
    if (s32Scale < 1) {
      container.style.marginBottom = `-${Math.round(natH * (1 - s32Scale) - 24)}px`;
    } else {
      container.style.marginBottom = `${Math.round(natH * (s32Scale - 1) + 24)}px`;
    }

    container.style.visibility = 'visible';

    // 🎯 智慧自動聚焦：首次進入時自動將視窗平滑滾動至「我方作戰席位」，清晰直視當前對手
    requestAnimationFrame(() => {
      const myCard = container.querySelector('.b-match-card.is-my-match');
      if (myCard && !viewport.dataset.userScrolled) {
        const cRect = container.getBoundingClientRect();
        const mRect = myCard.getBoundingClientRect();
        const targetTop = (mRect.top - cRect.top) - (vpH - mRect.height) / 2;
        viewport.scrollTop = Math.max(0, targetTop);
      }
    });

    return s32Scale;
  }

  // 4 / 8 / 16 強：維持經典「一屏流 (Fit-to-Screen)」無捲軸全景展示
  viewport.classList.remove('is-scrollable-32');
  container.classList.remove('is-scrollable-32');
  container.style.marginBottom = '0';
  const availW = vpW - 32;
  const availH = vpH - 24;
  const scale = Math.min(availW / natW, availH / natH, 1.25);

  const targetH = availH / scale;
  if (targetH > natH) container.style.height = `${Math.floor(targetH)}px`;

  container.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
  container.dataset.scale = String(scale);
  container.classList.add('is-fitted');
  return scale;
}

function getRoundTitle(r, size) {
  if (size === 32) {
    if (r === 1) return '32 強賽';
    if (r === 2) return '16 強賽';
    if (r === 3) return '半準決賽 (8強)';
    if (r === 4) return '準決賽 (4強)';
  } else if (size === 16) {
    if (r === 1) return '16 強賽';
    if (r === 2) return '半準決賽 (8強)';
    if (r === 3) return '準決賽 (4強)';
  } else if (size === 8) {
    if (r === 1) return '半準決賽 (8強)';
    if (r === 2) return '準決賽 (4強)';
  } else {
    return '準決賽 (4強)';
  }
  return `第 ${r} 輪`;
}

function renderBracketColHtml(col, t, side) {
  return `<div class="bracket-col ${side}-col" data-round="${col.round}">
    <div class="bracket-col-header">
      <span class="col-header-pill">${col.title}</span>
    </div>
    <div class="bracket-col-matches">
      ${col.matches.map(m => renderMatchCardHtml(m, t)).join('')}
    </div>
  </div>`;
}

function renderMatchCardHtml(m, t, isFinal = false, isBronze = false) {
  const prof = getTournamentPlayerProfile();
  const isMyMatch = Boolean(m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid || m.teamA?.isMe || m.teamB?.isMe);
  const isFinished = (m.status === 'finished');
  const isPaired = Boolean(m.teamA && m.teamB);
  const totalRounds = t.totalRounds || Math.log2(t.size);

  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const isOnline = Boolean(onlineRoom);

  const reqWins = (isOnline && typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
    ? FirebaseTourneyEngine.getRequiredWins(m, t.format || t.matchType, totalRounds)
    : (typeof TournamentEngine !== 'undefined' ? TournamentEngine.getRequiredWins(m) : 1);

  // 判定是否為我方當前正在等待出擊的對戰場次
  const currentMyMatch = isOnline
    ? Object.values(onlineRoom.matches || {}).find(item => {
        if (item.status === 'finished') return false;
        const aIsMe = item.teamA && item.teamA.uid === prof.uid;
        const bIsMe = item.teamB && item.teamB.uid === prof.uid;
        return (aIsMe || bIsMe) && Boolean(item.teamA && item.teamB);
      })
    : (typeof TournamentEngine !== 'undefined' ? TournamentEngine.getMyMatch() : null);

  const isMyReadyFight = Boolean(currentMyMatch && currentMyMatch.id === m.id);

  // 線上多人模式下我方是否已鎖定陣容等待對手
  let isWaitingOpponent = false;
  if (isMyReadyFight && isOnline) {
    const isTeamA = m.teamA && m.teamA.uid === prof.uid;
    const readyKey = isTeamA ? 'readyA' : 'readyB';
    isWaitingOpponent = (m[readyKey] === true);
  }

  // 局數計分圓點生成輔助 (BO3/BO5 pips)
  const renderPips = (score, req) => {
    if (req <= 1) return '';
    let pips = '';
    for (let i = 0; i < req; i++) {
      pips += `<span class="pip ${i < score ? 'won' : ''}"></span>`;
    }
    return `<div class="b-pips">${pips}</div>`;
  };

  const renderTeamTag = (team, isOpponent) => {
    if (!team) return '';
    const isMe = (team.uid === prof.uid || team.isMe);
    if (isMe) {
      return `<span class="b-team-badge badge-me" title="我方特遣部隊">👑我方</span>`;
    }
    if (isOpponent) {
      return `<span class="b-team-badge badge-opp" title="當前迎戰敵方">🎯敵方</span>`;
    }
    if (team.isAI) {
      return `<span class="b-team-badge badge-ai" title="AI 自動推演部隊">🤖AI</span>`;
    }
    return `<span class="b-team-badge badge-peer" title="真人參賽選手">🟢真人</span>`;
  };

  const renderUidSuffix = (team) => {
    if (!team || team.isAI || !team.uid) return '';
    const shortUid = team.uid.replace('CMD-', '').slice(-4);
    return `<span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-left:3px">#${shortUid}</span>`;
  };

  return `<div class="b-match-card ${isMyMatch ? 'is-my-match' : ''} ${isMyReadyFight ? 'is-ready-to-fight' : ''} ${isFinal ? 'is-grand-final' : ''} ${isBronze ? 'is-bronze-card' : ''}" data-match-id="${m.id}" ${isMyReadyFight ? 'title="⚔️ 我方出擊場次 · 點擊立即出征迎戰"' : ''}>
    <div class="port-terminal port-left" aria-hidden="true"></div>
    <div class="port-terminal port-right" aria-hidden="true"></div>

    ${isMyMatch ? `<div class="my-match-strip"><span class="pulse-beacon"></span> ${isMyReadyFight ? '★ 我方迎戰線 (出擊) ★' : '我方作戰線'}</div>` : ''}

    <div class="b-team-row ${isFinished && m.winner === 'A' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        ${renderTeamTag(m.teamA, isMyMatch && m.teamB && (m.teamB.uid === prof.uid || m.teamB.isMe))}
        <span class="b-team-flag-pill">${m.teamA ? m.teamA.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamA ? esc(m.teamA.name) : '待定對手'}">
          ${m.teamA ? esc(m.teamA.name) : '待定對手'}
        </span>
        ${renderUidSuffix(m.teamA)}
      </div>
      <div class="b-score-wrapper">
        ${renderPips(m.scoreA, reqWins)}
        <span class="b-score-plate ${isFinished && m.winner === 'A' ? 'is-winner' : ''}">${m.scoreA}</span>
      </div>
    </div>

    <div class="b-team-row ${isFinished && m.winner === 'B' ? 'winner' : isFinished ? 'loser' : ''}">
      <div class="b-team-name-box">
        ${renderTeamTag(m.teamB, isMyMatch && m.teamA && (m.teamA.uid === prof.uid || m.teamA.isMe))}
        <span class="b-team-flag-pill">${m.teamB ? m.teamB.flag : '？'}</span>
        <span class="b-team-name" title="${m.teamB ? esc(m.teamB.name) : '待定對手'}">
          ${m.teamB ? esc(m.teamB.name) : '待定對手'}
        </span>
        ${renderUidSuffix(m.teamB)}
      </div>
      <div class="b-score-wrapper">
        ${renderPips(m.scoreB, reqWins)}
        <span class="b-score-plate ${isFinished && m.winner === 'B' ? 'is-winner' : ''}">${m.scoreB}</span>
      </div>
    </div>

    <div class="b-match-status-bar">
      ${(() => {
        // 精簡 ID: R1-M1 -> R11, R1-M2 -> R12, R4-M1 -> FIN, BRONZE-FINAL -> BRZ
        let cid = m.id;
        if (m.id === t.finalMatchId || m.id === 'FINAL' || m.round === totalRounds) cid = 'FIN';
        else if (m.id === t.bronzeMatchId || m.id === 'BRONZE-FINAL' || m.isBronze) cid = 'BRZ';
        else {
          const matchParts = m.id.match(/R(\d+)-M(\d+)/);
          if (matchParts) cid = `R${matchParts[1]}${matchParts[2]}`;
        }
        const fmtTag = reqWins > 1 ? `BO${reqWins === 3 ? 5 : 3}` : 'BO1';
        return `<span class="b-match-id-tag" title="${m.id} · 先${reqWins}勝制">${cid} ${fmtTag}</span>`;
      })()}
      ${(m.bannedListB && m.bannedListB.length) ? `<span class="b-ban-badge ban-opp" title="${m.teamA?.name || '我方'} 累計遭禁 ${m.bannedListB.length} 件：${m.bannedListB.map(id => UNIT_MAP[id]?.name || id).join('、')}">⚠️ ${m.bannedListB.length}</span>` : ''}
      ${(m.bannedListA && m.bannedListA.length) ? `<span class="b-ban-badge ban-me" title="我方累計禁用對手 ${m.bannedListA.length} 件：${m.bannedListA.map(id => UNIT_MAP[id]?.name || id).join('、')}">🚫 ${m.bannedListA.length}</span>` : ''}
      ${isFinished ?
        (isMyMatch ? `<span class="b-status-badge finished">✔ 戰報</span>` : `<span class="b-status-badge finished">✔ 戰報</span>`) :
        isMyReadyFight ?
          (isWaitingOpponent ?
            `<span class="b-status-badge my-waiting">⏳ 等候</span>` :
            `<span class="b-status-badge fight-ready">⚔️ 出擊</span>`) :
        (isMyMatch ?
          `<span class="b-status-badge waiting">⏳ 晉級</span>` :
          isPaired ?
            `<span class="b-status-badge spec">👀 觀戰</span>` :
            `<span class="b-status-badge waiting">⏳ 待定</span>`)}
    </div>
  </div>`;
}

function renderBracketSvgLinks(t) {
  const container = $('#bracketContainer');
  const svg = $('#bracketSvgLayer');
  if (!container || !svg || !t || !t.matches) return;

  // 畫布已被 scale 縮放：getBoundingClientRect 為縮放後尺寸，需除以 scale 還原為畫布內部座標
  const s = parseFloat(container.dataset.scale) || 1;
  const rawRect = container.getBoundingClientRect();
  if (rawRect.width === 0 || rawRect.height === 0) return;
  const W = container.offsetWidth;
  const H = container.offsetHeight;
  const toLocal = r => ({
    left: (r.left - rawRect.left) / s,
    right: (r.right - rawRect.left) / s,
    top: (r.top - rawRect.top) / s,
    height: r.height / s
  });
  const cRect = { left: 0, top: 0 };
  const localRect = el => toLocal(el.getBoundingClientRect());

  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  let pathsHtml = `
    <defs>
      <!-- 金色晉級流光漸層 -->
      <linearGradient id="winnerFlowGold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#fbbf24" stop-opacity="1" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.9" />
      </linearGradient>
      <!-- 翡翠綠晉級漸層 -->
      <linearGradient id="winnerFlowGreen" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669" stop-opacity="0.9" />
        <stop offset="50%" stop-color="#34d399" stop-opacity="1" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.9" />
      </linearGradient>
      <!-- 季軍古銅漸層 -->
      <linearGradient id="bronzeFlow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#b45309" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#d97706" stop-opacity="0.8" />
      </linearGradient>
      <!-- 霓虹光暈濾鏡 -->
      <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  `;

  // 1. 繪製標準晉級樹 (Left & Right Wings -> Final)
  Object.values(t.matches).forEach(m => {
    if (!m.nextMatchId || !t.matches[m.nextMatchId]) return;

    const fromEl = container.querySelector(`[data-match-id="${m.id}"]`);
    const toEl = container.querySelector(`[data-match-id="${m.nextMatchId}"]`);
    if (!fromEl || !toEl) return;

    const fromRect = localRect(fromEl);
    const toRect = localRect(toEl);

    let x1, y1, x2, y2, ctrlX1, ctrlY1, ctrlX2, ctrlY2;
    const isLeft = m.isLeft;

    if (isLeft) {
      // 左翼：從卡片右緣中心出發 -> 進入下一輪卡片左緣
      x1 = fromRect.right - cRect.left;
      y1 = fromRect.top + fromRect.height * 0.5 - cRect.top;
      x2 = toRect.left - cRect.left;
      const slotRatio = m.nextSlot === 'A' ? 0.32 : m.nextSlot === 'B' ? 0.68 : 0.5;
      y2 = toRect.top + toRect.height * slotRatio - cRect.top;

      const dx = Math.max(25, (x2 - x1) * 0.55);
      ctrlX1 = x1 + dx;
      ctrlY1 = y1;
      ctrlX2 = x2 - dx;
      ctrlY2 = y2;
    } else {
      // 右翼：從卡片左緣中心出發 -> 進入下一輪卡片右緣
      x1 = fromRect.left - cRect.left;
      y1 = fromRect.top + fromRect.height * 0.5 - cRect.top;
      x2 = toRect.right - cRect.left;
      const slotRatio = m.nextSlot === 'A' ? 0.32 : m.nextSlot === 'B' ? 0.68 : 0.5;
      y2 = toRect.top + toRect.height * slotRatio - cRect.top;

      const dx = Math.max(25, (x1 - x2) * 0.55);
      ctrlX1 = x1 - dx;
      ctrlY1 = y1;
      ctrlX2 = x2 + dx;
      ctrlY2 = y2;
    }

    const pathD = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
    const isFinished = (m.status === 'finished');
    const isMyAdvancement = isFinished && ((m.winner === 'A' && m.teamA?.isMe) || (m.winner === 'B' && m.teamB?.isMe));

    let strokeClass = 'bracket-link-pending';
    let strokeAttr = '';
    let filterAttr = '';

    if (isFinished) {
      if (isMyAdvancement) {
        strokeClass = 'bracket-link-my-flow';
        strokeAttr = 'stroke="url(#winnerFlowGold)"';
        filterAttr = 'filter="url(#neonGlow)"';
      } else {
        strokeClass = 'bracket-link-active';
        strokeAttr = 'stroke="url(#winnerFlowGreen)"';
        filterAttr = 'filter="url(#neonGlow)"';
      }
    }

    pathsHtml += `
      <g class="bracket-link-group">
        <!-- 底層深色軌道 -->
        <path d="${pathD}" class="bracket-link-bg" />
        <!-- 核心貝茲導軌 (流光動畫) -->
        <path d="${pathD}" class="bracket-link-core ${strokeClass}" ${strokeAttr} ${filterAttr} />
        <!-- 起始端點與接入端點微型科技圓點 -->
        <circle cx="${x1}" cy="${y1}" r="3" class="bracket-port-circle ${isFinished ? 'active' : ''}" />
        <circle cx="${x2}" cy="${y2}" r="3" class="bracket-port-circle ${isFinished ? 'active' : ''}" />
      </g>
    `;
  });

  // 2. 準決賽敗者引導至季軍賽 (Bronze Final) 的虛線導引
  if (t.bronzeMatchId && t.matches[t.bronzeMatchId]) {
    const bronzeEl = container.querySelector(`[data-match-id="${t.bronzeMatchId}"]`);
    if (bronzeEl) {
      const bRect = localRect(bronzeEl);
      const semiMatches = Object.values(t.matches).filter(m => m.round === t.totalRounds - 1);
      semiMatches.forEach(sm => {
        const smEl = container.querySelector(`[data-match-id="${sm.id}"]`);
        if (!smEl) return;
        const smRect = localRect(smEl);
        let x1, y1, x2, y2, ctrlX1, ctrlY1, ctrlX2, ctrlY2;
        if (sm.isLeft) {
          x1 = smRect.right - cRect.left;
          y1 = smRect.top + smRect.height * 0.7 - cRect.top;
          x2 = bRect.left - cRect.left;
          y2 = bRect.top + bRect.height * 0.4 - cRect.top;
          const dx = Math.max(20, (x2 - x1) * 0.5);
          ctrlX1 = x1 + dx; ctrlY1 = y1; ctrlX2 = x2 - dx; ctrlY2 = y2;
        } else {
          x1 = smRect.left - cRect.left;
          y1 = smRect.top + smRect.height * 0.7 - cRect.top;
          x2 = bRect.right - cRect.left;
          y2 = bRect.top + bRect.height * 0.6 - cRect.top;
          const dx = Math.max(20, (x1 - x2) * 0.5);
          ctrlX1 = x1 - dx; ctrlY1 = y1; ctrlX2 = x2 + dx; ctrlY2 = y2;
        }
        const bPathD = `M ${x1} ${y1} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${x2} ${y2}`;
        pathsHtml += `
          <g class="bracket-link-bronze-group">
            <path d="${bPathD}" class="bracket-link-bg" />
            <path d="${bPathD}" class="bracket-link-bronze" stroke="url(#bronzeFlow)" stroke-dasharray="4 3" />
          </g>
        `;
      });
    }
  }

  svg.innerHTML = pathsHtml;
}

/* 點擊錦標賽任一對抗卡片，彈出觀戰與戰報彈窗 */
function openTournamentSpectatorModal(matchId) {
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  let snap = null;
  if (onlineRoom && onlineRoom.status === 'in_progress') {
    const m = onlineRoom.matches ? onlineRoom.matches[matchId] : null;
    if (m) {
      const totalRounds = onlineRoom.totalRounds || Math.log2(onlineRoom.size);
      const reqWins = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getRequiredWins)
        ? FirebaseTourneyEngine.getRequiredWins(m, onlineRoom.format, totalRounds)
        : 1;
      snap = {
        matchId: m.id,
        round: m.round,
        status: m.status,
        teamA: m.teamA,
        teamB: m.teamB,
        scoreA: m.scoreA || 0,
        scoreB: m.scoreB || 0,
        requiredWins: reqWins,
        history: ensureArray(m.history)
      };
    }
  } else {
    snap = TournamentEngine.getMatchSnapshot(matchId);
    if (snap) snap.history = ensureArray(snap.history);
  }
  if (!snap) return;

  const modal = $('#tourneySpectatorModal');
  const card = $('#tourneySpectatorCard');
  if (!modal || !card) return;

  const reqWins = snap.requiredWins;
  const teamAName = snap.teamA ? `${snap.teamA.flag} ${snap.teamA.name}` : '待定';
  const teamBName = snap.teamB ? `${snap.teamB.flag} ${snap.teamB.name}` : '待定';

  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-family:var(--head);font-size:16px;font-weight:800;color:var(--amber)">
        🏆 戰況情報所 · 場次 ${snap.matchId} (${reqWins === 3 ? 'BO5 五局三勝制' : (reqWins === 2 ? 'BO3 三局兩勝制' : 'BO1 單場淘汰')})
      </div>
      <button class="btn ghost sm" id="btnTourneySpecClose">關閉 ✕</button>
    </div>

    <!-- 對抗即時大比分面板 -->
    <div class="pvp-versus-box" style="margin-bottom:16px">
      <div class="pvp-v-player">
        <div class="v-flag">${snap.teamA?.flag || '🌐'}</div>
        <div class="v-name">${esc(snap.teamA?.name || '待定')}</div>
        <span class="v-uid">${snap.teamA?.isMe ? '我方' : 'AI'}</span>
      </div>
      <div class="pvp-vs-badge">
        <span style="font-size:24px;font-family:var(--mono);color:#fff">${snap.scoreA} : ${snap.scoreB}</span>
        <div class="pvp-ping" style="color:${snap.status === 'finished' ? '#10b981' : '#f59e0b'}">
          ${snap.status === 'finished' ? '✔ 已完賽' : '⚡ 爭霸激戰中'}
        </div>
      </div>
      <div class="pvp-v-player">
        <div class="v-flag">${snap.teamB?.flag || '🌐'}</div>
        <div class="v-name">${esc(snap.teamB?.name || '待定')}</div>
        <span class="v-uid">${snap.teamB?.isMe ? '我方' : 'AI'}</span>
      </div>
    </div>

    <!-- 歷局小局快照清單 (零頻寬黑盒子重播) -->
    <div style="margin-top:12px">
      <div class="sheet-label" style="margin-bottom:8px">小局交火推演記錄 (${snap.history.length} 局)</div>
      ${snap.history.length === 0 ? `<div class="muted" style="padding:16px;text-align:center">此場次正在進行戰術配置，尚未交火。</div>` : ''}
      <div style="display:flex;flex-direction:column;gap:10px">
        ${snap.history.map((h, i) => {
          const wName = h.winner === 'A' ? teamAName : teamBName;
          return `<div class="panel" style="padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid var(--line2);display:flex;justify-content:space-between;align-items:center">
            <div>
              <strong style="color:var(--cyan)">第 ${h.round} 局</strong> ｜
              戰場：${h.event?.icon || '🌐'} ${esc(h.event?.name || '標準戰區')} ｜
              獲勝：<b style="color:${h.winner === 'A' ? '#38bdf8' : '#f87171'}">${wName}</b>
              <div class="muted" style="font-size:11px;margin-top:2px">積分 ${h.scoreA.toFixed(0)} : ${h.scoreB.toFixed(0)}</div>
            </div>
            <button class="btn ghost sm btnReplayRound" data-match="${snap.matchId}" data-round-idx="${i}" style="font-size:11.5px">
              🎬 播放戰鬥推演
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;

  modal.hidden = false;
  currentActiveModal = modal;
}

/* 啟動錦標賽中玩家的一場戰鬥 */
function startTournamentPlayerBattle() {
  const myMatch = TournamentEngine.getMyMatch();
  if (!myMatch) {
    toast('⚠️ 目前沒有輪到你的對戰場次');
    return;
  }

  const t = TournamentEngine.getState();
  const isSeriesFirstGame = (!myMatch.history || myMatch.history.length === 0);

  // 若為開戰鎖定賽制且為該系列賽第 1 局，確保載入開戰瞬間凍結之初始配置
  if (t && t.armoryRule === 'locked' && t.lockedDeck && t.lockedDeck.length === 5 && isSeriesFirstGame) {
    state.deck = t.lockedDeck.slice();
    if (t.lockedDoctrine) state.doctrine = t.lockedDoctrine;
  }

  // 檢查並清理玩家牌組中已被敵方戰術禁用的裝備
  const bansOnMe = currentBanned();
  let hasBannedEquipped = false;
  state.deck.forEach((id, idx) => {
    if (id && bansOnMe.includes(id)) {
      state.deck[idx] = null;
      state.active = idx;
      hasBannedEquipped = true;
    }
  });

  // 驗證玩家陣容：若未配置滿 5 個槽位或包含被禁用裝備，友善引導進入錦標賽軍火庫替補補位（絕不踢出錦標賽）
  if (!state.deck.every(Boolean) || hasBannedEquipped) {
    const bannedNames = bansOnMe.map(id => UNIT_MAP[id]?.name || id).join('、');
    toast(`⚠️ 主力裝備【${bannedNames || '部分單位'}】已被敵方戰術禁用！請先在軍火庫完成替補配給再出擊！`);
    startTourneyBuild();
    return;
  }

  // 設定當前輪次全場統一戰區天候 (Unified Round Theater)
  const curTheater = (typeof TournamentEngine !== 'undefined' && TournamentEngine.getCurrentRoundTheater && TournamentEngine.getCurrentRoundTheater())
    || (t && t.roundTheaters && t.roundTheaters[t.currentRound])
    || pick(EVENTS);
  state.event = curTheater;

  const opp = myMatch.teamA.isMe ? myMatch.teamB : myMatch.teamA;
  state.enemy = (opp.deck || generateLegalDeck()).slice();
  state.enemyName = `${opp.flag} ${opp.name}`;
  state.enemyDoc = opp.doctrine || 'defense';

  // 開啟戰鬥推演前，清除錦標賽大廳倒數定時器，避免戰鬥期間扣除下一局準備時間
  if (window.__tourneyWaitTicker) {
    clearInterval(window.__tourneyWaitTicker);
    window.__tourneyWaitTicker = null;
  }
  myMatch.deadline = null;

  // 開啟戰鬥推演
  startBattle();
}

/* 錦標賽單局結算處理 (完整引入 BO3 / BO5 電競系列賽 Ban 選反制與下一輪解除重置) */
function handleTournamentRoundEnd(res) {
  const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
  const prof = (typeof getTournamentPlayerProfile === 'function') ? getTournamentPlayerProfile() : null;

  if (onlineRoom && onlineRoom.matches) {
    const myMatch = Object.values(onlineRoom.matches).find(m => (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid));
    if (!myMatch) {
      showResult(res, {
        bo3NextText: '🏆 返回錦標賽',
        bo3Callback: () => { closeBattle(); setMode('tournament'); }
      });
      return;
    }

    const totalRounds = onlineRoom.totalRounds || Math.log2(onlineRoom.size || 8);
    const reqWins = (typeof FirebaseTourneyEngine.getRequiredWins === 'function')
      ? FirebaseTourneyEngine.getRequiredWins(myMatch, onlineRoom.format, totalRounds)
      : (myMatch.requiredWins || 2);
    const isMultiGame = (reqWins >= 2);
    const fmtStr = reqWins === 3 ? 'BO5' : (reqWins === 2 ? 'BO3' : 'BO1');
    const isTeamA = (myMatch.teamA?.uid === prof.uid);
    const won = isTeamA ? (res.winner === 'A') : (res.winner === 'B');
    const draw = (res.winner === 'draw');
    const hist = ensureArray(myMatch.history);
    const matchFinished = (myMatch.status === 'finished');

    if (matchFinished) {
      const iWon = (myMatch.winnerTeam?.uid === prof.uid);
      showResult(res, {
        bo3NextText: iWon ? '🏆 晉級下一輪！返回錦標賽' : '💔 遺憾止步！返回錦標賽',
        bo3Callback: () => {
          closeBattle();
          if (onlineRoom.status === 'completed' && onlineRoom.champion?.uid === prof.uid) {
            showTournamentChampionModal(onlineRoom.champion);
          } else {
            setMode('tournament');
            if (iWon) {
              if (onlineRoom.armoryRule === 'locked') {
                if (onlineRoom.lockedDeck && onlineRoom.lockedDeck.length === 5) {
                  state.deck = onlineRoom.lockedDeck.slice();
                }
                if (onlineRoom.lockedDoctrine) {
                  state.doctrine = onlineRoom.lockedDoctrine;
                }
                toast('🎉 恭喜晉級下一輪！上一輪戰術禁用已全數解除，已重置恢復出征鎖定陣容！');
              } else {
                toast('🎉 恭喜晉級下一輪！上一輪戰術禁用已全數解除，軍火庫已全面解鎖，可自由調配陣容！');
              }
            } else {
              toast('💔 於本輪止步！你已轉為特邀戰術觀摩員，可收看後續所有決賽！');
            }
          }
        }
      });
      return;
    }

    // 線上多局制小局間 (BO3 / BO5)
    const nextGameNum = hist.length + 1;
    if (!myMatch.bannedListA) myMatch.bannedListA = [];
    if (!myMatch.bannedListB) myMatch.bannedListB = [];
    const myScore = isTeamA ? (myMatch.scoreA || 0) : (myMatch.scoreB || 0);
    const oppScore = isTeamA ? (myMatch.scoreB || 0) : (myMatch.scoreA || 0);

    if (isMultiGame) {
      const banCount = (onlineRoom.armoryRule === 'locked') ? 1 : 2;

      if (draw) {
        showResult(res, {
          bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局（平局重賽 · 比分 ${myScore}:${oppScore}）`,
          bo3Callback: () => {
            closeBattle();
            setMode('tournament');
            toast(`⚖️ 本局戰平！戰略積分相同，請準備第 ${nextGameNum} 局出擊！`);
          }
        });
        return;
      }

      if (won) {
        // 我方獲勝 -> 敵方失利
        const opp = isTeamA ? myMatch.teamB : myMatch.teamA;
        if (opp && opp.isAI) {
          const targetBans = isTeamA ? myMatch.bannedListB : myMatch.bannedListA;
          const playerDeckUnits = state.deck.filter(Boolean);
          const unbannedPlayerUnits = playerDeckUnits.filter(id => !targetBans.includes(id));
          const playerMvp = isTeamA ? res.mvp?.A : res.mvp?.B;

          const sortedThreats = unbannedPlayerUnits.slice().sort((a, b) => {
            const uA = UNIT_MAP[a];
            const uB = UNIT_MAP[b];
            const isMvpA = (playerMvp && playerMvp.id === a) ? 1000 : 0;
            const isMvpB = (playerMvp && playerMvp.id === b) ? 1000 : 0;
            return (isMvpB + (uB?.cost || 0) * 10) - (isMvpA + (uA?.cost || 0) * 10);
          });

          const aiChosenBans = sortedThreats.slice(0, banCount);
          aiChosenBans.forEach(id => {
            if (!targetBans.includes(id)) targetBans.push(id);
          });

          // 電腦敵方陣容也替換
          if (opp.deck) {
            const myBansOnOpp = isTeamA ? myMatch.bannedListA : myMatch.bannedListB;
            opp.deck = refitEnemyDeck(opp.deck, state.deck, state.event, myBansOnOpp);
          }

          const bannedNames = aiChosenBans.map(id => UNIT_MAP[id]?.name || id).join('、');

          showResult(res, {
            bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局（戰術反制 · 比分 ${myScore}:${oppScore}）`,
            bo3Callback: () => {
              closeBattle();
              setMode('tournament');
              const bansOnMe = isTeamA ? myMatch.bannedListB : myMatch.bannedListA;
              state.deck.forEach((id, idx) => {
                if (id && bansOnMe.includes(id)) {
                  state.deck[idx] = null;
                  state.active = idx;
                }
              });
              renderAll();
              toast(`⚠️ 電腦失利啟動反制！鎖定你上一局主力，禁用了【${bannedNames}】！請進入軍火庫調配換裝！(系列賽累計被禁 ${bansOnMe.length} 件)`);
            }
          });
          return;
        } else {
          showResult(res, {
            bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局 (比分 ${myScore}:${oppScore})`,
            bo3Callback: () => {
              closeBattle();
              setMode('tournament');
            }
          });
          return;
        }
      } else {
        // 我方本小局失利 -> 賦予指揮官戰術反制特權 (跳出 BAN 彈窗)
        showResult(res, {
          bo3NextText: `啟動戰術反制 (BAN 敵方裝備 · 比分 ${myScore}:${oppScore})`,
          bo3Callback: () => {
            closeBattle();
            const oppSide = isTeamA ? 'B' : 'A';
            const winnerTeam = res.final ? res.final[oppSide] : (isTeamA ? myMatch.teamB?.deck : myMatch.teamA?.deck);
            const nextEvent = state.event || pick(EVENTS);
            openBo3CounterModal(winnerTeam, nextGameNum, nextEvent);
          }
        });
        return;
      }
    } else {
      // BO1 小局推進
      showResult(res, {
        bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局 (比分 ${myScore}:${oppScore})`,
        bo3Callback: () => {
          closeBattle();
          setMode('tournament');
        }
      });
      return;
    }
  }

  const myMatch = TournamentEngine.getMyMatch();
  if (!myMatch) {
    showResult(res, {
      bo3NextText: '🏆 返回錦標賽',
      bo3Callback: () => {
        closeBattle();
        setMode('tournament');
      }
    });
    return;
  }

  const seed = (Math.random() * 4294967296) >>> 0;
  const eventObj = state.event || pick(EVENTS);
  const out = TournamentEngine.submitPlayerRoundResult(myMatch.id, res, seed, eventObj);
  // 小局結束後清空前一小局截止時間，待返回樹狀圖時重置為新一局的 60 秒準備時間
  myMatch.deadline = null;
  const t = TournamentEngine.getState();
  const reqWins = TournamentEngine.getRequiredWins(myMatch);
  const isMultiGame = (reqWins >= 2);
  const fmtStr = reqWins === 3 ? 'BO5' : (reqWins === 2 ? 'BO3' : 'BO1');
  const won = res.winner === 'A';
  const draw = res.winner === 'draw';

  if (out.matchFinished) {
    const iWon = out.winner.isMe;
    showResult(res, {
      bo3NextText: iWon ? '🏆 晉級下一輪！返回錦標賽' : '💔 遺憾止步！返回錦標賽',
      bo3Callback: () => {
        closeBattle();
        if (t.status === 'completed' && t.champion?.isMe) {
          showTournamentChampionModal(t.champion);
        } else {
          setMode('tournament');
          if (iWon) {
            // 【晉級下一輪比賽時：解除上一輪所有被 Ban 的名將，重新回復到沒被 Ban 的乾淨狀態！】
            if (t.armoryRule === 'locked') {
              // 開戰鎖定賽制：恢復為開戰鎖定前的 5 隻初始名將與教條配置
              if (t.lockedDeck && t.lockedDeck.length === 5) {
                state.deck = t.lockedDeck.slice();
              }
              if (t.lockedDoctrine) {
                state.doctrine = t.lockedDoctrine;
              }
              toast(`🎉 恭喜晉級下一輪！上一輪戰術禁用已全數解除，已重置恢復出征鎖定陣容！`);
            } else {
              // 自由調撥賽制：全軍火庫完全開放，指揮官可自由針對新國家調配
              toast(`🎉 恭喜晉級下一輪！上一輪戰術禁用已全數解除，軍火庫已全面解鎖，可自由調配陣容！`);
            }
          } else {
            toast(`💔 於本輪止步！你已轉為特邀戰術觀摩員，可收看後續所有決賽！`);
          }
        }
      }
    });
  } else {
    // 尚未分出勝負（多局制 BO3 / BO5 的小局之間）
    const nextGameNum = myMatch.history.length + 1;
    const isTeamA = myMatch.teamA && myMatch.teamA.isMe;
    if (!myMatch.bannedListA) myMatch.bannedListA = [];
    if (!myMatch.bannedListB) myMatch.bannedListB = [];

    if (isMultiGame) {
      const banCount = (t && t.armoryRule === 'locked') ? 1 : 2;

      if (draw) {
        showResult(res, {
          bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局（平局重賽 · 比分 ${out.currentScore[0]}:${out.currentScore[1]}）`,
          bo3Callback: () => {
            closeBattle();
            setMode('tournament');
            toast(`⚖️ 本局戰平！戰略積分相同，請準備第 ${nextGameNum} 局出擊！`);
          }
        });
        return;
      }

      if (won) {
        // 我方本小局獲勝 -> 電腦失利，電腦啟動智能戰術反制！
        const targetBans = isTeamA ? myMatch.bannedListB : myMatch.bannedListA;
        const playerDeckUnits = state.deck.filter(Boolean);
        const unbannedPlayerUnits = playerDeckUnits.filter(id => !targetBans.includes(id));
        const playerMvp = res.mvp?.A;

        // 智能威脅評估排序：MVP 傷害優先，高額費用次之
        const sortedThreats = unbannedPlayerUnits.slice().sort((a, b) => {
          const uA = UNIT_MAP[a];
          const uB = UNIT_MAP[b];
          const isMvpA = (playerMvp && playerMvp.id === a) ? 1000 : 0;
          const isMvpB = (playerMvp && playerMvp.id === b) ? 1000 : 0;
          return (isMvpB + (uB?.cost || 0) * 10) - (isMvpA + (uA?.cost || 0) * 10);
        });

        const aiChosenBans = sortedThreats.slice(0, banCount);
        aiChosenBans.forEach(id => {
          if (!targetBans.includes(id)) targetBans.push(id);
        });

        // 電腦自身的敵方陣容也換裝（避開被我方累計 Ban 的武器）
        const opp = isTeamA ? myMatch.teamB : myMatch.teamA;
        const myBansOnOpp = isTeamA ? myMatch.bannedListA : myMatch.bannedListB;
        if (opp && opp.deck) {
          opp.deck = refitEnemyDeck(opp.deck, state.deck, eventObj, myBansOnOpp);
        }

        const bannedNames = aiChosenBans.map(id => UNIT_MAP[id]?.name || id).join('、');

        showResult(res, {
          bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局（戰術反制 · 比分 ${out.currentScore[0]}:${out.currentScore[1]}）`,
          bo3Callback: () => {
            closeBattle();
            setMode('tournament');
            // 卸下我方卡槽中被敵方 Ban 掉的裝備
            const bansOnMe = isTeamA ? myMatch.bannedListB : myMatch.bannedListA;
            state.deck.forEach((id, idx) => {
              if (id && bansOnMe.includes(id)) {
                state.deck[idx] = null;
                state.active = idx;
              }
            });
            renderAll();
            toast(`⚠️ 電腦失利啟動反制！鎖定你上一局主力，禁用了【${bannedNames}】！請進入軍火庫調配換裝！(系列賽累計被禁 ${bansOnMe.length} 件)`);
          }
        });
      } else {
        // 我方本小局失利 -> 賦予指揮官戰術反制特權（跳出 Ban 彈窗）
        showResult(res, {
          bo3NextText: `啟動戰術反制 (BAN 敵方裝備 · 比分 ${out.currentScore[0]}:${out.currentScore[1]})`,
          bo3Callback: () => {
            closeBattle();
            const oppSide = isTeamA ? 'B' : 'A';
            const winnerTeam = res.final ? res.final[oppSide] : (isTeamA ? myMatch.teamB?.deck : myMatch.teamA?.deck);
            openBo3CounterModal(winnerTeam, nextGameNum, eventObj);
          }
        });
      }
    } else {
      // BO1 單局制小局推進
      showResult(res, {
        bo3NextText: `進入 ${fmtStr} 第 ${nextGameNum} 局 (比分 ${out.currentScore[0]}:${out.currentScore[1]})`,
        bo3Callback: () => {
          closeBattle();
          setMode('tournament');
          toast(`小局戰罷！當前比分 ${out.currentScore[0]} : ${out.currentScore[1]}，請準備下一小局出擊！`);
        }
      });
    }
  }
}

/* 世界冠軍頒獎典禮 Modal */
function showTournamentChampionModal(championTeam) {
  const modal = $('#tourneyChampionModal');
  const card = $('#tourneyChampionCard');
  if (!modal || !card) return;

  card.innerHTML = `
    <div style="font-size:64px;line-height:1;animation:floatTrophy 2s ease-in-out infinite">🏆</div>
    <h1 style="font-family:var(--head);font-size:26px;color:#fbbf24;margin:12px 0 4px;letter-spacing:0.08em">
      WORLD CHAMPION ${new Date().getFullYear()}
    </h1>
    <h2 style="font-size:20px;color:#fff;margin:0 0 16px">
      ${championTeam.flag} ${esc(championTeam.name)}
    </h2>
    <p class="muted" style="font-size:13.5px;max-width:440px;margin:0 auto 20px;line-height:1.6">
      歷經多輪殊死淘汰與戰術推演，以不可阻擋的聯合作戰微操奪得最高榮譽！登頂世界冠軍王座！
    </p>
    <div class="row" style="justify-content:center;gap:12px">
      <button class="btn amber lg" id="btnDownloadTourneyPoster" style="font-weight:900">
        📜 下載冠軍榮譽戰報海報
      </button>
      <button class="btn ghost lg" id="btnTourneyChampionClose">
        關閉 ✕
      </button>
    </div>
  `;

  modal.hidden = false;
  currentActiveModal = modal;
  SoundEngine.play('victory');
}

/* 錦標賽世界冠軍戰術海報下載 (Canvas) */
function downloadTournamentChampionPoster(championTeam) {
  const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#090d16'); bg.addColorStop(1, '#1e1b4b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  
  g.strokeStyle = 'rgba(245,158,11,.15)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  g.fillStyle = '#fbbf24'; g.font = '700 28px "JetBrains Mono",monospace'; g.fillText('TOP CLASH 15 · WORLD CHAMPIONSHIP', 80, 110);
  g.fillStyle = '#ffffff'; g.font = '900 68px "Noto Sans TC",sans-serif'; g.fillText('世界盃淘汰大獎賽', 80, 200);

  g.fillStyle = '#f59e0b'; g.font = '900 130px "Noto Sans TC",sans-serif';
  g.fillText('世界總冠軍 🏆', 80, 380);

  g.fillStyle = '#38bdf8'; g.font = '700 48px "Noto Sans TC",sans-serif';
  g.fillText(`${championTeam.flag} ${championTeam.name}`, 80, 470);

  g.fillStyle = '#94a3b8'; g.font = '500 28px "Noto Sans TC",sans-serif';
  g.fillText(`登頂日期：${new Date().toLocaleDateString('zh-TW')} ｜ 15元聯合作戰最高殿堂`, 80, 530);

  let y = 600;
  state.deck.forEach((id, i) => {
    const u = UNIT_MAP[id]; if (!u) return;
    const col = CATS[u.cat].color;
    g.fillStyle = 'rgba(255,255,255,.05)'; roundRect(g, 80, y, 920, 120, 18); g.fill();
    g.fillStyle = col; g.fillRect(80, y, 8, 120);
    g.fillStyle = '#94a3b8'; g.font = '600 24px "JetBrains Mono",monospace'; g.fillText(CATS[u.cat].short + ' · ' + SLOTS[i].label, 120, y + 40);
    g.fillStyle = '#dbe7f5'; g.font = '700 42px "Noto Sans TC",sans-serif'; g.fillText(u.name, 120, y + 90);
    g.fillStyle = '#fbbf24'; g.font = '700 54px Rajdhani,"Noto Sans TC",sans-serif'; g.textAlign = 'right'; g.fillText('$' + u.cost, 960, y + 80); g.textAlign = 'left';
    y += 138;
  });

  const a = document.createElement('a'); a.download = 'topclash-champion.png'; a.href = c.toDataURL('image/png'); a.click();
  toast('🏆 世界冠軍戰報海報已成功下載！');
}

/* 綁定錦標賽大廳與樹狀圖交互事件 (支援 Solo / Private / Public) */
$('#tourneyModeTabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.t-mode-tab'); if (!btn) return;
  currentTourneyTab = btn.dataset.tab;
  updateTourneyTabPanels();
});

$('#tourneySizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  tourneySelectedSize = +btn.dataset.size;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
  renderTournamentView();
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
});

$('#tourneyFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  tourneySelectedFormat = btn.dataset.format;
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
  renderTournamentView();
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
});

$('#tourneyArmorySelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  tourneySelectedArmory = btn.dataset.armory || 'free';
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
  renderTournamentView();
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定軍備配給規則：${tourneySelectedArmory === 'locked' ? '🔒 開戰鎖定 (陣容教條一套到底)' : '🎲 自由調撥 (每輪可調整名將)'}`);
});

$('#privateArmorySelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  privateSelectedArmory = btn.dataset.armory || 'free';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定私人軍備配給：${privateSelectedArmory === 'locked' ? '🔒 開戰鎖定' : '🎲 自由調撥'}`);
});

$('#privateSizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  privateSelectedSize = +btn.dataset.size;
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定私人房間規模：${privateSelectedSize} 強`);
});

$('#privateFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  privateSelectedFormat = btn.dataset.format || 'hybrid';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定私人賽制：${getFormatNameShort(privateSelectedFormat)}`);
});

$('#publicSizeSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  publicSelectedSize = +btn.dataset.size;
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定公開排隊規模：${publicSelectedSize} 強`);
});

$('#publicFormatSelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  publicSelectedFormat = btn.dataset.format || 'hybrid';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定公開賽制：${getFormatNameShort(publicSelectedFormat)}`);
});

$('#publicArmorySelector')?.addEventListener('click', e => {
  const btn = e.target.closest('.pill-btn'); if (!btn) return;
  publicSelectedArmory = btn.dataset.armory || 'free';
  syncTourneySelectorsUI();
  updateTourneyLobbyBadge();
  toast(`已設定公開軍備配給：${publicSelectedArmory === 'locked' ? '🔒 開戰鎖定' : '🎲 自由調撥'}`);
});

$('#btnTourneyFillAI')?.addEventListener('click', () => {
  TournamentEngine.fillWithAI();
  renderTournamentView();
  toast('🤖 已自動抽籤調派全球各強特遣隊，補滿全部參賽席位！');
});

$('#btnTourneyResetLobby')?.addEventListener('click', () => {
  TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
  renderTournamentView();
  toast('已重置參賽席位');
});

$('#btnToggleSoloRoster')?.addEventListener('click', () => {
  const box = $('#soloParticipantsCollapsible');
  const btn = $('#btnToggleSoloRoster');
  if (!box || !btn) return;
  box.hidden = !box.hidden;
  btn.textContent = box.hidden ? '📋 展開席位預覽 ▾' : '收起席位 ▴';
});

$('#btnTourneyStart')?.addEventListener('click', () => {
  const errs = validateDeck(state.deck, budgetLimit(), currentBanned());
  if (errs.length) {
    toast(`⚠️ 參賽陣容尚未整備完畢（${errs[0]}），請先點選「隨機組隊」或前往軍火庫配置！`);
    return;
  }
  TournamentEngine.start(state.deck, state.doctrine);
  renderTournamentView();
  toast('🏆 世界盃淘汰錦標賽正式開賽！世足對抗樹已生成！');
});

// 私人房間：建立房間
$('#btnCreatePrivateRoom')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    const res = await FirebaseTourneyEngine.createRoom({
      size: privateSelectedSize,
      format: privateSelectedFormat,
      armoryRule: privateSelectedArmory,
      isPublic: false,
      playerProfile: prof
    });
    toast(`👑 成功建立私人房間【${res.roomCode}】！已生成邀請連結。`);
    renderTournamentView();
  } catch (err) {
    toast(`⚠️ 建房失敗：${err.message}`);
  }
});

// 私人房間：加入房間
$('#btnJoinTourneyRoom')?.addEventListener('click', async () => {
  const code = $('#inputJoinTourneyCode')?.value.trim();
  if (!code) {
    toast('請輸入 6 位房間代碼！');
    return;
  }
  try {
    const prof = getTournamentPlayerProfile();
    await FirebaseTourneyEngine.joinRoom(code, prof);
    toast(`🟢 成功加入錦標賽房間【${code.toUpperCase()}】！`);
    renderTournamentView();
  } catch (err) {
    toast(`⚠️ 加入失敗：${err.message}`);
  }
});

// 複製代碼與邀請連結
$('#btnCopyTourneyCode')?.addEventListener('click', () => {
  const code = $('#privateRoomCodeDisplay')?.textContent;
  if (code && code !== '------') {
    navigator.clipboard?.writeText(code);
    toast(`📋 已複製房間代碼：${code}`);
  }
});

$('#btnCopyTourneyLink')?.addEventListener('click', () => {
  const code = $('#privateRoomCodeDisplay')?.textContent;
  if (code && code !== '------') {
    const url = new URL(window.location.href);
    url.searchParams.set('tourney', code);
    navigator.clipboard?.writeText(url.toString());
    toast(`🔗 已複製專屬邀請連結！傳送給好友即可一鍵入隊！`);
  }
});

$('#btnLeaveTourneyRoom')?.addEventListener('click', () => {
  if (confirm('確定要退出當前線上錦標賽房間嗎？')) {
    FirebaseTourneyEngine.leaveRoom();
    $('#privateRoomActiveView').hidden = true;
    $('#privateLobbyEntrance').hidden = false;
    toast('已安全退出房間，返回大廳。');
    renderTournamentView();
  }
});

$('#btnPrivateFillAI')?.addEventListener('click', async () => {
  const code = FirebaseTourneyEngine.getCurrentRoomCode();
  if (code) {
    await FirebaseTourneyEngine.fillWithAI(code, false);
    toast('🤖 已調派全球各強特遣隊補齊席位！請確認後點選下方「正式開賽」。');
  }
});

$('#btnPrivateStart')?.addEventListener('click', async () => {
  const code = FirebaseTourneyEngine.getCurrentRoomCode();
  if (code) {
    await FirebaseTourneyEngine.startTournament(code);
    toast('🏆 多人錦標賽正式開賽！世足對抗樹已生成！');
  }
});

// 公開大廳：快速匹配
$('#btnQuickMatchTourney')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    toast(`⚡ 正在搜尋雲端最快開賽之 ${publicSelectedSize} 強公開房間...`);
    const res = await FirebaseTourneyEngine.quickMatch(prof, publicSelectedSize, publicSelectedFormat, publicSelectedArmory);
    if (res.isNew) {
      toast(`👑 已為你發起 ${publicSelectedSize} 強公開湊桌房【${res.roomCode}】！300 秒自動倒數開賽！`);
    } else {
      toast(`🟢 已快速滑入公開房間【${res.roomCode}】！等待開賽！`);
    }
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 匹配失敗：${err.message}`);
  }
});

// 公開大廳：主動建立公開房間
$('#btnCreatePublicRoom')?.addEventListener('click', async () => {
  try {
    const prof = getTournamentPlayerProfile();
    const res = await FirebaseTourneyEngine.createRoom({
      name: `名將世界盃 ${publicSelectedSize}強公開賽`,
      size: publicSelectedSize,
      format: publicSelectedFormat,
      armoryRule: publicSelectedArmory,
      isPublic: true,
      playerProfile: prof
    });
    toast(`👑 成功建立公開房間【${res.roomCode}】！已發布至大廳清單，啟動 300 秒倒數！`);
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 公開建房失敗：${err.message}`);
  }
});

$('#btnRefreshPublicRooms')?.addEventListener('click', () => {
  startListeningPublicRooms();
  toast('🔄 已刷新公開大廳即時房間清單');
});

// 點擊公開房間卡片加入
$('#tourneyPublicRoomsList')?.addEventListener('click', async e => {
  const btn = e.target.closest('.btnJoinLiveRoom'); if (!btn) return;
  const code = btn.dataset.code;
  if (!code) return;
  try {
    const prof = getTournamentPlayerProfile();
    await FirebaseTourneyEngine.joinRoom(code, prof);
    toast(`🟢 成功加入公開房間【${code}】！`);
    renderTournamentView();
  } catch(err) {
    toast(`⚠️ 加入失敗：${err.message}`);
  }
});

$('#tourneyActionBox')?.addEventListener('click', async e => {
  if (e.target.closest('#btnTourneyGoFight')) {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    if (onlineRoom && onlineRoom.status === 'in_progress') {
      // 線上多人出擊：雙階段盲提
      const prof = getTournamentPlayerProfile();
      const errs = validateDeck(state.deck, budgetLimit(), currentBanned());
      if (errs.length) {
        toast(`⚠️ 參賽陣容未達標（${errs[0]}）！請調整陣容。`);
        setMode('quick');
        return;
      }
      const myMatch = Object.values(onlineRoom.matches || {}).find(m => {
        if (m.status === 'finished') return false;
        const aIsMe = m.teamA && m.teamA.uid === prof.uid;
        const bIsMe = m.teamB && m.teamB.uid === prof.uid;
        return aIsMe || bIsMe;
      });
      if (myMatch) {
        await FirebaseTourneyEngine.submitMatchDeck(onlineRoom.id, myMatch.id, prof.uid, state.deck, state.doctrine);
        toast('🎯 陣容已鎖定並提交雲端！等待對手出擊...');
        renderTournamentView();
      }
      return;
    }

    startTournamentPlayerBattle();
    return;
  }
  if (e.target.closest('#btnTourneyTuneDeck')) {
    const tState = (typeof FirebaseTourneyEngine !== 'undefined' && FirebaseTourneyEngine.getCurrentRoom()) || (typeof TournamentEngine !== 'undefined' && TournamentEngine.getState());
    if (tState && tState.armoryRule === 'locked' && tState.status === 'in_progress') {
      // 若處於多局制小局間，且有槽位因被 Ban 而空缺，特例允許進入軍火庫完成補位！
      const hasEmptySlot = !state.deck.every(Boolean);
      if (!hasEmptySlot) {
        toast('🔒 當前為「開戰鎖定」賽制，全系列賽陣容已鎖定！(小局若遇禁用可入庫補位)');
        return;
      }
    }
    startTourneyBuild();
    return;
  }
  if (e.target.closest('#btnTourneyLeaveOnline')) {
    if (confirm('確定要退出當前線上錦標賽房間嗎？')) {
      FirebaseTourneyEngine.leaveRoom();
      const pActive = $('#privateRoomActiveView');
      const pEntrance = $('#privateLobbyEntrance');
      if (pActive) pActive.hidden = true;
      if (pEntrance) pEntrance.hidden = false;
      toast('已退出線上錦標賽，返回大廳。');
      renderTournamentView();
    }
    return;
  }
  if (e.target.closest('#btnTourneyRematchOnline')) {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    const roomCode = onlineRoom ? (onlineRoom.id || FirebaseTourneyEngine.getCurrentRoomCode()) : null;
    if (roomCode) {
      FirebaseTourneyEngine.resetRoom(roomCode).then(() => {
        toast('🎉 房間已重置為備戰狀態！隨時可重新開賽！');
        renderTournamentView();
      }).catch(err => {
        toast('重置失敗：' + (err.message || err));
      });
    }
    return;
  }
  if (e.target.closest('#btnTourneyResetAll')) {
    const resetBtn = e.target.closest('#btnTourneyResetAll');
    const actionType = resetBtn?.dataset?.tourneyAction || 'forfeit';
    const tState = TournamentEngine.getState();
    const curRound = tState?.currentRound || 1;

    if (actionType === 'forfeit') {
      const ok = confirm(`⚠️ 確定要放棄本屆世界盃錦標賽嗎？\n\n您當前正在第 ${curRound} 輪激戰中，主動放棄將視為棄權退賽並返回配置大廳。`);
      if (!ok) return;
    }

    TournamentEngine.create(tourneySelectedSize, tourneySelectedFormat, getTournamentPlayerProfile(), tourneySelectedArmory);
    renderTournamentView();
    toast(actionType === 'forfeit' ? '🏳️ 已主動放棄本屆錦標賽，回到配置大廳' : (actionType === 'leave_spec' ? '已退出觀戰，回到錦標賽大廳' : '已重置錦標賽，歡迎開啟新一屆世界盃！'));
    return;
  }
});

// 監聽 Firebase 房間更新與戰鬥播報事件
if (typeof FirebaseTourneyEngine !== 'undefined') {
  let tourneyTicker = null;
  setInterval(() => {
    if (state.mode === 'ladder') {
      updateLadderResetTicker();
    }
    const room = FirebaseTourneyEngine.getCurrentRoom();
    if (room && state.mode === 'tournament') {
      if (room.status === 'waiting' && room.isPublic && room.countdownEnd && Date.now() > room.countdownEnd) {
        const prof = getTournamentPlayerProfile();
        if (room.hostUid === prof.uid) {
          FirebaseTourneyEngine.fillWithAI(room.id);
        }
      }
      if (room.status === 'in_progress') {
        FirebaseTourneyEngine.checkTimeoutAndAutoResolve(room.id);
        const btn = document.querySelector('#btnTourneyGoFight');
        if (btn && btn.textContent.includes('等對手出擊')) {
          const prof = getTournamentPlayerProfile();
          const myMatch = Object.values(room.matches || {}).find(m => {
            if (m.status === 'finished') return false;
            return (m.teamA && m.teamA.uid === prof.uid) || (m.teamB && m.teamB.uid === prof.uid);
          });
          if (myMatch && myMatch.deadline) {
            const sec = Math.max(0, Math.ceil((myMatch.deadline - Date.now()) / 1000));
            btn.textContent = '⏳ 陣容已鎖定 · 等對手出擊 (' + sec + 's)...';
          }
        }
      }
    }
  }, 1000);

  let tourneyUpdateTimer = null;
  FirebaseTourneyEngine.on('room_updated', room => {
    if (state.mode === 'tournament') {
      if (tourneyUpdateTimer) clearTimeout(tourneyUpdateTimer);
      tourneyUpdateTimer = setTimeout(() => {
        renderTournamentView();
      }, 120);
    }
  });

  FirebaseTourneyEngine.on('match_resolved', data => {
    if (state.mode !== 'tournament') return;
    const prof = getTournamentPlayerProfile();
    const m = data.match;
    if (m && (m.teamA?.uid === prof.uid || m.teamB?.uid === prof.uid)) {
      const isTeamA = (m.teamA && m.teamA.uid === prof.uid);
      const opp = isTeamA ? m.teamB : m.teamA;
      const h = data.historyItem;
      const res = data.res;

      state.mode = 'tournament';
      state.deck = isTeamA ? h.deckA.slice() : h.deckB.slice();
      state.doctrine = isTeamA ? (h.docA || 'defense') : (h.docB || 'defense');
      state.enemy = isTeamA ? h.deckB.slice() : h.deckA.slice();
      state.enemyDoc = isTeamA ? (h.docB || 'defense') : (h.docA || 'defense');
      state.enemyName = ((opp?.flag || '') + ' ' + (opp?.name || '對手')).trim();
      state.event = h.event || { id: 'fair', name: '晴朗無風', icon: '☀' };
      state.seed = h.seed;
      state.lastRes = res;

      showBattle(res);
      toast('⚔️ 雙方陣容已揭曉！正式進入對決推演！');
    }
  });

  FirebaseTourneyEngine.on('room_closed', () => {
    toast('房間已關閉或結束');
    if (state.mode === 'tournament') {
      renderTournamentView();
    }
  });
}

// 點擊樹狀圖上任何比賽節點 (若點擊我方即刻迎戰卡片，直接啟動出擊)
$('#bracketContainer')?.addEventListener('click', e => {
  const card = e.target.closest('.b-match-card'); if (!card) return;
  const matchId = card.dataset.matchId;

  // 若使用者點擊的是自己的即刻出擊卡片或右下角迎戰按鈕，直接連動頂部出擊迎戰
  if (card.classList.contains('is-ready-to-fight') || e.target.closest('.fight-ready')) {
    const fightBtn = document.getElementById('btnTourneyGoFight');
    if (fightBtn) {
      fightBtn.click();
      return;
    }
  }

  // 其餘情況（完賽戰報、AI/對手觀戰推演）開啟戰況情報所彈窗
  openTournamentSpectatorModal(matchId);
});

// 觀戰彈窗內點擊播放推演
$('#tourneySpectatorModal')?.addEventListener('click', e => {
  if (e.target.id === 'tourneySpectatorModal' || e.target.id === 'btnTourneySpecClose' || e.target.closest('#btnTourneySpecClose')) {
    $('#tourneySpectatorModal').hidden = true;
    currentActiveModal = null;
    return;
  }
  const replayBtn = e.target.closest('.btnReplayRound');
  if (replayBtn) {
    const matchId = replayBtn.dataset.match;
    const rIdx = +replayBtn.dataset.roundIdx;
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    if (onlineRoom && onlineRoom.status && onlineRoom.status !== 'waiting') {
      const fbSnap = FirebaseTourneyEngine.getMatchSnapshot(matchId, rIdx);
      if (fbSnap && fbSnap.battleRes) {
        $('#tourneySpectatorModal').hidden = true;
        currentActiveModal = null;
        showBattle(fbSnap.battleRes);
      }
      return;
    }
    const snap = TournamentEngine.getMatchSnapshot(matchId);
    if (!snap || !snap.history[rIdx]) return;
    const h = snap.history[rIdx];
    const res = resolveBattle(h.deckA, h.deckB, {
      seed: h.seed,
      event: h.event,
      docA: h.docA || 'defense',
      docB: h.docB || 'defense'
    });
    $('#tourneySpectatorModal').hidden = true;
    currentActiveModal = null;
    showBattle(res);
  }
});

// 冠軍彈窗互動
$('#tourneyChampionModal')?.addEventListener('click', e => {
  if (e.target.id === 'tourneyChampionModal' || e.target.id === 'btnTourneyChampionClose') {
    $('#tourneyChampionModal').hidden = true;
    currentActiveModal = null;
    return;
  }
  if (e.target.id === 'btnDownloadTourneyPoster' || e.target.closest('#btnDownloadTourneyPoster')) {
    const t = TournamentEngine.getState();
    if (t?.champion) downloadTournamentChampionPoster(t.champion);
  }
});

function refitTournamentBracket() {
  if (state.mode === 'tournament') {
    const onlineRoom = (typeof FirebaseTourneyEngine !== 'undefined') ? FirebaseTourneyEngine.getCurrentRoom() : null;
    const isOnline = !!onlineRoom && (currentTourneyTab !== 'solo');
    const t = isOnline ? onlineRoom : (typeof TournamentEngine !== 'undefined' ? TournamentEngine.getState() : null);
    if (t && t.status !== 'registration' && t.status !== 'waiting') {
      applyBracketFitToViewport();
      renderBracketSvgLinks(t);
    }
  }
}
window.addEventListener('resize', refitTournamentBracket);
if (typeof ResizeObserver !== 'undefined' && $('#tourneyBracketViewport')) {
  new ResizeObserver(() => requestAnimationFrame(refitTournamentBracket)).observe($('#tourneyBracketViewport'));
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(refitTournamentBracket);

/* ---------- 啟動 ---------- */
const savedTheme = LS.get('wl15_theme', null);
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
// 預設為淺色系 (日間戰情室)
const initialTheme = savedTheme || 'light';
applyTheme(initialTheme, false);

const savedSound = LS.get('wl15_sound', true);
SoundEngine.enabled = savedSound;
if ($('#audioIcon')) $('#audioIcon').textContent = savedSound ? '🔊' : '🔇';

if (typeof LadderEngine !== 'undefined') LadderEngine.init();
if ($('#navAvatarCircle')) $('#navAvatarCircle').dataset.ready = 'true';
if (typeof Telemetry !== 'undefined') Telemetry.init();

setupMatch();
renderAll();

function clearUrlSearchParam(paramName) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(paramName)) {
      url.searchParams.delete(paramName);
      const newQuery = url.searchParams.toString();
      const newUrl = url.pathname + (newQuery ? '?' + newQuery : '') + url.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  } catch (e) {}
}

// 檢查 URL 是否帶有模式或好友邀請房間代碼
const urlParams = new URLSearchParams(window.location.search);
const modeParam = urlParams.get('mode');
const tourneyParam = new URLSearchParams(window.location.search).get('tourney');
if (tourneyParam && typeof FirebaseTourneyEngine !== 'undefined') {
  clearUrlSearchParam('tourney');
  setTimeout(async () => {
    setMode('tournament');
    currentTourneyTab = 'private';
    updateTourneyTabPanels();
    const input = $('#inputJoinTourneyCode');
    if (input) input.value = tourneyParam.toUpperCase();
    try {
      const prof = getTournamentPlayerProfile();
      await FirebaseTourneyEngine.joinRoom(tourneyParam.toUpperCase(), prof);
      toast(`🟢 透過專屬連結加入錦標賽房間【${tourneyParam.toUpperCase()}】！`);
      renderTournamentView();
    } catch(e) {
      toast(`⚠️ 加入房間提示：${e.message}`);
    }
  }, 400);
}

if (modeParam && ['ladder', 'tournament', 'bo3', 'quick', 'ghost', 'daily', 'sandbox'].includes(modeParam)) {
  if (modeParam === 'ghost') {
    setMode('ladder');
  } else {
    setMode(modeParam);
  }
}
const roomParam = urlParams.get('room');
if (roomParam) {
  clearUrlSearchParam('room');
  setTimeout(() => {
    setMode('bo3');
    openOnlinePvpModal(roomParam.trim());
    toast(`🎯 偵測到好友 BO5 房間邀請 [${roomParam.toUpperCase()}]！點擊立即加入即可連線對決！`);
  }, 500);
}

const replayParam = urlParams.get('replay');
if (replayParam) {
  clearUrlSearchParam('replay');
  try {
    const raw = atob(replayParam.trim());
    const [dA, dB, seedStr, evId, docA, docB] = raw.split('~');
    const deckA = dA.split('.').filter(id => UNIT_MAP[id]);
    const deckB = dB.split('.').filter(id => UNIT_MAP[id]);
    if (deckA.length === 5 && deckB.length === 5) {
      LS.set('wl15_seen', 1);
      const evObj = EVENTS.find(e => e.id === evId) || EVENTS[0];
      state.deck = deckA.slice();
      state.enemy = deckB.slice();
      state.event = evObj;
      state.doctrine = docA || 'defense';
      state.enemyDoc = docB || 'defense';
      const res = resolveBattle(deckA, deckB, {
        seed: Number(seedStr) >>> 0,
        event: evObj,
        docA: state.doctrine,
        docB: state.enemyDoc
      });
      state.lastRes = res;
      setTimeout(() => {
        showBattle(res);
        toast('🎬 已載入分享戰局重播，正在重現完整推演！');
      }, 250);
    }
  } catch (e) {
    console.warn('Replay decode error:', e);
  }
}

if (!LS.get('wl15_seen', 0) && !replayParam && !tourneyParam && !roomParam) showHelp();

// Service Worker 由 index.html 與 armory.html 統一註冊

/* ---------- 雲端指揮官身分中心與免密書籤控制器 (A+C) ---------- */
function openCloudSyncModal() {
  const modal = $('#cloudSyncModal');
  if (!modal || typeof CloudSync === 'undefined') return;
  $('#commanderModal').hidden = true;
  currentActiveModal = modal;

  const lState = (typeof LadderEngine !== 'undefined') ? LadderEngine.getState() : null;
  const p = lState ? lState.player : null;
  const myName = p?.name ? esc(p.name) : esc(playerGhost.callsign || '虎步先鋒鐵騎營');
  const myFlag = p?.flag || playerGhost.flag || '🇹🇼';
  const tier = (typeof LadderEngine !== 'undefined' && p)
    ? LadderEngine.getRankTier(p.rp)
    : { name: '作戰少尉', color: '#475569' };
  const winRate = stats.played ? Math.round(stats.win / stats.played * 100) : 0;

  const flagEl = $('#cloudModalFlag'); if (flagEl) flagEl.textContent = myFlag;
  const nameEl = $('#cloudModalName'); if (nameEl) nameEl.textContent = myName;
  const uidEl = $('#cloudModalUid'); if (uidEl) uidEl.textContent = (p && p.uid) || 'CMD-7392';
  const tierEl = $('#cloudModalTier');
  if (tierEl) {
    tierEl.textContent = tier.name;
    tierEl.style.color = tier.color;
    tierEl.style.borderColor = tier.color + '66';
    tierEl.style.background = tier.color + '22';
  }
  const statsEl = $('#cloudModalStats');
  if (statsEl) {
    statsEl.textContent = `天梯 ${p ? p.rp : 2055} RP ｜ 累計 ${stats.played} 場 · 勝率 ${winRate}% · ${stats.streak} 連勝`;
  }

  const acc = CloudSync.getAccount();
  const unloggedView = $('#cloudAuthViewUnlogged');
  const loggedView = $('#cloudAuthViewLogged');

  if (acc && acc.id) {
    unloggedView.hidden = true;
    loggedView.hidden = false;
    $('#loggedCommanderIdDisplay').textContent = acc.displayId || acc.id;
    const email = acc.email.replace(/^(.{1,2})[^@]*@/, '$1***@');
    $('#loggedSyncTimeDisplay').textContent = `Google：${email || '已登入'}（僅自己可見）`;
  } else {
    unloggedView.hidden = false;
    loggedView.hidden = true;
  }
  renderCloudStatus();

  modal.hidden = false;
}

function closeCloudSyncModal() {
  if (!$('#cloudSaveChoice').hidden) return;
  const modal = $('#cloudSyncModal');
  if (modal) modal.hidden = true;
  currentActiveModal = null;
}

function renderCloudStatus() {
  const status = (typeof CloudSync !== 'undefined' && typeof CloudSync.getStatus === 'function') ? CloudSync.getStatus() : { state: 'local' };
  const labels = {
    loading: '正在確認 Google 登入狀態',
    local: '僅本機保存',
    pending: '尚有待同步資料',
    syncing: '正在同步',
    synced: '雲端已同步',
    error: '同步未完成'
  };
  const line = $('#cloudSaveStatus');
  if (line) {
    line.textContent = `${labels[status.state]}${status.lastSyncedAt ? ` · 最近成功：${new Date(status.lastSyncedAt).toLocaleString()}` : ''}${status.error ? ` · ${status.error}` : ''}`;
  }
  const badge = $('#cloudConnectionLabel');
  if (badge) badge.textContent = CloudSync.getAccount() ? 'Google 已登入' : '未連結 Google 帳號';
}

function chooseCloudSave(details) {
  openCloudSyncModal();
  const pane = $('#cloudSaveChoice');
  const describe = data => data ? `${data.nickname} · ${data.played} 場 · ${data.rp} RP` : '尚無存檔';
  $('#cloudChoiceTitle').textContent = details.isNew ? '確認首次備份' : '選擇本次要使用的存檔';
  $('#cloudChoiceLocal').textContent = `本機：${describe(details.local)}`;
  $('#cloudChoiceRemote').textContent = `雲端：${describe(details.cloud)}${details.updatedAt ? ` · ${new Date(details.updatedAt).toLocaleString()}` : ''}`;
  $('#btnChooseLocalSave').disabled = !details.canUseLocal;
  $('#btnChooseCloudSave').hidden = details.isNew;
  pane.hidden = false;
  return new Promise(resolve => {
    const finish = choice => {
      for (const id of ['btnChooseLocalSave', 'btnChooseCloudSave', 'btnCancelSaveChoice']) {
        $('#' + id).onclick = null;
      }
      pane.hidden = true;
      resolve(choice);
    };
    $('#btnChooseLocalSave').onclick = () => finish('local');
    $('#btnChooseCloudSave').onclick = () => finish('cloud');
    $('#btnCancelSaveChoice').onclick = () => finish('cancel');
  });
}

function setupCloudSyncModal() {
  $('.cloud-sync-card').appendChild($('#commanderModal'));
  $('#commanderModal').className = 'commander-editor';
  CloudSync.setSaveResolver(chooseCloudSave);
  window.addEventListener('cloudsyncchange', () => {
    updateCloudSyncButtonState();
    renderCloudStatus();
    if (!$('#cloudSyncModal').hidden && $('#cloudSaveChoice').hidden && $('#commanderModal').hidden) {
      openCloudSyncModal();
    }
  });
  CloudSync.init().catch(error => {
    console.error('Google 身分確認失敗:', error);
    toast(`Google 身分確認失敗：${error.message}`);
  });
  $('#btnCommanderCapsule')?.addEventListener('click', openCloudSyncModal);
  $('#btnCloudSync')?.addEventListener('click', openCloudSyncModal);
  $('#btnCommanderProfile')?.addEventListener('click', openCloudSyncModal);
  $('#btnEditProfileFromCloud')?.addEventListener('click', () => {
    openCommanderModal();
  });
  $('#btnCloudCancel')?.addEventListener('click', closeCloudSyncModal);
  $('#btnCloseCloudModal')?.addEventListener('click', closeCloudSyncModal);
  $('#btnGoLadderFromCloud')?.addEventListener('click', () => {
    closeCloudSyncModal();
    setMode('ladder');
  });

  $('#btnGoogleCloudLogin')?.addEventListener('click', async () => {
    const isActivelyFighting = document.body.classList.contains('in-battle') && !$('#viewBattle')?.hidden;
    if (isActivelyFighting || (state.isOnlinePvp && state.pvpOpponentReady)) {
      toast('請先完成目前對戰，再切換帳號或載入存檔');
      return;
    }
    const btn = $('#btnGoogleCloudLogin');
    btn.disabled = true;
    btn.textContent = '⏳ 正在連結 Google 帳號...';

    try {
      const res = await CloudSync.loginWithGoogle();
      if (res.needsReload) {
        window.location.reload();
        return;
      }
      toast(res.isNew
        ? `🎉 Google 帳號連結成功！已建立指揮官【${res.account.displayId}】的雲端存檔。`
        : `🎉 歡迎回來，指揮官【${res.account.displayId}】！雲端記錄已載入。`);
      updateCloudSyncButtonState();
      renderAll();
      openCloudSyncModal();
    } catch (e) {
      const message = e.code === 'auth/popup-blocked'
        ? '瀏覽器封鎖了登入視窗，請允許此網站開啟彈出視窗後重試。'
        : e.code === 'auth/popup-closed-by-user'
          ? 'Google 登入視窗已關閉，尚未完成登入。'
          : e.message;
      toast(`❌ Google 登入失敗：${message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = '🌐 使用 Google 帳號登入／建立雲端存檔';
    }
  });

  // 手動同步
  $('#btnManualSyncCloud')?.addEventListener('click', async () => {
    const btn = $('#btnManualSyncCloud');
    btn.disabled = true;
    btn.textContent = '⏳ 同步中...';
    const ok = await CloudSync.syncToCloud();
    btn.disabled = false;
    btn.textContent = '🔄 立即手動同步';
    if (ok) {
      toast('☁️ 本機戰績與配置已成功備份至雲端！');
    } else {
      const err = CloudSync.getStatus().error || '';
      if (err.includes('Google') || err.includes('PERMISSION_DENIED') || err.includes('Permission denied')) {
        toast('⚠️ Google 登入授權已在其他裝置更新或逾期，請點擊「切換帳號／比較存檔」重新連線');
      } else {
        toast(`⚠️ ${err || '雲端同步失敗，請稍後重試'}`);
      }
    }
  });

  // 登出解綁
  $('#btnLogoutCloud')?.addEventListener('click', async () => {
    const isActivelyFighting = document.body.classList.contains('in-battle') && !$('#viewBattle')?.hidden;
    if (isActivelyFighting || (state.isOnlinePvp && state.pvpOpponentReady)) {
      toast('請先完成目前對戰，再登出帳號');
      return;
    }
    if (confirm('登出後返回訪客存檔；此帳號的本機進度會另行保留，不會移交其他帳號。確定登出？')) {
      const btn = $('#btnLogoutCloud');
      if (btn) btn.disabled = true;
      try {
        await CloudSync.logout();
        window.location.reload();
      } catch (e) {
        console.error('[CloudSync] 登出失敗:', e);
        toast('⚠️ 雲端登出失敗，請稍後重試');
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  });
  $('#btnSwitchGoogleAccount')?.addEventListener('click', () => $('#btnGoogleCloudLogin').click());
}

  // 點選遮罩背景關閉彈窗
  $('#cloudSyncModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'cloudSyncModal' && $('#cloudSaveChoice').hidden) closeCloudSyncModal();
  });
  
  // 啟動雲端存檔按鈕監聽
  setupCloudSyncModal();

  // 啟動錦標賽年份動態初始化 (自動適應新年份)
  (function initTournamentYear() {
    const y = new Date().getFullYear();
    const mainTitleEl = document.querySelector('.lobby-main-title');
    if (mainTitleEl) mainTitleEl.innerHTML = `🏆 ${y} 名將世界盃淘汰錦標賽 (Tournament Arena)`;
    const badgeEl = document.getElementById('tourneyBadge');
    if (badgeEl) badgeEl.textContent = `🏆 ${y} 名將世界盃淘汰錦標賽`;
  })();


window.__db15 = { state, startBattle, showBattle, fastForwardBattle, setMode, getGhostPool, applyTheme, toggleTheme, LadderEngine, renderLadderView, OnlinePvPEngine, getTournamentPlayerProfile, buildReplayShareUrl, openCloudSyncModal, CloudSync: (typeof CloudSync !== 'undefined' ? CloudSync : null), handleBo3RoundEnd, getBo3WinsNeeded, getBo3BanCount, randomDeck, openBo3CounterModal, renderTournamentView, handleTournamentRoundEnd, PvPTimerManager, startPvpDeploymentTimer, handlePlayerForfeit, autoFillAndSubmitPvpDeck };
})();

// 全域點擊外部與 Esc 鍵自動關閉戰場自選選單
document.addEventListener('click', e => {
  if (!e.target.closest('.custom-weather-dropdown')) {
    document.querySelectorAll('.custom-weather-menu').forEach(m => m.setAttribute('hidden', ''));
    document.querySelectorAll('.custom-weather-dropdown').forEach(d => d.classList.remove('open'));
    const btn = document.getElementById('btnWeatherDropdown');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  if (!e.target.closest('.custom-ai-dropdown')) {
    document.querySelectorAll('.custom-ai-menu').forEach(m => m.setAttribute('hidden', ''));
    document.querySelectorAll('.custom-ai-dropdown').forEach(d => d.classList.remove('open'));
    const btnAi = document.getElementById('btnAiDropdown');
    if (btnAi) btnAi.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.custom-weather-menu, .custom-ai-menu').forEach(m => m.setAttribute('hidden', ''));
    document.querySelectorAll('.custom-weather-dropdown, .custom-ai-dropdown').forEach(d => d.classList.remove('open'));
    const btn = document.getElementById('btnWeatherDropdown');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    const btnAi = document.getElementById('btnAiDropdown');
    if (btnAi) btnAi.setAttribute('aria-expanded', 'false');
  }
});

function updateLadderResetTicker() {
  const tickerEl = document.getElementById('myLadderResetTicker');
  if (!tickerEl) return;
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime());
  const h = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
  tickerEl.textContent = `${h}:${m}:${s}`;
}
