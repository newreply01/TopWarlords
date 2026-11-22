'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords)
   戰後深層數據遙測、史實羈絆展示與參謀復盤模組
   ===================================================== */
(function (root) {
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function sumMetrics(units) {
    const list = Array.isArray(units) ? units : [];
    const out = { dmgDone: 0, dmgTaken: 0, skillDmg: 0, statusDmg: 0, healed: 0, dodges: 0, blocks: 0 };
    for (const u of list) {
      if (!u) continue;
      out.dmgDone += Math.round(u.dmgDone || 0);
      out.dmgTaken += Math.round(u.dmgTaken || 0);
      out.skillDmg += Math.round(u.skillDmg || 0);
      out.statusDmg += Math.round(u.statusDmg || 0);
      out.healed += Math.round(u.healed || 0);
      out.dodges += Math.round(u.dodges || 0);
      out.blocks += Math.round(u.blocks || 0);
    }
    return out;
  }

  function buildMetricRow(label, icon, valA, valB) {
    const a = Math.max(0, Number(valA) || 0);
    const b = Math.max(0, Number(valB) || 0);
    const total = a + b;
    const pctA = total > 0 ? Math.round((a / total) * 100) : 50;
    const pctB = 100 - pctA;
    return `
      <div class="ra-metric-row">
        <div class="ra-metric-head">
          <b class="ra-val-a ${a > b ? 'is-lead' : ''}">${a}</b>
          <span class="ra-metric-lbl">${escapeHtml(icon)} ${escapeHtml(label)}</span>
          <b class="ra-val-b ${b > a ? 'is-lead' : ''}">${b}</b>
        </div>
        <div class="ra-metric-bar">
          <div class="ra-fill-a" style="width:${pctA}%"></div>
          <div class="ra-fill-b" style="width:${pctB}%"></div>
        </div>
      </div>
    `;
  }

  function buildBondsHtml(bonds, sideTitle, sideCls) {
    const list = Array.isArray(bonds) ? bonds : [];
    if (!list.length) {
      return `<div class="ra-bonds-col ${sideCls}"><span class="ra-bonds-lbl">${escapeHtml(sideTitle)}：</span><span class="ra-bond-empty">無史實羈絆</span></div>`;
    }
    const pills = list.map(b =>
      `<span class="bond-pill" title="${escapeHtml(b.desc || '')}">${escapeHtml((b.icon || '🏛️') + ' ' + (b.name || '史實羈絆'))}</span>`
    ).join('');
    return `<div class="ra-bonds-col ${sideCls}"><span class="ra-bonds-lbl">${escapeHtml(sideTitle)}：</span>${pills}</div>`;
  }

  function buildAdviceList(res, mySide) {
    const enemySide = mySide === 'A' ? 'B' : 'A';
    const myUnits = (res && res.final && res.final[mySide]) || [];
    const enemyUnits = (res && res.final && res.final[enemySide]) || [];
    const myBonds = (res && res.bonds && res.bonds[mySide]) || [];
    const mySyns = (res && res.syn && res.syn[mySide]) || [];
    const won = res && res.winner === mySide;
    const advice = [];

    const enemySorted = enemyUnits.slice().sort((x, y) => (y?.dmgDone || 0) - (x?.dmgDone || 0));
    const topEnemy = enemySorted[0];
    if (topEnemy && (topEnemy.dmgDone || 0) > 150) {
      const counterHint = {
        air: '神射強弩（如李廣、養由基）可於階段二以 2.5 倍火力優先攔截敵方突騎。',
        armor: '具備「破甲重擊 (TRUE_AT)」之名將或火計軍師可有效貫穿重甲高防壁壘。',
        air_defense: '高隱匿突騎或「十面埋伏 / 先制破陣」軍師可於階段一搶先瓦解敵方弩陣。',
        naval: '具備「看破伏兵 (ASW)」之先登或高謀略軍師可反制敵方奇兵夜襲。',
        support: '提高全軍謀略總值或改採「難知如陰」教條可奪回階段一奇謀壓制權。'
      }[topEnemy.cat] || '調整站位與兵種互克比例以限制敵方核心發揮。';
      advice.push(`敵方主輸出為 <b>${escapeHtml(topEnemy.name)}</b>（${Math.round(topEnemy.dmgDone || 0)} 傷害），建議：${escapeHtml(counterHint)}`);
    }

    const enemyMetrics = sumMetrics(enemyUnits);
    if (enemyMetrics.statusDmg >= 45) {
      advice.push(`敵方累計透過灼燒／計策異常造成 <b>${enemyMetrics.statusDmg}</b> 額外傷害，可強化防禦陣型或提前擊破敵軍火攻軍師。`);
    } else if (!myBonds.length && !mySyns.length) {
      advice.push(won
        ? '本戰未啟動陣勢或史實羈絆仍獲勝；若進階挑戰更高難度，可嘗試搭配同時代／同勢力名將進一步放大勝勢。'
        : '本陣尚未觸發軍陣協同或史實羈絆，點將時可留意頂部羈絆提示燈與金色史實徽章以獲取全軍加成。');
    } else if (myBonds.length > 0 && advice.length < 2) {
      advice.push(`本戰成功啟動「<b>${escapeHtml(myBonds.map(b => b.name).join('、'))}</b>」史實羈絆，建議維持核心連動骨架再微調對位兵種。`);
    }

    if (!advice.length) {
      advice.push(won
        ? '全軍攻防節奏均衡，各項戰術指標表現穩健，可續用此編制征戰沙場。'
        : '建議檢視戰場天候修正與階段三存活率，適度調高重甲坦度或防空火力。');
    }
    return advice.slice(0, 2);
  }

  function buildBattleBreakdownHtml(res, mySide = 'A') {
    if (!res || !res.final) return '';
    const enemySide = mySide === 'A' ? 'B' : 'A';
    const mA = sumMetrics(res.final[mySide]);
    const mB = sumMetrics(res.final[enemySide]);
    const bondsA = (res.bonds && res.bonds[mySide]) || [];
    const bondsB = (res.bonds && res.bonds[enemySide]) || [];
    const adviceList = buildAdviceList(res, mySide);

    return `
      <div class="result-analytics-card">
        <div class="intel-card-title">📈 戰術遙測細項與參謀復盤 (TACTICAL ANALYTICS)</div>
        <div class="ra-bonds-row">
          ${buildBondsHtml(bondsA, '🔵 我方史實羈絆', 'side-a')}
          ${buildBondsHtml(bondsB, '🔴 敵方史實羈絆', 'side-b')}
        </div>
        <div class="ra-metrics-grid">
          ${buildMetricRow('無雙戰法傷害', '⚔️', mA.skillDmg, mB.skillDmg)}
          ${buildMetricRow('灼燒／異常傷害', '🔥', mA.statusDmg, mB.statusDmg)}
          ${buildMetricRow('承受總傷害', '🩸', mA.dmgTaken, mB.dmgTaken)}
          ${buildMetricRow('戰場兵力回復', '💚', mA.healed, mB.healed)}
          ${buildMetricRow('奇襲閃避次數', '💨', mA.dodges, mB.dodges)}
          ${buildMetricRow('重甲格擋次數', '🛡️', mA.blocks, mB.blocks)}
        </div>
        <div class="ra-advisor">
          <div class="ra-advisor-title">🧭 軍師實戰換陣建議</div>
          <ul class="ra-advisor-list">
            ${adviceList.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  const api = { escapeHtml, buildBattleBreakdownHtml };
  if (typeof window !== 'undefined') window.WarlordAnalytics = api;
  if (root) root.WarlordAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

