# -*- coding: utf-8 -*-
"""
全面優化 armory.html 與 armory.js：
1. 支援 5 兵團分類與 3 國籍（中國、日本、韓國）多維篩選
2. 徹底替換現代軍武術語為古代歷史名將、兵書計謀術語
3. 支援 200 位歷史名將全息點將卡與大圖展開
"""
from pathlib import Path

ROOT = Path("D:/TopWarlords")

# 1. 調整 armory.html
html = (ROOT / "armory.html").read_text(encoding="utf-8")

html = html.replace("<title>TopClash 頂尖對戰：15元聯合作戰 | 軍武庫圖鑑全鑑 (200 位日韓中純歷史名將)</title>",
                    "<title>TopWarlords 頂尖對戰：15元名將聯合作戰 | 東亞歷史名將點將錄全鑑 (200 位日韓中純歷史名將)</title>")

html = html.replace('content="收錄 TopClash 頂尖對戰：15元聯合作戰全部 125 款全差異化現代軍武圖鑑，涵蓋五大兵種、五階費用、高清實裝照片、五維數值與招牌戰術特性。"',
                    'content="收錄 TopWarlords 全部 200 位日韓中純歷史名將點將錄，涵蓋五大兵團、五階軍令費用、古典水墨戰將圖、五維數值與孫子兵法招牌戰術特性。"')

html = html.replace('content="TopClash 軍武庫圖鑑全鑑 | 200 位日韓中純歷史名將實裝參數"',
                    'content="TopWarlords 東亞名將點將錄全鑑 | 200 位日韓中純歷史名將實戰參數"')

html = html.replace('content="收錄 TopClash 全部 125 款全差異化現代軍武圖鑑，涵蓋五大兵種、五階費用、高清實裝照片、五維數值與招牌戰術特性。"',
                    'content="收錄 TopWarlords 全部 200 位日韓中純歷史名將點將錄，涵蓋五大兵團、五階軍令費用、古典水墨戰將圖、五維數值與孫子兵法招牌戰術特性。"')

html = html.replace('<h1>頂尖對戰 <small>軍武庫圖鑑全鑑</small></h1>\n      <p class="sub">ARMORY ENCYCLOPEDIA · 125 MODERN WARFARE ASSETS</p>',
                    '<h1>頂尖對戰 <small>名將點將錄全鑑</small></h1>\n      <p class="sub">HERO ENCYCLOPEDIA · 200 HISTORICAL WARLORDS</p>')

html = html.replace('<h2>現代名將點將錄 <span class="badge">125 款全差異化武裝</span></h2>\n      <p>涵蓋全球現役與先導旗艦武器系統，五大作戰兵種 × 五階預算級距，收錄完整數值、作戰定位與招牌戰術特性。</p>',
                    '<h2>東亞歷史名將點將錄 <span class="badge">200 位日韓中純歷史名將</span></h2>\n      <p>嚴選春秋戰國至明末清初東亞三國純歷史名將謀士，五大作戰兵團 × 五階軍令費用，收錄五維實戰數值、武裝招式與專屬陣法特性。</p>')

html = html.replace('<div class="num" id="totalUnitsCount">125</div>\n        <div class="label">收錄武器總數</div>',
                    '<div class="num" id="totalUnitsCount">200</div>\n        <div class="label">收錄名將總數</div>')

html = html.replace('<div class="label">作戰兵種</div>', '<div class="label">作戰兵團</div>')

old_pills = '''      <div class="filter-pills" id="catFilterGroup">
        <button class="filter-btn active" data-cat="all">全部兵種 (125)</button>
        <button class="filter-btn" data-cat="air">✈️ 制空打擊 (25)</button>
        <button class="filter-btn" data-cat="armor">🛡️ 重裝鐵騎 (25)</button>
        <button class="filter-btn" data-cat="air_defense">🎯 區域防空 (25)</button>
        <button class="filter-btn" data-cat="naval">⚓ 制海權威 (25)</button>
        <button class="filter-btn" data-cat="support">🛰️ 情報/長程 (25)</button>
      </div>'''

new_pills = '''      <div class="filter-pills" id="catFilterGroup">
        <button class="filter-btn active" data-cat="all">全部兵團 (200)</button>
        <button class="filter-btn" data-cat="air">⚡ 奔雷突騎 (40)</button>
        <button class="filter-btn" data-cat="armor">🛡️ 重甲陷陣 (40)</button>
        <button class="filter-btn" data-cat="air_defense">🏹 神射強弩 (40)</button>
        <button class="filter-btn" data-cat="naval">⚔️ 先登奇兵 (40)</button>
        <button class="filter-btn" data-cat="support">📜 軍師奇謀 (40)</button>
      </div>'''
html = html.replace(old_pills, new_pills)

# 增加國籍篩選按鈕
old_cost_row = '<div style="display:flex;align-items:center;gap:8px;">\n        <span class="select-label">預算費用：</span>'
new_nat_and_cost = '''<div style="display:flex;align-items:center;gap:8px;">
        <span class="select-label">國別陣營：</span>
        <div class="cost-pills" id="natFilterGroup">
          <button class="cost-btn active" style="width:auto;padding:0 10px;" data-nat="all">全部</button>
          <button class="cost-btn" style="width:auto;padding:0 8px;" data-nat="🇨🇳">🇨🇳 中國 (100)</button>
          <button class="cost-btn" style="width:auto;padding:0 8px;" data-nat="🇯🇵">🇯🇵 日本 (65)</button>
          <button class="cost-btn" style="width:auto;padding:0 8px;" data-nat="🇰🇷">🇰🇷 韓國 (35)</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:8px;">
        <span class="select-label">軍令費用：</span>'''
html = html.replace(old_cost_row, new_nat_and_cost)

html = html.replace('placeholder="搜尋武器名稱、代碼 (如 F22)、國家、主力武裝或特性 (如 匿蹤、神盾)..."',
                    'placeholder="搜尋名將姓名 (如 諸葛亮、白起、李舜臣)、國家、主力武裝或戰術特性 (如 運籌帷幄、先登)..."')

html = html.replace('<div>目前符合條件：<b id="filteredCount">125</b> 款武器裝備</div>\n    <div style="font-size:12px;">點擊任何武器卡片可展開全息戰術情報大圖</div>',
                    '<div>目前符合條件：<b id="filteredCount">200</b> 位歷史名將</div>\n    <div style="font-size:12px;">點擊任何名將卡片可展開名將列傳與實戰戰術全鑑</div>')

html = html.replace('<option value="sth_desc">匿蹤 STH：高至低</option>\n          <option value="ew_desc">電戰 EW：高至低</option>',
                    '<option value="sth_desc">隱匿 STH：高至低</option>\n          <option value="ew_desc">謀略 EW：高至低</option>')

html = html.replace('<th>照片</th>\n          <th>名稱 / 型號</th>\n          <th>兵種</th>\n          <th>費用</th>\n          <th>國家</th>\n          <th>風格特性</th>\n          <th>主力武裝</th>\n          <th>HP</th>\n          <th>ATK</th>\n          <th>減傷</th>\n          <th>匿蹤</th>\n          <th>電戰</th>\n          <th>戰術特性</th>',
                    '<th>畫像</th>\n          <th>名將 / 陣營</th>\n          <th>兵團</th>\n          <th>費用</th>\n          <th>國家</th>\n          <th>作戰風格</th>\n          <th>專屬兵器</th>\n          <th>氣血</th>\n          <th>武勇</th>\n          <th>厚鎧</th>\n          <th>隱匿</th>\n          <th>謀略</th>\n          <th>陣法特性</th>')

html = html.replace('<h3>📖 18 種現代戰術特性全辭典 (Tactical Trait Codex)</h3>',
                    '<h3>📖 18 種古代兵法戰術特性全辭典 (Ancient Tactical Trait Codex)</h3>')

html = html.replace('<img id="intelImg" class="intel-hero-img" src="" alt="武器照片">',
                    '<img id="intelImg" class="intel-hero-img" src="" alt="名將畫像">')

html = html.replace('localStorage.getItem(\'db15_theme\')', 'localStorage.getItem(\'wl15_theme\')')

(ROOT / "armory.html").write_text(html, encoding="utf-8")
print("armory.html 優化完成！")

