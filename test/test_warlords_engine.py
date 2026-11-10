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
                    const presetCats = preset.deck.map(id => unitMap[id]?.cat);
                    if (presetCats.length !== 5 || presetCats.some(cat => !cat) || new Set(presetCats).size !== 5) {
                        errs.push('天梯預設陣容不完整或引用無效武將：' + preset.id);
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
            for (const cat of ['air', 'armor', 'air_defense', 'naval', 'support']) {
                for (let c = 1; c <= 5; c++) {
                    const cnt = units.filter(u => u.cat === cat && u.cost === c).length;
                    if (cnt !== 5) errs.push(`${cat} $${c} 數量不為 5: ${cnt}`);
                }
            }
            if (units.some(u => !u.skill || !u.skill.name || !u.skill.desc)) {
                errs.push('存在缺少專屬戰法 (skill) 之武將');
            }
            if (unitMap.CAOCAO && (unitMap.CAOCAO.cost !== 4 || unitMap.CAOCAO.cat !== 'support')) {
                errs.push('曹操定位錯誤');
            }
            if (unitMap.XIAHOU_DUN && (unitMap.XIAHOU_DUN.cost !== 3 || unitMap.XIAHOU_DUN.cat !== 'armor')) {
                errs.push('夏侯惇定位錯誤');
            }
            if (!(unitMap.PANGTONG.cost > unitMap.LUSU.cost && unitMap.PANGTONG.ew > unitMap.LUSU.ew && unitMap.LUSU.ew > unitMap.LUXUN.ew)) {
                errs.push('龐統 > 魯肅 > 陸遜 排序未落實');
            }
            for (const nav5 of ['XIEXUAN', 'TIANDAN', 'LUMENG', 'CAOBIN', 'YISUNSIN']) {
                if (!unitMap[nav5] || unitMap[nav5].cat !== 'naval' || unitMap[nav5].cost !== 5) {
                    errs.push('先登奇兵 $5 統帥定位錯誤: ' + nav5);
                }
            }
            for (const [id, cat] of [['ZHOUYU', 'support'], ['PANGJUAN', 'support'], ['TIANDAN', 'naval'], ['SUNCE', 'air'], ['SUNJIAN', 'armor'], ['LIUBOWEN', 'support']]) {
                if (!unitMap[id] || unitMap[id].cat !== cat) errs.push(id + ' 分類錯誤或缺漏');
            }
            const removedIds = [
                'FUMA', 'KEIJI', 'OBATA', 'HULU', 'ZANGBA', 'CAOZHANG', 'DIQING', 'LIDIAN', 'PANMEI', 'NIWA',
                'LIUYU', 'YANGSU', 'CHENTANG', 'WEIXIAOKUAN', 'SEOHUI', 'KIMBUSHIK', 'EKEI', 'MASANOBU',
                'FANLI', 'CHENGYU', 'YAMAMOTO', 'NAOIE', 'SESSAI', 'MASASHIGE', 'WENPING', 'QUYI', 'CAOZHEN',
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

            const formationDeck = ['HUO', 'BAIQI', 'LIGUANG', 'YISUNSIN', 'ZHUGELIANG'];
            const neutralFormations = Array(5).fill('fishscale');
            const gooseBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 0,
                formationsA: ['fishscale', 'fishscale', 'goose', 'fishscale', 'fishscale'],
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
            const normalCaptureBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 0,
                formationsA: neutralFormations,
                formationsB: neutralFormations
            });
            if (!normalCaptureBattle.frames.flatMap(frame => frame.lines).some(line => line.kind === 'capture')) {
                errs.push('一般陣形未產生戰鬥俘虜事件');
            }

            const craneDeck = ['HUO', 'XIANGYU', 'LIGUANG', 'YISUNSIN', 'ZHUGELIANG'];
            const craneBattle = resolveBattle(craneDeck, craneDeck, {
                seed: 16,
                formationsA: ['fishscale', 'crane', 'fishscale', 'fishscale', 'fishscale'],
                formationsB: neutralFormations
            });
            if (craneBattle.vp.A.occupationCtl <= 0) errs.push('存活鶴翼未取得區域控制分');

            const mountainBattle = resolveBattle(formationDeck, formationDeck, {
                seed: 1,
                formationsA: ['longsnake', ...neutralFormations.slice(1)],
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
                formationsA: ['fishscale', 'fishscale', 'fishscale', 'fourYi', 'fishscale'],
                formationsB: neutralFormations,
                terrain: 'forest'
            });
            if (fourYiBattle.final.A[3].formation !== 'fourYi' || fourYiBattle.final.A[3].formationAttack !== 1.5) {
                errs.push('孟獲四夷森林加成未套用');
            }
            const fourYiMountain = resolveBattle(barbarianDeck, formationDeck, {
                seed: 12,
                formationsA: ['fishscale', 'fishscale', 'fishscale', 'fourYi', 'fishscale'],
                formationsB: neutralFormations,
                terrain: 'mountain'
            });
            if (fourYiMountain.final.A[3].formationAttack !== 1.5) errs.push('孟獲四夷山岳加成未套用');
            if (fourYiBattle.final.A[0].formationTacticChance !== 0.06) errs.push('魚鱗基礎戰法率未提高');
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
                normalCaptures: normalCaptureBattle.frames.flatMap(frame => frame.lines).filter(line => line.kind === 'capture').length,
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
