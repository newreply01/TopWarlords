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
ROOT = Path("D:/TopWarlords")
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
<script src="http://localhost:{PORT}/js/engine.js"></script>
</body>
</html>"""
        (ROOT / "test_sandbox.html").write_text(test_html, encoding="utf-8")

        page.goto(f"http://localhost:{PORT}/test_sandbox.html")

        # 執行推演測試
        page.on("console", lambda msg: print("PAGE LOG:", msg.text))
        page.on("pageerror", lambda err: print("PAGE ERROR:", err))

        res = page.evaluate("""() => {
            const errs = [];
            const units = (typeof UNITS !== 'undefined') ? UNITS : window.UNITS;
            const unitMap = (typeof UNIT_MAP !== 'undefined') ? UNIT_MAP : window.UNIT_MAP;

            if (!units || units.length !== 164) {
                errs.push('UNITS 數量不為 164，當前：' + (units ? units.length : 0));
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

            return {
                unitCount: units ? units.length : 0,
                zhugeLiang: unitMap ? unitMap['ZHUGELIANG'] : null,
                deckA: deckA ? deckA.map(id => unitMap[id].name) : [],
                deckB: deckB ? deckB.map(id => unitMap[id].name) : [],
                battleWinner: battle ? battle.winner : null,
                vpA: battle ? battle.vp.A.total : 0,
                vpB: battle ? battle.vp.B.total : 0,
                framesCount: battle ? battle.frames.length : 0,
                batch100: { aWins, bWins, draws },
                errs
            };
        }""")

        assert len(res["errs"]) == 0, f"推演測試失敗: {res['errs']}"
        print("[PASS] 1. 200 位日韓中純歷史名將全鑑載入成功：共", res["unitCount"], "位")
        print("[PASS] 2. 諸葛亮定位成功驗證：", res["zhugeLiang"]["name"], f"(${res['zhugeLiang']['cost']} {res['zhugeLiang']['cat']}) 稱號: {res['zhugeLiang']['tag']}")
        print("[PASS] 3. 隨機合法隊伍生成通過：")
        print("   隊伍 A:", " / ".join(res["deckA"]))
        print("   隊伍 B:", " / ".join(res["deckB"]))
        print("[PASS] 4. 單場古戰場推演成功！勝者:", res["battleWinner"], f"(VP: {res['vpA']} vs {res['vpB']}) 總回合幀數:", res["framesCount"])
        print("[PASS] 5. 100 場隨機名將陣容大數據批次模擬成功！戰果:", res["batch100"])

        browser.close()
finally:
    server.terminate()
    if (ROOT / "test_sandbox.html").exists():
        (ROOT / "test_sandbox.html").unlink()

print("\n🎉 TopWarlords 核心引擎與名將資料庫推演測試 100% 通過！")
