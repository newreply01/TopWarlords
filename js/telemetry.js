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

    // 綁定 UI 點擊事件（無論離線或連線皆可開啟戰情大盤）
    setupUIEvents();
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
  }

  // 開啟全域戰情大盤彈窗
  function openTelemetryModal() {
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
        openTelemetryModal();
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
    setGA4MeasurementId,
    getGA4MeasurementId
  };
})();

// 自動掛載至全域
if (typeof window !== 'undefined') {
  window.Telemetry = Telemetry;
}
