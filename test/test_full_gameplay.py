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
    [sys.executable, "-c",
     "import functools, http.server, sys; "
     "http.server.ThreadingHTTPServer.request_queue_size = 128; "
     "http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), "
     "functools.partial(http.server.SimpleHTTPRequestHandler, directory=sys.argv[2])).serve_forever()",
     str(PORT), str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(service_workers='block')
        context.set_default_timeout(60000)

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
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=10000)
        time.sleep(0.5)

        # 關閉可能彈出的說明模態窗
        assert page.locator("#helpModal").is_hidden(), "Help modal should not cover gameplay"

        # 1. 檢查卡片渲染
        cards = page.locator(".m-card")
        card_count = cards.count()
        print(f"[TEST 1] 5x5 看板渲染名將卡片數量: {card_count} 張")
        assert card_count == 25, f"預期 25 張卡片，實際得到 {card_count}"
        theme_colors = []
        for theme in ['dark', 'light']:
            if page.locator('html').get_attribute('data-theme') != theme:
                page.locator('#btnTheme').click()
            colors = page.evaluate("""() => {
                const skill = getComputedStyle(document.querySelector('.m-skill'));
                const stats = getComputedStyle(document.querySelector('.m-stats'));
                const rgb = color => color.match(/[\\d.]+/g).slice(0, 3).map(Number);
                const luminance = channels => channels.map(v => {
                    v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
                }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
                const contrast = (a, b) => {
                    const x = luminance(a), y = luminance(b);
                    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
                };
                const backgrounds = skill.backgroundImage.match(/rgb\\([^)]+\\)/g).map(rgb);
                return { foreground: skill.color, background: skill.backgroundImage, stats: stats.color,
                    contrast: Math.min(...backgrounds.map(bg => contrast(rgb(skill.color), bg))) };
            }""")
            assert colors['contrast'] >= 4.5, f"Skill plaque contrast failed in {theme}: {colors}"
            theme_colors.append(colors)
        assert theme_colors[0]['foreground'] != theme_colors[1]['foreground']
        assert theme_colors[0]['background'] != theme_colors[1]['background']
        assert theme_colors[0]['stats'] != theme_colors[1]['stats']

        for width, height in [(1680, 900), (1440, 900), (1366, 768), (1280, 720), (1273, 588), (1019, 470), (1100, 800), (390, 844), (320, 740)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(200)
            readability = page.evaluate("""() => {
                const cards = [...document.querySelectorAll('.m-card')];
                const visible = cards.filter(card => card.getBoundingClientRect().width > 0);
                return {
                    skills: cards.every(card => {
                        const unit = UNIT_MAP[card.dataset.id];
                        const nation = card.querySelector('.m-nation');
                        const phase = card.querySelector('.m-skill-phase');
                        const expectedThirdVal = unit.cat === 'armor'
                            ? `${Math.round((unit.def || 0) * 100)}%`
                            : String(Math.max(unit.ew, unit.st));
                        const expectedThirdLabel = unit.cat === 'armor'
                            ? `甲 ${expectedThirdVal}`
                            : `${unit.ew > unit.st ? '謀' : '隱'} ${expectedThirdVal}`;
                        const expectedThirdAria = unit.cat === 'armor'
                            ? `護甲減傷 ${expectedThirdVal}`
                            : `${unit.ew > unit.st ? '謀略' : '隱匿'} ${expectedThirdVal}`;
                        return card.querySelector('.m-skill strong').textContent === unit.skill.name
                            && !card.querySelector('.m-skill-effect, .m-role-hint')
                            && !card.querySelector('.m-avatar-wrap .m-env-badge')
                            && Boolean(nation && ['中', '日', '韓', '將'].includes(nation.textContent.trim()))
                            && (!unit.skill.phase || (phase && phase.textContent.trim() === unit.skill.phase))
                            && card.querySelector('.m-card-info-col .m-skill').dataset.infoId === unit.id
                            && [...card.querySelectorAll('.m-stats b')].map(value => value.textContent).join(',')
                                === [unit.hp, unit.atk, expectedThirdVal].join(',')
                            && card.querySelector('.m-stats span:last-child').textContent.trim() === expectedThirdLabel
                            && card.querySelector('.m-stats span:last-child').getAttribute('aria-label') === expectedThirdAria;
                    }),
                    readable: visible.every(card => {
                        const avatar = card.querySelector('.m-avatar-wrap').getBoundingClientRect();
                        const skill = card.querySelector('.m-skill').getBoundingClientRect();
                        const info = card.querySelector('.m-card-info-col').getBoundingClientRect();
                        const stats = card.querySelector('.m-stats').getBoundingClientRect();
                        const statCells = [...card.querySelectorAll('.m-stats span')].map(cell => cell.getBoundingClientRect());
                        const briefEl = card.querySelector('.m-mobile-brief');
                        const briefStyle = briefEl ? getComputedStyle(briefEl) : null;
                        const briefRect = briefEl ? briefEl.getBoundingClientRect() : null;
                        const bounds = card.getBoundingClientRect();
                        const compact = innerWidth > 768 && innerHeight <= 540;
                        const portrait = card.querySelector('.m-avatar-img');
                        const mobileBriefOk = !briefEl ? false : (
                            innerWidth > 768
                                ? briefStyle.display === 'none'
                                : (briefStyle.display !== 'none' && briefRect.height > 0 && briefRect.height <= 24
                                   && briefRect.right <= info.right + 1 && briefRect.bottom <= bounds.bottom + 0.5)
                        );
                        return Math.abs(avatar.height - (bounds.height - 2 * parseFloat(getComputedStyle(card).borderTopWidth))) <= 1
                            && Math.abs(avatar.width - Math.min(avatar.height,
                                card.querySelector('.m-card-main-row').clientWidth * 0.4)) <= 1
                            && getComputedStyle(portrait).objectFit === 'cover'
                            && avatar.right <= info.left
                            && parseFloat(getComputedStyle(card.querySelector('.m-name')).fontSize) >= (compact ? 13 : 14)
                            && parseFloat(getComputedStyle(card.querySelector('.m-skill')).fontSize) >= (compact ? 11 : 12)
                            && skill.width < bounds.width * 0.7
                            && skill.left >= info.left && skill.right <= info.right + 1
                            && skill.bottom <= stats.top
                            && stats.height > 0 && stats.height <= 18 && stats.bottom <= bounds.bottom
                            && statCells.every(cell => Math.abs(cell.top - statCells[0].top) < 1)
                            && statCells.every(cell => cell.right <= bounds.right && cell.left >= bounds.left)
                            && stats.left >= info.left && stats.right <= info.right + 1
                            && mobileBriefOk
                            && getComputedStyle(card.querySelector('.m-stats b')).color === getComputedStyle(card.querySelector('.m-stats')).color
                            && parseFloat(getComputedStyle(card.querySelector('.m-stats b')).fontSize) >= (compact ? 11 : 12);
                    }),
                    onePage: innerWidth <= 768 || cards.every(card => {
                        const rect = card.getBoundingClientRect();
                        const board = document.querySelector('#matrixBoard');
                        const footer = document.querySelector('#commandDeck').getBoundingClientRect();
                        return rect.top >= board.getBoundingClientRect().top && rect.bottom <= footer.top
                            && board.scrollHeight <= board.clientHeight + 1;
                    }),
                    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
                };
            }""")
            assert readability["skills"] and readability["readable"], f"Unreadable selection cards at {width}px: {readability}"
            assert not readability["horizontalOverflow"], f"Selection overflow at {width}px"
            assert readability["onePage"], f"All 25 cards must fit without scrolling at {width}x{height}: {readability}"
            last_card = page.locator(".col-category.mobile-active .m-card" if width <= 768 else ".col-category:first-child .m-card").last
            last_card.scroll_into_view_if_needed()
            assert last_card.is_visible(), f"Last card is inaccessible at {width}px"
            assert last_card.evaluate("(card) => {const r=card.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight;}"), \
                f"Last card cannot scroll into viewport at {width}px"
            if width <= 768:
                deck_before_details = page.evaluate("() => localStorage.getItem('wl15_deck')")
                last_card.locator(".m-skill").click()
                assert page.locator("#unitDetailModal").is_visible(), f"Skill details are inaccessible at {width}px"
                assert page.evaluate("() => localStorage.getItem('wl15_deck')") == deck_before_details
                page.locator("#btnUnitSheetClose").click()
        page.set_viewport_size({"width": 1280, "height": 720})
        page.locator(".m-card").first.scroll_into_view_if_needed()
        deck_before_details = page.evaluate("() => localStorage.getItem('wl15_deck')")
        page.locator(".m-card .m-skill").first.click()
        assert page.locator("#unitDetailModal").is_visible(), "Skill badge must open details without selecting the unit"
        assert page.locator("#unitDetailModal .u-tt-skill .m-skill-phase").is_visible(), "Unit detail modal must show skill phase badge"
        modal_text = page.locator("#unitDetailModal").inner_text()
        assert "電戰值" not in modal_text and "主武裝" not in modal_text, f"Legacy terminology remained in detail modal: {modal_text}"
        assert page.evaluate("() => localStorage.getItem('wl15_deck')") == deck_before_details, "Opening skill details selected a unit"
        page.locator("#btnUnitSheetClose").click()
        page.locator(".m-card .m-skill").first.focus()
        page.keyboard.press("Enter")
        assert page.locator("#unitDetailModal").is_visible(), "Keyboard activation must open skill details"
        assert page.evaluate("() => localStorage.getItem('wl15_deck')") == deck_before_details
        page.locator("#btnUnitSheetClose").click()
        page.locator(".m-card").first.hover()
        assert page.locator("#unitTooltip .u-tt-skill").is_visible(), "Desktop hover must show skill details"
        tooltip_text = page.locator("#unitTooltip").inner_text()
        assert "電戰值" not in tooltip_text and "主武裝" not in tooltip_text, f"Legacy terminology remained in tooltip: {tooltip_text}"
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

        page.locator('#btnOpenFormation').click()
        assert page.locator('#formationDropdownMenu').is_visible()
        assert page.locator('[data-formation-slot]').count() == 0
        page.locator('#formationDropdownMenu .formation-opt-item[data-val="square"]').click()
        assert page.evaluate("() => JSON.parse(localStorage.getItem('wl15_formations'))") == ['square'] * 5
        assert page.locator('#formationSummary').inner_text() == '方圓'
        assert page.locator('#formationDropdownMenu').is_hidden()
        page.locator('#btnWeatherDropdown').click()
        page.locator('.weather-opt-item[data-val="strait"]').click()

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
        environment = page.evaluate("() => Battle3DEngine.getDebugState()")
        assert environment['scene'] == 'canyon' and environment['terrain'] == 'mountain'
        assert all(unit['layout'] == 'square' for unit in environment['battalions'] if unit['side'] == 'A'), \
            'Formation selected in the UI did not apply to the whole army'
        page.evaluate("""() => {
            document.querySelector('#btnPause').click();
            Battle3DEngine.pauseAnimationLoop(true);
        }""")

        page.locator("#btnToggle3DView").click()
        assert page.locator("#battle3DWrapper").is_hidden()
        for width, height in [(1680, 900), (1100, 800), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(150)
            for panel, team in [("team-a", "#teamA"), ("team-b", "#teamB")]:
                page.locator(f'button[data-battle-panel="{panel}"]').click()
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

        # 6.5 行動端 (390x844) 備戰指揮列與首次引導排版實測
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_function(
            "() => window.matchMedia('(max-width: 768px)').matches && document.querySelector('#commandDeck') && !document.querySelector('#commandDeck').hidden",
            timeout=5000,
        )
        page.wait_for_timeout(250)
        mobile_deck = page.evaluate("""() => {
            const box = sel => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
            };
            return {
                deck: box('#commandDeck'),
                budget: box('#budgetUsed'),
                rand: box('#btnRand'),
                more: box('#btnDeckMore'),
                go: box('#btnGo')
            };
        }""")
        for key in ("budget", "rand", "more", "go"):
            b = mobile_deck[key]
            assert b and b["left"] >= 0 and b["right"] <= 390 and b["top"] >= 0 and b["bottom"] <= 844, \
                f"Mobile {key} out of 390x844 viewport: {mobile_deck}"
        assert mobile_deck["rand"]["width"] >= 40 and mobile_deck["more"]["width"] >= 40 and mobile_deck["go"]["width"] >= 200, \
            f"Mobile command deck buttons undersized: {mobile_deck}"
        assert mobile_deck["budget"]["right"] < mobile_deck["rand"]["left"], \
            f"Mobile budget collides with #btnRand: {mobile_deck}"
        assert mobile_deck["rand"]["bottom"] <= mobile_deck["go"]["top"] + 2, \
            f"Mobile #btnRand/#btnDeckMore row did not stay above #btnGo: {mobile_deck}"

        fresh_mobile = browser.new_context(viewport={"width": 390, "height": 844})
        fresh_page = fresh_mobile.new_page()
        fresh_page.on("pageerror", lambda err: errors.append(str(err)))
        fresh_page.goto(f"http://127.0.0.1:{PORT}/index.html")
        fresh_page.wait_for_selector(".m-card", timeout=10000)
        fresh_page.wait_for_timeout(200)
        assert not fresh_page.locator("#helpModal").evaluate("el => el.hidden"), "First visit should open help modal"
        assert fresh_page.locator("#onboardCoachBar").evaluate("el => el.hidden"), "Onboarding coach bar should wait until help modal closes"
        fresh_page.locator("#helpClose").click()
        fresh_page.wait_for_timeout(200)
        assert fresh_page.locator("#helpModal").evaluate("el => el.hidden"), "Help modal did not close"
        onboard_rect = fresh_page.evaluate("""() => {
            const bar = document.querySelector('#onboardCoachBar');
            const br = bar.getBoundingClientRect();
            const steps = [...bar.querySelectorAll('.onboard-step')].map(s => s.getBoundingClientRect().width);
            return { hidden: bar.hidden, width: br.width, height: br.height, steps };
        }""")
        assert not onboard_rect["hidden"] and onboard_rect["height"] <= 160 and all(w >= 150 for w in onboard_rect["steps"]), \
            f"Mobile onboard coach bar collapsed or overflowed: {onboard_rect}"
        fresh_mobile.close()
        print(f"[TEST 7] 行動端 (390x844) 雙層指揮列與新手引導流驗證通過: {onboard_rect}")

        # 檢查過程是否有 JS 報錯
        assert len(errors) == 0, f"瀏覽器執行出現 JS 報錯: {errors}"

        browser.close()
finally:
    server.terminate()

print("\n🎉 TopWarlords 全流程 E2E 實機測試 100% 通過！名將對決完美運轉！")
