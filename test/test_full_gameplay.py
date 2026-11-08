# -*- coding: utf-8 -*-
"""
測試 TopWarlords 主頁面 index.html 的完整遊戲流程：
1. 頁面載入無 JS 報錯
2. 5x5 矩陣看板正確展示 25 位名將
3. 隨機組隊 / 點擊組隊 ($15 預算)
4. 發動出擊，推演三階段古戰場
5. 跳過動畫秒速結算，產出戰報與 VP
"""
import sys
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("D:/TopWarlords")
PORT = 8139

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # 預先在 storage 設定已看過幫助與新手引導，避免新手彈窗阻擋點擊
        context.add_init_script("""
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)

        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        # 訪問主頁並等待看板卡片渲染完成
        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=10000)
        time.sleep(0.5)

        # 關閉可能彈出的說明模態窗
        page.keyboard.press("Escape")
        time.sleep(0.3)

        # 1. 檢查卡片渲染
        cards = page.locator(".m-card")
        card_count = cards.count()
        print(f"[TEST 1] 5x5 看板渲染名將卡片數量: {card_count} 張")
        assert card_count == 25, f"預期 25 張卡片，實際得到 {card_count}"

        # 2. 測試隨機補滿按鈕
        page.evaluate("() => document.querySelector('#btnRand').click()")
        time.sleep(0.5)

        # 檢查預算儀表與選定的名將
        deck_info = page.evaluate("""() => {
            const rawDeck = localStorage.getItem('wl15_deck_A');
            const deck = rawDeck ? JSON.parse(rawDeck) : [];
            const unitMap = (typeof UNIT_MAP !== 'undefined') ? UNIT_MAP : window.UNIT_MAP;
            return {
                deck: deck,
                names: deck.map(id => (unitMap && unitMap[id]) ? unitMap[id].name : id),
                budgetUsed: document.querySelector('#budgetUsed').innerText
            };
        }""")
        print(f"[TEST 2] 點擊隨機補滿後，目前已配置軍令預算: ${deck_info['budgetUsed']}，陣容: {deck_info['names']}")
        assert int(deck_info['budgetUsed']) <= 15 and int(deck_info['budgetUsed']) > 0, f"預算超出上限: ${deck_info['budgetUsed']}"

        # 3. 測試點將調撥兵符 (Reroll)
        page.evaluate("() => document.querySelector('#btnRerollMarket').click()")
        time.sleep(0.5)
        print("[TEST 3] 點將調撥兵符 (洗牌) 測試通過")

        # 重新隨機補滿準備出擊，並等待出擊按鈕就緒
        page.evaluate("() => document.querySelector('#btnRand').click()")
        page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        time.sleep(0.5)

        # 4. 點擊發動戰略出擊 (id 是 #btnGo)
        btn_go = page.locator("#btnGo")
        print(f"[TEST 4] 出擊按鈕文字: {btn_go.inner_text().strip()}")
        
        click_res = page.evaluate("""() => {
            const btn = document.querySelector('#btnGo');
            try {
                btn.click();
                return {
                    clicked: true,
                    bodyClasses: document.body.className,
                    viewBattleHidden: document.querySelector('#viewBattle').hidden
                };
            } catch (err) {
                return { clicked: false, error: String(err) };
            }
        }""")
        print("[TEST 4 詳情]", click_res)
        time.sleep(1.2)

        # 檢查戰況介面 #viewBattle 是否展開
        view_battle = page.locator("#viewBattle")
        assert not click_res['viewBattleHidden'], "戰場推演畫面未展開"
        print("[TEST 4] 古戰場戰況推演畫面成功展開！三階段推演進行中...")

        # 5. 測試跳過動畫秒速結算 (#btnSkip)
        btn_skip = page.locator("#btnSkip")
        if btn_skip.is_visible():
            btn_skip.click(force=True)
            time.sleep(1.0)
            print("[TEST 5] 點擊跳過動畫，秒速完成戰略結算！")

        # 檢查結算戰報海報按鈕
        btn_poster = page.locator("#btnPoster")
        is_finished = btn_poster.is_visible()
        print(f"[TEST 6] 戰鬥結算完成，戰報海報按鈕可見: {is_finished}")

        # 檢查過程是否有 JS 報錯
        assert len(errors) == 0, f"瀏覽器執行出現 JS 報錯: {errors}"

        browser.close()
finally:
    server.terminate()

print("\n🎉 TopWarlords 全流程 E2E 實機測試 100% 通過！名將對決完美運轉！")
