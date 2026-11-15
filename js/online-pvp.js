'use strict';
/* =====================================================
   頂尖對戰：15元聯合作戰 — 線上真人雙人對戰引擎 (Online PvP Engine)
   基於 WebRTC P2P DataChannel 技術，零後端伺服器成本，支援 GitHub Pages 與 Vercel 靜態環境
   ===================================================== */

const OnlinePvPEngine = (function () {
  const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const ROOM_PREFIX = 'TOPWARLORDS-BO5-';

  let peer = null;
  let conn = null;
  let isHost = false;
  let currentRoomId = '';
  let opponentInfo = null; // { name, uid, flag }
  let opponentJoinedEmitted = false;
  let listeners = {};
  let useFirebaseRelay = false;
  let fbRoomRef = null;
  let fbMsgListener = null;
  let publicRoomsUnsub = null;
  let pendingJoinResolve = null;
  let pendingJoinReject = null;
  let activeGuestSenderId = null;
  let claimedSeatCode = null;
  let roomHasStarted = false;
  let packetSeq = 0;
  const seenPacketKeys = new Set();
  let roomSettings = { isPublic: true, maxGames: 5, marketMode: 'locked' };
  const senderId = 'P-' + Math.random().toString(36).slice(2, 10);

  function applyRoomSettingsOptions(options = {}) {
    if (!options || typeof options !== 'object') return;
    if (options.isPublic !== undefined) roomSettings.isPublic = !!options.isPublic;
    if ([3, 5, 7].includes(Number(options.maxGames))) roomSettings.maxGames = Number(options.maxGames);
    if (options.marketMode === 'free' || options.marketMode === 'locked') roomSettings.marketMode = options.marketMode;
  }

  async function releaseRoomSeat(codeToRelease) {
    const clean = String(codeToRelease || '').trim().toUpperCase().replace(/^(TOPWARLORDS-BO5-|WL_)/, '');
    if (!clean) return;
    const db = getFbDb();
    if (!db) return;
    try {
      await db.ref('pvp_rooms/WL_' + clean).transaction(cur => {
        if (!cur || cur.status !== 'full' || cur.guestId !== senderId) return cur;
        return Object.assign({}, cur, {
          status: 'waiting',
          guestId: null,
          guestUid: null,
          guestName: null,
          updatedAt: Date.now()
        });
      });
    } catch (_) { }
  }

  function filterPublicRoomsSnapshot(val) {
    if (!val || typeof val !== 'object') return [];
    const now = Date.now();
    const list = [];
    Object.keys(val).forEach(key => {
      if (!key.startsWith('WL_') || /^(TC_|TOPCLASH-BO5-)/i.test(key)) return;
      const r = val[key];
      if (!r || r.gameId !== 'topwarlords') return;
      const isPublic = r.isPublic === true;
      const isWaiting = (r.status || 'waiting') === 'waiting' && !r.guestId;
      const isRecent = r.createdAt && (now - r.createdAt < 15 * 60 * 1000);
      const cleanCode = key.replace(/^WL_/, '');
      if (!isPublic || !isWaiting || !isRecent) return;
      if ((currentRoomId && cleanCode === currentRoomId) || (r.hostId && r.hostId === senderId)) return;
      list.push({
        code: cleanCode,
        hostUid: r.hostUid || 'CMD-HOST',
        hostName: r.hostName || '本部特遣隊',
        hostFlag: r.hostFlag || '🌐',
        maxGames: [3, 5, 7].includes(Number(r.maxGames)) ? Number(r.maxGames) : 5,
        marketMode: r.marketMode === 'free' ? 'free' : 'locked',
        createdAt: r.createdAt
      });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }

  const FIREBASE_CONFIG = (typeof window !== 'undefined' && window.TOPCLASH_FIREBASE_CONFIG) || {
    apiKey: "AIzaSyCcqIW2P88KMBTCkNJhneADRjdJzjBOcI0",
    authDomain: "top-game-913c0.firebaseapp.com",
    databaseURL: "https://top-game-913c0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "top-game-913c0",
    storageBucket: "top-game-913c0.firebasestorage.app",
    messagingSenderId: "948581983008",
    appId: "1:948581983008:web:c141212f221a706263ad45"
  };

  function getFbDb() {
    try {
      if (typeof window !== 'undefined' && window.firebase) {
        if (!window.firebase.apps || !window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
        }
        return window.firebase.database();
      }
    } catch (e) {
      console.warn('Firebase init in OnlinePvPEngine:', e);
    }
    return null;
  }

  function buildHandshakePayload(playerProfile, hostFlag) {
    return {
      gameId: 'topwarlords',
      senderId,
      name: (playerProfile && playerProfile.name) || (hostFlag ? '本部特遣隊' : '挑戰突擊隊'),
      uid: (playerProfile && playerProfile.uid) || 'CMD-ONLINE',
      flag: (playerProfile && playerProfile.flag) || '🇹🇼',
      isHost: !!hostFlag,
      isPublic: roomSettings.isPublic,
      maxGames: roomSettings.maxGames,
      marketMode: roomSettings.marketMode
    };
  }

  function attachFirebaseRelay(code, hostFlag, playerProfile, options = {}) {
    if (!code || /^(TC_|TOPCLASH-BO5-)/i.test(String(code).trim())) return false;
    const db = getFbDb();
    if (!db) return false;
    cleanupFirebaseRelay();
    if (hostFlag) applyRoomSettingsOptions(options);
    fbRoomRef = db.ref('pvp_rooms/WL_' + code);
    if (hostFlag) {
      fbRoomRef.set({
        gameId: 'topwarlords',
        code,
        isPublic: roomSettings.isPublic,
        status: 'waiting',
        createdAt: Date.now(),
        hostId: senderId,
        hostUid: (playerProfile && playerProfile.uid) || 'CMD-HOST',
        hostName: (playerProfile && playerProfile.name) || '本部特遣隊',
        hostFlag: (playerProfile && playerProfile.flag) || '🇹🇼',
        maxGames: roomSettings.maxGames,
        marketMode: roomSettings.marketMode
      }).catch(() => { });
      fbRoomRef.onDisconnect().remove();
    }
    const msgsRef = fbRoomRef.child('messages');
    fbMsgListener = msgsRef.on('child_added', snap => {
      const val = snap.val();
      if (!val || val.sender === senderId) return;
      if (val.target && val.target !== senderId) return;
      if (val.type === '__RELAY_JOIN__' && hostFlag) {
        if ((opponentInfo || activeGuestSenderId || roomHasStarted) && val.sender !== activeGuestSenderId) {
          fbRoomRef.child('messages').push({
            sender: senderId,
            target: val.sender,
            packet: { type: 'ROOM_FULL', payload: { message: '該房間已有對手進駐或已經開戰' }, timestamp: Date.now() },
            ts: Date.now()
          }).catch(() => { });
          return;
        }
        activeGuestSenderId = val.sender;
        useFirebaseRelay = true;
        pvpState.connected = true;
        fbRoomRef.update({
          status: 'full',
          guestId: val.sender,
          guestUid: val.uid || '',
          guestName: val.name || '',
          updatedAt: Date.now()
        }).catch(() => { });
        sendPacket('HANDSHAKE', buildHandshakePayload(playerProfile, true));
        return;
      }
      if (val.type === '__HOST_LEAVE__' && !hostFlag) {
        if (currentRoomId === code) {
          const beforeStart = !roomHasStarted;
          useFirebaseRelay = false;
          pvpState.connected = false;
          opponentInfo = null;
          opponentJoinedEmitted = false;
          if (pendingJoinReject) {
            pendingJoinReject(new Error('房主已關閉房間'));
          } else {
            emit('opponent_left', { beforeStart });
          }
        }
        return;
      }
      if (val.type === '__GUEST_LEAVE__' && hostFlag) {
        if (!activeGuestSenderId || val.sender === activeGuestSenderId) {
          const beforeStart = !roomHasStarted;
          activeGuestSenderId = null;
          pvpState.connected = false;
          opponentInfo = null;
          opponentJoinedEmitted = false;
          useFirebaseRelay = false;
          if (beforeStart) {
            fbRoomRef.update({
              status: 'waiting',
              guestId: null,
              guestUid: null,
              guestName: null,
              updatedAt: Date.now()
            }).catch(() => { });
          }
          emit('opponent_left', { beforeStart });
        }
        return;
      }
      if (val.packet) {
        if (val.packet.type === 'ROOM_FULL') {
          if (pendingJoinReject && !opponentInfo) {
            pendingJoinReject(new Error((val.packet.payload && val.packet.payload.message) || '該房間人數已滿或已經開戰'));
          }
          return;
        }
        if (val.packet.type === 'HANDSHAKE' && hostFlag && (opponentInfo || activeGuestSenderId) && val.sender !== activeGuestSenderId) {
          return;
        }
        if (!pvpState.connected) {
          useFirebaseRelay = true;
          pvpState.connected = true;
        }
        handleIncomingPacket(val.packet);
      }
    });
    return true;
  }

  function cleanupFirebaseRelay() {
    if (fbRoomRef && fbMsgListener) {
      try { fbRoomRef.child('messages').off('child_added', fbMsgListener); } catch (e) { }
    }
    if (fbRoomRef && isHost) {
      try { fbRoomRef.remove(); } catch (e) { }
    }
    fbRoomRef = null;
    fbMsgListener = null;
    useFirebaseRelay = false;
  }

  // 線上 BO5 比分與狀態
  let pvpState = {
    connected: false,
    round: 1,
    winsA: 0, // 本部特遣隊比分
    winsB: 0, // 挑戰突擊隊比分
    bannedByOpponent: null, // 對手禁用我方的裝備
    bannedByMe: null,       // 我方禁用對手的裝備
    myReady: false,
    opponentReady: false
  };

  function resetPvpState() {
    pvpState.connected = false;
    pvpState.round = 1;
    pvpState.winsA = 0;
    pvpState.winsB = 0;
    pvpState.bannedByOpponent = null;
    pvpState.bannedByMe = null;
    pvpState.myReady = false;
    pvpState.opponentReady = false;
  }

  function on(evt, fn) {
    if (!listeners[evt]) listeners[evt] = [];
    listeners[evt].push(fn);
  }

  function emit(evt, data) {
    if (listeners[evt]) {
      listeners[evt].forEach(fn => {
        try { fn(data); } catch (e) { console.error('PVP listener error', e); }
      });
    }
  }

  /* 動態非同步載入 PeerJS 函式庫 */
  function ensurePeerJS() {
    return new Promise((resolve, reject) => {
      if (window.Peer) return resolve();
      const existing = document.querySelector(`script[src="${PEERJS_CDN}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('載入 PeerJS 失敗')));
        return;
      }
      const s = document.createElement('script');
      s.src = PEERJS_CDN;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('無法從 CDN 載入 WebRTC 連線套件'));
      document.head.appendChild(s);
    });
  }

  /* 生成 6 位大寫軍規房間代碼 */
  function generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /* 本部特遣隊建立房間 */
  async function createRoom(playerProfile, options = {}) {
    await ensurePeerJS();
    closeConnection();
    applyRoomSettingsOptions(options);

    const shortCode = generateRoomCode();
    currentRoomId = shortCode;
    isHost = true;
    roomHasStarted = false;
    opponentJoinedEmitted = false;
    seenPacketKeys.clear();
    activeGuestSenderId = null;
    claimedSeatCode = null;
    resetPvpState();

    const fullPeerId = `${ROOM_PREFIX}${shortCode}`;

    return new Promise((resolve, reject) => {
      let peerOpened = false;
      peer = new window.Peer(fullPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', id => {
        peerOpened = true;
        attachFirebaseRelay(shortCode, true, playerProfile, roomSettings);
        const info = {
          roomCode: shortCode,
          shareUrl: getShareUrl(shortCode),
          isPublic: roomSettings.isPublic,
          maxGames: roomSettings.maxGames,
          marketMode: roomSettings.marketMode
        };
        emit('room_created', info);
        resolve(info);
      });

      peer.on('connection', incoming => {
        const metaSender = incoming && incoming.metadata && incoming.metadata.senderId;
        const isSameRelayGuest = !!(activeGuestSenderId && metaSender && metaSender === activeGuestSenderId);
        const alreadyOccupiedByOther = Boolean(
          (roomHasStarted && !isSameRelayGuest)
          || (conn && conn.open && !isSameRelayGuest)
          || (activeGuestSenderId && metaSender && metaSender !== activeGuestSenderId)
          || (opponentInfo && !metaSender && conn && conn.open)
        );
        if (alreadyOccupiedByOther) {
          incoming.on('open', () => {
            try {
              incoming.send({
                type: 'ROOM_FULL',
                payload: { message: '該房間已有對手進駐或已經開戰' },
                timestamp: Date.now()
              });
            } catch (_) { }
            setTimeout(() => { try { incoming.close(); } catch (_) { } }, 80);
          });
          return;
        }
        // 若 Firebase Relay 已先連上但 Incoming 未帶 metadata，先驗證首個 HANDSHAKE 是否為同一位挑戰者再升級
        if ((opponentInfo || activeGuestSenderId) && !metaSender) {
          let verified = false;
          const rejectDuplicate = () => {
            try {
              incoming.send({
                type: 'ROOM_FULL',
                payload: { message: '該房間已有對手進駐或已經開戰' },
                timestamp: Date.now()
              });
            } catch (_) { }
            setTimeout(() => { try { incoming.close(); } catch (_) { } }, 80);
          };
          const probeTimer = setTimeout(() => {
            if (!verified) rejectDuplicate();
          }, 1500);
          incoming.on('data', firstPkt => {
            if (verified) return;
            if (firstPkt && firstPkt.type === 'HANDSHAKE') {
              const pktSender = firstPkt.payload && firstPkt.payload.senderId;
              if (activeGuestSenderId && pktSender && pktSender !== activeGuestSenderId) {
                clearTimeout(probeTimer);
                rejectDuplicate();
                return;
              }
              verified = true;
              clearTimeout(probeTimer);
              setupConnection(incoming, playerProfile, { alreadyOpen: true, initialPacket: firstPkt });
            }
          });
          incoming.on('close', () => clearTimeout(probeTimer));
          return;
        }
        setupConnection(incoming, playerProfile);
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        if (!peerOpened) {
          emit('error', err.message || '連線錯誤');
          reject(err);
        }
      });
    });
  }

  /* 挑戰突擊隊加入房間 */
  async function joinRoom(roomCode, playerProfile) {
    const rawCode = String(roomCode || '').trim().toUpperCase();
    if (rawCode.startsWith('TC_') || rawCode.startsWith('TOPCLASH-BO5-')) {
      throw new Error('此對戰代碼屬於其他遊戲專案，無法加入');
    }
    const cleanCode = rawCode.replace(/^(TOPWARLORDS-BO5-|WL_)/, '');

    await ensurePeerJS();
    closeConnection();

    let claimedByMe = false;
    const db = getFbDb();
    if (db && cleanCode) {
      const roomRef = db.ref('pvp_rooms/WL_' + cleanCode);
      let snap = null;
      try {
        snap = await Promise.race([
          roomRef.once('value'),
          new Promise(resolve => setTimeout(() => resolve(null), 2000))
        ]);
      } catch (_) {
        snap = null;
      }

      if (snap && typeof snap.exists === 'function' && snap.exists()) {
        const meta = snap.val() || {};
        if (meta.gameId && meta.gameId !== 'topwarlords') {
          throw new Error('此對戰代碼屬於其他遊戲專案，無法加入');
        }
        if ((meta.status && meta.status !== 'waiting') || (meta.guestId && meta.guestId !== senderId)) {
          throw new Error('該房間人數已滿或已經開戰，請選擇其他房間！');
        }
        try {
          const txRes = await roomRef.transaction(cur => {
            if (!cur) return cur;
            if (cur.gameId && cur.gameId !== 'topwarlords') return;
            if (cur.status && cur.status !== 'waiting') return;
            if (cur.guestId && cur.guestId !== senderId) return;
            return Object.assign({}, cur, {
              status: 'full',
              guestId: senderId,
              guestUid: (playerProfile && playerProfile.uid) || '',
              guestName: (playerProfile && playerProfile.name) || '',
              updatedAt: Date.now()
            });
          });
          if (!txRes.committed || !txRes.snapshot || !txRes.snapshot.val()) {
            throw new Error('該房間剛被其他玩家搶先加入或已關閉，請選擇其他房間！');
          }
          claimedByMe = true;
          claimedSeatCode = cleanCode;
        } catch (txErr) {
          if (txErr && /其他玩家|人數已滿|其他遊戲專案/.test(txErr.message || '')) throw txErr;
        }
      }
    }

    currentRoomId = cleanCode;
    isHost = false;
    roomHasStarted = false;
    opponentJoinedEmitted = false;
    seenPacketKeys.clear();
    activeGuestSenderId = null;
    resetPvpState();
    opponentInfo = null;

    const fullPeerId = `${ROOM_PREFIX}${cleanCode}`;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let relayStarted = false;

      const finishSuccess = () => {
        if (isSettled) return;
        isSettled = true;
        pendingJoinResolve = null;
        pendingJoinReject = null;
        clearTimeout(connectionTimeout);
        resolve({ roomCode: cleanCode });
      };

      const finishError = (err) => {
        if (isSettled) return;
        isSettled = true;
        pendingJoinResolve = null;
        pendingJoinReject = null;
        clearTimeout(connectionTimeout);
        if (claimedByMe) {
          claimedByMe = false;
          claimedSeatCode = null;
          releaseRoomSeat(cleanCode);
        }
        const message = (err && err.message) ? err.message : String(err || '加入房間失敗');
        reject(err instanceof Error ? err : new Error(message));
      };

      pendingJoinResolve = finishSuccess;
      pendingJoinReject = finishError;

      // 8 秒逾時防護
      const connectionTimeout = setTimeout(() => {
        if (!pvpState.connected && !opponentInfo) {
          finishError(new Error(`連線逾時：找不到房間 [${cleanCode}] 或房主尚未就緒，請確認代碼無誤！`));
        }
      }, 8000);

      const startRelayFallback = () => {
        if (relayStarted || pvpState.connected) return;
        relayStarted = true;
        console.log('[PvP] 啟動 Firebase 雲端中繼直連房主:', cleanCode);
        if (attachFirebaseRelay(cleanCode, false, playerProfile) && fbRoomRef) {
          useFirebaseRelay = true;
          fbRoomRef.child('messages').push({
            sender: senderId,
            type: '__RELAY_JOIN__',
            uid: (playerProfile && playerProfile.uid) || '',
            name: (playerProfile && playerProfile.name) || '',
            ts: Date.now()
          }).catch(() => { });
          sendPacket('HANDSHAKE', buildHandshakePayload(playerProfile, false));
        }
      };

      // 挑戰者 PeerJS 初始化
      try {
        peer = new window.Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });
      } catch (e) {
        console.warn('[PvP] PeerJS init failed, falling back to Firebase immediately:', e);
        startRelayFallback();
      }

      if (peer) {
        peer.on('open', () => {
          try {
            const outgoing = peer.connect(fullPeerId, { reliable: true, metadata: { senderId } });
            setupConnection(outgoing, playerProfile);

            // 若 1.2 秒內 WebRTC 未能穿透對稱型 NAT，立即雙軌啟動 Firebase RTDB 雲端中繼
            setTimeout(() => {
              if (!pvpState.connected) startRelayFallback();
            }, 1200);
          } catch (e) {
            startRelayFallback();
          }
        });

        peer.on('error', err => {
          console.warn('[PvP] Peer join error, switching to Firebase Relay fallback:', err);
          startRelayFallback();
        });
      } else {
        startRelayFallback();
      }

      // 同時預先掛載 Firebase 監聽，確保房主發送的 HANDSHAKE 絕不遺漏
      setTimeout(() => {
        if (!pvpState.connected) startRelayFallback();
      }, 500);
    });
  }

  /* 設定 DataChannel 雙向通訊監聽 */
  function setupConnection(c, playerProfile, options = {}) {
    const prevConn = conn;
    conn = c;
    if (prevConn && prevConn !== c) {
      try { prevConn.close(); } catch (_) { }
    }

    const onOpenChannel = () => {
      if (c !== conn) return;
      pvpState.connected = true;
      // 發送身分握手封包 (Handshake)
      sendPacket('HANDSHAKE', buildHandshakePayload(playerProfile, isHost));
    };

    if (options && options.alreadyOpen) {
      onOpenChannel();
      if (options.initialPacket) {
        handleIncomingPacket(options.initialPacket);
      }
    } else {
      c.on('open', onOpenChannel);
    }

    c.on('data', data => {
      if (c !== conn) return;
      handleIncomingPacket(data);
    });

    c.on('close', () => {
      if (c !== conn) return;
      conn = null;
      // 若 Firebase Relay 仍在線且雙方已完成握手，禁止因 P2P 通道退回中繼而誤觸離房關閉
      if (useFirebaseRelay && fbRoomRef && opponentInfo) {
        pvpState.connected = true;
        return;
      }
      // 尚未完成握手前，交由 Firebase 中繼與逾時邏輯處理，不要提前發送離房
      if (!opponentInfo) {
        if (!useFirebaseRelay) pvpState.connected = false;
        return;
      }
      const beforeStart = !roomHasStarted;
      pvpState.connected = false;
      opponentInfo = null;
      opponentJoinedEmitted = false;
      activeGuestSenderId = null;
      if (isHost && fbRoomRef && beforeStart) {
        fbRoomRef.update({
          status: 'waiting',
          guestId: null,
          guestUid: null,
          guestName: null,
          updatedAt: Date.now()
        }).catch(() => { });
      }
      emit('opponent_left', { beforeStart });
    });

    c.on('error', err => {
      if (c !== conn) return;
      console.error('Conn error', err);
      if (!useFirebaseRelay || !opponentInfo) {
        emit('error', '對戰連線中斷');
      }
    });
  }

  /* 處理接收到的封包 */
  function handleIncomingPacket(data) {
    if (!data || !data.type) return;
    if (data.id) {
      if (seenPacketKeys.has(data.id)) return;
      if (seenPacketKeys.size > 500) seenPacketKeys.clear();
      seenPacketKeys.add(data.id);
    }

    switch (data.type) {
      case 'ROOM_FULL':
        if (pendingJoinReject && !opponentInfo) {
          pendingJoinReject(new Error((data.payload && data.payload.message) || '該房間人數已滿或已經開戰'));
        }
        break;

      case 'HANDSHAKE':
        if (data.payload && data.payload.gameId && data.payload.gameId !== 'topwarlords') {
          closeConnection();
          emit('error', '對手來自不同遊戲專案，已自動中斷連線');
          return;
        }
        if (isHost) {
          const pktSender = data.payload && data.payload.senderId;
          if ((opponentInfo || activeGuestSenderId || roomHasStarted) && activeGuestSenderId && pktSender && pktSender !== activeGuestSenderId) {
            return;
          }
          if (!activeGuestSenderId && pktSender) {
            activeGuestSenderId = pktSender;
          }
          if (fbRoomRef && !roomHasStarted) {
            fbRoomRef.update({
              status: 'full',
              guestUid: (data.payload && data.payload.uid) || '',
              guestName: (data.payload && data.payload.name) || '',
              updatedAt: Date.now()
            }).catch(() => { });
          }
        }
        opponentInfo = data.payload;
        pvpState.connected = true;
        if (pendingJoinResolve) pendingJoinResolve();
        if (!opponentJoinedEmitted) {
          opponentJoinedEmitted = true;
          emit('opponent_joined', { opponent: opponentInfo, isHost });
        }
        break;

      case 'SETTINGS_UPDATE':
        emit('room_settings_updated', data.payload);
        break;

      case 'GAME_START_SESSION':
        roomHasStarted = true;
        pvpState.round = (data.payload && data.payload.round) || 1;
        pvpState.winsA = (data.payload && data.payload.winsA) || 0;
        pvpState.winsB = (data.payload && data.payload.winsB) || 0;
        pvpState.bannedByOpponent = null;
        pvpState.bannedByMe = null;
        pvpState.myReady = false;
        pvpState.opponentReady = false;
        emit('game_session_started', data.payload);
        break;

      case 'DECK_COMMIT':
        emit('opponent_deck_committed', data.payload);
        break;

      case 'DECK_SUBMIT':
        emit('opponent_deck_ready', data.payload);
        break;

      case 'DECK_UNREADY':
        pvpState.opponentReady = false;
        emit('opponent_deck_unready', data.payload);
        break;

      case 'BAN_COMMIT':
        pvpState.bannedByOpponent = data.payload.bannedUnitId;
        emit('opponent_ban_committed', data.payload);
        break;

      case 'COMBAT_SYNC':
        emit('combat_start_sync', data.payload);
        break;

      case 'SERIES_END':
        emit('series_end_received', data.payload);
        break;

      case 'EMOTE':
        emit('emote_received', data.payload);
        break;

      case 'REMATCH_REQ':
        emit('rematch_requested');
        break;

      case 'PLAYER_FORFEIT':
        emit('player_forfeit_received', data.payload);
        break;
    }
  }

  const CRITICAL_SYNC_PACKETS = new Set([
    'HANDSHAKE',
    'GAME_START_SESSION',
    'DECK_COMMIT',
    'DECK_SUBMIT',
    'DECK_UNREADY',
    'BAN_COMMIT',
    'COMBAT_SYNC',
    'PLAYER_FORFEIT',
    'SERIES_END'
  ]);

  /* 發送封包 */
  function sendPacket(type, payload) {
    if (type === 'GAME_START_SESSION' && isHost) {
      roomHasStarted = true;
      if (fbRoomRef) {
        fbRoomRef.update({ status: 'playing', updatedAt: Date.now() }).catch(() => { });
      }
    }
    const packet = { id: `${senderId}:${++packetSeq}`, type, payload, timestamp: Date.now() };
    let sentOverP2P = false;
    if (conn && conn.open) {
      try {
        conn.send(packet);
        sentOverP2P = true;
      } catch (_) {
        sentOverP2P = false;
      }
    }
    const criticalPacket = CRITICAL_SYNC_PACKETS.has(type);
    if (useFirebaseRelay && fbRoomRef && (!sentOverP2P || criticalPacket)) {
      fbRoomRef.child('messages').push({ sender: senderId, packet, ts: Date.now() }).catch(() => { });
    }
  }

  function updateRoomMeta(patch = {}) {
    applyRoomSettingsOptions(patch);
    if (isHost && fbRoomRef) {
      fbRoomRef.update({
        isPublic: roomSettings.isPublic,
        maxGames: roomSettings.maxGames,
        marketMode: roomSettings.marketMode,
        updatedAt: Date.now()
      }).catch(() => { });
    }
    if ((patch.maxGames !== undefined || patch.marketMode !== undefined) && pvpState.connected) {
      sendPacket('SETTINGS_UPDATE', {
        maxGames: roomSettings.maxGames,
        marketMode: roomSettings.marketMode
      });
    }
  }

  function reopenWaitingRoom() {
    if (!isHost || !currentRoomId || roomHasStarted) return false;
    if (conn) {
      try { conn.close(); } catch (_) { }
      conn = null;
    }
    pvpState.connected = false;
    opponentInfo = null;
    opponentJoinedEmitted = false;
    activeGuestSenderId = null;
    useFirebaseRelay = false;
    if (fbRoomRef) {
      fbRoomRef.update({
        status: 'waiting',
        guestId: null,
        guestUid: null,
        guestName: null,
        updatedAt: Date.now()
      }).catch(() => { });
    }
    return true;
  }

  function stopListeningPublicRooms() {
    if (typeof publicRoomsUnsub === 'function') {
      try { publicRoomsUnsub(); } catch (_) { }
      publicRoomsUnsub = null;
    }
  }

  function listenPublicRooms(callback) {
    stopListeningPublicRooms();
    const cb = typeof callback === 'function' ? callback : () => { };
    const db = getFbDb();
    if (!db) {
      cb([], { offline: true });
      return () => { };
    }
    const roomsRef = db.ref('pvp_rooms').orderByChild('status').equalTo('waiting').limitToLast(30);
    const handler = roomsRef.on(
      'value',
      snap => cb(filterPublicRoomsSnapshot(snap ? snap.val() : null)),
      err => {
        console.warn('[PvP] listenPublicRooms error:', err);
        cb([], { offline: true });
      }
    );
    publicRoomsUnsub = () => {
      try { roomsRef.off('value', handler); } catch (_) { }
    };
    return stopListeningPublicRooms;
  }

  async function quickMatch(playerProfile, options = {}) {
    const db = getFbDb();
    let candidates = [];
    if (db) {
      try {
        const roomsRef = db.ref('pvp_rooms').orderByChild('status').equalTo('waiting').limitToLast(30);
        const snap = await Promise.race([
          roomsRef.once('value'),
          new Promise(resolve => setTimeout(() => resolve(null), 2500))
        ]);
        if (snap && typeof snap.val === 'function') {
          candidates = filterPublicRoomsSnapshot(snap.val());
          candidates.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }
      } catch (e) {
        console.warn('[PvP] quickMatch query failed:', e);
      }
    }

    for (const room of candidates) {
      try {
        await joinRoom(room.code, playerProfile);
        return { mode: 'joined', roomCode: room.code, room };
      } catch (_) {
        // 該房可能剛被搶先加入或已斷開，嘗試下一個或自動轉建公開房
      }
    }

    const created = await createRoom(playerProfile, {
      isPublic: true,
      maxGames: [3, 5, 7].includes(Number(options.maxGames)) ? Number(options.maxGames) : roomSettings.maxGames,
      marketMode: options.marketMode === 'free' ? 'free' : 'locked'
    });
    return { mode: 'created', roomCode: created.roomCode, shareUrl: created.shareUrl };
  }

  function getShareUrl(code) {
    const loc = window.location;
    const base = loc.protocol + '//' + loc.host + loc.pathname;
    return `${base}?room=${code}`;
  }

  function closeConnection() {
    pendingJoinResolve = null;
    pendingJoinReject = null;
    if (!isHost) {
      if (useFirebaseRelay && fbRoomRef) {
        try {
          fbRoomRef.child('messages').push({ sender: senderId, type: '__GUEST_LEAVE__', ts: Date.now() }).catch(() => { });
        } catch (_) { }
      }
      if (!roomHasStarted && claimedSeatCode) {
        const codeToRelease = claimedSeatCode;
        claimedSeatCode = null;
        releaseRoomSeat(codeToRelease);
      } else {
        claimedSeatCode = null;
      }
    } else {
      claimedSeatCode = null;
    }
    if (isHost && fbRoomRef && opponentInfo) {
      const leavingRef = fbRoomRef;
      const listenerToDetach = fbMsgListener;
      try {
        if (listenerToDetach) leavingRef.child('messages').off('child_added', listenerToDetach);
      } catch (_) { }
      fbRoomRef = null;
      fbMsgListener = null;
      useFirebaseRelay = false;
      try {
        leavingRef.child('messages').push({ sender: senderId, type: '__HOST_LEAVE__', ts: Date.now() }).catch(() => { });
      } catch (_) { }
      setTimeout(() => {
        try { leavingRef.remove(); } catch (_) { }
      }, 600);
    } else {
      cleanupFirebaseRelay();
    }
    if (conn) {
      try { conn.close(); } catch (e) { }
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) { }
      peer = null;
    }
    currentRoomId = '';
    activeGuestSenderId = null;
    roomHasStarted = false;
    resetPvpState();
    opponentInfo = null;
    opponentJoinedEmitted = false;
    seenPacketKeys.clear();
  }

  /* 產生 128-bit 密碼學安全隨機鹽值 */
  function generateSecureSalt() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const arr = new Uint32Array(4);
        crypto.getRandomValues(arr);
        return Array.from(arr, n => n.toString(16).padStart(8, '0')).join('');
      }
    } catch (_) { }
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }

  function getCommitRaw(deck, doctrine, salt, formations, terrain) {
    const roster = (deck || []).join('.');
    if (formations === undefined && terrain === undefined) {
      return `${roster}|${doctrine || 'defense'}|${salt || ''}`;
    }
    const formationKey = Array.isArray(formations) ? formations.join('.') : '';
    return `${roster}|${doctrine || 'defense'}|${formationKey}|${terrain || 'plain'}|${salt || ''}`;
  }

  /* Commit-Reveal 覆蓋陣容、教條、陣形與地形，避免揭露後改動戰場配置。 */
  function computeCommitHash(deck, doctrine, salt, formations, terrain) {
    const raw = getCommitRaw(deck, doctrine, salt, formations, terrain);
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= (c + i * 31);
      h2 = Math.imul(h2, 0x01000193);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  async function computeCommitHashAsync(deck, doctrine, salt, formations, terrain) {
    const raw = getCommitRaw(deck, doctrine, salt, formations, terrain);
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
        return 'sha256:' + hex;
      }
    } catch (_) { }
    return computeCommitHash(deck, doctrine, salt, formations, terrain);
  }

  return {
    on,
    createRoom,
    joinRoom,
    sendPacket,
    updateRoomMeta,
    reopenWaitingRoom,
    getRoomSettings: () => Object.assign({}, roomSettings),
    listenPublicRooms,
    stopListeningPublicRooms,
    quickMatch,
    generateSecureSalt,
    computeCommitHash,
    computeCommitHashAsync,
    broadcastRoomSettings: (settings) => updateRoomMeta(settings),
    closeConnection,
    getState: () => pvpState,
    getOpponent: () => opponentInfo,
    isHostUser: () => isHost,
    getCurrentRoomCode: () => currentRoomId
  };
})();
