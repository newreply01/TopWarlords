'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 世界盃淘汰錦標賽引擎 (Tournament Engine)
   支援 4 / 8 / 16 / 32 強單淘汰對抗樹、AI 影子戰隊一鍵補齊、
   確定性推演零頻寬即時觀戰、決賽圈 BO3/BO5 升級賽制與世足樹狀圖
   ===================================================== */

const TournamentEngine = (() => {
  // 錦標賽全局狀態
  let tourney = null;

  // 預設 32 支歷史名將軍團名單
  const NATION_TEAMS = [
    { name: '大漢驃騎冠軍營', flag: '🇨🇳', doc: 'strike', callsign: 'HAN HUO' },
    { name: '曹魏虎豹精騎軍', flag: '🇨🇳', doc: 'strike', callsign: 'WEI TIGER' },
    { name: '季漢無當飛軍營', flag: '🇨🇳', doc: 'defense', callsign: 'SHU WUDANG' },
    { name: '江東錦帆水陸軍', flag: '🇨🇳', doc: 'deception', callsign: 'WU SAIL' },
    { name: '大秦武安鐵衛軍', flag: '🇨🇳', doc: 'defense', callsign: 'QIN BAIQI' },
    { name: '大唐玄甲陌刀營', flag: '🇨🇳', doc: 'defense', callsign: 'TANG XUANJIA' },
    { name: '大宋背嵬忠烈軍', flag: '🇨🇳', doc: 'defense', callsign: 'SONG BEIWEI' },
    { name: '大明戚家鴛鴦陣', flag: '🇨🇳', doc: 'defense', callsign: 'MING QIJUN' },
    { name: '甲斐風林火山軍', flag: '🇯🇵', doc: 'strike', callsign: 'KAI SHINGEN' },
    { name: '越後車懸毘沙門', flag: '🇯🇵', doc: 'strike', callsign: 'ECHIGO KENSHIN' },
    { name: '尾張三段鐵砲隊', flag: '🇯🇵', doc: 'defense', callsign: 'OWARI ODA' },
    { name: '奧州伊達騎銃軍', flag: '🇯🇵', doc: 'strike', callsign: 'DATE DRAGON' },
    { name: '安藝三矢水陸營', flag: '🇯🇵', doc: 'deception', callsign: 'AKI MOURI' },
    { name: '朝鮮忠武鳴梁營', flag: '🇰🇷', doc: 'defense', callsign: 'JOSEON YI' },
    { name: '高句麗薩水奇兵軍', flag: '🇰🇷', doc: 'deception', callsign: 'SALSU EULJI' },
    { name: '新羅花郎誓天衛', flag: '🇰🇷', doc: 'defense', callsign: 'SILLA HWARANG' },
    { name: '大戰國連橫五國軍', flag: '🇨🇳', doc: 'deception', callsign: 'YAN LEYI' },
    { name: '北府風鶴勁旅營', flag: '🇨🇳', doc: 'deception', callsign: 'BEIFU XIE' },
    { name: '南陳白袍破陣軍', flag: '🇨🇳', doc: 'strike', callsign: 'WHITE ROBE' },
    { name: '楚漢十面埋伏軍', flag: '🇨🇳', doc: 'deception', callsign: 'HAN XIN' },
    { name: '西涼羌胡鐵騎營', flag: '🇨🇳', doc: 'strike', callsign: 'XILIANG MA' },
    { name: '白馬義從先鋒營', flag: '🇨🇳', doc: 'strike', callsign: 'WHITE STEED' },
    { name: '三河本多蜻蛉營', flag: '🇯🇵', doc: 'defense', callsign: 'MIKAWA HONDA' },
    { name: '薩摩釣野伏伏兵營', flag: '🇯🇵', doc: 'deception', callsign: 'SATSUMA AMBUSH' },
    { name: '真田赤備六文錢', flag: '🇯🇵', doc: 'strike', callsign: 'SANADA RED' },
    { name: '土佐一領具足軍', flag: '🇯🇵', doc: 'defense', callsign: 'TOSA GUZOKU' },
    { name: '立花西國無雙營', flag: '🇯🇵', doc: 'strike', callsign: 'TACHIBANA' },
    { name: '瀨戶內能島水師', flag: '🇯🇵', doc: 'deception', callsign: 'NOSHIMA FLEET' },
    { name: '清海鎮海上王營', flag: '🇰🇷', doc: 'defense', callsign: 'CHEONGHAEJIN' },
    { name: '安市城挽弓守衛營', flag: '🇰🇷', doc: 'defense', callsign: 'ANSI FORTRESS' },
    { name: '高麗火桶神機營', flag: '🇰🇷', doc: 'deception', callsign: 'HWATONG CORPS' },
    { name: '長平堅壁虎賁軍', flag: '🇨🇳', doc: 'defense', callsign: 'ZHAO LIANPO' }
  ];

  /**
   * 隨機產生一套符合 15 元預算五兵種的合法陣容
   */
  function generateLegalDeck() {
    // 預設常見黃金陣容之一
    if (typeof LADDER_PRESETS !== 'undefined' && LADDER_PRESETS.length) {
      const p = LADDER_PRESETS[Math.floor(Math.random() * LADDER_PRESETS.length)];
      return p.deck.slice();
    }
    return ['ZHANGLIAO', 'DIANWEI', 'HUANGZHONG', 'GANNING', 'SUNBIN'];
  }

  /**
   * 建立錦標賽
   * @param {number} size - 參賽隊伍總數 (4, 8, 16, 32)
   * @param {string} matchType - 賽制 ('bo1', 'hybrid', 'bo3')
   * @param {object} hostPlayer - 房主自己
   */
  function create(size = 16, matchType = 'hybrid', hostPlayer = null, armoryRule = 'locked') {
    if (![4, 8, 16, 32].includes(size)) size = 16;

    const me = hostPlayer || {
      uid: 'CMD-7392',
      name: '我方聯合戰術作戰群',
      flag: '🇹🇼',
      isMe: true,
      isAI: false,
      deck: null,
      doctrine: 'defense'
    };

    // 參賽隊列槽位初始化
    const participants = new Array(size).fill(null);
    participants[0] = Object.assign({}, me, { seedNo: 1, slotIdx: 0 });

    const totalRounds = Math.log2(size);
    // 生成每一輪次的全場統一戰區天候 (Unified Round Theaters)
    const availableEvents = (typeof EVENTS !== 'undefined' && EVENTS.length)
      ? EVENTS.slice()
      : [{ id: 'normal', name: '晴空萬里', icon: '☀️' }];
    const shuffledEvs = availableEvents.slice().sort(() => Math.random() - 0.5);
    const roundTheaters = {};
    for (let r = 1; r <= totalRounds; r++) {
      roundTheaters[r] = shuffledEvs[(r - 1) % shuffledEvs.length];
    }

    tourney = {
      id: 'TOURNEY-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      size,
      matchType, // 'bo1' (⚡ 極速單淘汰), 'hybrid' (⭐ 決賽升級制), 'bo3' (⚔️ 大師征服)
      format: matchType,
      armoryRule: armoryRule || 'locked', // 'locked' (開戰鎖定) | 'free' (自由調撥)
      lockedDeck: null,
      lockedDoctrine: null,
      lockedFormations: null,
      lockedTerrain: 'plain',
      roundTheaters,
      currentRound: 1, // 1: 32強, 2: 16強, 3: 8強, 4: 準決賽(4強), 5: 決賽
      totalRounds, // 4強:2輪, 8強:3輪, 16強:4輪, 32強:5輪
      status: 'registration', // 'registration' -> 'in_progress' -> 'completed'
      participants,
      matches: {}, // key: matchId, value: Match
      leftWingMatchIds: [],
      rightWingMatchIds: [],
      finalMatchId: null,
      bronzeMatchId: null,
      champion: null,
      runnerUp: null,
      thirdPlace: null,
      historyLog: []
    };

    buildBracketStructure();
    return tourney;
  }

  /**
   * 建立世足 2026 左右雙翼樹狀結構
   */
  function buildBracketStructure() {
    const size = tourney.size;
    const totalRounds = tourney.totalRounds;

    // 清空
    tourney.matches = {};
    tourney.leftWingMatchIds = [];
    tourney.rightWingMatchIds = [];

    // 每一輪的比賽數量
    // 例如 size=16: R1: 8場, R2: 4場 (八強), R3: 2場 (準決賽), R4: 1場 (決賽)
    let currentMatchCount = size / 2;

    for (let r = 1; r <= totalRounds; r++) {
      const isFinalRound = (r === totalRounds);
      const isSemiFinal = (r === totalRounds - 1);

      for (let m = 0; m < currentMatchCount; m++) {
        const matchId = `R${r}-M${m + 1}`;
        const isLeft = isFinalRound ? false : (m < currentMatchCount / 2);

        // 下一輪晉級節點指針
        let nextMatchId = null;
        let nextSlot = 'A';
        if (!isFinalRound) {
          const nextR = r + 1;
          const nextM = Math.floor(m / 2) + 1;
          nextMatchId = `R${nextR}-M${nextM}`;
          nextSlot = (m % 2 === 0) ? 'A' : 'B';
        }

        const matchObj = {
          id: matchId,
          round: r,
          index: m,
          isLeft,
          status: 'pending', // 'pending' | 'ready' | 'battling' | 'finished'
          teamA: null,
          teamB: null,
          scoreA: 0,
          scoreB: 0,
          winner: null, // 'A' | 'B'
          winnerTeam: null,
          loserTeam: null,
          nextMatchId,
          nextSlot,
          history: [], // 小局推演快照
          currentSeed: null,
          currentEvent: null,
          combatStartTime: null,
          bannedByA: null,
          bannedByB: null,
          isBronze: false
        };

        tourney.matches[matchId] = matchObj;

        if (isFinalRound) {
          tourney.finalMatchId = matchId;
        } else {
          if (isLeft) tourney.leftWingMatchIds.push(matchId);
          else tourney.rightWingMatchIds.push(matchId);
        }
      }
      currentMatchCount /= 2;
    }

    // 建立季軍賽 (Bronze Final)
    tourney.bronzeMatchId = 'BRONZE-FINAL';
    tourney.matches[tourney.bronzeMatchId] = {
      id: 'BRONZE-FINAL',
      round: totalRounds,
      index: 99,
      isLeft: false,
      isBronze: true,
      status: 'pending',
      teamA: null,
      teamB: null,
      scoreA: 0,
      scoreB: 0,
      winner: null,
      winnerTeam: null,
      loserTeam: null,
      nextMatchId: null,
      nextSlot: null,
      history: []
    };
  }

  /**
   * 一鍵用 AI 影子部隊補齊空位
   */
  function fillWithAI() {
    if (!tourney) return null;
    if (tourney.status !== 'registration') {
      create(tourney.size, tourney.matchType, tourney.participants ? tourney.participants[0] : null);
    }

    // 洗牌備選國家代表隊
    const shuffledPool = NATION_TEAMS.slice().sort(() => Math.random() - 0.5);
    let nationIdx = 0;

    for (let i = 0; i < tourney.size; i++) {
      if (!tourney.participants[i]) {
        const nation = shuffledPool[nationIdx % shuffledPool.length];
        nationIdx++;
        tourney.participants[i] = {
          uid: 'AI-' + (1000 + i),
          name: nation.name,
          flag: nation.flag,
          callsign: nation.callsign,
          isMe: false,
          isAI: true,
          deck: generateLegalDeck(),
          doctrine: nation.doc || 'defense',
          seedNo: i + 1,
          slotIdx: i
        };
      }
    }

    // 將參賽者分配至第 1 輪 (Round 1) 比賽中
    // 採用標準世足種子對抗排序，避免強強提早相撞
    const r1Matches = Object.values(tourney.matches).filter(m => m.round === 1);
    for (let i = 0; i < r1Matches.length; i++) {
      const match = r1Matches[i];
      // 上半區 vs 下半區種子對抗配對
      const idxA = i * 2;
      const idxB = i * 2 + 1;
      match.teamA = Object.assign({}, tourney.participants[idxA]);
      match.teamB = Object.assign({}, tourney.participants[idxB]);
      match.status = 'ready';
    }

    return tourney.participants;
  }

  /**
   * 正式開賽：執行全域隨機抽籤（Fisher-Yates Shuffle），打破固定 1 號位限制
   */
  function start(playerDeck = null, playerDoctrine = null, playerFormations = null, playerTerrain = null) {
    if (!tourney) return;
    const player = tourney.participants.find(pt => pt && pt.isMe);
    const actualFormations = playerFormations || (player && player.formations) || (typeof state !== 'undefined' && state.formations) || Array(5).fill('fishscale');
    tourney.lockedFormations = actualFormations.slice();
    tourney.lockedTerrain = playerTerrain || (player && player.terrain) || (typeof state !== 'undefined' && state.terrain) || 'plain';

    // 1. 若為開戰鎖定賽制，於鳴槍開賽瞬間永久凍結我方陣容與教條
    if (tourney.armoryRule === 'locked') {
      const p = player;
      const actualDeck = playerDeck || (p && p.deck) || (typeof state !== 'undefined' && state.deck) || generateLegalDeck();
      const actualDoc = playerDoctrine || (p && p.doctrine) || (typeof state !== 'undefined' && state.doctrine) || 'defense';
      tourney.lockedDeck = actualDeck.slice();
      tourney.lockedDoctrine = actualDoc;
      if (p) {
        p.deck = tourney.lockedDeck.slice();
        p.doctrine = tourney.lockedDoctrine;
      }
    }
    if (player) {
      player.formations = tourney.lockedFormations.slice();
      player.terrain = tourney.lockedTerrain;
    }

    // 2. 若未滿額自動補齊（大廳階段玩家維持在 1 號位）
    fillWithAI();

    // 2. 正式開賽瞬間執行世界盃全域隨機洗牌抽籤，隨機分派至 4/8/16/32 強各席位
    for (let i = tourney.participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tourney.participants[i], tourney.participants[j]] = [tourney.participants[j], tourney.participants[i]];
    }
    for (let i = 0; i < tourney.participants.length; i++) {
      tourney.participants[i].slotIdx = i;
      tourney.participants[i].seedNo = i + 1;
    }

    // 3. 依洗牌後的全新排位重新生成第 1 輪 (Round 1) 比賽對決節點
    const r1Matches = Object.values(tourney.matches).filter(m => m.round === 1);
    for (let i = 0; i < r1Matches.length; i++) {
      const match = r1Matches[i];
      const idxA = i * 2;
      const idxB = i * 2 + 1;
      match.teamA = Object.assign({}, tourney.participants[idxA]);
      match.teamB = Object.assign({}, tourney.participants[idxB]);
      match.status = 'ready';
    }

    tourney.status = 'in_progress';
    tourney.currentRound = 1;
    // 4. 初始化第一輪純 AI 比賽的推演 (保留包含玩家的場次)
    resolveCurrentRoundAIBattles();
    return tourney;
  }

  /**
   * 獲取當前所需要的獲勝局數 (BO1=1勝, BO3=2勝)
   */
  function getRequiredWinsForMatch(match) {
    if (!tourney) return 1;
    const isFinalOrBronze = (match.round === tourney.totalRounds || match.id === tourney.finalMatchId || match.id === tourney.bronzeMatchId);
    // 1. ⚡ 極速單淘汰：決賽前為 BO1 (1勝)，冠軍決賽與季軍戰升級為 BO3 (2勝)
    if (tourney.matchType === 'bo1') {
      return isFinalOrBronze ? 2 : 1;
    }
    // 2. ⭐ 決賽升級制：四強前 (包含四強準決賽及更早) 為 BO3 (2勝)，冠軍決賽與季軍戰升級為 BO5 (3勝)
    if (tourney.matchType === 'hybrid') {
      return isFinalOrBronze ? 3 : 2;
    }
    // 3. ⚔️ 大師征服：全程所有輪次均為 BO5 (3勝)
    if (tourney.matchType === 'bo3' || tourney.matchType === 'bo5') {
      return 3;
    }
    return 1;
  }

  /**
   * 尋找「我方」目前參與的對戰 (若已淘汰則回傳 null)
   */
  function getMyMatch() {
    if (!tourney || tourney.status !== 'in_progress') return null;
    return Object.values(tourney.matches).find(m => {
      if (m.status === 'finished') return false;
      const aIsMe = m.teamA && m.teamA.isMe;
      const bIsMe = m.teamB && m.teamB.isMe;
      return (aIsMe || bIsMe) && (m.teamA && m.teamB);
    }) || null;
  }

  /**
   * 自動推演當前輪次中「純 AI vs AI」的所有對決
   */
  function resolveCurrentRoundAIBattles() {
    if (!tourney || tourney.status !== 'in_progress') return;

    const currentMatches = Object.values(tourney.matches).filter(m => m.round === tourney.currentRound && m.status !== 'finished');

    currentMatches.forEach(match => {
      if (!match.teamA || !match.teamB) return;
      // 若兩邊都是 AI，由確定性引擎瞬間完成結算
      if (match.teamA.isAI && match.teamB.isAI) {
        resolveAIMatchSeries(match);
      }
    });

    // 檢查本輪是否已全部完賽
    checkAndAdvanceRound();
  }

  /**
   * 結算一場純 AI 的對決系列賽
   */
  function resolveAIMatchSeries(match) {
    const reqWins = getRequiredWinsForMatch(match);
    match.status = 'battling';
    match.bannedListA = match.bannedListA || [];
    match.bannedListB = match.bannedListB || [];

    let deckA = (match.teamA.deck || generateLegalDeck()).slice();
    let deckB = (match.teamB.deck || generateLegalDeck()).slice();
    const isMultiGame = (reqWins >= 2);
    const banCount = (tourney && tourney.armoryRule === 'locked') ? 1 : 2;

    while (match.scoreA < reqWins && match.scoreB < reqWins) {
      const curRound = match.history.length + 1;
      const seed = (Math.random() * 4294967296) >>> 0;
      const roundIdx = match.round || (tourney && tourney.currentRound) || 1;
      const eventObj = (tourney && tourney.roundTheaters && tourney.roundTheaters[roundIdx])
        ? tourney.roundTheaters[roundIdx]
        : ((typeof EVENTS !== 'undefined' && EVENTS.length) ? EVENTS[Math.floor(Math.random() * EVENTS.length)] : { id: 'storm', name: '暴風雨' });
      const battleTerrain = tourney.lockedTerrain || 'plain';
      const formationsA = match.teamA.isMe && Array.isArray(tourney.lockedFormations)
        ? tourney.lockedFormations.slice()
        : (Array.isArray(match.teamA.formations)
          ? match.teamA.formations.slice()
          : (typeof getRecommendedFormations === 'function' ? getRecommendedFormations(deckA, battleTerrain) : Array(5).fill('fishscale')));
      const formationsB = Array.isArray(match.teamB.formations)
        ? match.teamB.formations.slice()
        : (typeof getRecommendedFormations === 'function' ? getRecommendedFormations(deckB, battleTerrain) : Array(5).fill('fishscale'));

      let res = null;
      if (typeof resolveBattle === 'function') {
        res = resolveBattle(deckA, deckB, {
          seed,
          event: eventObj,
          docA: match.teamA.doctrine || 'defense',
          docB: match.teamB.doctrine || 'defense',
          formationsA,
          formationsB,
          terrain: battleTerrain
        });
      } else {
        res = {
          winner: Math.random() > 0.5 ? 'A' : 'B',
          final: { A: [], B: [] },
          mvp: { A: null, B: null }
        };
      }

      const w = res.winner === 'draw' ? (Math.random() > 0.5 ? 'A' : 'B') : res.winner;
      if (w === 'A') match.scoreA++;
      else match.scoreB++;

      match.history.push({
        round: curRound,
        winner: w,
        deckA: deckA.slice(),
        deckB: deckB.slice(),
        docA: match.teamA.doctrine,
        docB: match.teamB.doctrine,
        formationsA,
        formationsB,
        terrain: battleTerrain,
        seed,
        event: eventObj,
        scoreA: res.vp?.A?.total || 100,
        scoreB: res.vp?.B?.total || 100
      });

      // 多局制 BO3 / BO5 系列賽：小局間失利方進行戰術反制 (Ban 1~2 隻主力) 並替補換裝
      if (isMultiGame && match.scoreA < reqWins && match.scoreB < reqWins) {
        if (w === 'A') {
          // B 輸了，B 封禁 A 的武器
          const mvpA = res.mvp?.A?.id;
          const candidatesA = deckA.filter(id => id && !match.bannedListB.includes(id));
          const banTargets = [];
          if (mvpA && candidatesA.includes(mvpA)) banTargets.push(mvpA);
          candidatesA.forEach(id => {
            if (banTargets.length < banCount && !banTargets.includes(id)) banTargets.push(id);
          });
          banTargets.forEach(id => {
            if (!match.bannedListB.includes(id)) match.bannedListB.push(id);
          });
          // A 換裝補位
          deckA = deckA.map(id => match.bannedListB.includes(id) ? null : id);
          if (typeof refitDeckForAI === 'function') {
            deckA = refitDeckForAI(deckA, match.bannedListB);
          } else {
            deckA = generateLegalDeck();
          }
        } else {
          // A 輸了，A 封禁 B 的武器
          const mvpB = res.mvp?.B?.id;
          const candidatesB = deckB.filter(id => id && !match.bannedListA.includes(id));
          const banTargets = [];
          if (mvpB && candidatesB.includes(mvpB)) banTargets.push(mvpB);
          candidatesB.forEach(id => {
            if (banTargets.length < banCount && !banTargets.includes(id)) banTargets.push(id);
          });
          banTargets.forEach(id => {
            if (!match.bannedListA.includes(id)) match.bannedListA.push(id);
          });
          // B 換裝補位
          deckB = deckB.map(id => match.bannedListA.includes(id) ? null : id);
          if (typeof refitDeckForAI === 'function') {
            deckB = refitDeckForAI(deckB, match.bannedListA);
          } else {
            deckB = generateLegalDeck();
          }
        }
      }
    }

    finalizeMatchResult(match);
  }

  /**
   * 提交玩家真實戰鬥結果（真人玩家單局結算）
   */
  function submitPlayerRoundResult(matchId, singleRoundResult, seed, eventObj) {
    const match = tourney.matches[matchId];
    if (!match) return;

    // 推演中玩家永遠是推演 A 側，敵方為推演 B 側；需動態映射至 match.teamA 或 match.teamB
    const playerIsMatchTeamA = Boolean(match.teamA && (match.teamA.isMe || (tourney.playerProfile && match.teamA.uid === tourney.playerProfile.uid)));
    const playerWon = (singleRoundResult.winner === 'A');
    const isDraw = (singleRoundResult.winner === 'draw');
    const w = isDraw 
      ? (playerIsMatchTeamA ? 'A' : 'B')
      : (playerWon ? (playerIsMatchTeamA ? 'A' : 'B') : (playerIsMatchTeamA ? 'B' : 'A'));

    if (w === 'A') match.scoreA++;
    else match.scoreB++;

    const histDeckA = playerIsMatchTeamA ? (singleRoundResult.deckA || match.teamA.deck) : (singleRoundResult.deckB || match.teamA.deck);
    const histDeckB = playerIsMatchTeamA ? (singleRoundResult.deckB || match.teamB.deck) : (singleRoundResult.deckA || match.teamB.deck);

    match.history.push({
      round: match.history.length + 1,
      winner: w,
      deckA: histDeckA.slice(),
      deckB: histDeckB.slice(),
      docA: match.teamA.doctrine,
      docB: match.teamB.doctrine,
      formationsA,
      formationsB,
      terrain: battleTerrain,
      seed,
      event: eventObj,
      scoreA: singleRoundResult.vp?.A?.total || 100,
      scoreB: singleRoundResult.vp?.B?.total || 100,
      mvpA: singleRoundResult.mvp?.A,
      mvpB: singleRoundResult.mvp?.B
    });

    const reqWins = getRequiredWinsForMatch(match);
    if (match.scoreA >= reqWins || match.scoreB >= reqWins) {
      finalizeMatchResult(match);
      checkAndAdvanceRound();
      return { matchFinished: true, winner: match.winnerTeam };
    } else {
      return { matchFinished: false, currentScore: [match.scoreA, match.scoreB] };
    }
  }

  /**
   * 正式完賽並將勝者推至下一輪節點
   */
  function finalizeMatchResult(match) {
    match.status = 'finished';
    const isAWinner = match.scoreA > match.scoreB;
    match.winner = isAWinner ? 'A' : 'B';
    match.winnerTeam = isAWinner ? match.teamA : match.teamB;
    match.loserTeam = isAWinner ? match.teamB : match.teamA;

    // 若是決賽，產出總冠軍與亞軍
    if (match.id === tourney.finalMatchId) {
      tourney.champion = match.winnerTeam;
      tourney.runnerUp = match.loserTeam;
    } else if (match.id === tourney.bronzeMatchId) {
      tourney.thirdPlace = match.winnerTeam;
    } else {
      // 推進下一輪
      if (match.nextMatchId && tourney.matches[match.nextMatchId]) {
        const nextMatch = tourney.matches[match.nextMatchId];
        if (match.nextSlot === 'A') nextMatch.teamA = Object.assign({}, match.winnerTeam);
        else nextMatch.teamB = Object.assign({}, match.winnerTeam);

        if (nextMatch.teamA && nextMatch.teamB) {
          nextMatch.status = 'ready';
        }
      }

      // 若是準決賽 (Semi-Final)，將落敗者送入季軍賽 (Bronze Final)
      if (match.round === tourney.totalRounds - 1 && tourney.matches[tourney.bronzeMatchId]) {
        const bronzeMatch = tourney.matches[tourney.bronzeMatchId];
        if (!bronzeMatch.teamA) bronzeMatch.teamA = Object.assign({}, match.loserTeam);
        else bronzeMatch.teamB = Object.assign({}, match.loserTeam);

        if (bronzeMatch.teamA && bronzeMatch.teamB) {
          bronzeMatch.status = 'ready';
        }
      }
    }
  }

  /**
   * 檢查是否可推進至下一輪
   */
  function checkAndAdvanceRound() {
    if (!tourney || tourney.status !== 'in_progress') return;

    // 檢查當前輪次的所有比賽是否都已完成
    const currentMatches = Object.values(tourney.matches).filter(m => m.round === tourney.currentRound);
    const allFinished = currentMatches.every(m => m.status === 'finished');

    if (allFinished) {
      if (tourney.currentRound < tourney.totalRounds) {
        tourney.currentRound++;
        // 進入新一輪，自動模擬該輪次所有純 AI 比賽
        resolveCurrentRoundAIBattles();
      } else {
        // 決賽與季軍賽均已完成
        const finalM = tourney.matches[tourney.finalMatchId];
        const bronzeM = tourney.matches[tourney.bronzeMatchId];
        if (finalM?.status === 'finished' && (!bronzeM || bronzeM.status === 'finished')) {
          tourney.status = 'completed';
        }
      }
    }
  }

  /**
   * 取得指定比賽的輕量黑盒子（用於觀戰重播）
   */
  function getMatchSnapshot(matchId) {
    if (!tourney || !tourney.matches[matchId]) return null;
    const m = tourney.matches[matchId];
    return {
      matchId: m.id,
      round: m.round,
      status: m.status,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: m.winner,
      history: m.history,
      requiredWins: getRequiredWinsForMatch(m)
    };
  }

  return {
    create,
    start,
    fillWithAI,
    getMyMatch,
    getMatch: (id) => tourney?.matches[id] || null,
    submitPlayerRoundResult,
    resolveCurrentRoundAIBattles,
    checkAndAdvanceRound,
    getMatchSnapshot,
    getState: () => tourney,
    getCurrentRoundTheater: () => {
      if (!tourney || !tourney.roundTheaters) return null;
      return tourney.roundTheaters[tourney.currentRound] || null;
    },
    getRequiredWins: getRequiredWinsForMatch
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TournamentEngine;
}
