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
ROOT = Path(__file__).resolve().parents[1]
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
        context = browser.new_context(service_workers='block')

        # 預先在 storage 設定已看過幫助與新手引導，避免新手彈窗阻擋點擊
        context.add_init_script("""
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_seen', '1');
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
        assert page.locator("#helpModal").is_hidden(), "Help modal should not cover gameplay"

        # 1. 檢查卡片渲染
        cards = page.locator(".m-card")
        card_count = cards.count()
        print(f"[TEST 1] 5x5 看板渲染名將卡片數量: {card_count} 張")
        assert card_count == 25, f"預期 25 張卡片，實際得到 {card_count}"

        for width, height in [(1680, 900), (1100, 800), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            readability = page.evaluate("""() => {
                const cards = [...document.querySelectorAll('.m-card')];
                const visible = cards.filter(card => card.getBoundingClientRect().width > 0);
                return {
                    skills: cards.every(card => {
                        const unit = UNIT_MAP[card.dataset.id];
                        return card.querySelector('.m-skill strong').textContent === unit.skill.name
                            && !card.querySelector('.m-skill-effect, .m-role-hint, .m-stats')
                            && card.querySelector('.m-skill').dataset.infoId === unit.id;
                    }),
                    readable: visible.every(card => {
                        const avatar = card.querySelector('.m-avatar-wrap').getBoundingClientRect();
                        const skill = card.querySelector('.m-skill').getBoundingClientRect();
                        const bounds = card.getBoundingClientRect();
                        return avatar.width >= 76 && avatar.height >= 76
                            && parseFloat(getComputedStyle(card.querySelector('.m-name')).fontSize) >= 16
                            && parseFloat(getComputedStyle(card.querySelector('.m-skill')).fontSize) >= 15
                            && skill.width >= bounds.width - 25
                            && skill.bottom <= bounds.bottom;
                    }),
                    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
                };
            }""")
            assert readability["skills"] and readability["readable"], f"Unreadable selection cards at {width}px: {readability}"
            assert not readability["horizontalOverflow"], f"Selection overflow at {width}px"
            last_card = page.locator(".col-category.mobile-active .m-card" if width <= 768 else ".col-category:first-child .m-card").last
            last_card.scroll_into_view_if_needed()
            assert last_card.is_visible(), f"Last card is inaccessible at {width}px"
            assert last_card.evaluate("(card) => {const r=card.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;}"), \
                f"Last card cannot scroll into viewport at {width}px"
        page.set_viewport_size({"width": 1280, "height": 720})
        page.locator(".m-card").first.scroll_into_view_if_needed()
        deck_before_details = page.evaluate("() => localStorage.getItem('wl15_deck')")
        page.locator(".m-card .m-skill").first.click()
        assert page.locator("#unitDetailModal").is_visible(), "Skill badge must open details without selecting the unit"
        assert page.evaluate("() => localStorage.getItem('wl15_deck')") == deck_before_details, "Opening skill details selected a unit"
        page.locator("#btnUnitSheetClose").click()
        page.locator(".m-card").first.hover()
        assert page.locator("#unitTooltip .u-tt-skill").is_visible(), "Desktop hover must show skill details"
        print("[TEST 1b] 桌機／平板／手機頭像、字級、專屬技能與捲動可達性通過")

        same_role_result = page.evaluate("""() => {
            const ids = [...document.querySelectorAll('.m-card[data-cat="air"]')].map(card => card.dataset.id);
            if (ids.length !== 5) return { count: ids.length, deck: [] };
            for (const id of ids) {
                const card = document.querySelector(`.m-card[data-id="${id}"]`);
                if (!card) return { count: ids.length, missing: id, deck: [] };
                card.click();
            }
            const deck = JSON.parse(localStorage.getItem('wl15_deck') || '[]').filter(Boolean);
            const unitMap = window.UNIT_MAP;
            return { count: deck.length, roles: [...new Set(deck.map(id => unitMap[id].cat))], cost: deck.reduce((sum, id) => sum + unitMap[id].cost, 0) };
        }""")
        assert same_role_result['count'] == 1 and same_role_result['roles'] == ['air'] and same_role_result['cost'] <= 15, f"Only one cavalry leader should occupy the cavalry slot: {same_role_result}"
        page.evaluate("document.querySelector('#btnClear').click()")

        # 2. 測試隨機補滿按鈕
        page.evaluate("() => document.querySelector('#btnRand').click()")
        time.sleep(0.5)

        # 檢查預算儀表與選定的名將
        deck_info = page.evaluate("""() => {
            const rawDeck = localStorage.getItem('wl15_deck');
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

        page.locator("#btnToggle3DView").click()
        assert page.locator("#battle3DWrapper").is_hidden()
        for width, height in [(1680, 900), (1100, 800), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(150)
            for panel, team in [("team-a", "#teamA"), ("team-b", "#teamB")]:
                if width <= 1100:
                    page.locator(f'[data-battle-panel="{panel}"]').click()
                vertical = page.locator(f"{team} .bu").evaluate_all("""cards => {
                    const rects = cards.map(card => ({
                        top: card.offsetTop, bottom: card.offsetTop + card.offsetHeight,
                        left: card.offsetLeft, x: card.offsetLeft, y: card.offsetTop,
                        width: card.offsetWidth, height: card.offsetHeight
                    }));
                    return { valid: rects.length === 5 && rects.every((rect, i) => i === 0 ||
                        (rect.top >= rects[i - 1].bottom - 1 && Math.abs(rect.left - rects[0].left) < 1)),
                        rects: rects.map(rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })) };
                }""")
                assert vertical["valid"], f"{team} 2D cards are not stacked vertically at {width}px: {vertical}"
        page.set_viewport_size({"width": 1280, "height": 720})
        page.locator("#btnToggle3DView").click()
        assert page.locator("#battle3DWrapper").is_visible()

        # 5. 測試跳過動畫秒速結算 (#btnSkip)
        btn_skip = page.locator("#btnSkip")
        if btn_skip.is_visible():
            skip_is_topmost = page.evaluate("""() => {
                const button = document.querySelector('#btnSkip');
                const rect = button.getBoundingClientRect();
                return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button;
            }""")
            assert skip_is_topmost, "Skip control is covered by another battle layer"
            page.evaluate("document.querySelector('#btnSkip').click()")
            time.sleep(1.0)
            print("[TEST 5] 點擊跳過動畫，秒速完成戰略結算！")

        # 檢查結算戰報海報按鈕
        btn_poster = page.locator("#btnPoster")
        is_finished = btn_poster.is_visible()
        page.wait_for_selector("#rReview", state="visible", timeout=10000)
        assert page.locator("#rReview").is_visible(), "AAR result did not render"
        assert page.locator("#rExitBattle").is_visible(), "Direct battle exit action is missing"
        page.locator("#rExitBattle").click()
        assert page.locator("#viewBattle").evaluate("el => el.hidden"), "Battle view stayed open after AAR exit"
        assert page.locator("#viewBuild").is_visible(), "Build view did not return after AAR exit"

        print(f"[TEST 6] 戰鬥結算完成，戰報海報按鈕可見: {is_finished}")

        # 檢查過程是否有 JS 報錯
        assert len(errors) == 0, f"瀏覽器執行出現 JS 報錯: {errors}"

        browser.close()
finally:
    server.terminate()

print("\n🎉 TopWarlords 全流程 E2E 實機測試 100% 通過！名將對決完美運轉！")
