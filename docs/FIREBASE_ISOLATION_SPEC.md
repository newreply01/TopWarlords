# TopWarlords 跨專案 Firebase 與本機儲存隔離設計規格

**版本**：`v7.12.0`  
**適用專案**：頂尖對戰：15元名將聯合作戰 (`TopWarlords`，`gameId: 'topwarlords'`)  
**共用資料庫**：Firebase Realtime Database (`top-game-913c0-default-rtdb`)

---

## 0. v7.12.0 安全與管理員驗證強化

- **遙測管理員驗證改為記憶體態＋工作階段權杖**：[js/telemetry.js](../js/telemetry.js) 不再將 `ADMIN_HASH` 長期寫入 `localStorage`（並自動清除舊鍵 `wl15_telemetry_admin_v1`），改以 `sessionStorage` 儲存 `ADMIN_SESSION_TOKEN_KEY`（`wl15_telemetry_admin_session_v1`）並搭配執行期記憶體旗標 `adminUnlockedInMemory` 與隨機種子 `SESSION_NONCE`，關閉分頁即自動登出。
- **CSP 與連線白名單**：[vercel.json](../vercel.json) 新增完整 `Content-Security-Policy` 標頭，限制 `script-src`、`connect-src`（僅允許 Firebase RTDB / PeerJS / Google Analytics / 本域）與 `frame-ancestors 'none'`，並將專案 `name` 正名為 `topwarlords`。
- **建議 RTDB Security Rules 加固**：於 Firebase Console 針對 `global_stats/warlords/summary`、`players` 建議限制欄位型別與非負整數範圍；對 `pvp_rooms/WL_*` 限制寫入內容大小與必須攜帶 `gameId === 'topwarlords'`。

## 0-1. v7.15.7 存檔隱私修正（停止公開鏡像備份）

- **問題**：舊版 `writeCommanderCloudRecord()` 會把完整存檔（含 Google 帳號 email；舊版代號帳號另含 `passHash`、`authToken`）同時寫入 `global_stats/warlords/commanders/${uid}`，而 `global_stats` 為公開統計區，任何人皆可讀取。私有節點寫入失敗時更會只寫公開路徑。
- **修正**：存檔只寫入私有節點 `commanders/${uid}/warlords`，失敗即回報錯誤、不再退回公開路徑；上傳與讀回的紀錄一律剔除 `email`；同步成功後刪除本人在 `global_stats/warlords/commanders/${uid}` 的舊副本；舊版代號帳號（無 Firebase 登入身分）停止雲端同步。
- **仍需在 Firebase Console 處理**：
  1. 清除既有的公開副本：未再登入同步的玩家，其舊副本仍留在 `global_stats/warlords/commanders`，需以管理員權限刪除整個節點（存檔已在私有節點者不受影響；僅存在於公開副本的舊版代號帳號會失去雲端備份）。
  2. Security Rules 建議：`global_stats/warlords/commanders` 設為 `".read": false`，`$uid` 子節點僅允許 `".write": "auth != null && auth.uid === $uid"` 且只允許刪除（`!newData.exists()`），遷移期結束後整段改為 `".write": false`。
  3. 確認 `commanders/$uid` 規則為 `".read"/".write": "auth != null && auth.uid === $uid"`。
- **測試**：`test/test_cloud_sync_privacy.js`（已納入 CI）。

---

## 1. 背景與架構選型（方案 A + B 混合架構）

`TopWarlords`（古代名將版）與前作 `TopClash`（現代軍武版）共用同一個 Firebase Realtime Database 實例，且可能部署於同一 GitHub Pages 網域（`https://<user>.github.io/<repo>`，同源共用瀏覽器 `localStorage` / `sessionStorage`）。

實測該 RTDB Security Rules 僅開放既定 6 個頂層節點（`commanders`、`tournaments`、`pvp_rooms`、`ladder_ghosts`、`global_stats`、`global_presence`），直接對新增根節點（例如 `/warlords`）寫入會觸發 `HTTP 401 Permission denied`。因此在不更動 Firebase Console Rules 的前提下，採用**「既定節點內子命名空間 + 鍵名前綴 + `gameId` 雙向防衛 + 同源儲存鍵名分離」**（方案 A + B 混合架構），確保與姊妹作 **100% 互不覆蓋、互不混房、互不污染天梯與統計**。

---

## 2. 全模組隔離對應矩陣

| 頂層節點 / 儲存層 | 負責模組 | TopWarlords（名將版）寫入規格 | 跨專案讀取／寫入隔離防衛 |
| :--- | :--- | :--- | :--- |
| **`commanders/${uid}/warlords`** | [js/cloud-sync.js](../js/cloud-sync.js) | **僅**讀寫私有節點 `commanders/${uid}/warlords`（v7.15.7 起不再鏡像備份至公開統計區）；帶 `gameId: 'topwarlords'` 與獨立密碼鹽 `_TOPWARLORDS_SALT_2026`；上傳內容不含 email | 絕不覆寫 `commanders/${uid}` 根物件；`collectLocalSaveData()` 攜帶 `gameId`，`restoreSaveDataToLocal()` 拒絕 `gameId !== 'topwarlords'` 存檔；帳號快取鍵使用 `wl15_cloud_account`。舊版 `global_stats/warlords/commanders/${uid}` 僅供讀取遷移，玩家同步成功後自動刪除本人副本。 |
| **LocalStorage / SessionStorage** | 全域瀏覽器儲存 | 僅讀寫 `wl15_*`、`topwarlords_*` 命名空間（唯讀向下相容 `topwarlords_ladder_v1`） | 全面清除誤植的 `db15_*`、`topclash_*`、`topbattle_*` 鍵名，與 `TopClash` 在同網域（如 `*.github.io`）下完全隔離。 |
| **`tournaments/WL_${code}`** | [js/firebase-tourney.js](../js/firebase-tourney.js) | RTDB 鍵名統一加上 `WL_` 前綴，UI 顯示維持 6 碼；`roomPayload` 帶入 `gameId: 'topwarlords'` | `listenPublicRooms()`、`quickMatch()` 配合索引 `.orderByChild('status').equalTo('waiting').limitToLast(30)` 並過濾 `TC_` 與異專案 `gameId`；`joinRoom()` 主動阻擋 `TC_` 前綴或異專案 `gameId`。 |
| **`pvp_rooms/WL_${code}` & PeerJS** | [js/online-pvp.js](../js/online-pvp.js) | PeerJS `ROOM_PREFIX = 'TOPWARLORDS-BO5-'`；中繼路徑 `pvp_rooms/WL_${code}` 帶 `gameId: 'topwarlords'` | `attachFirebaseRelay()` 與 `joinRoom()` 主動攔截 `TC_` / `TOPCLASH-BO5-` 代碼；所有 `HANDSHAKE` 必帶 `gameId: 'topwarlords'`，`handleIncomingPacket()` 發現不符立即斷線並提示錯誤。 |
| **`global_stats/warlords/ladder_ghosts/${key}`** | [js/ladder.js](../js/ladder.js) | 主讀寫 `global_stats/warlords/ladder_ghosts/${key}`，雙寫鏡像 `ladder_ghosts/WL_${key}`；寫入 `gameId: 'topwarlords'` 與 `rp: state.player.rp ?? 0` | `pushDefenseFleetToCloud()` 阻擋 `TC_` 鍵名並以空值合併保留 0 RP；`syncCloudGhosts()` 跳過 `TC_` 與異專案 `gameId`，並透過 `validateDeck(g.deck)` 驗證名將合法性與預算。 |
| **`global_stats/warlords/*`** | [js/telemetry.js](../js/telemetry.js) | 在線節點 `global_stats/warlords/presence/wl_*`、總覽 `global_stats/warlords/summary`、日統計 `daily`、名冊 `players`、事件 `topwarlords:telemetry` | 在線統計濾除 `tc_` / `TC_` 與異專案 `gameId`；`recordBattle()` 僅允許通過 `UNIT_MAP[flagshipId]` 驗證的本專案名將 ID 寫入 `flagships`。 |

---

## 3. 後續第 N 個姊妹專案擴充範本

未來若有第 3 款以上作品共用同一 Firebase RTDB 與 GitHub Pages 網域，開案時即需先保留獨立識別組，再依全域規則 `C:\Users\MM\.gemini\GEMINI.md` 與技能 `shared-firebase-isolation` 實作：

| 專案識別項目 | TopClash (現代軍武) | TopWarlords (古代名將) | 新專案範本 (`<newgame>`) |
| :--- | :--- | :--- | :--- |
| **`gameId`** | `'topclash'` | `'topwarlords'` | `'<newgame>'` |
| **鍵名前綴 (`<PREFIX>_`)** | `TC_` | `WL_` | `<XX>_`（兩碼大寫＋底線） |
| **PeerJS 前綴** | `TOPCLASH-BO5-` | `TOPWARLORDS-BO5-` | `<NEWGAME>-BO5-` |
| **本機儲存前綴** | `db15_*`, `topclash_*` | `wl15_*`, `topwarlords_*` | `<xx>15_*`, `<newgame>_*` |
| **雲端存檔與統計子樹** | `commanders/${uid}` (`.update()`) / `global_stats/summary` | `commanders/${uid}/warlords` / `global_stats/warlords/*` | `commanders/${uid}/<newslug>` / `global_stats/<newslug>/*` |

---

## 4. 驗證方式

1. 執行專案四大自動化測試套件（`test_warlords_engine.py`、`test_armory.py`、`test_full_gameplay.py`、`test_3d_battlefield.py`），確認端對端渲染、天梯載入與 3D 推演零回歸錯誤。
2. 參考全域技能 `~/.gemini/config/skills/shared-firebase-isolation/SKILL.md` 之跨專案檢查表，確認無任何 `db15_*` / `topclash_*` 殘留、0 RP 未被預設值覆寫、且跨專案房間／幽靈／握手封包均遭主動攔截。

