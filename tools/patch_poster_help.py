# -*- coding: utf-8 -*-
with open('D:/TopWarlords/js/poster-help.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = text[text.find('<div class="help-tab-panel" id="helpPanelRules"'):text.find('<div class="help-tab-panel" id="helpPanelInstall"')]

new_block = '''<div class="help-tab-panel" id="helpPanelRules" ${activeTab === 'rules' ? '' : 'hidden'}>
    <h2>📖 古代名將聯合作戰推演手冊</h2>
    <p class="muted">用 $15 軍令預算組建五大古代兵團槽位，與對手進行古代古典沙盤推演。</p>

    <h3>一、排兵布陣規則</h3>
    <ul>
      <li><b>五大專屬兵團</b>：奔雷突騎 (CAV)、重甲陷陣 (ARM)、神射強弩 (ARC)、先登奇兵 (VAN)、軍師奇謀 (STR) 各選 1 位歷史名將，不可重複或留空。</li>
      <li><b>總軍令 $15 限額</b>：名將軍令由 $1 至 $5 不等，只要總軍令不超標，可自由配置多個 $5 傳世名將（如霍去病、衛青、白起、諸葛亮、上杉謙信、武田信玄、李舜臣等）。</li>
      <li><b>收錄 200 位日韓中純歷史名將</b>：每個槽位提供 5 種價位、每種價位各有 A～H 共 8 款不同特性名將與兵器。可隨時點擊右上角「點將調撥兵符」重新召集候選名將。</li>
    </ul>

    <h3>二、四大核心演習模式</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">⚡ 戰術演習</div>
        <div class="help-desc">
          <b>單人演訓模式</b>：內含 <b>⚡ 快速交鋒</b>（迎戰 7 大 AI 名將流派風格，並可自由切換 6 種古戰場天候場景）、<b>🎯 精選破局</b>（以 $15 標準預算挑戰 $19~$25 超標 BOSS 殘局）與 <b>🧪 沙盒模擬</b>（一鍵推演 100~300 場蒙地卡羅大數據檢驗全天候勝率與戰損）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">⚔️ 多局鏖戰</div>
        <div class="help-desc">
          <b>錦標對抗賽制</b>：支援單人闖關與 <b>🌐 線上即時開房對戰</b>！可自訂 <b>BO3 (3局2勝) / BO5 (5局3勝) / BO7 (7局4勝)</b>，並可自選戰場場景。支援 <b>🔒 開戰鎖定 (Ban 1)</b>（首局開戰後鎖定名將庫，敗方享有戰術反制權禁用敵方 1 名主力）與 <b>🎲 自由調撥 (Ban 2)</b>（每局重新洗牌調撥，雙方各 Ban 2 名進行深度博弈）兩大軍令規則。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🏆 天梯挑戰</div>
        <div class="help-desc">
          <b>全球排位挑戰</b>：挑戰全服百大玩家即時駐防部隊，採用戰略勝點 (RP) 階級制，由「軍候百夫長」一路晉升至「天下大將軍」！每小時享有 30 次作戰派遣令（整點自動補滿 30 次），並可自訂部署專屬防禦陣容迎接全球挑戰。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🥇 群雄爭霸</div>
        <div class="help-desc">
          <b>單淘汰冠軍盃</b>：支援單人挑戰與 <b>🌐 線上多人即時開房／世界盃自動配對</b> 的 8 強／16 強單淘汰樹狀盃賽，一戰定生死，爭奪頂尖大將軍榮譽金盃！
        </div>
      </div>
    </div>

    <h3>三、古戰場三階段推演與勝負</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">階段一 · 奇謀先制</div>
        <div class="help-desc">
          <b>運籌帷幄與十面埋伏</b>：比拼全軍謀略值奪取戰局先機；軍師奇謀先制打擊敵方神射箭陣，十面埋伏則可直擊敵方最昂貴主帥核心。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">階段二 · 突騎神射</div>
        <div class="help-desc">
          <b>箭雨拋射與戰馬奔馳</b>：神射強弩以箭雨覆蓋壓制突騎（享有 <b>×2.5</b> 剋制加成）；存活突騎長驅直入穿插敵陣；先登死士飛躍破陣。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">階段三 · 短兵相接</div>
        <div class="help-desc">
          <b>主力交鋒與白刃決戰（上限 10 輪）</b>：重甲陷陣築起鋼盾之牆阻擋攻勢；各軍依戰力激烈對決，金鐵交鳴。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">勝負判定標準</div>
        <div class="help-desc">
          <b>全殲敵軍 · 殘兵 VP 裁定</b>：優先以全殲敵方名將判定勝利；若激戰滿 10 輪雙方仍有存活部隊，則脫離接觸，由<b>殘存兵力 ＋ 戰場控制 ＋ 以弱勝強</b>戰略勝點（VP）裁定勝負。
        </div>
      </div>
    </div>

    <h3>四、兵家戰術教條（賽前 3 選 1）</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">🌪 疾如風</div>
        <div class="help-desc">
          階段一、二攻擊火力 <b>+12%</b>，但承受傷害 <b>+5%</b>（兵貴神速，適合突騎千里奔襲與長程斬首突擊）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🏔 不動如山</div>
        <div class="help-desc">
          全軍承受傷害 <b>−12%</b>，神射攔截突騎命中率 <b>+6%</b>（玄甲厚鎧堅壁清野，適合步兵陣地防守反擊與消耗戰）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🌑 難知如陰</div>
        <div class="help-desc">
          全軍謀略值 <b>×1.5 倍</b>（大幅強化奪取陣法先機機會），並使敵方全體命中率 <b>−8%</b>（神鬼莫測，適合奇謀算計與規避敵軍重擊）。
        </div>
      </div>
    </div>

    <h3>五、古代五大軍陣協同體系</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">🏹 弓弩連環</div>
        <div class="help-desc">
          高階軍師 (謀略≥50) ＋ 神射強弩／投石火砲 ➔ 啟動全軍謀略 <b>+12</b>、箭雨命中率 <b>+6%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🐎 鐵騎穿插</div>
        <div class="help-desc">
          $5 傳世突騎 ＋ 先登死士 ➔ 突騎與死士衝鋒傷害 <b>+15%</b>、全軍隱匿 <b>+5</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🌊 水陸連環</div>
        <div class="help-desc">
          先登奇兵／水師 ＋ 奇謀軍師 (謀略≥15 或登高觀瞻) ➔ 水戰與奇襲命中率 <b>+6%</b>、部隊傷害 <b>+12%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🛡 步騎並進</div>
        <div class="help-desc">
          重甲陷陣／大盾鋼牆 ＋ 攻城巨砲／先登戰械 ➔ 階段三重甲與破陣傷害 <b>+10%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">⚡ 運籌決勝</div>
        <div class="help-desc">
          全軍謀略總值超越對手 <b>≥ 10</b> 點時奪取戰局先機，敵方全體命中率最高 <b>−15%</b>、我方戰力最高 <b>+8%</b>。
        </div>
      </div>
    </div>
  </div>

  '''

if old_block:
    text = text.replace(old_block, new_block, 1)
    with open('D:/TopWarlords/js/poster-help.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Successfully patched poster-help.js with authentic ancient warlord text!')
else:
    print('Could not find old_block in poster-help.js')
