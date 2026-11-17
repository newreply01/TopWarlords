# 無雙式武將大招演出：實作任務書（Level 1 + Level 2）

> 給實作模型的交接文件。請**依序**完成 Phase 0 → Phase 5，每個 Phase 結束時自行驗收並 commit。
> 專案根目錄：`D:\TopWarlords`（GitHub `newreply01/TopWarlords`，分支 `main`）。
> 已定案的決策：**走 Level 1（切入演出）+ Level 2（招牌 3D 特效）**；**切入演出採完整版 1.5 秒**；招式名以本文件 §7 為準（不得自行改名）。

---

## 0. 必讀：專案規則（違反即視為未完成）

1. **快取版本**：`sw.js` 的 `caches.match(req, { ignoreSearch: false })` 是嚴格比對 `?v=`。任何 JS/CSS/圖檔變更都必須：
   - 將 `sw.js` 第 1 行 `APP_VERSION` 遞增（目前 `7.11.68`，依序 `7.11.69`、`7.11.70`…）。
   - 將 `index.html` 內**全部** `?v=舊版本` 一次替換為新版本（目前共 20 處；新增 script 後數量會增加，替換前先計數）。
   - 新增的 JS 檔要同時加入 `index.html` 的 `<script defer src="...?v=版本">` 與 `sw.js` 的 `CORE_ASSETS`。
2. **本機儲存鍵名前綴**：只能用 `wl15_` 或 `topwarlords_` 前綴（例如 `wl15_musou_mode`）。禁止使用無前綴的鍵名。
3. **深淺雙主題**：主題由 `document.documentElement.getAttribute('data-theme') === 'light'` 判斷。浮在戰場上的橫幅與切入畫面在**淺色模式**必須改用 **99% 不透明的深色 HUD 實底**（`rgba(15,23,42,0.99)` 漸層到 `rgba(69,26,3,0.99)`）、純白主文字 `#ffffff`、文字陰影 `0 1px 3px rgba(0,0,0,0.7)`、琥珀金邊框。**不可**在淺色模式使用半透明或白色卡片。
4. **防碰撞**：切入畫面不可遮住階段燈號、天候徽章與錄影計時列（`#holoRadarStrip`、`.log-header-hud`）；點擊跳過、按下 `#btnSkip`、離開戰鬥時必須**同步清除**所有切入 DOM 與 3D 特效。
5. **Python**：需要處理影像時使用 `D:\Python\Python310\python.exe`（已安裝 Pillow）。本機**沒有** Node.js。
6. 每個 Phase 完成後：遞增版本 → `git -C D:\TopWarlords add <檔案>` → `commit` → `push origin main`。

---

## 1. 現況程式碼地圖（請先讀過這些位置）

| 用途 | 檔案與位置 |
|---|---|
| 8 種特效原型定義 | `js/data.js` 約 L581 `SKILL_FX_ARCHETYPES` |
| 武將 → 特效原型對照 | `js/data.js` 約 L592 `UNIT_SKILL_FX`、L636 `resolveSkillFx()` |
| 武將技能名稱／階段 | `js/data.js` 約 L304 `UNIT_SKILLS` |
| 武將頭像路徑 | `js/data.js` `UNIT_META[UID].img`（`assets/warlords/<UID>.jpg?v=...`，384×384 Q 版） |
| WebGL Renderer 建立 | `js/battle-3d.js` 約 L482；低效能裝置判斷 L473 / L486 `isLowPowerDevice` |
| 戰鬥時鐘／頓幀 | `js/battle-3d.js` L68 `combatNow()`、L106 `hitStopUntil` |
| 鏡頭震動 | `js/battle-3d.js` L114 `cameraShakeEnabled`、L4157 `triggerCameraShake(power)` |
| 特效配色表 | `js/battle-3d.js` L3066 `VFX_PALETTES` |
| 程序化特效貼圖 | `js/battle-3d.js` L3077 `getSkillVfxTexture(kind)` |
| 戰法名號卷軸 | `js/battle-3d.js` L3588 `spawnSkillScrollBanner()` |
| **大招特效主函式** | `js/battle-3d.js` L3663 `performWarlordSkillVfx(aToken, tToken, fxKey, ln, isUltimate)`；粒子上限 L3675 `particleSystems.length >= 210` |
| 大招觸發點（3 處） | `js/battle-3d.js` L2497、L2610、L2616 |
| 清除戰場特效 | `js/battle-3d.js` L5267 `clearBattleEffects()` |
| 主題判斷範例 | `js/battle-3d.js` L4096 |
| 播放流程／跳過／速度 | `js/app.js` L140（`speed`、`skip`、`paused`）、L375、L4814、L5022 |
| Three.js 版本 | `js/libs/three.min.js`（推測為 **r128**，Phase 3 開始前請先確認 `THREE.REVISION`） |

> 行號是 `v7.11.68` 的位置，若有偏移請用搜尋函式名稱定位。

---

## Phase 0｜資料層：無雙招式表

**新增檔案** `js/musou-data.js`（在 `data.js` 之後、`battle-3d.js` 之前載入）：

```js
'use strict';
/* 無雙招式表：name=招式名（主標）、tag=副標（典故四字）、sig=Level 2 招牌特效 key（null 表示沿用原型特效） */
const MUSOU_MOVES = {
  LUBU: { name: '天下無雙・方天畫戟', tag: '人中呂布', sig: 'lubu_sky_halberd' },
  // ……依 §7 完整填入 125 位
};
function getMusouMove(uid) { return MUSOU_MOVES[uid] || null; }
```

**驗收**
- [ ] 125 位武將全部有 `name` 與 `tag`；`$5`、`$4` 共 50 位有 `sig`，其餘為 `null`。
- [ ] 用 Python 驗證：`RAW_UNITS` 的 UID 集合 == `MUSOU_MOVES` 的鍵集合（不可多也不可少）。
- [ ] 已加入 `index.html` script 與 `sw.js` `CORE_ASSETS`。

---

## Phase 1｜Level 1：1.5 秒切入演出（全 125 位）

**新增檔案** `js/musou-cutin.js`、在 `style.css` 新增 `.musou-cutin*` 樣式。

### 1.1 API

```js
// 回傳 Promise，演出結束（或被跳過）時 resolve
window.MusouCutin = {
  play({ uid, side, fxKey }) {},   // side: 'A'（我方，從左進場）或 'B'（敵方，從右進場）
  clearAll() {},                   // 立即移除所有切入 DOM、取消計時器
  isPlaying() {}
};
```

### 1.2 時間軸（速度 1× 時總長 **1500 ms**）

| 時間 | 演出內容 |
|---|---|
| 0–150 ms | 戰場暗角由 0 漸變到 0.7；戰鬥時鐘放慢（見 1.4）；白色閃光 1 幀 |
| 100–400 ms | 斜切色帶（約 -12° 斜角）從施放方那一側滑入，底色使用 `VFX_PALETTES[fxKey]` 的 `dark → primary` 漸層，`border` 色描邊；同時出現放射狀速度線（CSS `repeating-conic-gradient` 或 Canvas） |
| 250–550 ms | Q 版頭像（`UNIT_META[uid].img`）以 1.15 → 1.0 回彈縮放滑入，外框金色描邊＋外發光；國旗 emoji 小徽章 |
| 450–1100 ms | 招式名主標**逐字**浮現（每字間隔 60 ms，從 1.4 倍縮到 1 倍，書法襯線字體沿用 `style.css` 既有的標題字體）；字後蓋上**紅色印章**（內含原型 icon，如 🔥⚡☯️）；副標顯示「武將名・tag」 |
| 1100–1500 ms | 色帶與頭像以斜向擦除退場、閃光一次 → 回傳 resolve，接著觸發 3D 特效與鏡頭震動 |

### 1.3 版面
- 覆蓋層掛在 3D 戰場容器上（不要蓋住整個頁面），`pointer-events: none`，但整個覆蓋層可點擊以跳過（點擊時呼叫 `clearAll()` 並 resolve）。
- 桌機：色帶高度約為戰場高度的 34%，垂直置中偏上；頭像大小 180–220 px。
- 手機（寬度 < 720）：色帶高度約 28%，頭像 120 px，招式名字級自動縮放，不可換行斷字（主標過長時縮字級）。
- 必須避開 `#holoRadarStrip`／`.log-header-hud`：讀取兩者的 `getBoundingClientRect()`，讓色帶的 top 在其下方。
- 淺色模式：依 §0-3 使用深色實底 HUD；深色模式可使用原型配色的半透明漸層。
- `prefers-reduced-motion: reduce` 時：取消滑入與速度線，只做 600 ms 淡入淡出。

### 1.4 與戰鬥節奏整合
1. 在 `battle-3d.js` 的 3 個觸發點（L2497 / L2610 / L2616）改為：
   `await MusouCutin.play({...})` → 再呼叫 `performWarlordSkillVfx(...)`。若呼叫端不是 async，請把觸發流程包成 async 或用 Promise `.then()` 串接，**不能**讓戰報文字提前跑完。
2. 演出期間戰鬥時鐘凍結：利用既有 `hitStopUntil`／`combatNow()` 機制，讓單位移動、攻擊動畫與傷害數字暫停（3D 場景仍可渲染，以便保留粒子與鏡頭推近）。
3. 鏡頭：演出開始時鏡頭朝施放者推近約 12%，結束時 400 ms 復原；尊重 `cameraShakeEnabled` 開關。
4. **速度與跳過**（`app.js` 的 `speed` / `skip`）：
   - 1×：1500 ms；2×：1000 ms；3× 以上：750 ms（時間軸各段等比例壓縮）。
   - `skip === true` 或按下 `#btnSkip`：不播放切入、直接 resolve。
5. **佇列**：同一時刻若有多位武將觸發大招，依序排隊播放；佇列中第 3 位起改用 900 ms 精簡版，避免一場戰鬥被拖得太長。
6. 每位武將每場戰鬥只播放一次切入（沿用技能「每戰一次」的規則）。
7. 在 `clearBattleEffects()` 與離開戰鬥／重新開局時呼叫 `MusouCutin.clearAll()`。
8. 音效：演出開始播放 `SoundEngine.play(...)`（沿用 `UNIT_META[uid].sfx` 分類），結束時接上原本的技能音效。

### 1.5 設定開關
- 在戰鬥設定（與鏡頭震動開關同一區）新增「大招演出：完整／精簡／關閉」，存入 `localStorage` 的 `wl15_musou_mode`（`full` | `lite` | `off`），預設 `full`。
- `lite` = 900 ms 版本；`off` = 不顯示切入（3D 特效照常）。

**驗收**
- [ ] 125 位武將觸發大招時都會顯示正確的頭像、招式名、副標與配色。
- [ ] 1× 速度下用 `performance.now()` 量測，演出長度為 1500 ± 50 ms。
- [ ] 跳過、2×／3× 速度、佇列、每場只播一次都正常。
- [ ] 淺色／深色主題各截圖一次；淺色模式的色帶為不透明深色實底、文字清楚。
- [ ] 桌機（1440×900）、平板（1024×768）、手機（390×844）三種尺寸都不遮擋 HUD、文字不溢出。
- [ ] 跳過或離場後，DOM 中不殘留任何 `.musou-cutin` 節點。

---

## Phase 2｜Level 2 底層：發光後製 + 加算混色 + GPU 粒子

### 2.1 Bloom 後製
1. 確認 `THREE.REVISION`，從**相同版本**的 three.js `examples/js/`（非 module 版本）放入 `js/libs/postprocessing/`：
   `EffectComposer.js`、`RenderPass.js`、`ShaderPass.js`、`CopyShader.js`、`LuminosityHighPassShader.js`、`UnrealBloomPass.js`。版本不一致會直接報錯。
2. 只讓特效發光：使用「選擇性 Bloom」（特效物件放在 `layers` 1，先渲染 bloom 圖層再與主場景合成），避免地形、模型與 UI 一起泛白。
3. 參數建議：`strength 1.1`、`radius 0.45`、`threshold 0.15`；淺色主題 `strength` 降為 0.8。
4. 把所有 `renderer.render(scene, camera)` 呼叫統一改成 `renderFrame()`，由它決定使用 composer 或直接 render。
5. 視窗縮放時同步呼叫 `composer.setSize()`。

### 2.2 加算混色
- `performWarlordSkillVfx` 中 `addTexPlane` / `addTexSprite` 新增 `opts.additive`，為 `true` 時使用 `THREE.AdditiveBlending`。火焰、雷光、刀氣、光環預設開啟；煙霧、暗影類維持一般混色。

### 2.3 GPU 粒子系統
- 新增 `createGpuBurst({ count, origin, color, speed, life, size, gravity, spread })`：用單一 `THREE.Points` + 自訂 `ShaderMaterial`，在 vertex shader 依 `uTime` 計算位置與淡出，不在 CPU 每幀更新每顆粒子。
- 一次爆發可支援 600–1500 顆，CPU 負擔與目前 1 顆 Sprite 相近。
- 生命週期結束時 `dispose()` geometry 與 material。

### 2.4 共用特效元件（供 Phase 3 招牌特效使用）
- `spawnShockRing(pos, color, maxRadius, duration)`：地面擴散衝擊波環
- `spawnSlashArc(pos, dir, color, width, duration)`：月牙刀氣（加算混色）
- `spawnRibbonTrail(pathPoints, color, width, duration)`：沿路徑的光帶拖尾
- `spawnGroundDecal(pos, texKey, size, duration)`：地面焦痕／法陣貼花
- `spawnPillar(pos, color, height, duration)`：光柱／火柱

### 2.5 畫質分級
- 新增 `wl15_vfx_quality`：`high`（Bloom + GPU 粒子全量）、`medium`（無 Bloom、粒子 50%）、`low`（無 Bloom、粒子 25%、僅保留 2D 切入）。
- 預設：`isLowPowerDevice ? 'medium' : 'high'`；執行時若連續 2 秒平均 FPS < 40，自動降一級並 toast 提示一次。

**驗收**
- [ ] 8 種原型特效全部改用加算混色後，在深色主題下可見明顯溢光，地形與模型不泛白。
- [ ] 中階手機（或 Chrome DevTools CPU 4× 降速）在 `high` 畫質大招期間 FPS ≥ 45。
- [ ] 切換三種畫質都能即時生效，無錯誤訊息、無記憶體持續上升（連打 10 場後檢查 `renderer.info.memory`）。

---

## Phase 3｜Level 2：$5 招牌專屬特效（25 位）

在 `battle-3d.js` 新增 `SIGNATURE_VFX = { [sigKey]: (ctx) => {...} }`；`performWarlordSkillVfx` 依 `getMusouMove(uid)?.sig` 優先呼叫招牌特效，找不到時回到原型特效。`ctx` 提供 `{ caster, target, casterPos, targetPos, groundY, palette, now }` 與 Phase 2 的元件。

每個招牌特效持續 **1.2–1.8 秒**，必須包含：① 起手（蓄力或法陣）② 主擊（命中瞬間 Bloom 最亮＋頓幀 80 ms＋鏡頭震動）③ 餘韻（殘火、餘煙、碎片）。

規格見 §7 的「招牌特效」欄。**$5 全部完成後先 commit 一次並請使用者驗收風格**，再進行 Phase 4。

**驗收**
- [ ] 25 位 $5 武將的招牌特效能在戰鬥中觸發、互不相同、肉眼可辨識。
- [ ] 每個招牌特效結束後 `particleSystems` 與 GPU 粒子全部回收。

---

## Phase 4｜Level 2：$4 招牌專屬特效（25 位）

同 Phase 3。$4 招牌特效可以比 $5 精簡（持續 1.0–1.4 秒、元件較少），但仍需和同原型的其他武將有明顯差異。

---

## Phase 5｜其餘 75 位武將：原型強化 + 色調差異

- 8 種原型特效使用 Phase 2 元件重製，全面變華麗。
- 同一原型內依兵種 `cat` 微調色相（±12°）與主擊形狀，避免完全相同。
- 切入演出（Phase 1）已讓他們有專屬頭像與招式名，這裡不再新增獨立特效。

**驗收**
- [ ] 隨機抽 20 場 AI 對戰，無報錯；所有大招都有切入與 3D 特效。

---

## 6. 交付檢查清單（全部完成後）
- [ ] `index.html`、`sw.js` 版本一致，新增檔案都在 `CORE_ASSETS` 中。
- [ ] 本機儲存鍵名皆以 `wl15_` 開頭。
- [ ] 淺色／深色 × 桌機／平板／手機，共 6 組截圖放在 `docs/musou-screens/`。
- [ ] 不可修改 `RAW_UNITS` 數值、`UNIT_SKILL_EFFECTS` 戰鬥效果或任何 Firebase 相關程式（本任務只處理演出與視覺）。

---

## 7. 無雙招式表（125 位，已依史實擬定，請照抄）

欄位：`UID`｜武將｜**招式名**（主標）｜副標 tag｜招牌特效 `sig`（僅 $5／$4）與規格

### 奔雷突騎（air）

| UID | 武將 | 招式名 | 副標 | 招牌特效 sig ／ 規格 |
|---|---|---|---|---|
| HUO | 霍去病 | 封狼居胥・千里奔襲 | 冠軍侯 | `huo_wolf_raid`：地面閃電路徑由己方直貫敵後，沿途雷光騎影殘像 3 道，終點狼首雷紋炸裂 |
| LUBU | 呂布 | 天下無雙・方天畫戟 | 人中呂布 | `lubu_sky_halberd`：赤色龍捲環繞 → 戟刃三連月牙斬（紅金）→ 地面放射裂痕＋赤焰衝擊環 |
| YOSHITSUNE | 源義經 | 鵯越逆落・八艘飛 | 九郎判官 | `yoshitsune_cliff_dive`：高空斜降的藍白流星騎影，著地青白衝擊波，空中 8 道殘影跳躍 |
| SHINGEN | 武田信玄 | 風林火山・甲斐之虎 | 疾如風 | `shingen_furinkazan`：「風」「林」「火」「山」四字依序在空中燃起並落地爆開（青、綠、紅、褐） |
| KENSHIN | 上杉謙信 | 毘沙門天・車懸之陣 | 越後之龍 | `kenshin_bishamon`：背後浮現金色「毘」字光輪，騎影以車輪狀輪轉衝擊三圈 |
| WEI | 衛青 | 武剛車陣・龍城七捷 | 大將軍 | `wei_wugang_wall`：方陣戰車光牆升起後向前推進，碾壓敵陣揚起金塵 |
| ZHAOYUN | 趙雲 | 長坂七進七出・龍膽一身 | 常山子龍 | `zhaoyun_seven_charges`：銀白槍芒 7 段連刺，最後一擊化為銀龍穿陣 |
| ZHANGLIAO | 張遼 | 威震逍遙津・八百破十萬 | 遼來來 | `zhangliao_xiaoyao`：雙戟紫電十字斬，8 道紫影騎兵從霧中衝出 |
| CHENQINGZHI | 陳慶之 | 白袍神兵・千軍萬馬避白袍 | 名師大將 | `chen_white_robe`：白色光浪騎陣橫掃，雪白羽毛粒子漫天 |
| KIMYUSHIN | 金庾信 | 花郎誓天・三韓一統 | 興武大王 | `kim_hwarang_oath`：金色花郎劍陣浮空成圓，劍雨落下並綻開金花 |
| MACHO | 馬超 | 錦馬超・西涼鐵騎突 | 神威天將軍 | — |
| YUKIMURA | 真田幸村 | 日本一兵・六文錢突擊 | 赤備決死 | — |
| SUNCE | 孫策 | 小霸王・江東席捲 | 霸王再世 | — |
| GAOCHANGGONG | 高長恭 | 蘭陵王入陣曲 | 鐵面神勇 | — |
| DATE | 伊達政宗 | 獨眼龍・騎馬鐵砲 | 奧州筆頭 | — |
| GAISUWEN | 淵蓋蘇文 | 五刀飛斬・莫離支 | 高句麗雄霸 | — |
| XIAHOUYUAN | 夏侯淵 | 虎步關右・三日五百 | 疾風將軍 | — |
| EULJI | 乙支文德 | 薩水大捷・誘敵千里 | 高句麗名將 | — |
| TACHIBANA | 立花宗茂 | 西國無雙・雷切疾風 | 鎮西之雄 | — |
| ZHAOSHE | 趙奢 | 狹路相逢勇者勝 | 馬服君 | — |
| MADAI | 馬岱 | 西涼追襲・斬叛一擊 | 平北將軍 | — |
| WANGSHUANG | 王雙 | 流星飛錘・陳倉猛追 | 萬夫莫當 | — |
| YAMAGATA | 山縣昌景 | 赤備先驅・甲州猛衝 | 武田四天王 | — |
| PANGDE | 龐德 | 抬櫬決死・白馬射關 | 白馬將軍 | — |
| MAEDATOSHI | 前田利家 | 槍之又左・赤母衣突擊 | 加賀百萬石 | — |

### 重甲陷陣（armor）

| UID | 武將 | 招式名 | 副標 | 招牌特效 sig ／ 規格 |
|---|---|---|---|---|
| BAIQI | 白起 | 武安君・長平殲滅 | 人屠 | `baiqi_changping`：地面浮現暗紅包圍圈並收縮，黑甲劍影從四面刺入中心 |
| XIANGYU | 項羽 | 破釜沉舟・力拔山兮 | 西楚霸王 | `xiangyu_pofu`：躍起後砸地，黑紅爆裂衝擊波＋碎石噴發，地面留下巨大焦痕 |
| YUEFEI | 岳飛 | 撼山易・撼岳家軍難 | 精忠報國 | `yuefei_beiwei`：「岳」字大旗光影立起，金色槍陣方牆前推 |
| HONDA | 本多忠勝 | 蜻蛉切・五十七戰無傷 | 戰國最強 | `honda_tonbokiri`：蜻蛉翅狀光刃橫掃 180°，鹿角金光護盾閃現 |
| GUANYU | 關羽 | 威震華夏・水淹七軍 | 武聖 | `guanyu_dragon_flood`：青龍盤旋升空 → 偃月刀龍形斬擊波，伴隨水浪捲地 |
| WANGJIAN | 王翦 | 六十萬秦軍・平楚 | 秦之柱石 | `wangjian_qin_legion`：黑色秦軍方陣光影層層推進，青銅戈林舉起 |
| LIANPO | 廉頗 | 長平堅壁・老驥伏櫪 | 趙之長城 | `lianpo_rampart`：土牆壁壘從地面隆起擋下攻擊，壁面迸出碎石 |
| ZHANGFEI | 張飛 | 當陽斷橋・燕人一喝 | 萬人敵 | `zhangfei_roar`：怒吼音波環向前擴散，地面木橋斷裂碎片飛散 |
| SHIMAZUY | 島津義弘 | 鬼石曼子・關原背進 | 鬼島津 | `shimazu_retreat_charge`：黑紅鬼面殘影向敵陣反衝，野太刀一字橫斬 |
| ZHOUYAFU | 周亞夫 | 細柳營・堅壁平七國 | 真將軍 | `zhouyafu_xiliu`：柳葉狀綠光盾陣排列成牆，反彈光箭 |
| SUNJIAN | 孫堅 | 江東猛虎・古錠刀 | 破虜將軍 | — |
| CAOREN | 曹仁 | 樊城天人・鐵壁固守 | 天人之勇 | — |
| HOJO_UJIYASU | 北條氏康 | 相模之獅・河越夜戰 | 小田原城主 | — |
| TACHIBANAD | 立花道雪 | 雷神道雪・斬雷一閃 | 鬼道雪 | — |
| XUCHU | 許褚 | 虎癡裸衣・倒拖雙牛 | 虎侯 | — |
| SHIBATA | 柴田勝家 | 瓶割柴田・背水一戰 | 鬼柴田 | — |
| XIAHOU_DUN | 夏侯惇 | 拔矢啖睛・父精母血 | 獨眼將軍 | — |
| CHOIYOUNG | 崔瑩 | 視金如石・高麗柱石 | 鐵原崔氏 | — |
| YANGYE | 楊業 | 金刀楊無敵・雁門破遼 | 楊家將 | — |
| IINAOMASA | 井伊直政 | 井伊赤鬼・赤備突陣 | 德川四天王 | — |
| DIANWEI | 典韋 | 古之惡來・雙戟死守 | 宛城護主 | — |
| ZHOUTAI | 周泰 | 膚如刻畫・以身護主 | 幼平 | — |
| GYEBAEK | 階伯 | 黃山伐・五千決死 | 百濟忠魂 | — |
| KATOKIYOMASA | 加藤清正 | 片鎌槍・蔚山籠城 | 肥後之虎 | — |
| YUJIN | 于禁 | 毅重持節・死守營陣 | 五子良將 | — |

### 神射強弩（air_defense）

| UID | 武將 | 招式名 | 副標 | 招牌特效 sig ／ 規格 |
|---|---|---|---|---|
| LIGUANG | 李廣 | 射石沒羽・飛將神弓 | 漢之飛將 | `liguang_stone_arrow`：白羽箭化為白光貫穿岩石，命中處岩塊爆裂 |
| YANGYOUJI | 養由基 | 百步穿楊・七札一矢 | 楚國神射 | `yangyouji_seven_layers`：一箭連續擊穿 7 層光盾圖案，每層碎裂一次 |
| NOBUNAGA | 織田信長 | 長篠三段擊・天下布武 | 第六天魔王 | `nobunaga_three_volley`：三排火繩槍口依序噴出火光，三波彈幕掃射，「天下布武」朱印落地 |
| JUMONG | 朱蒙 | 東明神矢・百發百中 | 高句麗東明聖王 | `jumong_divine_arrow`：金色三足烏光翼展開，射出巨大金光神矢 |
| LIMU | 李牧 | 代郡萬弩・破胡大陣 | 武安君 | `limu_ten_thousand`：天空萬箭如雨落下，形成覆蓋全區的箭幕 |
| MENGTIAN | 蒙恬 | 萬里長城・秦弩齊發 | 秦之北疆 | `mengtian_great_wall`：長城城垛光影升起，城頭秦弩齊射 |
| HUANGZHONG | 黃忠 | 定軍山・老將神弦 | 老當益壯 | `huangzhong_dingjun`：滿月拉弓蓄力金光，一箭化鳳凰貫穿敵陣 |
| HANSHIZHONG | 韓世忠 | 克敵神弓・黃天蕩 | 中興名將 | `han_huangtiandang`：江面金光浪潮中射出連弩，水面炸起火柱 |
| SAIKA | 雜賀孫市 | 八咫烏・雜賀連銃 | 鐵砲傭兵王 | `saika_yatagarasu`：黑色三足烏剪影掠過，三連銃火光＋黑羽飄散 |
| HULUGUANG | 斛律光 | 落雕都督・射鵰一矢 | 北齊柱石 | `hulu_eagle_shot`：高空金雕剪影被一箭射落，羽毛與光屑迸散 |
| YOICHI | 那須與一 | 屋島扇之的・一箭定浪 | 源氏神弓 | — |
| TAISHICI | 太史慈 | 猿臂神射・神亭酣戰 | 信義篤烈 | — |
| AKECHI | 明智光秀 | 敵在本能寺・桔梗雷火 | 惟任日向守 | — |
| MALONG | 馬隆 | 偏箱車八陣・強弩平涼 | 西晉名將 | — |
| SHIMAZU_IEHISA | 島津家久 | 釣野伏・沖田畷齊射 | 薩摩戰術鬼才 | — |
| GWONYUL | 權慄 | 幸州大捷・神機箭火車 | 朝鮮中興名將 | — |
| ZONGZE | 宗澤 | 汴京連弩・過河三呼 | 宗爺爺 | — |
| GENGYAN | 耿弇 | 雲台破齊・強弩圍城 | 雲台二十八將 | — |
| FENGYI | 馮異 | 大樹將軍・崤底伏弩 | 大樹將軍 | — |
| ASAKURA_SOT | 朝倉宗滴 | 九頭龍川・越前銃陣 | 越前軍神 | — |
| TORII | 鳥居元忠 | 伏見城血戰・三河忠魂 | 三河武士之鑑 | — |
| CHOIMUSEON | 崔茂宣 | 走火神機箭・火桶齊射 | 高麗火藥之父 | — |
| MATSUNAGA | 松永久秀 | 平蜘蛛爆碎 | 戰國梟雄 | — |
| TAKIGAWA | 瀧川一益 | 進退瀧川・甲賀連銃 | 織田四天王 | — |
| HONDA_TADATSUGU | 本多忠次 | 三河鐵砲・長篠輪射 | 三河老將 | — |

### 先登奇兵（naval）

| UID | 武將 | 招式名 | 副標 | 招牌特效 sig ／ 規格 |
|---|---|---|---|---|
| YISUNSIN | 李舜臣 | 鳴梁海戰・十三艘逆襲 | 忠武公 | `yisunsin_turtle_ship`：海浪中衝出龜船虛影，側舷火砲連轟並激起水柱 |
| LUMENG | 呂蒙 | 白衣渡江・襲取荊州 | 吳下阿蒙 | `lumeng_white_robe`：白霧中浮現商船剪影，霧散後紫刃突刺 |
| LIJING | 李靖 | 雪夜襲陰山・衛公兵法 | 大唐軍神 | `lijing_snow_raid`：雪暴中千騎剪影奔襲，冰藍斬擊十字 |
| XIEXUAN | 謝玄 | 淝水之戰・風聲鶴唳 | 北府兵統帥 | `xiexuan_feishui`：江面巨浪＋白鶴群掠過，敵陣潰散的風壓 |
| MOURI_MOTO | 毛利元就 | 三矢之訓・嚴島奇襲 | 西國謀神 | `mouri_three_arrows`：三支光矢合而為一（不折之矢），射出時捲起暴風雨 |
| DENGAI | 鄧艾 | 陰平天降・裹氈滾崖 | 滅蜀之功 | `dengai_cliff_drop`：從畫面上方山崖翻滾而下的光團，落地暗綠衝擊 |
| KUKI | 九鬼嘉隆 | 鐵甲船・木津川大筒 | 九鬼水軍 | `kuki_ironclad`：黑鐵巨艦剪影，大筒砲擊三連爆 |
| LUXUN | 陸遜 | 火燒連營七百里 | 夷陵都督 | `luxun_burning_camps`：一字排開的營帳由近至遠依序燃起，形成七段火牆 |
| WEIYAN | 魏延 | 子午谷奇謀 | 漢中都督 | `weiyan_ziwu`：峽谷剪影中伏兵紫影一齊殺出，狂骨環刀橫斬 |
| XUHUANG | 徐晃 | 長驅直入・破十重圍 | 周亞夫之風 | `xuhuang_ten_rings`：10 層鹿角光環依序被大斧劈碎 |
| GANNING | 甘寧 | 錦帆百騎劫營 | 錦帆賊 | — |
| HATTORI | 服部半藏 | 鬼半藏・伊賀影縫 | 伊賀忍軍頭領 | — |
| JIANGWEI | 姜維 | 天水麒麟・九伐中原 | 諸葛傳人 | — |
| YUNGWAN | 尹瓘 | 別武班・東北九城 | 高麗元帥 | — |
| ZHANGHE | 張郃 | 巧變斷汲・街亭奇兵 | 五子良將 | — |
| HUANGGAI | 黃蓋 | 苦肉計・赤壁火船 | 東吳宿將 | — |
| TIANDAN | 田單 | 即墨火牛陣 | 安平君 | — |
| CAOBIN | 曹彬 | 浮橋渡江・平定江南 | 北宋良將 | — |
| JEONGJI | 鄭地 | 觀音浦・艦砲斬寇 | 高麗水軍 | — |
| YUEJIN | 樂進 | 每戰先登・無堅不陷 | 五子良將 | — |
| MENGHUO | 孟獲 | 南蠻王・藤甲象兵 | 南中渠帥 | — |
| MURAKAMI | 村上武吉 | 能島焙烙玉 | 海賊大將 | — |
| YUYUNWEN | 虞允文 | 采石磯・海鰍霹靂 | 書生督師 | — |
| WAKIZAKA | 脇坂安治 | 賤岳七本槍・淡路水軍 | 淡路水軍頭領 | — |
| TOUDO | 藤堂高虎 | 築城名人・水城鐵壁 | 歷事七主 | — |

### 軍師奇謀（support）

| UID | 武將 | 招式名 | 副標 | 招牌特效 sig ／ 規格 |
|---|---|---|---|---|
| ZHUGELIANG | 諸葛亮 | 八陣圖・石兵八陣 | 臥龍 | `zhuge_bazhen`：地面金色八卦陣旋轉展開，8 根石柱依序升起，羽扇東風捲過敵陣 |
| SUNWU | 孫武 | 孫子兵法・五戰入郢 | 兵聖 | `sunwu_thirteen`：13 片竹簡在空中環繞成圓後射向敵陣 |
| HANXIN | 韓信 | 十面埋伏・四面楚歌 | 兵仙 | `hanxin_ten_sides`：敵方四周 10 面旗幟光影同時立起，向內收束斬擊 |
| ZHANGLIANG | 張良 | 運籌帷幄・決勝千里 | 謀聖 | `zhangliang_scroll`：《太公兵法》卷軸展開成光幕，金色文字化為光箭 |
| TOYOTOMI | 豐臣秀吉 | 天下人・一夜城 | 太閤 | `toyotomi_one_night`：金色城郭光影在瞬間拔地而起，金瓢簞馬印閃耀 |
| CAOCAO | 曹操 | 官渡奇襲・烏巢焚糧 | 魏武帝 | `caocao_wuchao`：遠方糧倉燃起大火，黑色「魏」字旗在火光中展開 |
| WUQI | 吳起 | 魏武卒・七十六戰不敗 | 兵家亞聖 | `wuqi_wuzu`：重甲魏武卒方陣光影列隊，長矛齊刺 |
| LEYI | 樂毅 | 五國合縱・連下七十城 | 昌國君 | `leyi_five_states`：五色旗光（五國）從五方匯聚為一道光柱 |
| LIUBOWEN | 劉伯溫 | 神機妙算・鄱陽決戰 | 誠意伯 | `liubowen_poyang`：湖面星盤浮現，星辰連線後降下天火 |
| TOKUGAWA | 德川家康 | 關原天下分・東照神君 | 東照大權現 | `tokugawa_sekigahara`：三葉葵紋金光盾陣展開，軍配一揮全軍光環 |
| ZHOUYU | 周瑜 | 赤壁東風・萬艦焚江 | 美周郎 | — |
| SIMAYI | 司馬懿 | 鷹視狼顧・高平陵 | 冢虎 | — |
| SUNBIN | 孫臏 | 圍魏救趙・馬陵伏弩 | 兵家宗師 | — |
| GUOJIA | 郭嘉 | 十勝十敗・鬼謀遺計 | 鬼才 | — |
| KANGGAMCHAN | 姜邯贊 | 龜州大捷・決堤水攻 | 高麗護國名相 | — |
| PANGTONG | 龐統 | 鳳雛・連環計 | 鳳雛 | — |
| LUSU | 魯肅 | 榻上策・孫劉同盟 | 東吳柱石 | — |
| XUNYU | 荀彧 | 王佐之才・驅虎吞狼 | 王佐 | — |
| HANBEI | 竹中半兵衛 | 今孔明・十六騎奪城 | 天才軍師 | — |
| KANBEI | 黑田官兵衛 | 備中水攻・中國大返還 | 如水 | — |
| JIAXU | 賈詡 | 亂武・毒士離間 | 算無遺策 | — |
| FAZHENG | 法正 | 定軍山・居高指旗 | 翼侯 | — |
| SANADAMASA | 真田昌幸 | 表裏比興・上田城 | 智謀之將 | — |
| SHIMAZU_YOSHIHISA | 島津義久 | 薩摩釣野伏 | 九州統帥 | — |
| YAMAMOTO | 山本勘助 | 啄木鳥戰法 | 武田軍師 | — |
