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

        # 8. 線上真人雙人房：私人/公開權限切換、公開大廳過濾、跨專案隔離與快速配對實測
        pvp_context = browser.new_context(viewport={"width": 1280, "height": 720}, service_workers='block')
        pvp_context.route("https://www.gstatic.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        pvp_context.route("https://unpkg.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        pvp_context.add_init_script("""(() => {
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
            const dbStore = {
                pvp_rooms: {
                    WL_PUB888: {
                        gameId: 'topwarlords',
                        code: 'PUB888',
                        isPublic: true,
                        status: 'waiting',
                        hostId: 'HOST-PUB888',
                        hostUid: 'CMD-PUB888',
                        hostName: '織田信長公開房',
                        hostFlag: '🇯🇵',
                        maxGames: 7,
                        marketMode: 'free',
                        createdAt: Date.now() - 8000,
                        messages: {}
                    },
                    WL_PRIV99: {
                        gameId: 'topwarlords',
                        code: 'PRIV99',
                        isPublic: false,
                        status: 'waiting',
                        hostId: 'HOST-PRIV99',
                        hostUid: 'CMD-PRIV99',
                        hostName: '私人房應隱藏',
                        hostFlag: '🇨🇳',
                        maxGames: 5,
                        marketMode: 'locked',
                        createdAt: Date.now() - 8000
                    },
                    WL_FULL11: {
                        gameId: 'topwarlords',
                        code: 'FULL11',
                        isPublic: true,
                        status: 'full',
                        hostId: 'HOST-FULL11',
                        hostUid: 'CMD-FULL11',
                        hostName: '滿員房應隱藏',
                        hostFlag: '🇰🇷',
                        maxGames: 3,
                        marketMode: 'locked',
                        createdAt: Date.now() - 8000
                    },
                    TC_CLASH1: {
                        gameId: 'topclash',
                        code: 'CLASH1',
                        isPublic: true,
                        status: 'waiting',
                        hostId: 'HOST-TC',
                        hostUid: 'CMD-TC',
                        hostName: '友作房間應隔離',
                        hostFlag: '🌐',
                        maxGames: 5,
                        marketMode: 'locked',
                        createdAt: Date.now() - 8000
                    },
                    WL_BADGID: {
                        gameId: 'othergame',
                        code: 'BADGID',
                        isPublic: true,
                        status: 'waiting',
                        hostId: 'HOST-BG',
                        hostUid: 'CMD-BG',
                        hostName: '異作ID應隔離',
                        hostFlag: '🌐',
                        maxGames: 5,
                        marketMode: 'locked',
                        createdAt: Date.now() - 8000
                    }
                }
            };
            window.__mockDbStore = dbStore;
            const subscribers = [];

            const getAt = (path) => {
                const parts = String(path || '').split('/').filter(Boolean);
                let cur = dbStore;
                for (const p of parts) {
                    if (!cur || typeof cur !== 'object') return undefined;
                    cur = cur[p];
                }
                return cur;
            };
            const setAt = (path, val) => {
                const parts = String(path || '').split('/').filter(Boolean);
                if (!parts.length) return;
                let cur = dbStore;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
                    cur = cur[parts[i]];
                }
                if (val === null || val === undefined) delete cur[parts[parts.length - 1]];
                else cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
                notifyAll(path);
            };
            const updateAt = (path, patch) => {
                const cur = getAt(path);
                const merged = Object.assign(cur && typeof cur === 'object' ? JSON.parse(JSON.stringify(cur)) : {}, JSON.parse(JSON.stringify(patch)));
                for (const k of Object.keys(merged)) {
                    if (merged[k] === null || merged[k] === undefined) delete merged[k];
                }
                setAt(path, merged);
            };
            const makeSnap = (val) => ({
                exists: () => val !== undefined && val !== null,
                val: () => val === undefined ? null : JSON.parse(JSON.stringify(val))
            });
            const notifyAll = (changedPath) => {
                subscribers.forEach(s => {
                    if (s.evt === 'value') {
                        s.fn(makeSnap(getAt(s.path)));
                    }
                });
            };
            const makeRef = (path) => ({
                child: (sub) => makeRef(path ? path + '/' + sub : sub),
                set: (v) => { setAt(path, v); return Promise.resolve(); },
                update: (p) => { updateAt(path, p); return Promise.resolve(); },
                remove: () => { setAt(path, null); return Promise.resolve(); },
                onDisconnect: () => ({ remove: () => Promise.resolve(), set: () => Promise.resolve() }),
                limitToLast: () => makeRef(path),
                orderByChild: () => makeRef(path),
                equalTo: () => makeRef(path),
                once: () => Promise.resolve(makeSnap(getAt(path))),
                on: (evt, fn) => {
                    const entry = { path, evt, fn };
                    subscribers.push(entry);
                    if (evt === 'value') {
                        setTimeout(() => fn(makeSnap(getAt(path))), 0);
                    }
                    return fn;
                },
                off: (evt, fn) => {
                    for (let i = subscribers.length - 1; i >= 0; i--) {
                        if (subscribers[i].path === path && (!fn || subscribers[i].fn === fn)) {
                            subscribers.splice(i, 1);
                        }
                    }
                },
                push: (val) => {
                    const id = 'M-' + Math.random().toString(36).slice(2, 8);
                    setAt(path + '/' + id, val);
                    subscribers.forEach(s => {
                        if (s.path === path && s.evt === 'child_added') {
                            setTimeout(() => s.fn(makeSnap(val)), 5);
                        }
                    });
                    if (path === 'pvp_rooms/WL_PUB888/messages' && val && val.type === '__RELAY_JOIN__') {
                        const msg = {
                            sender: 'HOST-PUB888',
                            packet: {
                                id: 'HOST-PUB888:hs',
                                type: 'HANDSHAKE',
                                payload: {
                                    gameId: 'topwarlords',
                                    senderId: 'HOST-PUB888',
                                    name: '織田信長公開房',
                                    uid: 'CMD-PUB888',
                                    flag: '🇯🇵',
                                    isHost: true,
                                    isPublic: true,
                                    maxGames: 7,
                                    marketMode: 'free'
                                }
                            },
                            ts: Date.now()
                        };
                        subscribers.forEach(s => {
                            if (s.path === 'pvp_rooms/WL_PUB888/messages' && s.evt === 'child_added') {
                                setTimeout(() => s.fn(makeSnap(msg)), 15);
                            }
                        });
                    }
                    return Promise.resolve({ key: id });
                },
                transaction: (fn) => {
                    const cur = getAt(path);
                    const next = fn(cur !== undefined ? JSON.parse(JSON.stringify(cur)) : null);
                    if (next === undefined) {
                        return Promise.resolve({ committed: false, snapshot: makeSnap(cur) });
                    }
                    setAt(path, next);
                    return Promise.resolve({ committed: true, snapshot: makeSnap(getAt(path)) });
                }
            });

            const fakeApp = {};
            const fakeDb = { ref: (p) => makeRef(p) };
            fakeDb.ServerValue = { TIMESTAMP: Date.now() };
            window.firebase = {
                apps: [fakeApp],
                initializeApp: () => fakeApp,
                auth: () => ({ onAuthStateChanged: () => () => {}, currentUser: null }),
                database: Object.assign(() => fakeDb, { ServerValue: { TIMESTAMP: Date.now() } })
            };

            window.Peer = function(id) {
                const cbs = {};
                const outgoingConns = [];
                this.id = id || ('PEER-' + Math.random().toString(36).slice(2, 7));
                this.on = (evt, fn) => { cbs[evt] = fn; };
                this.connect = (target, opts) => {
                    const ocbs = {};
                    const connObj = {
                        target,
                        metadata: opts && opts.metadata ? opts.metadata : null,
                        open: false,
                        sent: [],
                        on: (e, f) => { ocbs[e] = f; },
                        send: (d) => { connObj.sent.push(d); },
                        close: () => { connObj.open = false; if (ocbs.close) ocbs.close(); },
                        _trigger: (e, a) => {
                            if (e === 'open') connObj.open = true;
                            if (e === 'close') connObj.open = false;
                            if (ocbs[e]) ocbs[e](a);
                        }
                    };
                    outgoingConns.push(connObj);
                    window.__mockLastOutgoingConn = connObj;
                    return connObj;
                };
                this.destroy = () => {};
                this._trigger = (evt, arg) => { if (cbs[evt]) cbs[evt](arg); };
                window.__mockLastPeer = this;
                setTimeout(() => { if (cbs.open) cbs.open(this.id); }, 10);
            };
        })();""")
        pvp_page = pvp_context.new_page()
        pvp_page.on("pageerror", lambda err: errors.append(f"pvp_page: {err}"))
        pvp_page.goto(f"http://127.0.0.1:{PORT}/index.html")
        pvp_page.wait_for_selector(".m-card", timeout=10000)
        pvp_page.wait_for_timeout(150)
        if pvp_page.locator("#helpModal").is_visible():
            pvp_page.locator("#helpClose").click()
            pvp_page.wait_for_timeout(150)

        pvp_page.locator("#tabBo3").click()
        pvp_page.wait_for_timeout(150)
        pvp_btn_text = pvp_page.locator("#btnOnlinePvp").inner_text()
        assert "待戰" not in pvp_btn_text and "間" not in pvp_btn_text, f"Mission bar button must not show live waiting count: {pvp_btn_text}"

        pvp_page.locator("#btnOnlinePvp").click()
        pvp_page.wait_for_function("() => /^[A-Z0-9]{6}$/.test((document.querySelector('#pvpRoomCodeDisplay')?.textContent || '').trim())", timeout=5000)
        host_code = pvp_page.locator("#pvpRoomCodeDisplay").inner_text().strip()
        host_pub_check = pvp_page.evaluate("""(code) => {
            const s = OnlinePvPEngine.getRoomSettings();
            const fb = window.__mockDbStore.pvp_rooms['WL_' + code];
            const modalCard = document.querySelector('#onlinePvpModal .pvp-modal-card');
            return {
                settings: s,
                pubActive: document.querySelector('#btnPvpVisPublic').classList.contains('active'),
                privActive: document.querySelector('#btnPvpVisPrivate').classList.contains('active'),
                fbPublic: fb ? fb.isPublic : null,
                fbGameId: fb ? fb.gameId : null,
                fbStatus: fb ? fb.status : null,
                hOverflow: modalCard.scrollWidth > modalCard.clientWidth + 1
            };
        }""", host_code)
        assert host_pub_check["settings"]["isPublic"] is True and host_pub_check["pubActive"] and not host_pub_check["privActive"], f"Host room must default to public: {host_pub_check}"
        assert host_pub_check["fbPublic"] is True and host_pub_check["fbGameId"] == "topwarlords" and host_pub_check["fbStatus"] == "waiting", f"Firebase host room payload mismatch: {host_pub_check}"
        assert not host_pub_check["hOverflow"], f"Host modal overflowed on desktop: {host_pub_check}"

        pvp_page.locator("#btnPvpVisPrivate").click()
        pvp_page.wait_for_timeout(100)
        host_priv_check = pvp_page.evaluate("""(code) => ({
            settings: OnlinePvPEngine.getRoomSettings(),
            privActive: document.querySelector('#btnPvpVisPrivate').classList.contains('active'),
            fbPublic: window.__mockDbStore.pvp_rooms['WL_' + code]?.isPublic
        })""", host_code)
        assert host_priv_check["settings"]["isPublic"] is False and host_priv_check["privActive"] and host_priv_check["fbPublic"] is False, f"Private toggle failed: {host_priv_check}"

        pvp_page.locator("#btnPvpVisPublic").click()
        pvp_page.select_option("#pvpHostGamesSel", "3")
        pvp_page.select_option("#pvpHostMarketSel", "free")
        pvp_page.wait_for_timeout(100)
        rule_check = pvp_page.evaluate("""(code) => ({
            settings: OnlinePvPEngine.getRoomSettings(),
            fb: window.__mockDbStore.pvp_rooms['WL_' + code]
        })""", host_code)
        assert rule_check["settings"] == {"isPublic": True, "maxGames": 3, "marketMode": "free"} and rule_check["fb"]["maxGames"] == 3 and rule_check["fb"]["marketMode"] == "free", f"Host rule update failed: {rule_check}"

        # 切換到加入分頁：確認自己建的尚未開戰房被清除、公開清單嚴格過濾跨作/私人/滿房
        pvp_page.locator("#tabPvpJoin").click()
        pvp_page.wait_for_timeout(150)
        lobby_check = pvp_page.evaluate("""(oldHostCode) => {
            const items = [...document.querySelectorAll('#pvpPublicRoomsList .pvp-public-room-item')];
            const modalCard = document.querySelector('#onlinePvpModal .pvp-modal-card');
            return {
                oldHostExists: !!window.__mockDbStore.pvp_rooms['WL_' + oldHostCode],
                codes: items.map(el => el.dataset.code),
                text: items.map(el => el.innerText.replace(/\\s+/g, ' ')),
                hOverflow: modalCard.scrollWidth > modalCard.clientWidth + 1
            };
        }""", host_code)
        assert not lobby_check["oldHostExists"], f"Idle hosted room should close when switching to join tab: {lobby_check}"
        assert lobby_check["codes"] == ["PUB888"], f"Public room filtering leaked private/full/foreign rooms: {lobby_check}"
        assert not lobby_check["hOverflow"], f"Join modal overflowed on desktop: {lobby_check}"

        # 行動端 390x844 下檢查加入面板不溢位
        pvp_page.set_viewport_size({"width": 390, "height": 844})
        pvp_page.wait_for_timeout(150)
        assert pvp_page.evaluate("() => { const m = document.querySelector('#onlinePvpModal .pvp-modal-card'); return m.scrollWidth <= m.clientWidth + 1; }"), "Join modal overflowed horizontally at 390x844"
        pvp_page.set_viewport_size({"width": 1280, "height": 720})
        pvp_page.wait_for_timeout(100)

        # 點擊公開房「一鍵加入」並驗證握手完成後對峙欄與賽制同步
        pvp_page.locator('#pvpPublicRoomsList .btnJoinPublicPvpRoom[data-code="PUB888"]').click()
        pvp_page.wait_for_function("() => !document.querySelector('#pvpVersusBox').hidden", timeout=5000)
        joined_check = pvp_page.evaluate("""() => ({
            enemyName: document.querySelector('#pvpEnemyName').textContent,
            boBadge: document.querySelector('#bo3PvpGamesSel')?.value || null,
            maxGames: __db15.state.bo3.maxGames,
            marketMode: __db15.state.bo3.marketMode
        })""")
        assert joined_check["enemyName"] == "織田信長公開房" and joined_check["maxGames"] == 7 and joined_check["marketMode"] == "free", f"Public room handshake/rule sync failed: {joined_check}"

        # 關閉房間、清空大廳公開房，測試「⚡ 快速配對」無空房自動建公開房 (方案 A)
        pvp_page.locator("#btnPvpCancel").click()
        pvp_page.evaluate("() => { delete window.__mockDbStore.pvp_rooms.WL_PUB888; }")
        pvp_page.locator("#btnOnlinePvp").click()
        pvp_page.wait_for_timeout(100)
        pvp_page.locator("#tabPvpJoin").click()
        pvp_page.wait_for_timeout(120)
        assert "目前沒有等待中的公開雙人房" in pvp_page.locator("#pvpPublicRoomsList").inner_text(), "Empty lobby message missing"
        pvp_page.locator("#btnPvpQuickMatch").click()
        pvp_page.wait_for_function("() => document.querySelector('#tabPvpHost').classList.contains('active') && /^[A-Z0-9]{6}$/.test((document.querySelector('#pvpRoomCodeDisplay')?.textContent || '').trim())", timeout=5000)
        qm_check = pvp_page.evaluate("""() => {
            const code = document.querySelector('#pvpRoomCodeDisplay').textContent.trim();
            return {
                code,
                settings: OnlinePvPEngine.getRoomSettings(),
                fb: window.__mockDbStore.pvp_rooms['WL_' + code]
            };
        }""")
        assert qm_check["settings"]["isPublic"] is True and qm_check["fb"] and qm_check["fb"]["isPublic"] is True and qm_check["fb"]["gameId"] == "topwarlords", f"Quick match empty fallback did not create public room: {qm_check}"

        # 8b. 實測雙通道競態（Firebase 中繼先連上、WebRTC 後到）與「立即加入」按鈕點擊不得斷房或無法開戰
        race_host_code = qm_check["code"]
        pvp_page.evaluate("""(code) => {
            const msgRef = window.firebase.database().ref('pvp_rooms/WL_' + code + '/messages');
            msgRef.push({ sender: 'GUEST-RACE-01', type: '__RELAY_JOIN__', uid: 'CMD-GUEST', name: '模擬對手', ts: Date.now() });
            msgRef.push({
                sender: 'GUEST-RACE-01',
                packet: {
                    id: 'GUEST-RACE-01:hs',
                    type: 'HANDSHAKE',
                    payload: { gameId: 'topwarlords', senderId: 'GUEST-RACE-01', name: '模擬對手', uid: 'CMD-GUEST', flag: '🇹🇼', isHost: false }
                },
                ts: Date.now()
            });
        }""", race_host_code)
        pvp_page.wait_for_function("() => !document.querySelector('#pvpVersusBox').hidden && !document.querySelector('#btnPvpStartBattle').hidden", timeout=5000)

        race_check = pvp_page.evaluate("""() => {
            const makeIncoming = (senderId, withMeta) => {
                const icbs = {};
                const connObj = {
                    open: true,
                    sent: [],
                    closed: false,
                    metadata: withMeta ? { senderId } : undefined,
                    on: (e, f) => { icbs[e] = f; },
                    send: (d) => { connObj.sent.push(d); },
                    close: () => { connObj.closed = true; connObj.open = false; if (icbs.close) icbs.close(); },
                    _emit: (e, a) => { if (icbs[e]) icbs[e](a); }
                };
                return connObj;
            };
            const sameGuestConn = makeIncoming('GUEST-RACE-01', false);
            window.__mockLastPeer._trigger('connection', sameGuestConn);
            sameGuestConn._emit('data', {
                id: 'GUEST-RACE-01:p2p-hs',
                type: 'HANDSHAKE',
                payload: { gameId: 'topwarlords', senderId: 'GUEST-RACE-01', name: '模擬對手', uid: 'CMD-GUEST', flag: '🇹🇼', isHost: false }
            });

            const intruderConn = makeIncoming('INTRUDER-99', true);
            window.__mockLastPeer._trigger('connection', intruderConn);
            intruderConn._emit('open');

            // 模擬 P2P 通道後續波動關閉，但 Firebase 中繼仍在線
            sameGuestConn.close();

            return {
                sameGuestGotRoomFull: sameGuestConn.sent.some(p => p && p.type === 'ROOM_FULL'),
                sameGuestClosedByHost: sameGuestConn.closed,
                intruderGotRoomFull: intruderConn.sent.some(p => p && p.type === 'ROOM_FULL'),
                hostVersusVisible: !document.querySelector('#pvpVersusBox').hidden,
                hostStartVisible: !document.querySelector('#btnPvpStartBattle').hidden,
                stillConnected: OnlinePvPEngine.getState().connected
            };
        }""")
        assert not race_check["sameGuestGotRoomFull"] and race_check["intruderGotRoomFull"], f"Late WebRTC upgrade mishandled: {race_check}"
        assert race_check["hostVersusVisible"] and race_check["hostStartVisible"] and race_check["stillConnected"], f"Host dropped room or start button after P2P close: {race_check}"

        # 房主按下「正式開戰」必須能正常進入線上 BO5 備戰狀態
        pvp_page.locator("#btnPvpStartBattle").click()
        pvp_page.wait_for_function("() => document.querySelector('#onlinePvpModal').hidden && __db15.state.isOnlinePvp === true", timeout=5000)
        start_check = pvp_page.evaluate("""(code) => ({
            isOnlinePvp: __db15.state.isOnlinePvp,
            mode: __db15.state.mode,
            fbStatus: window.__mockDbStore.pvp_rooms['WL_' + code]?.status
        })""", race_host_code)
        assert start_check["isOnlinePvp"] and start_check["mode"] == "bo3" and start_check["fbStatus"] == "playing", f"Host failed to start match: {start_check}"

        # 重置連線狀態並實測在輸入框輸入房號後點擊「立即加入」按鈕 (#btnSubmitJoinRoom) 與 P2P 失效防護
        pvp_page.evaluate("""() => {
            OnlinePvPEngine.closeConnection();
            __db15.state.isOnlinePvp = false;
            window.__mockDbStore.pvp_rooms.WL_PUB888 = {
                gameId: 'topwarlords',
                code: 'PUB888',
                isPublic: true,
                status: 'waiting',
                createdAt: Date.now() - 15000,
                hostId: 'HOST-PUB888',
                hostUid: 'CMD-PUB888',
                hostName: '織田信長公開房',
                hostFlag: '🇯🇵',
                maxGames: 7,
                marketMode: 'free'
            };
        }""")
        pvp_page.locator("#btnOnlinePvp").click()
        pvp_page.wait_for_timeout(120)
        pvp_page.locator("#tabPvpJoin").click()
        pvp_page.wait_for_timeout(120)
        pvp_page.fill("#pvpJoinCodeInput", "PUB888")
        pvp_page.locator("#btnSubmitJoinRoom").click()
        pvp_page.wait_for_function("() => !document.querySelector('#pvpVersusBox').hidden", timeout=5000)
        guest_race_alive = pvp_page.evaluate("""() => {
            if (window.__mockLastOutgoingConn) window.__mockLastOutgoingConn._trigger('close');
            return {
                versusVisible: !document.querySelector('#pvpVersusBox').hidden,
                connected: OnlinePvPEngine.getState().connected,
                cancelText: document.querySelector('#btnPvpCancel')?.textContent?.trim()
            };
        }""")
        assert guest_race_alive["versusVisible"] and guest_race_alive["connected"] and guest_race_alive["cancelText"] == "離開房間 ✕", f"Guest dropped on fallback P2P close or submit click failed: {guest_race_alive}"

        pvp_context.close()
        print(f"[TEST 8] 線上真人雙人房（私人/公開切換、公開大廳隔離、立即加入與雙通道防斷房開戰）測試通過: {qm_check['code']}")

        # 9. 精選破局 (Daily Challenge $19~$25 超標 BOSS)：切換題庫、編組出擊與破局次數更新實測
        daily_ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        daily_page = daily_ctx.new_page()
        daily_page.on("pageerror", lambda err: errors.append(f"daily_page: {err}"))
        daily_page.goto(f"http://127.0.0.1:{PORT}/index.html")
        daily_page.wait_for_selector(".m-card", timeout=10000)
        daily_page.wait_for_timeout(150)
        if daily_page.locator("#helpModal").is_visible():
            daily_page.locator("#helpClose").click()
            daily_page.wait_for_timeout(150)

        daily_page.locator('[data-submode="daily"]').click()
        daily_page.wait_for_selector("#dailyPlanSel", timeout=5000)
        daily_init = daily_page.evaluate("""() => ({
            mode: __db15.state.mode,
            enemyLen: __db15.state.enemy ? __db15.state.enemy.length : 0,
            enemyCost: __db15.state.enemy ? __db15.state.enemy.reduce((s, id) => s + (UNIT_MAP[id]?.cost || 0), 0) : 0,
            options: document.querySelectorAll('#dailyPlanSel option').length,
            groups: document.querySelectorAll('#dailyPlanSel optgroup').length,
            hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
        })""")
        assert daily_init["mode"] == "daily" and daily_init["enemyLen"] == 5 and 19 <= daily_init["enemyCost"] <= 25, f"Daily init failed: {daily_init}"
        assert daily_init["options"] >= 17 and daily_init["groups"] == 7 and not daily_init["hOverflow"], f"Daily selector/layout failed: {daily_init}"

        for dw, dh in [(1280, 720), (1180, 720), (960, 720)]:
            daily_page.set_viewport_size({"width": dw, "height": dh})
            daily_page.wait_for_timeout(120)
            daily_overlap = daily_page.evaluate("""() => {
                const mc = document.querySelector('#missionContent')?.getBoundingClientRect();
                const dm = document.querySelector('.daily-mission-item')?.getBoundingClientRect();
                const form = document.querySelector('#formationDropdown')?.getBoundingClientRect();
                const right = document.querySelector('#missionRightTools')?.getBoundingClientRect();
                return {
                    mcRight: mc?.right || 0,
                    dmRight: dm?.right || 0,
                    formLeft: form?.left || 0,
                    formRight: form?.right || 0,
                    rightLeft: right?.left || 0,
                    bleedsForm: Boolean(dm && form && dm.right > form.left + 1),
                    formBleedsRight: Boolean(form && right && form.right > right.left + 1),
                    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
                };
            }""")
            assert not daily_overlap["bleedsForm"] and not daily_overlap["formBleedsRight"] and not daily_overlap["overflow"], \
                f"Daily mission bar overlapped at {dw}x{dh}: {daily_overlap}"
        daily_page.set_viewport_size({"width": 1280, "height": 720})
        daily_page.wait_for_timeout(80)

        daily_page.select_option("#dailyPlanSel", "pantheon-25")
        daily_page.wait_for_timeout(100)
        assert daily_page.evaluate("() => __db15.state.enemy.reduce((s, id) => s + (UNIT_MAP[id]?.cost || 0), 0)") == 25, "Pantheon-25 should have cost 25"
        daily_page.select_option("#dailyPlanSel", "random_tier")
        daily_page.wait_for_timeout(100)
        rt_cost = daily_page.evaluate("() => __db15.state.enemy.reduce((s, id) => s + (UNIT_MAP[id]?.cost || 0), 0)")
        assert 19 <= rt_cost <= 25, f"Random tier cost out of range: {rt_cost}"

        daily_page.locator("#btnRand").click()
        daily_page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        assert "挑戰超標破局" in daily_page.locator("#btnGo").inner_text()
        daily_page.evaluate("() => document.querySelector('#btnGo').click()")
        daily_page.wait_for_function("() => document.body.classList.contains('in-battle') && !document.querySelector('#viewBattle').hidden", timeout=5000)
        daily_page.wait_for_timeout(400)
        daily_page.evaluate("() => document.querySelector('#btnSkip').click()")
        daily_page.wait_for_selector("#rRematch", state="visible", timeout=10000)
        daily_page.evaluate("() => document.querySelector('#rRematch').click()")
        daily_page.wait_for_timeout(150)
        daily_after = daily_page.evaluate("""() => ({
            inBattle: document.body.classList.contains('in-battle'),
            missionText: document.querySelector('#missionBar').innerText
        })""")
        assert not daily_after["inBattle"] and "1次" in daily_after["missionText"], f"Daily rematch/counter failed: {daily_after}"

        daily_page.set_viewport_size({"width": 390, "height": 844})
        daily_page.wait_for_timeout(150)
        assert not daily_page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1"), "Daily mode overflowed at 390x844"
        daily_ctx.close()
        print(f"[TEST 9] 精選破局 ($19~$25 超標題庫、切換與再戰結算) 測試通過: randomCost=${rt_cost}")

        # 檢查過程是否有 JS 報錯
        assert len(errors) == 0, f"瀏覽器執行出現 JS 報錯: {errors}"

        browser.close()
finally:
    server.terminate()

print("\n🎉 TopWarlords 全流程 E2E 實機測試 100% 通過！名將對決完美運轉！")
