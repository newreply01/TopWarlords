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
  let listeners = {};
  let useFirebaseRelay = false;
  let fbRoomRef = null;
  let fbMsgListener = null;
  const senderId = 'P-' + Math.random().toString(36).slice(2, 10);

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

  function attachFirebaseRelay(code, hostFlag, playerProfile) {
    if (!code || /^(TC_|TOPCLASH-BO5-)/i.test(String(code).trim())) return false;
    const db = getFbDb();
    if (!db) return false;
    cleanupFirebaseRelay();
    fbRoomRef = db.ref('pvp_rooms/WL_' + code);
    if (hostFlag) {
      fbRoomRef.set({ gameId: 'topwarlords', createdAt: Date.now(), hostId: senderId, status: 'waiting' }).catch(() => { });
      fbRoomRef.onDisconnect().remove();
    }
    const msgsRef = fbRoomRef.child('messages');
    fbMsgListener = msgsRef.on('child_added', snap => {
      const val = snap.val();
      if (!val || val.sender === senderId) return;
      if (val.type === '__RELAY_JOIN__' && hostFlag) {
        useFirebaseRelay = true;
        pvpState.connected = true;
        sendPacket('HANDSHAKE', {
          gameId: 'topwarlords',
          name: playerProfile.name,
          uid: playerProfile.uid,
          flag: playerProfile.flag,
          isHost: true
        });
        return;
      }
      if (val.packet) {
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
  async function createRoom(playerProfile) {
    await ensurePeerJS();
    closeConnection();

    const shortCode = generateRoomCode();
    currentRoomId = shortCode;
    isHost = true;
    pvpState.connected = false;
    pvpState.winsA = 0;
    pvpState.winsB = 0;
    pvpState.round = 1;

    const fullPeerId = `${ROOM_PREFIX}${shortCode}`;

    return new Promise((resolve, reject) => {
      peer = new window.Peer(fullPeerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', id => {
        attachFirebaseRelay(shortCode, true, playerProfile);
        emit('room_created', { roomCode: shortCode, shareUrl: getShareUrl(shortCode) });
        resolve({ roomCode: shortCode, shareUrl: getShareUrl(shortCode) });
      });

      peer.on('connection', incoming => {
        setupConnection(incoming, playerProfile);
      });

      peer.on('error', err => {
        console.error('Peer error:', err);
        emit('error', err.message || '連線錯誤');
        reject(err);
      });
    });
  }

  /* 挑戰突擊隊加入房間 */
  async function joinRoom(roomCode, playerProfile) {
    await ensurePeerJS();
    closeConnection();

    const rawCode = String(roomCode || '').trim().toUpperCase();
    if (rawCode.startsWith('TC_') || rawCode.startsWith('TOPCLASH-BO5-')) {
      throw new Error('此對戰代碼屬於其他遊戲專案，無法加入');
    }
    const cleanCode = rawCode.replace(/^(TOPWARLORDS-BO5-|WL_)/, '');
    currentRoomId = cleanCode;
    isHost = false;
    pvpState.connected = false;
    pvpState.winsA = 0;
    pvpState.winsB = 0;
    pvpState.round = 1;
    opponentInfo = null;

    const fullPeerId = `${ROOM_PREFIX}${cleanCode}`;

    return new Promise((resolve, reject) => {
      let isSettled = false;
      let relayStarted = false;

      const finishSuccess = () => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(connectionTimeout);
        resolve({ roomCode: cleanCode });
      };

      const finishError = (err) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(connectionTimeout);
        emit('error', err.message || err);
        reject(err);
      };

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
          fbRoomRef.child('messages').push({ sender: senderId, type: '__RELAY_JOIN__', ts: Date.now() }).catch(() => { });
          sendPacket('HANDSHAKE', {
            gameId: 'topwarlords',
            name: playerProfile.name,
            uid: playerProfile.uid,
            flag: playerProfile.flag,
            isHost: false
          });
        }
      };

      // 監聽握手成功
      const onOpponentHandshake = () => {
        pvpState.connected = true;
        finishSuccess();
      };
      const unbindTemp = () => {
        // 握手成功由 handleIncomingPacket 全域處理
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
            const outgoing = peer.connect(fullPeerId, { reliable: true });
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
  function setupConnection(c, playerProfile) {
    conn = c;

    conn.on('open', () => {
      pvpState.connected = true;
      // 發送身分握手封包 (Handshake)
      sendPacket('HANDSHAKE', {
        gameId: 'topwarlords',
        name: playerProfile.name,
        uid: playerProfile.uid,
        flag: playerProfile.flag,
        isHost
      });
    });

    conn.on('data', data => {
      handleIncomingPacket(data);
    });

    conn.on('close', () => {
      pvpState.connected = false;
      emit('opponent_left');
    });

    conn.on('error', err => {
      console.error('Conn error', err);
      emit('error', '對戰連線中斷');
    });
  }

  /* 處理接收到的封包 */
  function handleIncomingPacket(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'HANDSHAKE':
        if (data.payload && data.payload.gameId && data.payload.gameId !== 'topwarlords') {
          closeConnection();
          emit('error', '對手來自不同遊戲專案，已自動中斷連線');
          return;
        }
        opponentInfo = data.payload;
        emit('opponent_joined', { opponent: opponentInfo, isHost });
        break;

      case 'SETTINGS_UPDATE':
        emit('room_settings_updated', data.payload);
        break;

      case 'GAME_START_SESSION':
        emit('game_session_started', data.payload);
        break;

      case 'DECK_COMMIT':
        emit('opponent_deck_committed', data.payload);
        break;

      case 'DECK_SUBMIT':
        emit('opponent_deck_ready', data.payload);
        break;

      case 'BAN_COMMIT':
        pvpState.bannedByOpponent = data.payload.bannedUnitId;
        emit('opponent_ban_committed', data.payload);
        break;

      case 'COMBAT_SYNC':
        emit('combat_start_sync', data.payload);
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

  /* 發送封包 */
  function sendPacket(type, payload) {
    const packet = { type, payload, timestamp: Date.now() };
    if (conn && conn.open) {
      conn.send(packet);
      return;
    }
    if (useFirebaseRelay && fbRoomRef) {
      fbRoomRef.child('messages').push({ sender: senderId, packet, ts: Date.now() }).catch(() => { });
    }
  }

  function getShareUrl(code) {
    const loc = window.location;
    const base = loc.protocol + '//' + loc.host + loc.pathname;
    return `${base}?room=${code}`;
  }

  function closeConnection() {
    cleanupFirebaseRelay();
    if (conn) {
      try { conn.close(); } catch (e) { }
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) { }
      peer = null;
    }
    pvpState.connected = false;
    opponentInfo = null;
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
    generateSecureSalt,
    computeCommitHash,
    computeCommitHashAsync,
    broadcastRoomSettings: (settings) => sendPacket('SETTINGS_UPDATE', settings),
    closeConnection,
    getState: () => pvpState,
    getOpponent: () => opponentInfo,
    isHostUser: () => isHost,
    getCurrentRoomCode: () => currentRoomId
  };
})();
