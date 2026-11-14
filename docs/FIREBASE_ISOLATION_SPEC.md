# TopWarlords 跨專案 Firebase 與本機儲存隔離設計規格

**版本**：`v7.10.10`  
**適用專案**：頂尖對戰：15元名將聯合作戰 (`TopWarlords`，`gameId: 'topwarlords'`)  
**共用資料庫**：Firebase Realtime Database (`top-game-913c0-default-rtdb`)

---

## 1. 背景與架構選型（方案 A + B 混合架構）

`TopWarlords`（古代名將版）與前作 `TopClash`（現代軍武版）共用同一個 Firebase Realtime Database 實例，且可能部署於同一 GitHub Pages 網域（`https://<user>.github.io/<repo>`，同源共用瀏覽器 `localStorage` / `sessionStorage`）。

實測該 RTDB Security Rules 僅開放既定 6 個頂層節點（`commanders`、`tournaments`、`pvp_rooms`、`ladder_ghosts`、`global_stats`、`global_presence`），直接對新增根節點（例如 `/warlords`）寫入會觸發 `HTTP 401 Permission denied`。因此在不更動 Firebase Console Rules 的前提下，採用**「既定節點內子命名空間 + 鍵名前綴 + `gameId` 雙向防衛 + 同源儲存鍵名分離」**（方案 A + B 混合架構），確保與姊妹作 **100% 互不覆蓋、互不混房、互不污染天梯與統計**。

---

## 2. 全模組隔離對應矩陣

| 頂層節點 / 儲存層 | 負責模組 | TopWarlords（名將版）寫入規格 | 跨專案讀取／寫入隔離防衛 |
| :--- | :--- | :--- | :--- |
| **`commanders/${uid}/warlords`** | [js/cloud-sync.js](../js/cloud-sync.js) | 主讀寫 `commanders/${uid}/warlords`，並鏡像備份於 `global_stats/warlords/commanders/${uid}`；帶 `gameId: 'topwarlords'` 與獨立密碼鹽 `_TOPWARLORDS_SALT_2026` | 絕不覆寫 `commanders/${uid}` 根物件；`collectLocalSaveData()` 攜帶 `gameId`，`restoreSaveDataToLocal()` 拒絕 `gameId !== 'topwarlords'` 存檔；帳號快取鍵使用 `wl15_cloud_account`。 |
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

