/**
 * TopClash 雲端指揮官帳號與跨裝置存檔核心模組 (v5.9.106)
 * 整合 Firebase Google Authentication、RTDB 指揮官存檔與狀態廣播
 */
const CloudSync = (() => {
  const LS = (typeof window !== 'undefined' && window.LS) || {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const FIREBASE_CONFIG = window.TOPCLASH_FIREBASE_CONFIG || {
    apiKey: "AIzaSyCcqIW2P88KMBTCkNJhneADRjdJzjBOcI0",
    authDomain: "top-game-913c0.firebaseapp.com",
    databaseURL: "https://top-game-913c0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "top-game-913c0",
    storageBucket: "top-game-913c0.firebasestorage.app",
    messagingSenderId: "948581983008",
    appId: "1:948581983008:web:c141212f221a706263ad45"
  };

  const ID_REGEX = /^[a-zA-Z0-9]{6,20}$/;
  const PWD_REGEX = /^[a-zA-Z0-9]{4,30}$/;

  let db = null;
  let saveResolver = null;
  let syncTimer = null;

  let syncStatus = {
    state: 'local', // 'loading' | 'local' | 'pending' | 'syncing' | 'synced' | 'error'
    lastSyncedAt: null,
    error: null
  };

  function getStatus() {
    return { ...syncStatus };
  }

  function setStatus(state, error = null) {
    syncStatus.state = state;
    if (error !== undefined) syncStatus.error = error;
    if (state === 'synced') syncStatus.lastSyncedAt = Date.now();
    try {
      window.dispatchEvent(new CustomEvent('cloudsyncchange', { detail: getStatus() }));
    } catch (e) {}
  }

  function initFirebase() {
    if (db) return db;
    if (typeof window.firebase === 'undefined') {
      console.warn('[CloudSync] Firebase SDK 未載入，請確認網路連線');
      return null;
    }
    try {
      const app = window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(FIREBASE_CONFIG);
      db = app.database();
      return db;
    } catch (e) {
      console.error('[CloudSync] Firebase 初始化失敗:', e);
      return null;
    }
  }

  /* 取得當前本機綁定狀態 */
  function getAccount() {
    return LS.get('db15_cloud_account', null);
  }

  /* 儲存綁定狀態 */
  function setAccount(acc) {
    if (acc) {
      LS.set('db15_cloud_account', acc);
    } else {
      localStorage.removeItem('db15_cloud_account');
    }
  }

  function isLoggedIn() {
    return !!getAccount();
  }

  /* 收集當前本機所有遊戲戰績與設定 (精準支援天梯 topclash_ladder_v5、記憶體實時名冊與 A/B 槽雙牌組) */
  function collectLocalSaveData() {
    // 1. 取得天梯完整存檔 (優先從 LadderEngine 實時記憶體取得，其次讀取 localStorage)
    let ladderData = null;
    if (typeof window !== 'undefined' && window.LadderEngine && typeof window.LadderEngine.getState === 'function') {
      try {
        ladderData = JSON.parse(JSON.stringify(window.LadderEngine.getState()));
      } catch (e) {}
    }
    if (!ladderData) {
      ladderData = LS.get('topclash_ladder_v5', null) || LS.get('topbattle_ladder_v3', null) || LS.get('db15_ladder', null);
    }

    // 2. 戰績統計與呼號影子
    const statsData = LS.get('db15_stats', { played: 0, win: 0, streak: 0, best: 0, bo3Won: 0 });
    const ghostData = LS.get('db15_player_ghost', null);

    // 3. 玩家真實呼號、軍階與國旗
    const realNickname = ladderData?.player?.name
      || ghostData?.callsign
      || (typeof localStorage !== 'undefined' && localStorage.getItem('topclash_auto_callsign'))
      || '黑貓縱深特巡連';

    const realFlag = ladderData?.player?.flag
      || ghostData?.flag
      || '🇹🇼';

    const realUid = ladderData?.player?.uid
      || (typeof localStorage !== 'undefined' && localStorage.getItem('topclash_user_uid'))
      || 'CMD-7392';

    const realRP = (ladderData && ladderData.player && typeof ladderData.player.rp === 'number')
      ? ladderData.player.rp
      : (ghostData?.rp || 0);

    return {
      stats: statsData,
      ladder: ladderData,
      playerGhost: ghostData,
      // 完整牌組與戰術教條槽位支援 (A/B 雙槽 + 啟動槽 + 自訂預設)
      deckA: LS.get('db15_deck_A', null),
      deckB: LS.get('db15_deck_B', null),
      docA: LS.get('db15_doc_A', 'strike'),
      docB: LS.get('db15_doc_B', 'defense'),
      activeSlot: LS.get('db15_active_slot', 'A'),
      customPresets: LS.get('db15_custom_presets', null),
      // 舊版單牌組相容性欄位
      deck: LS.get('db15_deck', null) || LS.get('db15_deck_A', null),
      doctrine: LS.get('db15_doctrine', null) || LS.get('db15_doc_A', 'strike'),
      // 指揮官呼號設定
      profile: {
        name: realNickname,
        flag: realFlag,
        uid: realUid
      },
      nickname: realNickname,
      flag: realFlag,
      uid: realUid,
      rp: realRP,
      theme: LS.get('db15_theme', 'dark'),
      sound: LS.get('db15_sound', true),
      version: Date.now()
    };
  }

  /* 將雲端記錄覆蓋寫入本地 localStorage 並刷新記憶體引擎 */
  function restoreSaveDataToLocal(cloudData) {
    if (!cloudData) return;
    if (cloudData.stats) LS.set('db15_stats', cloudData.stats);

    // 1. 還原天梯存檔至 topclash_ladder_v5
    if (cloudData.ladder) {
      LS.set('topclash_ladder_v5', cloudData.ladder);
      LS.set('db15_ladder', cloudData.ladder); // 向下相容
      if (typeof window !== 'undefined' && window.LadderEngine && typeof window.LadderEngine.load === 'function') {
        try { window.LadderEngine.load(); } catch (e) {}
      }
    }

    // 2. 還原呼號與 UID
    const nick = cloudData.nickname || cloudData.profile?.name;
    if (nick && typeof localStorage !== 'undefined') {
      localStorage.setItem('topclash_auto_callsign', nick);
      localStorage.setItem('topclash_callsign_set', '1');
    }
    const uid = cloudData.uid || cloudData.profile?.uid;
    if (uid && typeof localStorage !== 'undefined') {
      localStorage.setItem('topclash_user_uid', uid);
    }

    // 3. 還原牌組槽位
    if (cloudData.deckA) LS.set('db15_deck_A', cloudData.deckA);
    if (cloudData.deckB) LS.set('db15_deck_B', cloudData.deckB);
    if (cloudData.docA) LS.set('db15_doc_A', cloudData.docA);
    if (cloudData.docB) LS.set('db15_doc_B', cloudData.docB);
    if (cloudData.activeSlot) LS.set('db15_active_slot', cloudData.activeSlot);
    if (cloudData.customPresets) LS.set('db15_custom_presets', cloudData.customPresets);
    if (cloudData.deck && !cloudData.deckA) LS.set('db15_deck_A', cloudData.deck);
    if (cloudData.doctrine && !cloudData.docA) LS.set('db15_doc_A', cloudData.doctrine);

    if (cloudData.playerGhost) LS.set('db15_player_ghost', cloudData.playerGhost);
    if (cloudData.theme) LS.set('db15_theme', cloudData.theme);
    if (typeof cloudData.sound === 'boolean') LS.set('db15_sound', cloudData.sound);
  }

  /* 密碼 SHA-256 安全雜湊 (相容舊版) */
  async function hashPassword(pwd) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd + '_TOPCLASH_SALT_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* 生成隨機安全免密 Token (相容舊版) */
  function generateAuthToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function setSaveResolver(resolverFn) {
    saveResolver = resolverFn;
  }

  /* 初始化雲端驗證監聽器 */
  async function init() {
    initFirebase();
    if (typeof window.firebase !== 'undefined' && window.firebase.auth) {
      try {
        const auth = window.firebase.auth();
        auth.onAuthStateChanged(async user => {
          if (user) {
            const acc = {
              id: user.uid,
              displayId: user.displayName || user.email?.split('@')[0] || 'CMD-' + user.uid.slice(0, 6).toUpperCase(),
              email: user.email || '',
              photoURL: user.photoURL || '',
              isGoogle: true,
              boundAt: Date.now()
            };
            setAccount(acc);
            setStatus('synced');
          } else {
            const currentAcc = getAccount();
            if (currentAcc && currentAcc.isGoogle) {
              setAccount(null);
            }
            setStatus('local');
          }
        });
      } catch (e) {
        console.warn('[CloudSync] Auth state listener warning:', e);
      }
    }
    return true;
  }

  /* Google 帳號一鍵登入 / 建立存檔 */
  async function loginWithGoogle() {
    const database = initFirebase();
    if (!database || typeof window.firebase === 'undefined' || !window.firebase.auth) {
      throw new Error('Firebase 驗證服務尚未載入，請確認網路連線');
    }
    setStatus('loading');
    const provider = new window.firebase.auth.GoogleAuthProvider();
    const result = await window.firebase.auth().signInWithPopup(provider);
    const user = result.user;
    if (!user) throw new Error('登入流程已被取消或未返回使用者資訊');

    const account = {
      id: user.uid,
      displayId: user.displayName || user.email?.split('@')[0] || 'CMD-' + user.uid.slice(0, 6).toUpperCase(),
      email: user.email || '',
      isGoogle: true,
      boundAt: Date.now()
    };
    setAccount(account);

    // 檢查雲端現有存檔
    let remoteData = null;
    try {
      const snap = await database.ref(`commanders/${user.uid}`).once('value');
      if (snap.exists()) {
        remoteData = snap.val();
      }
    } catch (e) {
      console.warn('[CloudSync] 讀取遠端存檔失敗:', e);
    }

    const localData = collectLocalSaveData();
    let needsReload = false;

    if (remoteData && remoteData.saveData && typeof saveResolver === 'function') {
      const localNickname = localData.nickname || localData.profile?.name || '黑貓縱深特巡連';
      const localPlayed = localData.stats?.played || 0;
      const localRP = (localData.ladder?.player && typeof localData.ladder.player.rp === 'number')
        ? localData.ladder.player.rp
        : (typeof localData.rp === 'number' ? localData.rp : 0);

      const cloudSave = remoteData.saveData || {};
      const cloudNickname = remoteData.nickname || cloudSave.nickname || cloudSave.profile?.name || '雲端指揮官';
      const cloudPlayed = cloudSave.stats?.played ?? (typeof remoteData.played === 'number' ? remoteData.played : 0);
      const cloudRP = (cloudSave.ladder?.player && typeof cloudSave.ladder.player.rp === 'number')
        ? cloudSave.ladder.player.rp
        : (typeof remoteData.rp === 'number' ? remoteData.rp : (typeof cloudSave.rp === 'number' ? cloudSave.rp : 0));

      const choice = await saveResolver({
        isNew: false,
        canUseLocal: true,
        local: {
          nickname: localNickname,
          played: localPlayed,
          rp: localRP
        },
        cloud: {
          nickname: cloudNickname,
          played: cloudPlayed,
          rp: cloudRP
        },
        updatedAt: remoteData.updatedAt
      });

      if (choice === 'cloud') {
        restoreSaveDataToLocal(remoteData.saveData);
        needsReload = true;
      } else if (choice === 'local') {
        await syncToCloud();
      }
    } else {
      await syncToCloud();
    }

    setStatus('synced');
    return { needsReload, account };
  }

  /* 背景自動同步最新戰績至雲端 */
  async function syncToCloud(silent = false) {
    const account = getAccount();
    if (!account || !account.id) {
      setStatus('local');
      return false;
    }

    const database = initFirebase();
    if (!database) {
      setStatus('error', '雲端資料庫未連線');
      return false;
    }

    // 跨裝置驗證安全保護：優先使用本機有效快取 Token (0ms)，若寫入遭遇 PERMISSION_DENIED 則自動強制刷新重試一次
    let currentUser = null;
    if (account.isGoogle && typeof window !== 'undefined' && window.firebase && window.firebase.auth) {
      const auth = window.firebase.auth();
      currentUser = auth.currentUser;
      if (!currentUser) {
        setStatus('error', 'Google 登入已逾期，請點擊「切換帳號／比較存檔」重新連線');
        return false;
      }
      try {
        await currentUser.getIdToken(false);
      } catch (tokenErr) {
        console.warn('[CloudSync] Google 憑證檢查失敗:', tokenErr);
        setStatus('error', 'Google 授權已在其他裝置變更或逾期，請點擊「切換帳號／比較存檔」重新連線');
        return false;
      }
    }

    if (!silent) setStatus('syncing');
    const localData = collectLocalSaveData();
    const now = Date.now();
    const rp = (localData.ladder?.player && typeof localData.ladder.player.rp === 'number')
      ? localData.ladder.player.rp
      : (typeof localData.rp === 'number' ? localData.rp : 0);
    const payload = {
      id: account.id,
      displayId: account.displayId,
      email: account.email || '',
      updatedAt: now,
      nickname: localData.nickname || account.nickname || '黑貓縱深特巡連',
      flag: localData.flag || account.flag || '🇹🇼',
      rp: rp,
      played: localData.stats?.played || 0,
      win: localData.stats?.win || 0,
      saveData: localData
    };

    try {
      await database.ref(`commanders/${account.id}`).set(payload);
      setStatus('synced');
      return true;
    } catch (e) {
      const rawMsg = e?.message || '';
      if (currentUser && (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('Permission denied'))) {
        try {
          await currentUser.getIdToken(true);
          await database.ref(`commanders/${account.id}`).set(payload);
          setStatus('synced');
          return true;
        } catch (retryErr) {
          console.warn('[CloudSync] 強制刷新憑證後重試同步仍失敗:', retryErr);
          setStatus('error', 'Google 授權已在其他裝置更新或逾期，請點擊「切換帳號／比較存檔」重新連線');
          return false;
        }
      }
      console.warn('[CloudSync] 同步失敗:', e);
      let errMsg = rawMsg;
      if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('Permission denied')) {
        errMsg = 'Google 授權已在其他裝置更新或逾期，請點擊「切換帳號／比較存檔」重新連線';
      }
      setStatus('error', errMsg);
      return false;
    }
  }

  /* 節流防抖同步調度 */
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncToCloud(true);
    }, 2000);
  }

  /* 登出 / 解除本機綁定 */
  async function logout() {
    try {
      if (typeof window.firebase !== 'undefined' && window.firebase.auth) {
        await window.firebase.auth().signOut();
      }
    } catch (e) {}
    setAccount(null);
    setStatus('local');
  }

  /* 生成專屬一鍵免密書籤網址 (舊版相容) */
  function generateBookmarkUrl(id, token) {
    const acc = getAccount();
    const cid = id || acc?.id;
    const ctoken = token || acc?.authToken;
    if (!cid || !ctoken) return '';
    const cleanUrl = window.location.href.split('#')[0];
    return `${cleanUrl}#cmd=${encodeURIComponent(cid)}&token=${encodeURIComponent(ctoken)}`;
  }

  /* 註冊並綁定雲端指揮官帳號 (舊版相容) */
  async function register(id, pwd, customNickname = '') {
    if (!ID_REGEX.test(id)) throw new Error('指揮官代號必須為半形英數字 (6~20 碼)');
    if (!PWD_REGEX.test(pwd)) throw new Error('戰術密碼必須為半形英數字 (4~30 碼)');
    const database = initFirebase();
    if (!database) throw new Error('雲端資料庫尚未就緒');
    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (snap.exists()) throw new Error(`指揮官代號【${id}】已被搶先註冊！`);
    const passHash = await hashPassword(pwd);
    const authToken = generateAuthToken();
    const localData = collectLocalSaveData();
    const now = Date.now();
    const payload = {
      id: cleanId, displayId: id, passHash, authToken, createdAt: now, updatedAt: now,
      nickname: customNickname || localData.profile?.name || '特遣隊指揮官',
      flag: localData.profile?.flag || '🇹🇼', saveData: localData
    };
    await database.ref(`commanders/${cleanId}`).set(payload);
    const account = { id: cleanId, displayId: id, authToken, nickname: payload.nickname, flag: payload.flag, boundAt: now };
    setAccount(account);
    setStatus('synced');
    return { success: true, account, bookmarkUrl: generateBookmarkUrl(cleanId, authToken) };
  }

  /* 密碼登入 (舊版相容) */
  async function loginWithPassword(id, pwd) {
    if (!ID_REGEX.test(id) || !PWD_REGEX.test(pwd)) throw new Error('帳號或密碼格式不符');
    const database = initFirebase();
    if (!database) throw new Error('雲端資料庫尚未就緒');
    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (!snap.exists()) throw new Error(`找不到指揮官【${id}】的雲端記錄`);
    const cloudUser = snap.val();
    const inputHash = await hashPassword(pwd);
    if (cloudUser.passHash !== inputHash) throw new Error('戰術密碼不相符');
    let authToken = cloudUser.authToken || generateAuthToken();
    if (cloudUser.saveData) restoreSaveDataToLocal(cloudUser.saveData);
    const account = { id: cleanId, displayId: cloudUser.displayId || id, authToken, nickname: cloudUser.nickname || '特遣隊指揮官', flag: cloudUser.flag || '🇹🇼', boundAt: Date.now() };
    setAccount(account);
    setStatus('synced');
    return { success: true, account, bookmarkUrl: generateBookmarkUrl(cleanId, authToken) };
  }

  /* Token 免密碼登入 (舊版相容) */
  async function loginWithToken(id, token) {
    if (!id || !token) return false;
    const database = initFirebase();
    if (!database) return false;
    const cleanId = id.toLowerCase();
    const snap = await database.ref(`commanders/${cleanId}`).once('value');
    if (!snap.exists()) return false;
    const cloudUser = snap.val();
    if (cloudUser.authToken !== token) return false;
    if (cloudUser.saveData) restoreSaveDataToLocal(cloudUser.saveData);
    const account = { id: cleanId, displayId: cloudUser.displayId || id, authToken: token, nickname: cloudUser.nickname || '特遣隊指揮官', flag: cloudUser.flag || '🇹🇼', boundAt: Date.now() };
    setAccount(account);
    setStatus('synced');
    return { success: true, account, bookmarkUrl: generateBookmarkUrl(cleanId, token) };
  }

  return {
    validateId: id => ID_REGEX.test(id),
    validatePassword: pwd => PWD_REGEX.test(pwd),
    getStatus,
    getAccount,
    isLoggedIn,
    setSaveResolver,
    init,
    loginWithGoogle,
    syncToCloud,
    scheduleSync,
    logout,
    register,
    loginWithPassword,
    loginWithToken,
    generateBookmarkUrl
  };
})();

window.CloudSync = CloudSync;
