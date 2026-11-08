/* =========================================================
   《頂尖對戰：15元名將聯合作戰》— 勝利戰報海報繪製與戰術說明手冊模組
   (Canvas Victory Poster & Tactical Manual / PWA Install Guide)
   ========================================================= */
(() => {
  'use strict';

  function roundRect(g, x, y, w, h, r) {
    if (typeof g.roundRect === 'function') {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      return;
    }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function downloadPoster(res, ctx) {
    const { state, dailyNo, dateKey, encodeDeck, toast } = ctx;
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#07101c'); bg.addColorStop(1, '#0c1a2b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(61,224,255,.1)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const won = res.winner === 'A';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#3de0ff'; g.font = '700 26px "JetBrains Mono",monospace'; g.fillText('TOP WARLORDS 15 · COMBINED WARLORDS', 70, 100);
    g.fillStyle = '#dbe7f5'; g.font = '900 64px "Noto Sans TC",sans-serif'; g.fillText('頂尖對戰', 70, 180);
    g.fillStyle = won ? '#5dffb0' : res.winner === 'draw' ? '#ffb340' : '#ff5d6e'; g.font = '900 150px "Noto Sans TC",sans-serif';
    g.fillText(won ? '勝 利' : res.winner === 'draw' ? '平 手' : '敗 北', 70, 370);
    g.fillStyle = '#7f93ab'; g.font = '500 30px "Noto Sans TC",sans-serif';
    g.fillText(`${res.ev.name} ｜ 積分 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)} ｜ ${state.mode === 'daily' ? '精選對戰 #' + dailyNo() : dateKey()}`, 70, 430);
    let y = 500;
    state.deck.forEach((id, i) => {
      const u = UNIT_MAP[id]; const col = CATS[u.cat].color;
      g.fillStyle = 'rgba(255,255,255,.05)'; roundRect(g, 70, y, 940, 120, 18); g.fill();
      g.fillStyle = col; g.fillRect(70, y, 8, 120);
      g.fillStyle = '#7f93ab'; g.font = '600 24px "JetBrains Mono",monospace'; g.fillText(CATS[u.cat].short + ' · ' + SLOTS[i].label, 110, y + 40);
      const mb = typeof getUnitMasteryBadge === 'function' ? getUnitMasteryBadge(u.id) : null;
      const ribbonIcon = (mb && mb.tier !== 'service') ? ` ${mb.icon}` : '';
      g.fillStyle = '#dbe7f5'; g.font = '700 42px "Noto Sans TC",sans-serif'; g.fillText(u.name + ribbonIcon, 110, y + 90);
      g.fillStyle = '#ffb340'; g.font = '700 56px Rajdhani,"Noto Sans TC",sans-serif'; g.textAlign = 'right'; g.fillText('$' + u.cost, 980, y + 82); g.textAlign = 'left';
      y += 138;
    });
    g.fillStyle = '#3de0ff'; g.font = '700 30px "JetBrains Mono",monospace'; g.fillText('CODE  ' + encodeDeck(state.deck), 70, y + 50);
    g.fillStyle = '#7f93ab'; g.font = '500 26px "Noto Sans TC",sans-serif'; g.fillText('用 $15 軍令調配你的名將陣容，來與我一決高下！', 70, y + 100);
    const a = document.createElement('a'); a.download = 'topwarlords-15.png'; a.href = c.toDataURL('image/png'); a.click();
    toast('海報已下載');
    if (typeof navigator !== 'undefined' && navigator.canShare && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      c.toBlob(blob => {
        if (!blob) return;
        try {
          const file = new File([blob], 'topwarlords-15.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: 'TopWarlords 名將戰報',
              text: `我在《頂尖對戰：15元名將聯合作戰》打出 ${res.vp.A.total.toFixed(0)} : ${res.vp.B.total.toFixed(0)} VP！陣容代碼：${encodeDeck(state.deck)}`
            }).catch(() => {});
          }
        } catch (_) {}
      }, 'image/png');
    }
  }

  window.__deferredPwaPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredPwaPrompt = e;
    const btn = document.getElementById('btnPwaInstallPrompt');
    if (btn) {
      btn.innerHTML = '📲 系統已準備就緒，立即安裝 APP';
      btn.classList.add('available');
    }
  });

  function showHelp(activeTab = 'rules', ctx = {}) {
    const $ = ctx.$ || (sel => document.querySelector(sel));
    const LS = ctx.LS;
    const toast = ctx.toast || (() => {});
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    $('#helpCard').innerHTML = `
  <div class="help-header-bar">
    <div class="help-tabs-nav" role="tablist">
      <button class="help-tab-btn ${activeTab === 'rules' ? 'active' : ''}" data-tab="rules" id="tabBtnRules">
        <span class="tab-icon">📖</span> 遊戲玩法手冊
      </button>
      <button class="help-tab-btn ${activeTab === 'install' ? 'active' : ''}" data-tab="install" id="tabBtnInstall">
        <span class="tab-icon">📱</span> 手機 APP 安裝指南 <span class="tab-badge">推薦</span>
      </button>
    </div>
    <button class="btn ghost sm x help-close-btn" id="helpClose" title="關閉手冊">關閉 ✕</button>
  </div>

  <div class="help-tab-panel" id="helpPanelRules" ${activeTab === 'rules' ? '' : 'hidden'}>
    <h2>📖 現代立體聯合作戰指引</h2>
    <p class="muted">用 $15 預算組建五大作戰槽位，與對手進行一分鐘現代立體聯合作戰推演。</p>

    <h3>一、組隊規則</h3>
    <ul>
      <li><b>五大專屬槽位</b>：制空打擊 (AIR)、重裝鐵騎 (ARM)、區域防空 (ADS)、制海權威 (NAV)、情報／長程打擊 (ISR) 各選 1 件，不可重複或留空。</li>
      <li><b>總預算 $15 限額</b>：單位造價由 $1 至 $5 不等，只要總造價不超標，可自由配置多個 $5 頂級主力單位（如 F-22、九九式改、愛國者 PAC-3、維吉尼亞級等）。</li>
      <li><b>收錄 200 位日韓中純歷史名將</b>：每個槽位提供 5 種價位、每種價位各有 A～E 共 5 款不同特性軍武。可隨時點擊右上角「調撥戰區軍火」重新補給候選陣容。</li>
    </ul>

    <h3>二、四大核心模式</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">⚡ 戰術演習</div>
        <div class="help-desc">
          <b>單人演訓模式</b>：內含 <b>⚡ 快速交鋒</b>（迎戰 7 大AI對手流派風格，並可自由切換 6 種戰場天候場景）、<b>🎯 精選破局</b>（以 $15 標準預算挑戰 $19~$25 超標 BOSS 殘局）與 <b>🧪 沙盒模擬</b>（一鍵推演 100~300 場蒙地卡羅大數據檢驗全天候勝率與戰損）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">⚔️ 多局鏖戰</div>
        <div class="help-desc">
          <b>錦標對抗賽制</b>：支援單人闖關與 <b>🌐 線上即時開房對戰</b>！可自訂 <b>BO3 (3局2勝) / BO5 (5局3勝) / BO7 (7局4勝)</b>，並可自選戰場場景。支援 <b>🔒 開戰鎖定 (Ban 1)</b>（首局開戰後鎖定軍火庫，敗方享有戰術反制權禁用敵方 1 件主力）與 <b>🎲 自由調撥 (Ban 2)</b>（每局重新洗牌調撥，雙方各 Ban 2 件進行深度博弈）兩大軍火庫規則。
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
          <b>單淘汰冠軍盃</b>：支援單人挑戰與 <b>🌐 線上多人即時開房／世界盃自動配對</b> 的 8 強／16 強單淘汰樹狀盃賽，一戰定生死，爭奪頂尖指揮官榮譽金盃！
        </div>
      </div>
    </div>

    <h3>三、三階段推演與勝負</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">階段一 · 電戰先制</div>
        <div class="help-desc">
          <b>電磁奪權與縱深反導</b>：比拼全隊電戰值（EW）奪取電磁優勢；SEAD 反輻射飛彈優先獵殺主動雷達防空（刺針／柳樹等被動紅外防空不易被鎖定），薩德／S-500 則可在高空動能攔截敵方先制飛彈。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">階段二 · 海空爭奪</div>
        <div class="help-desc">
          <b>防空攔截與制空制海</b>：區域防空優先遠程攔截突防敵機（享有 <b>×2.5</b> 傷害加成）；存活戰機展開空中纏鬥奪取制空；神盾艦與潛艦進行立體制海對決。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">階段三 · 聯合決戰</div>
        <div class="help-desc">
          <b>三階真實彈艙遞減（上限 10 輪）</b>：每單位依累計開火波次自動由<b>主要彈藥 (100%) ➔ 次要彈藥 (78%) ➔ 自衛副武裝＆過熱 (52%)</b> 真實遞減；第 6 輪起連續交火暴露方位提升鎖定命中。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">勝負判定標準</div>
        <div class="help-desc">
          <b>全殲優先 · 彈盡 VP 裁定</b>：優先以全殲敵軍判定勝利；若激戰滿 10 輪雙方仍有存活載具，則觸發 <b>[WINCHESTER 彈藥耗盡]</b> 脫離接觸，由<b>殘存戰力 ＋ 戰場控制 ＋ 以弱勝強</b>戰略積分（VP）裁定勝負。
        </div>
      </div>
    </div>

    <h3>四、戰術教條（賽前 3 選 1）</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">⚔ 先發制人</div>
        <div class="help-desc">
          階段一、二攻擊火力 <b>+12%</b>，但承受傷害 <b>+5%</b>（適合長程精準刺殺、高速斬首突擊流派）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🛡 縱深防禦</div>
        <div class="help-desc">
          全隊承受傷害 <b>−12%</b>，防空攔截敵機命中率 <b>+6%</b>（適合重裝甲抗揍、陣地防守反擊與消耗戰）。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">📡 電子欺敵</div>
        <div class="help-desc">
          全隊電戰值 <b>×1.5 倍</b>（大幅強化奪取電磁優勢機會），並使敵方全體命中率 <b>−8%</b>（適合迴避流與反制高命中昂貴大殺器）。
        </div>
      </div>
    </div>

    <h3>五、五大聯合作戰體系與電戰指標</h3>
    <div class="help-grid-list">
      <div class="help-row">
        <div class="help-badge">📡 協同接戰 (CEC)</div>
        <div class="help-desc">
          高階預警機 (EW≥50) ＋ 遠程防空／神盾艦 ➔ 啟動全隊電戰 <b>+12</b>、防空命中率 <b>+6%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🛸 有人無人 (MUM-T)</div>
        <div class="help-desc">
          $5 五代空優戰機 ＋ 無人機／巡飛彈／無人快艇 ➔ 支援與無人單位傷害 <b>+15%</b>、全隊隱匿 <b>+5</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">🌊 立體獵殺 (ASW)</div>
        <div class="help-desc">
          反潛艦／潛艦 ＋ 電戰機／校射偵蒐 (EW≥15 或 SPOT) ➔ 制海命中率 <b>+6%</b>、海軍傷害 <b>+12%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">⚙ 步坦協同 (Land)</div>
        <div class="help-desc">
          重裝甲／主動防護戰車 ＋ 自走砲／前觀校射支援 ➔ 階段三裝甲與火砲傷害 <b>+10%</b>。
        </div>
      </div>
      <div class="help-row">
        <div class="help-badge">⚡ 電磁壓制 (EW)</div>
        <div class="help-desc">
          全隊電戰總值超越對手 <b>≥ 10</b> 點時奪取電磁優勢，敵方全體命中率最高 <b>−15%</b>、我方火力最高 <b>+8%</b>。
        </div>
      </div>
    </div>
  </div>

  <div class="help-tab-panel" id="helpPanelInstall" ${activeTab === 'install' ? '' : 'hidden'}>
    <div class="pwa-hero-banner">
      <div class="pwa-hero-title">📱 免商店下載 · 一鍵加到手機主畫面</div>
      <div class="pwa-hero-desc">
        本遊戲採用 <b>PWA (Progressive Web App)</b> 現代標準打造，無需經過應用商店繁瑣審查或等待超大安裝包，只要將網頁加到主畫面，立即化身為<b>獨立全螢幕的原生級 APP</b>！
      </div>
    </div>

    <div class="pwa-smart-card">
      <div class="pwa-smart-info">
        <h4>⚡ 原生一鍵安裝通道 ${isStandalone ? '（當前環境已以 APP 模式執行）' : ''}</h4>
        <p>若您的瀏覽器支援 PWA 原生喚起，點擊右方按鈕即可直接呼叫系統安裝視窗；若無反應，請參考下方對應系統之圖文步驟。</p>
      </div>
      <button class="btn pwa-install-action-btn" id="btnPwaInstallPrompt">
        ${isStandalone ? '✅ 目前已是 APP 獨立模式' : (window.__deferredPwaPrompt ? '📲 立即安裝至桌面 (一鍵喚起)' : '📲 點擊啟動一鍵安裝')}
      </button>
    </div>

    <div class="pwa-platform-grid">
      <div class="pwa-platform-card android">
        <div class="platform-card-header">
          <div class="platform-card-title">🤖 Android 裝置安裝指南</div>
          <span class="platform-card-badge">Chrome / Edge 推薦</span>
        </div>
        <ol class="pwa-steps-list">
          <li class="pwa-step-item">
            <span class="step-num">1</span>
            <div class="step-body">使用手機 <b>Chrome</b> 或 <b>Edge</b> 瀏覽器開啟遊戲網址。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">2</span>
            <div class="step-body">點擊右上角「<b>選單按鈕（三個點 ⋮）</b>」，或網址列右側的「<b>安裝圖示 (⤓)</b>」。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">3</span>
            <div class="step-body">在跳出清單中點選「<b>加到主畫面</b>」或「<b>安裝應用程式 (Install App)</b>」。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">4</span>
            <div class="step-body">確認點擊「<b>安裝</b>」，桌面上即會生成專屬的《頂尖對決》APP 圖示！</div>
          </li>
        </ol>
      </div>

      <div class="pwa-platform-card ios">
        <div class="platform-card-header">
          <div class="platform-card-title">🍏 iPhone / iPad (iOS) 安裝指南</div>
          <span class="platform-card-badge">Apple Safari 專屬</span>
        </div>
        <ol class="pwa-steps-list">
          <li class="pwa-step-item">
            <span class="step-num">1</span>
            <div class="step-body">請務必使用 iPhone 內建的 <b>Safari 瀏覽器</b> 開啟遊戲（請勿使用 LINE 或 FB 內置瀏覽器）。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">2</span>
            <div class="step-body">點擊螢幕底部工具列正中央的「<b>分享按鈕</b>（方框帶向上箭頭 ⎋）」。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">3</span>
            <div class="step-body">在動作選單中向下滑動，找到並點選「<b>加入主畫面 (Add to Home Screen) ➕</b>」。</div>
          </li>
          <li class="pwa-step-item">
            <span class="step-num">4</span>
            <div class="step-body">點擊右上角的「<b>新增</b>」，手機桌面即成功建立獨立 APP，點擊即享無網址列全螢幕體驗！</div>
          </li>
        </ol>
      </div>
    </div>

    <div class="pwa-features-box">
      <div class="pwa-features-title">✨ 原生 APP 模式專屬特點</div>
      <div class="pwa-features-grid">
        <div class="pwa-feature-card">
          <h5>📺 沉浸全螢幕</h5>
          <p>徹底隱藏瀏覽器網址列與分頁欄，擴大 15% 可視操作空間，戰鬥交火更震撼。</p>
        </div>
        <div class="pwa-feature-card">
          <h5>⚡ 秒速本地啟動</h5>
          <p>核心兵種圖資與音效快取至本機，秒開秒進，低延遲流暢推演。</p>
        </div>
        <div class="pwa-feature-card">
          <h5>☁️ 跨裝置戰績同步</h5>
          <p>與線上對戰、天梯 RP 完全相通，搭配「雲端指揮官中心」隨時無痛換機。</p>
        </div>
        <div class="pwa-feature-card">
          <h5>🛡️ 零耗能免權限</h5>
          <p>容量僅數 MB，不要求相簿或通訊錄權限，安全純粹的古代名將戰略推演。</p>
        </div>
      </div>
    </div>
  </div>`;

    const tabs = $('#helpCard').querySelectorAll('.help-tab-btn');
    tabs.forEach(btn => {
      btn.onclick = () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;
        $('#helpPanelRules').hidden = (target !== 'rules');
        $('#helpPanelInstall').hidden = (target !== 'install');
      };
    });

    $('#helpModal').hidden = false;
    $('#helpClose').onclick = () => {
      $('#helpModal').hidden = true;
      if (LS) LS.set('wl15_seen', 1);
    };
    $('#helpModal').onclick = (e) => {
      if (e.target === $('#helpModal')) {
        $('#helpModal').hidden = true;
        if (LS) LS.set('wl15_seen', 1);
      }
    };

    const btnInstall = $('#btnPwaInstallPrompt');
    if (btnInstall) {
      btnInstall.onclick = async () => {
        if (window.__deferredPwaPrompt) {
          window.__deferredPwaPrompt.prompt();
          const choice = await window.__deferredPwaPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            toast('🎉 已送出安裝要求，請在手機主畫面查看！');
          }
          window.__deferredPwaPrompt = null;
        } else if (isStandalone) {
          toast('🎖️ 目前已在《頂尖對決》APP 獨立模式中運行！');
        } else if (isIOS) {
          toast('🍏 iPhone / iPad 請點擊 Safari 底部「分享 (⎋)」➔「加入主畫面 ➕」即可安裝！', 4500);
        } else {
          toast('💡 請點選瀏覽器右上角選單 (⋮) ➔ 點選「加到主畫面」或「安裝應用程式」！', 4500);
        }
      };
    }
  }

  window.PosterHelpModule = { downloadPoster, showHelp, roundRect };
})();

