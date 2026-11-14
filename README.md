# TopWarlords 頂尖對戰：15元名將聯合作戰 (Combined Warlords)

> ⚔️ 結合日韓中純歷史名將的戰略對決 Web 遊戲，支援 3D 古戰場推演沙盤、三階段古戰場戰術推演、名將點將錄全鑑與天梯榮譽榜！

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Vanilla-ES6+-cyan.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/WebGL-Three.js_r128-blue.svg)](https://threejs.org/)

---

## 🏛️ 遊戲核心特色

1. **125 位日韓中歷史名將全鑑**：
   - 涵蓋春秋戰國、秦漢、三國、兩晉南北朝、宋朝、日本源平／南北朝／戰國與韓國三國／高麗／朝鮮時代。
   - 嚴格限定純歷史真實名將（排除民間演義、單一戰役者、刺客與雜兵部隊，100% 皆為終身長才統帥）。
   - 國別分布：🇨🇳 中國 78 位、🇯🇵 日本 36 位、🇰🇷 韓國 11 位。
   - 五大兵團人數均衡：奔雷突騎、重甲陷陣、神射強弩、先登奇兵、軍師奇謀各 25 位。

2. **$15 軍令預算組隊競技**：
   - 五大作戰兵團（⚡ 奔雷突騎、🛡️ 重甲陷陣、🏹 神射強弩、⚔️ 先登奇兵、📜 軍師奇謀）嚴格各選 1 位。
   - $1～$5 費用五階級距，自由搭配，杜絕 Meta 固化。

3. **🏛️ 3D 古戰場微縮推演沙盤 (WebGL / Three.js)**：
   - 引入黑胡桃木推演沙盤與水墨地表。
   - 名將 3D 立體戰棋標記（帶陣營青銅／琉璃金邊基座與即時 3D 浮動血條）。
   - 支援 3D 拋物線萬箭齊發、奔雷突騎衝鋒撞擊、先登跳蕩騰躍與中軍死鬥打擊。
   - 支援隨時一鍵切換 `[3D 沙盤 / 2D 卡片視圖]` 與秒速跳過動畫。

4. **三大階段古戰場戰術推演**：
   - **階段一**：軍師奇謀帷幄、先制破陣斬首。
   - **階段二**：神射弩陣箭雨攔截、奔雷突騎先機爭奪、先登奇兵水陸交鋒。
   - **階段三**：中軍主力混戰死鬥（氣力三階遞減、百戰老將機制）。

5. **四大古代陣法羈絆協同**：
   - 📜 **八陣神機網**：頂級軍師 ＋ 斷騎護陣／神射強弩。
   - ⚡ **奇正相生陣**：傳奇飛將 ＋ 先登死士／火攻隊。
   - ⚔️ **水陸伏波破暗陣**：先登奇兵 ＋ 謀略高士／登高觀瞻。
   - 🛡️ **步騎火砲合圍**：重甲陷陣 ＋ 攻城器械／前觀校射。

6. **📜 東亞名將點將錄全鑑 (`armory.html`)**：
   - 多維度矩陣篩選：支援 5 大兵團、3 國陣營、費用等級、18 種古代兵法辭典檢索。
   - 點擊展開全息名將傳記與實戰數值雷達。

7. **天梯 11 級古代軍銜榮譽榜**：
   - 由「軍候百夫長」一路晉升至「天下大將軍」（含折衝都尉、校尉、中郎將、都督軍事、衛將軍、車騎大將軍、驃騎大將軍等）。
   - 100 支歷史天梯名門軍團實時防禦。

---

## 🚀 本地快速啟動

專案採用純原生 Web 技術架構（Vanilla HTML5 + CSS3 + ES6+ JS + WebGL），零打包建置步驟：

```bash
# 複製專案
git clone https://github.com/newreply01/TopWarlords.git
cd TopWarlords

# 啟動本機伺服器
python -m http.server 8080
```

在瀏覽器造訪 `http://localhost:8080` 即可遊玩！

---

## 📂 專案架構目錄

```
TopWarlords/
├── index.html              # 主指揮所介面 (5x5 名將徵召看板、3D 戰場推演台)
├── armory.html             # 東亞名將點將錄全鑑 (125 位名將傳記與兵法辭典)
├── style.css               # 主題樣式 (含 3D 沙盤、水墨古風與 RWD 自適應)
├── all_warlords.json       # 125 位日韓中歷史名將資料庫
├── js/
│   ├── app.js              # 主前端互動與對戰流程中樞
│   ├── battle-3d.js        # 3D 古戰場推演引擎 (Three.js WebGL Diorama)
│   ├── data.js             # 125 位武將五維數值、四大羈絆與氣力勳章
│   ├── engine.js           # 確定性古戰場推演計算核心
│   ├── ladder-data.js      # 100 支歷史天梯軍團與 11 級古代軍銜
│   ├── ladder.js           # 天梯排位與 CRS-15 積分算法
│   ├── sound.js            # 古代戰場物理聲學合成引擎
│   └── poster-help.js      # Canvas 戰報海報繪製與遊戲說明
├── assets/
│   ├── icons/              # PWA 應用圖示
│   └── warlords/           # 名將專屬古典水墨卡牌圖資 (*.jpg)
├── docs/
│   └── FIREBASE_ISOLATION_SPEC.md # 跨專案 Firebase RTDB 與同源本機儲存隔離規格
└── test/                   # Playwright 自動化 E2E 驗證套件
```

---

## 📜 授權協議

本專案基於 [MIT License](LICENSE) 開源授權。
