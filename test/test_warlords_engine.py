# -*- coding: utf-8 -*-
"""
測試 TopWarlords data.js 與 engine.js 在真實瀏覽器環境下的推演正確性
"""
import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
PORT = 8128

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.0)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 建立簡單的測試頁面注入 data.js 和 engine.js
        test_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script src="http://localhost:{PORT}/js/data.js"></script>
<script src="http://localhost:{PORT}/js/ladder-data.js"></script>
<script src="http://localhost:{PORT}/js/engine.js"></script>
<script src="http://localhost:{PORT}/js/online-pvp.js"></script>
</body>
</html>"""
        (ROOT / "test_sandbox.html").write_text(test_html, encoding="utf-8")

        page.goto(f"http://localhost:{PORT}/test_sandbox.html")

        # 執行推演測試
        page.on("console", lambda msg: print("PAGE LOG:", msg.text))
        page.on("pageerror", lambda err: print("PAGE ERROR:", err))

        res = page.evaluate("""async () => {
            const errs = [];
            const units = (typeof UNITS !== 'undefined') ? UNITS : window.UNITS;
            const unitMap = (typeof UNIT_MAP !== 'undefined') ? UNIT_MAP : window.UNIT_MAP;

            if (!units || units.length !== 125) {
                errs.push('UNITS 數量不為 125，當前：' + (units ? units.length : 0));
            }
            const exportedUnits = await (await fetch('/all_warlords.json')).json();
            if (JSON.stringify(exportedUnits) !== JSON.stringify(units)) errs.push('完整JSON匯出與正式資料不同步');
            const compactUnits = await (await fetch('/tools/all_units.json')).json();
            if (compactUnits.length !== units.length || compactUnits.some(unit => !unitMap[unit.id] || Object.entries(unit).some(([field, value]) => value !== unitMap[unit.id][field]))) errs.push('精簡JSON匯出與正式資料不同步');
            if (units.some(unit => !unit.historicalAudit || !unit.historicalAudit.status || !Array.isArray(unit.historicalAudit.sources))) {
                errs.push('每位名將必須標記史實核查狀態與來源清單');
            }
            if (unitMap.TIANDAN?.historicalAudit?.status !== 'source-linked' || unitMap.EULJI?.historicalAudit?.status !== 'qualified') {
                errs.push('田單／乙支文德的史實核查結論未保留');
            }
            const categoryCounts = Object.fromEntries(
                ['air', 'armor', 'air_defense', 'naval', 'support'].map(cat =>
                    [cat, units.filter(unit => unit.cat === cat).length]
                )
            );
            if (Object.values(categoryCounts).some(count => count !== 25)) {
                errs.push('五大兵團未各有 25 位：' + JSON.stringify(categoryCounts));
            }
            if (!window.LADDER_PRESETS || window.LADDER_PRESETS.length !== 100) {
                errs.push('天梯預設軍團數量錯誤');
            } else {
                for (const preset of window.LADDER_PRESETS) {
                    const presetUnits = preset.deck.map(id => unitMap[id]);
                    const presetCats = presetUnits.map(unit => unit?.cat);
                    if (presetUnits.length !== 5 || presetUnits.some(unit => !unit) || new Set(preset.deck).size !== 5 || new Set(presetCats).size !== 5) {
                        errs.push('天梯預設必須各軍種一位且不得重複：' + preset.id);
                    }
                }
            }
            for (const template of TEMPLATES) {
                for (const id of template.ids) {
                    if (!unitMap[id]) errs.push('陣容範本引用無效武將：' + id);
                }
            }
            for (const [id, flag] of [
                ['TOYOTOMI', '🇯🇵'],
                ['HOJO_UJIYASU', '🇯🇵'],
                ['SHIMAZU_YOSHIHISA', '🇯🇵'],
                ['CAOCAO', '🇨🇳'],
                ['XIAHOU_DUN', '🇨🇳']
            ]) {
                if (!unitMap || !unitMap[id] || unitMap[id].flag !== flag) {
                    errs.push('新增名將缺漏或國籍錯誤：' + id);
                }
            }
            if (units.some(unit => !Number.isInteger(unit.cost) || unit.cost < 1 || unit.cost > 5)) {
                errs.push('名將成本必須是 1–5 的整數');
            }
            for (const cat of ['air', 'armor', 'air_defense', 'naval', 'support']) {
                for (let cost = 1; cost <= 5; cost++) {
                    const count = units.filter(unit => unit.cat === cat && unit.cost === cost).length;
                    if (count !== 5) errs.push(`${cat} $${cost} 應有 5 位：${count}`);
                }
            }
            const sameRoleDeck = units.filter(unit => unit.cat === 'air' && unit.cost === 1).slice(0, 5).map(unit => unit.id);
            if (sameRoleDeck.length !== 5 || validateDeck(sameRoleDeck, 15, []).length === 0) {
                errs.push('五名同一軍種的將領必須被編組規則拒絕');
            }
            if (units.some(u => !u.skill || !u.skill.name || !u.skill.desc)) {
                errs.push('存在缺少專屬戰法 (skill) 之武將');
            }
            const effectFields = new Set(['damage', 'hit', 'armorPierce', 'missingHpDamage', 'woundedTargetDamage', 'highCostDamage', 'terrainDamage', 'bonusVs', 'heal', 'guard', 'teamGuard', 'teamHit', 'enemyHit', 'commandAttack']);
            for (const unit of units) {
                const effects = unit.skill?.effects;
                if (!effects || !Object.keys(effects).length) {
                    errs.push('缺少明確技能效果：' + unit.id);
                    continue;
                }
                for (const [field, value] of Object.entries(effects)) {
                    if (!effectFields.has(field)) errs.push('未實作技能欄位：' + unit.id + '/' + field);
                    if (field === 'bonusVs') {
                        for (const [cat, bonus] of Object.entries(value)) {
                            if (!(cat in categoryCounts) || !Number.isFinite(bonus) || bonus < 0 || bonus > 1) errs.push('軍種克制資料錯誤：' + unit.id);
                        }
                    } else if (!Number.isFinite(value) || value < 0 || value > (field === 'damage' ? 2 : 1)) {
                        errs.push('技能效果範圍錯誤：' + unit.id + '/' + field);
                    }
                }
                if (!unit.skill.desc.includes('每戰一次')) errs.push('技能說明缺少觸發限制：' + unit.id);
            }
            const skillAttacker = id => makeTeam([id], 'A', [], 'plain')[0];
            const fixtureIds = ['__MATCHUP_ATTACKER', '__MATCHUP_TARGET'];
            try {
                const fixture = (id, cat, extra = {}) => ({
                    id, name: id, cat, cost: 1, hp: 10000000, atk: 1000, def: 0,
                    st: 0, ew: 0, traits: [], roleFlags: [], ...extra
                });
                const firstDamage = (attackerCat, targetCat, attackerExtra = {}, targetExtra = {}, phase = 3) => {
                    UNIT_MAP[fixtureIds[0]] = fixture(fixtureIds[0], attackerCat, attackerExtra);
                    UNIT_MAP[fixtureIds[1]] = fixture(fixtureIds[1], targetCat, { atk: 0, ...targetExtra });
                    for (let seed = 1; seed <= 30; seed++) {
                        const battle = resolveBattle([fixtureIds[0]], [fixtureIds[1]], {
                            seed, event: EVENTS.find(e => e.id === 'clear'),
                            formationsA: ['square'], formationsB: ['square']
                        });
                        const line = battle.frames.filter(frame => frame.phase === phase).flatMap(frame => frame.lines)
                            .find(line => line.auid === `${fixtureIds[0]}-A0` && line.kind === 'hit');
                        if (line) return line.dmg;
                    }
                    throw new Error('No successful matchup fixture attack');
                };
                const normal = firstDamage('armor', 'armor');
                const armored = firstDamage('armor', 'armor', {}, { def: 0.5 });
                if (Math.abs(armored - normal * 0.5) > 1) errs.push('實際護甲減傷未達 50%');
                const pierce = firstDamage('armor', 'armor', { traits: ['TRUE_AT'] });
                const pierceArmored = firstDamage('armor', 'armor', { traits: ['TRUE_AT'] }, { def: 0.5 });
                if (pierce !== pierceArmored) errs.push('真傷未忽略護甲');
                const skill = bonus => ({ phase: 'P3', name: 'fixture', desc: 'fixture', effects: { damage: 1, bonusVs: { armor: bonus } } });
                const baseSkill = firstDamage('armor', 'armor', { skill: skill(0) });
                const bonusSkill = firstDamage('armor', 'armor', { skill: skill(0.3) });
                if (Math.abs(bonusSkill - baseSkill * 1.3) > 1) errs.push('專屬兵種增傷未實際達 30%');
                const partialPierce = firstDamage('armor', 'armor', {
                    skill: { ...skill(0), effects: { damage: 1, armorPierce: 0.4 } }
                }, { def: 0.5 });
                if (Math.abs(partialPierce - baseSkill * 0.7) > 1) errs.push('40% 技能破甲未正確降低護甲效果');
                if (!getCombatMatchup({ cat: 'armor' }, { cat: 'armor', def: 0.5 }, 3, false, false, 0.4).includes('40%')) errs.push('部分破甲提示與實際效果不符');
                const intercept = firstDamage('air_defense', 'air', {}, {}, 2);
                const formationScale = 0.9 * 0.78 * 0.88;
                if (intercept < Math.round(2125 * formationScale) || intercept > Math.round(2875 * formationScale)) errs.push('神射階段二攔截未實際使用 2.5 倍攻擊');
                const plainShot = firstDamage('air_defense', 'armor');
                if (plainShot < Math.round(595 * formationScale) || plainShot > Math.round(805 * formationScale)) errs.push('神射無突騎時平射未實際使用 0.7 倍攻擊');
                if (intercept <= plainShot * 2.5) errs.push('神射攔截與平射缺少實際傷害差異');
            } finally {
                for (const id of fixtureIds) delete UNIT_MAP[id];
            }
            const skillTarget = skillAttacker('BAIQI');
            const burst = skillAttacker('LUBU');
            if (getSkillAttackModifiers(burst, skillTarget, 3).damage !== 1.3 || getSkillAttackModifiers(burst, skillTarget, 2).damage !== 1) errs.push('爆發／階段限制錯誤');
            burst.skillUsed = true;
            if (getSkillAttackModifiers(burst, skillTarget, 3).damage !== 1) errs.push('已使用技能仍重複增傷');
            const wounded = skillAttacker('XIAHOU_DUN');
            wounded.hp = wounded.hpMax / 2;
            if (Math.abs(getSkillAttackModifiers(wounded, skillTarget, 3).damage - 1.28) > 1e-9) errs.push('受創爆發未按缺失兵力計算');
            const executioner = skillAttacker('BAIQI');
            skillTarget.hp = skillTarget.hpMax / 2;
            if (Math.abs(getSkillAttackModifiers(executioner, skillTarget, 3).damage - 1.32) > 1e-9) errs.push('斬殺未按目標缺失兵力計算');
            if (getSkillAttackModifiers(skillAttacker('LIGUANG'), skillTarget, 2).armorPierce !== 0.45) errs.push('神射穿甲效果缺漏');
            if (Math.abs(getSkillAttackModifiers(skillAttacker('ZHANGLIAO'), skillTarget, 3).damage - 1.38) > 1e-9) errs.push('越級技能未按費用判定');
            const terrainFighter = skillAttacker('MENGHUO');
            if (Math.abs(getSkillAttackModifiers(terrainFighter, skillTarget, 3, 'forest').damage - getSkillAttackModifiers(terrainFighter, skillTarget, 3, 'plain').damage - 0.12) > 1e-9) errs.push('地形技能未生效');
            if (Math.abs(getSkillAttackModifiers(skillAttacker('YANGYE'), skillAttacker('HUO'), 3).damage - 1.43) > 1e-9) errs.push('反騎技能未按軍種判定');
            const recoveryDeck = ['ZHAOYUN', 'HOJO_UJIYASU', 'LIGUANG', 'CHOSOKABE', 'ZHUGELIANG'];
            let recoveryObserved = false;
            let guardObserved = false;
            let effectDifferenceObserved = false;
            const skillBattleState = battle => ['A', 'B'].map(side => battle.final[side].map(({ uid, hp, dmgDone, skillGuard }) => ({ uid, hp, dmgDone, skillGuard })));
            for (let seed = 0; seed < 16; seed++) {
                const options = { seed, formationsA: Array(5).fill('fishscale'), formationsB: Array(5).fill('fishscale') };
                const enabled = resolveBattle(recoveryDeck, recoveryDeck, options);
                const activations = enabled.frames.flatMap(frame => frame.lines.map(line => ({ ...line, phase: frame.phase }))).filter(line => line.skillActivation);
                const activationIds = new Set();
                for (const activation of activations) {
                    if (activationIds.has(activation.auid)) errs.push('專屬技能一場重複發動：' + activation.auid);
                    activationIds.add(activation.auid);
                    const unit = enabled.final.A.concat(enabled.final.B).find(unit => unit.uid === activation.auid);
                    if (unit.skill.phase !== 'P' + activation.phase) errs.push('技能發動階段錯誤：' + unit.id);
                    recoveryObserved ||= activation.hpRestored > 0;
                    guardObserved ||= unit.skillGuard > 0;
                }
                const savedEffects = unitMap.ZHAOYUN.skill.effects;
                let disabled;
                try {
                    unitMap.ZHAOYUN.skill.effects = null;
                    disabled = resolveBattle(recoveryDeck, recoveryDeck, options);
                } finally {
                    unitMap.ZHAOYUN.skill.effects = savedEffects;
                }
                effectDifferenceObserved ||= JSON.stringify(skillBattleState(enabled)) !== JSON.stringify(skillBattleState(disabled));
                if (JSON.stringify(enabled.frames) !== JSON.stringify(resolveBattle(recoveryDeck, recoveryDeck, options).frames)) errs.push('同種子技能戰鬥不再確定性');
            }
            if (!recoveryObserved || !guardObserved || !effectDifferenceObserved) errs.push('技能回復、防護或啟用／停用對照未生效');
            if (unitMap.CAOCAO && (unitMap.CAOCAO.cost !== 4 || unitMap.CAOCAO.cat !== 'support')) {
                errs.push('曹操定位錯誤');
            }
            if (unitMap.XIAHOU_DUN && (unitMap.XIAHOU_DUN.cost !== 2 || unitMap.XIAHOU_DUN.cat !== 'armor')) {
                errs.push('夏侯惇定位錯誤');
            }
            if (unitMap.IINAOMASA && (unitMap.IINAOMASA.cost !== 3 || unitMap.IINAOMASA.cat !== 'armor')) {
                errs.push('井伊直政費用／兵種錯誤');
            }
            if (!(unitMap.LUXUN.cost > unitMap.LUSU.cost && unitMap.LUXUN.ew > unitMap.LUSU.ew && unitMap.LUSU.ew >= unitMap.PANGTONG.ew)) {
                errs.push('陸遜 > 魯肅 >= 龐統 全域歷史排序未落實');
            }
            for (const [navalId, cost] of [['XIEXUAN', 5], ['TIANDAN', 2], ['LUMENG', 5], ['CAOBIN', 2], ['YISUNSIN', 5], ['GANNING', 3]]) {
                if (!unitMap[navalId] || unitMap[navalId].cat !== 'naval' || unitMap[navalId].cost !== cost) {
                    errs.push('先登奇兵費用／定位錯誤: ' + navalId);
                }
            }
            for (const [id, cat] of [['ZHOUYU', 'support'], ['YAMAMOTO', 'support'], ['TIANDAN', 'naval'], ['SUNCE', 'air'], ['SUNJIAN', 'armor'], ['LIUBOWEN', 'support']]) {
                if (!unitMap[id] || unitMap[id].cat !== cat) errs.push(id + ' 分類錯誤或缺漏');
            }
            const removedIds = [
                'FUMA', 'KEIJI', 'OBATA', 'HULU', 'ZANGBA', 'CAOZHANG', 'DIQING', 'LIDIAN', 'PANMEI', 'NIWA',
                'LIUYU', 'YANGSU', 'CHENTANG', 'WEIXIAOKUAN', 'SEOHUI', 'KIMBUSHIK', 'EKEI', 'MASANOBU',
                'FANLI', 'CHENGYU', 'PANGJUAN', 'NAOIE', 'SESSAI', 'MASASHIGE', 'WENPING', 'QUYI', 'CAOZHEN',
                'CAOCHUN', 'MENGGONG', 'ZUTI', 'GAOSHUN', 'MANCHONG', 'YUWENTAI', 'GANGCHO', 'SANADA_NOB',
                'WANGPING', 'MILYU', 'TSUDA_SAN', 'GENGGONG', 'SHIMOTSUMA', 'WANGBA', 'KUKI_MORI', 'MIURA',
                'BAEJEONG', 'TAKAKAGE', 'CHENGONG', 'GANGGAMCHAN'
            ];
            for (const id of removedIds) {
                if (unitMap[id]) errs.push('已移除武將仍存在：' + id);
            }
            if (!unitMap || !unitMap['ZHUGELIANG']) {
                errs.push('找不到 諸葛亮 (ZHUGELIANG)');
            } else {
                const zgl = unitMap['ZHUGELIANG'];
                if (zgl.cost !== 5 || zgl.cat !== 'support') {
                    errs.push('諸葛亮費用或兵種錯誤: cost=' + zgl.cost + ', cat=' + zgl.cat);
                }
            }

            // 測試隨機合法組隊
            const rng = mulberry32(12345);
            const deckA = randomDeck(rng);
            const deckB = randomDeck(rng);

            if (!deckA || deckA.length !== 5) errs.push('randomDeck A 生成失敗');
            if (!deckB || deckB.length !== 5) errs.push('randomDeck B 生成失敗');

            const valA = validateDeck(deckA);
            const valB = validateDeck(deckB);
            if (valA.length > 0) errs.push('deckA 驗證錯誤: ' + valA.join(', '));
            if (valB.length > 0) errs.push('deckB 驗證錯誤: ' + valB.join(', '));

            // 測試單場推演
            const battle = resolveBattle(deckA, deckB, { seed: 999 });
            if (!battle || !battle.winner) errs.push('戰鬥推演無結果');
            if (!battle.vp || !battle.vp.A || !battle.vp.B) errs.push('VP 結算失敗');

            const skillDeckA = ['DENGAI', 'BAIQI', 'LIGUANG', 'YISUNSIN', 'YAMAMOTO'];
            const skillDeckB = ['XIAHOUYUAN', 'XIANGYU', 'JUMONG', 'GANNING', 'HANBEI'];
            const phaseSkillsTriggered = new Set();
            for (let seed = 0; seed < 48 && phaseSkillsTriggered.size < 3; seed++) {
                const skillBattle = resolveBattle(skillDeckA, skillDeckB, {
                    seed,
                    docA: 'defense',
                    docB: 'defense',
                    event: EVENTS.find(event => event.id === 'clear'),
                    formationsA: Array(5).fill('fishscale'),
                    formationsB: Array(5).fill('fishscale')
                });
                for (let index = 0; index < skillDeckA.length; index++) {
                    const unit = unitMap[skillDeckA[index]];
                    if (skillBattle.frames.some(frame => frame.phase === Number(unit.skill.phase.slice(1)) && frame.lines.some(line => line.auid === `${unit.id}-A${index}` && line.brevity === unit.skill.name))) {
                        phaseSkillsTriggered.add(unit.skill.phase);
                    }
                }
            }
            if (!['P1', 'P2', 'P3'].every(phase => phaseSkillsTriggered.has(phase))) {
                errs.push('專屬戰法未依 P1/P2/P3 在對應階段觸發: ' + JSON.stringify([...phaseSkillsTriggered]));
            }

            const ambushDeckA = ['ZHANGLIAO', 'BAIQI', 'LIGUANG', 'YISUNSIN', 'YAMAMOTO'];
            const ambushDeckB = ['HUO', 'XIANGYU', 'JUMONG', 'TIANDAN', 'HANBEI'];
            let cavalryAmbushObserved = false;
            let navalAmbushObserved = false;
            let repeatedAmbush = false;
            for (let seed = 0; seed < 32 && !(cavalryAmbushObserved && navalAmbushObserved); seed++) {
                const ambushBattle = resolveBattle(ambushDeckA, ambushDeckB, {
                    seed,
                    docA: 'defense',
                    docB: 'defense',
                    event: EVENTS.find(event => event.id === 'clear'),
                    formationsA: Array(5).fill('fishscale'),
                    formationsB: Array(5).fill('fishscale')
                });
                const ambushLines = ambushBattle.frames.flatMap(frame => frame.lines).filter(line => line.ambushActivation);
                const cavalryLines = ambushLines.filter(line => line.auid === 'ZHANGLIAO-A0');
                const navalLines = ambushLines.filter(line => line.auid === 'TIANDAN-B3');
                cavalryAmbushObserved = cavalryAmbushObserved || cavalryLines.length > 0;
                navalAmbushObserved = navalAmbushObserved || navalLines.length > 0;
                repeatedAmbush = repeatedAmbush || cavalryLines.length > 1 || navalLines.length > 1;
            }
            if (!cavalryAmbushObserved || !navalAmbushObserved || repeatedAmbush) errs.push('騎兵與水軍奇襲應各自跨軍種觸發且每場至多一次');

            const formationDeck = ['HUO', 'BAIQI', 'LIGUANG', 'YISUNSIN', 'ZHUGELIANG'];
            const neutralFormations = Array(5).fill('fishscale');
            const gooseBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 0,
                formationsA: Array(5).fill('goose'),
                formationsB: neutralFormations
            });
            const enemyById = new Map(gooseBattle.final.B.map(unit => [unit.uid, unit]));
            const gooseRearHit = gooseBattle.frames.flatMap(frame => frame.lines).some(line =>
                line.auid === formationDeck[2] + '-A2' && ['support', 'air_defense'].includes(enemyById.get(line.tuid)?.cat)
            );
            if (!gooseRearHit) errs.push('雁行未能攻擊敵軍後列');
            const gooseCannotCapture = !gooseBattle.frames.flatMap(frame => frame.lines).some(line =>
                line.auid === formationDeck[2] + '-A2' && line.kind === 'capture'
            );
            if (!gooseCannotCapture) errs.push('雁行部隊不應俘虜敵將');
            let normalCaptureObserved = false;
            for (let seed = 0; seed < 32 && !normalCaptureObserved; seed++) {
                const normalCaptureBattle = resolveBattle(formationDeck, formationDeck, {
                    seed,
                    formationsA: neutralFormations,
                    formationsB: neutralFormations
                });
                normalCaptureObserved = normalCaptureBattle.frames.flatMap(frame => frame.lines).some(line => line.kind === 'capture');
            }
            if (!normalCaptureObserved) {
                errs.push('一般陣形未產生戰鬥俘虜事件');
            }

            const craneDeck = ['HUO', 'XIANGYU', 'LIGUANG', 'YISUNSIN', 'ZHUGELIANG'];
            let craneBattle;
            for (let seed = 0; seed < 32; seed++) {
                craneBattle = resolveBattle(craneDeck, craneDeck, {
                    seed,
                    formationsA: Array(5).fill('crane'),
                    formationsB: neutralFormations
                });
                if (craneBattle.vp.A.occupationCtl > 0) break;
            }
            if (craneBattle.vp.A.occupationCtl <= 0) errs.push('鶴翼存活樣本未取得區域控制分');

            const mountainBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 1,
                formationsA: Array(5).fill('longsnake'),
                formationsB: neutralFormations,
                terrain: 'mountain'
            });
            if (mountainBattle.final.A[0].formationAttack !== 1.5 || mountainBattle.final.A[0].formationDefense !== 1.5) {
                errs.push('長蛇山地攻防加成不是 1.5');
            }

            const barbarianDeck = formationDeck.slice();
            barbarianDeck[3] = 'MENGHUO';
            const fourYiBattle = resolveBattle(barbarianDeck, formationDeck, {
                seed: 12,
                formationsA: Array(5).fill('fourYi'),
                formationsB: neutralFormations,
                terrain: 'forest'
            });
            if (fourYiBattle.final.A[3].formation !== 'fourYi' || fourYiBattle.final.A[3].formationAttack !== 1.5) {
                errs.push('孟獲四夷森林加成未套用');
            }
            const fourYiMountain = resolveBattle(barbarianDeck, formationDeck, {
                seed: 12,
                formationsA: Array(5).fill('fourYi'),
                formationsB: neutralFormations,
                terrain: 'mountain'
            });
            if (fourYiMountain.final.A[3].formationAttack !== 1.5) errs.push('孟獲四夷山岳加成未套用');
            if (fourYiBattle.final.A.some(unit => unit.formation !== 'fourYi' || unit.formationTacticChance !== 0.14)) errs.push('四夷未套用全軍');
            if (makeTeam(formationDeck, 'A', neutralFormations, 'plain').some(unit => unit.formationTacticChance !== 0.06)) errs.push('魚鱗基礎戰法率未提高');
            const migrated = makeTeam(formationDeck, 'A', ['square', 'goose', 'cone', 'crane', 'longsnake'], 'plain');
            if (migrated.some(unit => unit.formation !== 'square')) errs.push('舊混合陣形未統一為首個有效陣形');
            if (new Set(getRecommendedFormations(barbarianDeck, 'forest')).size !== 1) errs.push('AI推薦仍混用陣形');
            if (getBattleEnvironment(EVENTS.find(event => event.id === 'strait'), 'plain').terrain !== 'mountain'
                || getBattleEnvironment(EVENTS.find(event => event.id === 'urban'), 'forest').scene !== 'city'
                || getBattleEnvironment(EVENTS.find(event => event.id === 'plain'), 'mountain').terrain !== 'plain') {
                errs.push('場景選項與實際地貌不一致');
            }
            const ineligibleFourYi = resolveBattle(formationDeck, formationDeck, {
                seed: 12,
                formationsA: ['fourYi', ...neutralFormations.slice(1)],
                formationsB: neutralFormations,
                terrain: 'forest'
            });
            if (ineligibleFourYi.final.A[0].formation !== 'fishscale') errs.push('非異族武將不應使用四夷');

            const duelBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 1,
                formationsA: neutralFormations,
                formationsB: neutralFormations
            });
            const squareBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 1,
                formationsA: Array(5).fill('square'),
                formationsB: neutralFormations
            });
            const duels = result => result.frames.flatMap(frame => frame.lines).filter(line => line.duel).length;
            if (duels(duelBattle) !== 1 || duels(squareBattle) !== 0) errs.push('方圓單挑免疫判定錯誤');
            if (squareBattle.final.A.some(unit => unit.formationDuelImmune !== true)) errs.push('方圓免單挑狀態未進入結算單位');

            const hashFormations = Array(5).fill('fishscale');
            const baseHash = await OnlinePvPEngine.computeCommitHashAsync(deckA, 'strike', 'test-salt', hashFormations, 'plain');
            const repeatHash = await OnlinePvPEngine.computeCommitHashAsync(deckA, 'strike', 'test-salt', hashFormations, 'plain');
            const formationHash = await OnlinePvPEngine.computeCommitHashAsync(deckA, 'strike', 'test-salt', ['cone', ...hashFormations.slice(1)], 'plain');
            const terrainHash = await OnlinePvPEngine.computeCommitHashAsync(deckA, 'strike', 'test-salt', hashFormations, 'forest');
            const pvpHashChecks = {
                stable: baseHash === repeatHash,
                includesFormation: baseHash !== formationHash,
                includesTerrain: baseHash !== terrainHash
            };
            if (!pvpHashChecks.stable || !pvpHashChecks.includesFormation || !pvpHashChecks.includesTerrain) {
                errs.push('PvP commit hash 未完整涵蓋陣形／地形');
            }

            // 測試 100 場快速批次推演
            let aWins = 0, bWins = 0, draws = 0;
            for (let i = 0; i < 100; i++) {
                const dA = randomDeck(rng);
                const dB = randomDeck(rng);
                const b = resolveBattle(dA, dB, { seed: i * 37 });
                if (b.winner === 'A') aWins++;
                else if (b.winner === 'B') bWins++;
                else draws++;
            }

            let finaleBattle = null;
            for (let i = 0; i < 1000 && !finaleBattle; i++) {
                const dA = randomDeck(mulberry32(i * 2 + 1701));
                const dB = randomDeck(mulberry32(i * 2 + 1702));
                const candidate = resolveBattle(dA, dB, { seed: i * 997 + 41 });
                if (candidate.finale) finaleBattle = candidate;
            }
            if (!finaleBattle) {
                errs.push('未能找到觸發總衝鋒的確定性測試戰局');
            } else {
                const finaleKills = finaleBattle.frames.flatMap(frame => frame.lines).filter(line => line.finale && line.kind === 'kill');
                const remainingA = finaleBattle.final.A.filter(unit => unit.alive).length;
                const remainingB = finaleBattle.final.B.filter(unit => unit.alive).length;
                if (!finaleBattle.frames.some(frame => frame.finale === 'charge')) errs.push('總衝鋒事件框缺漏');
                if (!finaleBattle.wipeout || finaleKills.length === 0) errs.push('總衝鋒未記錄有效殲滅事件');
                if (finaleBattle.winner === 'A' && remainingB !== 0) errs.push('總衝鋒後敵軍仍有存活將領');
                if (finaleBattle.winner === 'B' && remainingA !== 0) errs.push('總衝鋒後我軍仍有存活將領');
                if (finaleBattle.winner === 'draw' && (remainingA !== 0 || remainingB !== 0)) errs.push('平手總衝鋒未以雙方覆滅收場');
            }

            return {
                unitCount: units ? units.length : 0,
                zhugeLiang: unitMap ? unitMap['ZHUGELIANG'] : null,
                deckA: deckA ? deckA.map(id => unitMap[id].name) : [],
                deckB: deckB ? deckB.map(id => unitMap[id].name) : [],
                battleWinner: battle ? battle.winner : null,
                vpA: battle ? battle.vp.A.total : 0,
                vpB: battle ? battle.vp.B.total : 0,
                framesCount: battle ? battle.frames.length : 0,
                formationMobility: BATTLE_FORMATION_DEFS.find(formation => formation.id === 'cone').mobility,
                fourYi: [fourYiBattle.final.A[3].formation, fourYiBattle.final.A[3].formationAttack],
                fourYiMountain: fourYiMountain.final.A[3].formationAttack,
                gooseRearHit,
                gooseCannotCapture,
                normalCaptures: normalCaptureObserved,
                craneOccupation: craneBattle.vp.A.occupationCtl,
                duelCounts: { normal: duels(duelBattle), square: duels(squareBattle) },
                pvpHashChecks,
                batch100: { aWins, bWins, draws },
                finale: finaleBattle ? {
                    winner: finaleBattle.winner,
                    annihilationKills: finaleBattle.frames.flatMap(frame => frame.lines).filter(line => line.finale && line.kind === 'kill').length
                } : null,
                errs
            };
        }""")

        assert len(res["errs"]) == 0, f"推演測試失敗: {res['errs']}"
        print("[PASS] 1. 125 位日韓中歷史名將全鑑載入成功：共", res["unitCount"], "位")
        print("[PASS] 2. 諸葛亮定位成功驗證：", res["zhugeLiang"]["name"], f"(${res['zhugeLiang']['cost']} {res['zhugeLiang']['cat']}) 稱號: {res['zhugeLiang']['tag']}")
        print("[PASS] 3. 隨機合法隊伍生成通過：")
        print("   隊伍 A:", " / ".join(res["deckA"]))
        print("   隊伍 B:", " / ".join(res["deckB"]))
        print("[PASS] 4. 單場古戰場推演成功！勝者:", res["battleWinner"], f"(VP: {res['vpA']} vs {res['vpB']}) 總回合幀數:", res["framesCount"])
        print("[PASS] 5. 野戰陣形規則通過：雁行後列", res["gooseRearHit"], "鶴翼佔領", res["craneOccupation"], "單挑", res["duelCounts"], "錐行機動", res["formationMobility"])
        print("[PASS] 6. 100 場隨機名將陣容大數據批次模擬成功！戰果:", res["batch100"])
        print("[PASS] 7. 十輪未分勝負時，總衝鋒殲滅流程通過：", res["finale"])

        browser.close()
finally:
    server.terminate()
    if (ROOT / "test_sandbox.html").exists():
        (ROOT / "test_sandbox.html").unlink()

print("\n🎉 TopWarlords 核心引擎與名將資料庫推演測試 100% 通過！")
