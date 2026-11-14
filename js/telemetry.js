'use strict';
/**
 * =====================================================
 * TopClash 全域遙測與戰情報告引擎 (Telemetry & Analytics Engine)
 * 雙軌統計架構 (Dual-Track Architecture):
 * 軌道 1 (Firebase RTDB): 全服在線人數 (Presence)、累計推演場次、總註冊指揮官數、今日戰況
 * 軌道 2 (Google Analytics 4): 專業訪客流向、留存率、自訂遊戲戰術事件 (GA4 Measurement)
 * =====================================================
 */

const Telemetry = (() => {
  const FIREBASE_CONFIG = window.TOPCLASH_FIREBASE_CONFIG;

  // 內部狀態
  let db = null;
  let isInitialized = false;
  let onlineCount = 1;
  const CACHE_KEY_GLOBAL_VISITS = 'topwarlords_cached_global_visits';
  const ADMIN_STORAGE_KEY = 'topwarlords_admin_auth';
  const ADMIN_SALT = '_C4ISR_ADMIN_SALT_2026';
  const ADMIN_HASH = '7df4073dafe01d32adc34c9036ce8ffc35f732c779f40e8d2e10794d955e88e0';

  function isAdmin() {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY) === ADMIN_HASH;
    } catch (e) {
      return false;
    }
  }

  function sha256FallbackHex(inputStr) {
    const bytes = new TextEncoder().encode(inputStr);
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const len = bytes.length;
    const bitLen = len * 8;
    const paddedLen = Math.ceil((len + 9) / 64) * 64;
    const msg = new Uint8Array(paddedLen);
    msg.set(bytes);
    msg[len] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(paddedLen - 4, bitLen >>> 0, false);
    view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);
    const w = new Int32Array(64);
    const rotr = (n, x) => (x >>> n) | (x << (32 - n));
    for (let offset = 0; offset < paddedLen; offset += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
        const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + S1 + ch + k[i] + w[i]) | 0;
        const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  async function sha256Hex(str) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      try {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { }
    }
    return sha256FallbackHex(str);
  }

  function syncAdminBadgeState() {
    const btn = document.getElementById('btnOpenTelemetry');
    if (!btn) return;
    if (isAdmin()) {
      btn.style.setProperty('cursor', 'pointer', 'important');
      btn.title = '📡 全服 C4ISR 即時戰況大盤 (管理員已解鎖 · 點擊開啟)';
    } else {
      btn.style.setProperty('cursor', 'default', 'important');
      btn.title = '全服累計到訪人次';
    }
  }

  async function verifyAndUnlockAdmin(pwd) {
    const digest = await sha256Hex(String(pwd || '').trim() + ADMIN_SALT);
    if (digest === ADMIN_HASH) {
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, ADMIN_HASH);
      } catch (e) { }
      syncAdminBadgeState();
      return true;
    }
    return false;
  }

  function lockAdmin() {
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (e) { }
    syncAdminBadgeState();
    closeTelemetryModal();
    if (typeof window.toast === 'function') {
      window.toast('🔒 已退出管理員模式並鎖定戰情大盤');
    }
  }

  function showAdminAuthModal() {
    let modal = document.getElementById('adminAuthModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'adminAuthModal';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="modal-card" style="max-width:400px;width:92%">
          <div class="cloud-modal-header" style="margin-bottom:12px">
            <div class="badge-tag" style="display:inline-block;margin-bottom:6px;font-size:11px;font-family:var(--mono);color:#f59e0b;background:rgba(245,158,11,0.12);padding:2px 8px;border-radius:4px;border:1px solid rgba(245,158,11,0.35);">🔐 DEVELOPER CLEARANCE</div>
            <h2 style="font-size:18px;margin:4px 0 6px;">C4ISR 開發者權限驗證</h2>
            <p class="muted" style="font-size:12px;line-height:1.5;">此遙測大盤與 GA4 配置僅限授權開發者存取。驗證通過後將記憶於本機瀏覽器。</p>
          </div>
          <div style="margin-bottom:10px">
            <input id="inputAdminAuthPwd" class="input" type="password" autocomplete="off" placeholder="請輸入開發者管理密碼" style="width:100%;font-family:var(--mono);font-size:14px">
            <div id="adminAuthError" style="color:#ef4444;font-size:12px;margin-top:6px;min-height:16px"></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
            <button class="btn ghost sm" id="btnAdminAuthCancel" type="button">取消</button>
            <button class="btn primary sm" id="btnAdminAuthSubmit" type="button" style="font-weight:700">🔓 驗證並解鎖</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const submitPwd = async () => {
        const input = document.getElementById('inputAdminAuthPwd');
        const errEl = document.getElementById('adminAuthError');
        if (!input) return;
        const ok = await verifyAndUnlockAdmin(input.value);
        if (ok) {
          if (errEl) errEl.textContent = '';
          input.value = '';
          modal.hidden = true;
          if (typeof window.toast === 'function') {
            window.toast('🔓 管理員模式已解鎖！本機瀏覽器已記住權限。');
          }
          openTelemetryModal();
        } else {
          if (errEl) errEl.textContent = '⚠️ 管理員密碼錯誤，權限驗證失敗。';
          input.select();
        }
      };

      modal.addEventListener('click', ev => {
        if (ev.target === modal || ev.target.closest('#btnAdminAuthCancel')) {
          modal.hidden = true;
          return;
        }
        if (ev.target.closest('#btnAdminAuthSubmit')) {
          submitPwd();
        }
      });

      const pwdInput = modal.querySelector('#inputAdminAuthPwd');
      if (pwdInput) {
        pwdInput.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            submitPwd();
          } else if (ev.key === 'Escape') {
            modal.hidden = true;
          }
        });
      }
    }

    const inputEl = document.getElementById('inputAdminAuthPwd');
    const errEl = document.getElementById('adminAuthError');
    if (errEl) errEl.textContent = '';
    if (inputEl) inputEl.value = '';
    modal.hidden = false;
    setTimeout(() => { if (inputEl) inputEl.focus(); }, 30);
  }

  function checkUrlAdminTrigger() {
    try {
      const url = new URL(window.location.href);
      const qAdmin = url.searchParams.get('admin');
      const hashMatch = /(?:^|[#&])admin=1(?:&|$)/.test(url.hash || '');
      if (qAdmin === '1' || hashMatch) {
        url.searchParams.delete('admin');
        if (hashMatch) {
          let cleanHash = (url.hash || '')
            .replace(/([#&])admin=1(?=&|$)/g, '$1')
            .replace(/[&#]+$/, '')
            .replace(/^#&/, '#');
          if (cleanHash === '#') cleanHash = '';
          url.hash = cleanHash;
        }
        const cleanUrl = url.pathname + url.search + url.hash;
        window.history.replaceState({}, document.title, cleanUrl || '/');

        if (isAdmin()) {
          setTimeout(() => openTelemetryModal(), 60);
        } else {
          setTimeout(() => showAdminAuthModal(), 60);
        }
      }
    } catch (e) { }
  }

  // 取得快取的全服人次，預設保底 1002，絕不使用本機單次計數 (如 4)
  function getCachedGlobalVisits() {
    try {
      const cached = parseInt(localStorage.getItem(CACHE_KEY_GLOBAL_VISITS) || '1002', 10);
      return Math.max(1002, isNaN(cached) ? 1002 : cached);
    } catch (e) {
      return 1002;
    }
  }

  let totalBattles = 0;
  let totalPlayers = 0;
  let todayBattles = 0;
  let totalVisits = getCachedGlobalVisits();
  let todayVisits = 1;
  let myPresenceRef = null;
  let mySessionId = 'wl_' + Math.random().toString(36).substring(2, 10);

  // 取得或生成不變的本機玩家 UID (與 LadderEngine 共用 32 字元無混淆字元集)
  function getMyUid() {
    let uid = localStorage.getItem('topwarlords_user_uid');
    if (!uid) {
      if (typeof LadderEngine !== 'undefined' && typeof LadderEngine.generateCommanderUID === 'function') {
        uid = LadderEngine.generateCommanderUID();
      } else {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        uid = `CMD-${code}`;
      }
      localStorage.setItem('topwarlords_user_uid', uid);
    }
    return uid;
  }

  function getMyCallsign() {
    return localStorage.getItem('topwarlords_auto_callsign') || '無名大將';
  }

  function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  // 初始化 Firebase Realtime Database
  function initFirebase() {
    if (db) return db;
    if (typeof window.firebase === 'undefined') {
      console.warn('[Telemetry] Firebase SDK 尚未載入，離線靜態降級');
      return null;
    }
    try {
      const app = window.firebase.apps.length
        ? window.firebase.apps[0]
        : window.firebase.initializeApp(FIREBASE_CONFIG);
      db = app.database();
      return db;
    } catch (e) {
      console.warn('[Telemetry] Firebase 初始化異常:', e);
      return null;
    }
  }

  // 初始化軌道 2：Google Analytics 4 (GA4) 動態載入器
  function initGA4() {
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function () { window.dataLayer.push(arguments); };
      }
      window.gtag('js', new Date());

      // 讀取站長設定的 GA4 ID (優先: localStorage -> window.TOPWARLORDS_GA_ID -> 預設)
      const gaId = localStorage.getItem('topwarlords_ga_id') || window.TOPWARLORDS_GA_ID;
      if (gaId && gaId.startsWith('G-')) {
        loadGAScript(gaId);
      }
    } catch (e) {
      console.warn('[Telemetry] GA4 初始化略過:', e);
    }
  }

  function loadGAScript(measurementId) {
    if (!measurementId || !measurementId.startsWith('G-')) return;
    if (document.querySelector(`script[src*="${measurementId}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.gtag('config', measurementId, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });
    console.log('[Telemetry] GA4 測量服務已啟動:', measurementId);
  }

  // 設置自訂 GA4 評估 ID
  function setGA4MeasurementId(newId) {
    const cleanId = (newId || '').trim();
    if (cleanId && !cleanId.startsWith('G-')) {
      throw new Error('GA4 評估 ID 格式必須以 "G-" 開頭（例如：G-ABC123XYZ）');
    }
    if (cleanId) {
      localStorage.setItem('topwarlords_ga_id', cleanId);
      loadGAScript(cleanId);
    } else {
      localStorage.removeItem('topwarlords_ga_id');
    }
    return true;
  }

  function getGA4MeasurementId() {
    return localStorage.getItem('topwarlords_ga_id') || window.TOPWARLORDS_GA_ID || '';
  }

  // 觸發自訂事件 (同時派發至 GA4 與自訂監聽)
  function trackEvent(eventName, params = {}) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      }
      // 派發自訂 DOM 事件方便內部除錯或擴充
      window.dispatchEvent(new CustomEvent('topwarlords:telemetry', { detail: { eventName, params } }));
    } catch (e) {
      // 靜默防止阻斷遊戲
    }
  }

  // 初始化遙測系統
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // 每次瀏覽器工作階段 (Session) 到訪計數 +1 (本機保底 + 雲端同步)
    const sessionVisited = sessionStorage.getItem('topwarlords_session_visit_counted');
    if (!sessionVisited) {
      const localV = Math.max(0, parseInt(localStorage.getItem('topwarlords_local_visits') || '0', 10)) + 1;
      localStorage.setItem('topwarlords_local_visits', String(localV));
      totalVisits += 1;
      try {
        localStorage.setItem(CACHE_KEY_GLOBAL_VISITS, String(totalVisits));
      } catch (e) { }
    }

    // 綁定 UI 點擊事件與管理員暗號檢查
    setupUIEvents();
    syncAdminBadgeState();
    checkUrlAdminTrigger();
    initGA4();

    const database = initFirebase();
    if (!database) {
      sessionStorage.setItem('topwarlords_session_visit_counted', '1');
      updateUI();
      return;
    }

    const uid = getMyUid();
    const callsign = getMyCallsign();
    const todayKey = getTodayKey();

    // 0. 網站到訪人次累計 (Total & Daily Site Visits - 隔離於 warlords 子空間)
    if (!sessionVisited) {
      sessionStorage.setItem('topwarlords_session_visit_counted', '1');
      database.ref('global_stats/warlords/summary/total_visits').transaction(c => (c || 0) + 1).then(res => {
        if (res && res.committed && res.snapshot) {
          const cloudV = res.snapshot.val();
          if (cloudV && cloudV > totalVisits) {
            totalVisits = cloudV;
            try {
              localStorage.setItem(CACHE_KEY_GLOBAL_VISITS, String(totalVisits));
            } catch (e) { }
            updateUI();
          }
        }
      }).catch(() => { });
      database.ref(`global_stats/warlords/daily/${todayKey}/visits`).transaction(c => (c || 0) + 1).catch(() => { });
    }

    // 1. 在線狀態管理 (Online Presence - 隔離於 warlords 子空間)
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', snap => {
      if (snap.val() === true) {
        myPresenceRef = database.ref(`global_stats/warlords/presence/${mySessionId}`);
        myPresenceRef.onDisconnect().remove();
        myPresenceRef.set({
          gameId: 'topwarlords',
          uid: uid,
          callsign: callsign,
          time: window.firebase.database.ServerValue.TIMESTAMP
        });
      }
    });

    // 監聽全服在線人數 (僅納入本作在線工作階段)
    database.ref('global_stats/warlords/presence').on('value', snap => {
      const val = snap.val() || {};
      const activeCount = Object.entries(val).filter(([k, v]) => {
        if (k.startsWith('tc_') || k.startsWith('TC_')) return false;
        if (v && v.gameId && v.gameId !== 'topwarlords') return false;
        return true;
      }).length;
      onlineCount = Math.max(1, activeCount);
      updateUI();
    });

    // 2. 指揮官累計登記統計 (去重計數)
    const hasRegistered = localStorage.getItem('topwarlords_telemetry_registered');
    if (!hasRegistered) {
      const playerRef = database.ref(`global_stats/warlords/players/${uid}`);
      playerRef.once('value').then(pSnap => {
        if (!pSnap.exists()) {
          playerRef.set({
            joinedAt: window.firebase.database.ServerValue.TIMESTAMP,
            callsign: callsign,
            lastActive: window.firebase.database.ServerValue.TIMESTAMP
          });
          database.ref('global_stats/warlords/summary/total_players').transaction(c => (c || 0) + 1);
        }
        localStorage.setItem('topwarlords_telemetry_registered', '1');
      }).catch(() => { });
    } else {
      // 每日更新最後活躍時間
      database.ref(`global_stats/warlords/players/${uid}/lastActive`).set(window.firebase.database.ServerValue.TIMESTAMP).catch(() => { });
    }

    // 3. 監聽全域到訪總人次、推演總局數與部隊總數
    database.ref('global_stats/warlords/summary').on('value', snap => {
      const val = snap.val() || {};
      totalBattles = val.total_battles || 0;
      totalPlayers = val.total_players || 0;
      const cloudV = val.total_visits || 0;
      totalVisits = Math.max(cloudV, totalPlayers, onlineCount, totalVisits, 1002);
      try {
        localStorage.setItem(CACHE_KEY_GLOBAL_VISITS, String(totalVisits));
      } catch (e) { }
      updateUI();
    });

    // 4. 監聽今日全服對戰局數與今日到訪人次
    database.ref(`global_stats/warlords/daily/${todayKey}`).on('value', snap => {
      const val = snap.val() || {};
      todayBattles = typeof val === 'object' ? (val.battles || 0) : 0;
      todayVisits = typeof val === 'object' ? Math.max(val.visits || 0, 1) : 1;
      updateUI();
    });

    updateUI();
  }

  // 記錄對戰結束數據
  function recordBattle(data = {}) {
    const { mode = 'quick', won = false, draw = false, turns = 0, flagshipId = null } = data;

    // 軌道 2：GA4 事件上報
    trackEvent('battle_finish', {
      mode: mode,
      result: won ? 'victory' : (draw ? 'draw' : 'defeat'),
      turns: turns,
      flagship: flagshipId || 'unknown'
    });

    // 軌道 1：Firebase 原子計數自增 (隔離於 warlords 子空間)
    if (!db) return;

    try {
      // 1. 全服累計局數 +1
      db.ref('global_stats/warlords/summary/total_battles').transaction(c => (c || 0) + 1);

      // 2. 今日全服局數 +1
      const today = getTodayKey();
      db.ref(`global_stats/warlords/daily/${today}/battles`).transaction(c => (c || 0) + 1);

      // 3. 今日特定模式局數 +1
      if (mode) {
        db.ref(`global_stats/warlords/daily/${today}/modes/${mode}`).transaction(c => (c || 0) + 1);
      }

      // 4. 旗艦軍武出戰熱度計數 (僅記錄本專案合法名將 ID)
      if (flagshipId && (typeof UNIT_MAP === 'undefined' || UNIT_MAP[flagshipId])) {
        db.ref(`global_stats/warlords/summary/flagships/${flagshipId}`).transaction(c => (c || 0) + 1);
      }
    } catch (e) {
      console.warn('[Telemetry] 戰果回傳異常 (靜默處理):', e);
    }
  }

  // 更新介面上的戰情數字
  function updateUI() {
    const visitsEl = document.getElementById('telemetryVisitsVal');
    const onlineEl = document.getElementById('telemetryOnlineVal');
    const battlesEl = document.getElementById('telemetryBattlesVal');
    if (visitsEl) {
      const formatted = totalVisits.toLocaleString();
      if (visitsEl.textContent !== formatted) {
        visitsEl.textContent = formatted;
      }
    }
    if (onlineEl) onlineEl.textContent = onlineCount.toLocaleString();
    if (battlesEl) battlesEl.textContent = totalBattles > 0 ? totalBattles.toLocaleString() : '--';

    // 更新彈窗內的數字（點選膠囊展開時顯示：在線人數、全服對戰幾局、到訪人次、今日戰況等）
    const mOnline = document.getElementById('modalTelOnline');
    const mBattles = document.getElementById('modalTelBattles');
    const mVisits = document.getElementById('modalTelVisits');
    const mTodayVisits = document.getElementById('modalTelTodayVisits');
    const mPlayers = document.getElementById('modalTelPlayers');
    const mToday = document.getElementById('modalTelToday');

    if (mOnline) mOnline.textContent = onlineCount.toLocaleString();
    if (mBattles) mBattles.textContent = totalBattles.toLocaleString();
    if (mVisits) mVisits.textContent = totalVisits.toLocaleString();
    if (mTodayVisits) mTodayVisits.textContent = todayVisits.toLocaleString();
    if (mPlayers) mPlayers.textContent = Math.max(totalPlayers, 1).toLocaleString();
    if (mToday) mToday.textContent = todayBattles.toLocaleString();
    syncAdminBadgeState();
  }

  // 開啟全域戰情大盤彈窗（僅限已解鎖管理員）
  function openTelemetryModal() {
    if (!isAdmin()) return;
    const modal = document.getElementById('globalTelemetryModal');
    if (!modal) return;

    // 填入最新資料
    updateUI();

    const inputGA = document.getElementById('inputGA4MeasurementId');
    if (inputGA) {
      inputGA.value = getGA4MeasurementId();
    }

    modal.hidden = false;
  }

  function closeTelemetryModal() {
    const modal = document.getElementById('globalTelemetryModal');
    if (modal) modal.hidden = true;
  }

  function setupUIEvents() {
    document.addEventListener('click', e => {
      if (e.target.closest('#btnOpenTelemetry') || e.target.closest('#hudGlobalTelemetry')) {
        if (!isAdmin()) return;
        openTelemetryModal();
        return;
      }
      if (e.target.closest('#btnLockTelemetryAdmin')) {
        lockAdmin();
        return;
      }
      if (e.target.closest('#btnCloseTelemetryModal') || e.target.closest('#btnCancelTelemetry')) {
        closeTelemetryModal();
        return;
      }
      if (e.target.closest('#btnSaveGA4')) {
        const input = document.getElementById('inputGA4MeasurementId');
        if (!input) return;
        try {
          setGA4MeasurementId(input.value);
          if (typeof window.toast === 'function') {
            window.toast(input.value.trim() ? `✅ 已儲存 GA4 評估代碼【${input.value.trim()}】，立即生效！` : 'ℹ️ 已清除自訂 GA4 代碼');
          }
          closeTelemetryModal();
        } catch (err) {
          if (typeof window.toast === 'function') {
            window.toast(`⚠️ ${err.message}`);
          } else {
            alert(err.message);
          }
        }
      }
      if (e.target.closest('#btnTestGAEvent')) {
        trackEvent('c4isr_ping', { time: Date.now() });
        if (typeof window.toast === 'function') {
          window.toast('📡 已向 GA4 派發測試事件【c4isr_ping】！請在 GA4 即時報表中查看。');
        }
      }
    });
  }

  return {
    init,
    recordBattle,
    trackEvent,
    getStats: () => ({ onlineCount, totalBattles, totalPlayers, todayBattles, totalVisits, todayVisits }),
    openTelemetryModal,
    closeTelemetryModal,
    isAdmin,
    lockAdmin,
    verifyAndUnlockAdmin,
    setGA4MeasurementId,
    getGA4MeasurementId
  };
})();

// 自動掛載至全域
if (typeof window !== 'undefined') {
  window.Telemetry = Telemetry;
}
