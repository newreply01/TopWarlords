# -*- coding: utf-8 -*-
"""
E2E 測試：驗證 TopWarlords 3D 古戰場推演沙盤
1. 進入主頁面並出擊
2. 驗證 #viewBattle 與 #battle3DWrapper 正常展開
3. 驗證 #battle3DCanvas 成功渲染 WebGL canvas
4. 驗證 Three.js 戰棋對象已正常載入
5. 驗證切換 3D/2D 按鈕功能
"""
import sys, time, subprocess, socket
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
with socket.socket() as port_socket:
    port_socket.bind(('127.0.0.1', 0))
    PORT = port_socket.getsockname()[1]

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
for _ in range(80):
    if server.poll() is not None:
        raise RuntimeError('Test HTTP server exited before becoming ready')
    try:
        with socket.create_connection(('127.0.0.1', PORT), timeout=0.1):
            break
    except OSError:
        time.sleep(0.1)
else:
    server.terminate()
    raise RuntimeError('Test HTTP server did not become ready')

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1680, 'height': 749}, service_workers='block')
        
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)

        page = context.new_page()
        desktop_errors = []
        page.on('pageerror', lambda error: desktop_errors.append(str(error)))

        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=8000)
        time.sleep(1.0)

        page.evaluate("""() => {
            document.querySelector('#btnOpenFormation').click();
            const terrain = document.querySelector('#formationTerrain');
            terrain.value = 'mountain';
            terrain.dispatchEvent(new Event('change', { bubbles: true }));
            document.querySelector('#btnCloseFormation').click();
        }""")

        # 隨機補滿陣容 (使用 evaluate 杜絕引導模態窗指針攔截)
        page.evaluate("() => document.querySelector('#btnRand').click()")
        page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        time.sleep(0.5)

        # 點擊出擊進入戰場
        click_res = page.evaluate("""() => {
            const btn = document.querySelector('#btnGo');
            btn.click();
            return {
                viewHidden: document.querySelector('#viewBattle').hidden
            };
        }""")
        time.sleep(1.0)

        print("[TEST 1] #viewBattle 成功展開！", click_res)
        assert not page.evaluate("() => document.querySelector('#viewBattle').hidden"), "#viewBattle 未展開！"

        # 驗證 3D 沙盤容器與 Canvas
        canvas_count = page.locator("#battle3DCanvas canvas").count()
        print(f"[TEST 2] 3D 沙盤 WebGL Canvas 渲染數量: {canvas_count}")
        assert canvas_count == 1, "未找到 WebGL Canvas 元素！"

        # 驗證 Three.js 全域物件與 Battle3DEngine
        is_three_ready = page.evaluate("() => typeof THREE !== 'undefined'")
        is_engine_ready = page.evaluate("() => typeof Battle3DEngine !== 'undefined'")
        print(f"[TEST 3] Three.js 就緒: {is_three_ready}, Battle3DEngine 就緒: {is_engine_ready}")
        assert is_three_ready and is_engine_ready, "Three.js 或 Battle3DEngine 未載入！"
        page.wait_for_function("() => Battle3DEngine.getDebugState().battalionRanks === 10", timeout=10000)
        terrain_state = page.evaluate("() => Battle3DEngine.getDebugState()")
        expected_soldiers = 240 if terrain_state['lowPowerDevice'] else 360
        assert terrain_state['modelsLoaded'] == terrain_state['modelsTotal'], f"兵種模型未完整載入：{terrain_state}"
        assert terrain_state['soldierCount'] == expected_soldiers, f"Unexpected visible soldier count: {terrain_state}"
        assert terrain_state['terrain'] == 'mountain' and not terrain_state['waterwayVisible'], f"山岳地形未切換：{terrain_state}"
        assert terrain_state['battalionRanks'] == 10, f"預期雙方 10 支部隊皆已加入後列兵群：{terrain_state}"
        page.wait_for_function("() => Battle3DEngine.getDebugState().engagedBattalions > 0", timeout=15000)
        assert not page.locator('#battlePanelTabs').is_visible(), 'Desktop should use the three-panel command layout'
        assert page.locator('#teamA').is_visible() and page.locator('#teamB').is_visible(), 'Desktop should show both team rosters'
        assert page.locator('.log-col').is_visible(), 'Desktop battle log is missing'
        desktop_layout = page.evaluate("""() => ({
            stage: document.querySelector('#battle3DWrapper').clientHeight,
            grid: document.querySelector('.battle-grid').clientHeight,
            roster: document.querySelector('#unitsCardListA').clientHeight,
            rosterContent: document.querySelector('#unitsCardListA').scrollHeight,
            card: document.querySelector('#unitsCardListA .bu')?.getBoundingClientRect().height || 0,
            log: document.querySelector('.log-col').clientWidth
        })""")
        assert 340 <= desktop_layout['stage'] <= 460, f"3D stage height is outside the viewport budget: {desktop_layout}"
        assert desktop_layout['grid'] >= 220 and desktop_layout['card'] >= 48, f"Battle roster was compressed: {desktop_layout}"
        assert desktop_layout['log'] >= 280, f"Battle log column is too narrow: {desktop_layout}"
        assert desktop_layout['rosterContent'] <= desktop_layout['roster'] + 4, f"Desktop roster still needs scrolling: {desktop_layout}"
        charge_finished = page.evaluate("async () => await Battle3DEngine.beginFinalCharge(280)")
        assert charge_finished and not page.evaluate("() => Battle3DEngine.getDebugState().finalChargeActive"), 'Final charge animation did not settle cleanly'

        # 測試切換 3D/2D 按鈕
        page.locator('#btnToggle3DView').click()
        is_hidden_now = page.locator('#battle3DWrapper').is_hidden()
        print(f"[TEST 5] 切換 3D 隱藏: {is_hidden_now}")
        assert is_hidden_now, "點擊切換後 3D 沙盤未正常隱藏！"

        assert page.locator('#btnToggle3DView').is_visible(), '2D mode hid the only way back to 3D'
        assert page.locator('#btnToggle3DView').get_attribute('aria-expanded') == 'false'
        page.locator('#btnToggle3DView').click()
        is_visible_again = page.locator('#battle3DWrapper').is_visible()
        print(f"[TEST 6] 切換 3D 重新顯現: {is_visible_again}")
        assert is_visible_again, "再次點擊後 3D 沙盤未重新顯現！"
        assert page.locator('#btnToggle3DView').get_attribute('aria-expanded') == 'true'

        # 點擊跳過秒速完成結算
        page.evaluate("() => document.querySelector('#btnSkip').click()")
        skip_state = page.evaluate("() => Battle3DEngine.getDebugState()")
        assert skip_state['animationPaused'], f"Skip did not finish: {skip_state}; errors: {desktop_errors}"
        assert not desktop_errors, f"Desktop battle raised browser errors: {desktop_errors}"
        assert page.locator("#rReview").is_visible(), "Battle result report did not render after skip"
        time.sleep(0.5)
        print("[TEST 7] 戰鬥秒速結算完成！")

        context.close()
        natural_context = browser.new_context(viewport={'width': 1530, 'height': 750}, service_workers='block')
        natural_context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_speed', '4');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)
        natural = natural_context.new_page()
        natural_errors = []
        natural.on('pageerror', lambda error: natural_errors.append(str(error)))
        natural.goto(f"http://localhost:{PORT}/index.html")
        natural.wait_for_selector(".m-card", timeout=10000)
        natural.evaluate("""() => {
            const resolveOriginal = window.resolveBattle;
            window.resolveBattle = () => {
                const result = resolveOriginal(
                    ['LUBU', 'XUCHU', 'HUANGZHONG', 'YUEJIN', 'LIUBOWEN'],
                    ['GAISUWEN', 'HONDA', 'ZHANGHE', 'DINGFENG', 'HANBEI'],
                    { seed: 11, event: EVENTS.find(event => event.id === 'clear'), docA: 'blitz', docB: 'defense' }
                );
                window.visualBattle = result;
                return result;
            };
            window.visualKills = [];
            const playOriginal = Battle3DEngine.playEvent;
            Battle3DEngine.playEvent = async line => {
                const startedAt = performance.now();
                await playOriginal(line);
                if (line.kind === 'kill' || line.kind === 'capture') {
                    window.visualKills.push({
                        attacker: line.auid,
                        elapsed: performance.now() - startedAt,
                        target: Battle3DEngine.getDebugState().battalions.find(unit => unit.uid === line.tuid)
                    });
                }
            };
            const chargeOriginal = Battle3DEngine.beginFinalCharge;
            Battle3DEngine.beginFinalCharge = async duration => {
                const before = Battle3DEngine.getDebugState().battalions;
                await chargeOriginal(duration);
                window.visualCharge = { before, after: Battle3DEngine.getDebugState().battalions };
            };
            document.querySelector('#btnRand').click();
            document.querySelector('#btnGo').click();
        }""")
        natural.wait_for_function(
            "() => window.visualBattle?._finished && Battle3DEngine.getDebugState().animationPaused",
            polling=100, timeout=120000
        )
        visual = natural.evaluate("""() => ({
            rounds: visualBattle.frames.filter(frame => frame.phase === 3).length,
            finale: visualBattle.finale,
            expectedDead: [...visualBattle.final.A, ...visualBattle.final.B].filter(unit => !unit.alive).length,
            state: Battle3DEngine.getDebugState(),
            kills: visualKills,
            charge: visualCharge
        })""")
        assert visual['rounds'] == 4 and not visual['finale'], f"Four-round regression fixture changed: {visual}"
        assert visual['state']['fallenBattalions'] == visual['expectedDead'], f"3D deaths diverged from battle result: {visual}"
        assert len(visual['kills']) == visual['expectedDead'], f"Deaths were only repaired at result instead of animated: {visual}"
        assert all(kill['target']['fallen'] and kill['target']['ranksFallen'] for kill in visual['kills']), \
            f"Soldiers stayed standing after a lethal event: {visual}"
        assert any(kill['attacker'] == 'LUBU-A0' for kill in visual['kills']), "First cavalry-charge kill was not animated"
        assert next(kill for kill in visual['kills'] if kill['attacker'] == 'LUBU-A0')['elapsed'] >= 1000, \
            "Cavalry target fell before both charge impact and death animation finished"
        for unit in visual['charge']['after']:
            if not unit['alive']:
                continue
            start = next(before for before in visual['charge']['before'] if before['uid'] == unit['uid'])
            assert abs(unit['x'] - start['x']) > 0.1, f"Battalion did not charge: {unit}"
            assert (unit['x'] > 0 if unit['side'] == 'A' else unit['x'] < 0), f"Battalion never crossed the battle line: {unit}"
        assert natural.locator("#rReview").is_visible(), "Natural battle result was not shown"
        natural.locator("#rReview").click()
        natural.locator("#btnToggle3DView").click()
        assert natural.locator("#battle3DWrapper").is_hidden()
        natural.locator("#btnToggle3DView").click()
        assert natural.locator("#battle3DWrapper").is_visible(), "Review could not return to 3D"
        assert not natural_errors, f"Natural battle raised browser errors: {natural_errors}"
        print("[TEST 7b] 四輪戰局自然播放：騎兵首擊、全軍交錯衝陣、六隊陣亡與結算同步通過！")
        natural_context.close()
        mobile_context = browser.new_context(viewport={'width': 600, 'height': 900}, service_workers='block')
        mobile_context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)
        mobile = mobile_context.new_page()
        mobile_errors = []
        mobile.on('pageerror', lambda err: mobile_errors.append(str(err)))
        mobile.on('console', lambda msg: mobile_errors.append(msg.text) if msg.type == 'error' else None)
        mobile.on('requestfailed', lambda request: mobile_errors.append(f"{request.url}: {request.failure}"))
        mobile.goto(f"http://localhost:{PORT}/index.html")
        mobile.wait_for_selector("#btnRand", state='visible', timeout=8000)
        mobile.evaluate("() => document.querySelector('#btnRand').click()")
        mobile.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        mobile_start = mobile.evaluate("""() => {
            const button = document.querySelector('#btnGo');
            button.click();
            return {
                disabled: button.disabled,
                viewHidden: document.querySelector('#viewBattle').hidden,
                bodyClass: document.body.className,
                deck: JSON.parse(localStorage.getItem('wl15_deck') || '[]')
            };
        }""")
        print('[MOBILE START]', mobile_start)
        assert not mobile_start['viewHidden'], f"手機出擊未開啟戰場：{mobile_start}; browser errors: {mobile_errors}"
        assert mobile.locator('#battlePanelTabs').is_visible(), 'Mobile battle panel tabs are missing'
        mobile.locator('[data-battle-panel="team-a"]').click()
        assert mobile.locator('#teamA').is_visible(), 'Friendly roster panel did not open'
        mobile.locator('[data-battle-panel="team-b"]').click()
        assert mobile.locator('#teamB').is_visible(), 'Enemy roster panel did not open'
        mobile.locator('[data-battle-panel="log"]').click()
        assert mobile.locator('.log-col').is_visible(), 'Battle log panel did not open'
        mobile_canvas = mobile.locator("#battle3DCanvas canvas")
        mobile_canvas_state = mobile.evaluate("""() => ({
            count: document.querySelectorAll('#battle3DCanvas canvas').length,
            visible: Boolean(document.querySelector('#battle3DCanvas canvas')?.getClientRects().length),
            webgl: Boolean(document.createElement('canvas').getContext('webgl'))
        })""")
        assert mobile_canvas.count() == 1 and mobile_canvas.is_visible() and mobile_canvas_state['webgl'], \
            f"手機 3D canvas 未初始化：{mobile_canvas_state}; browser errors: {mobile_errors}"
        try:
            mobile.wait_for_function("() => Battle3DEngine.getDebugState().battalionRanks === 10", timeout=12000)
        except Exception as error:
            debug_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
            raise AssertionError(f"手機兵群未完成載入：{debug_state}; browser errors: {mobile_errors}") from error
        mobile_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
        assert mobile_state['lowPowerDevice'], f"手機未使用低功耗渲染：{mobile_state}"
        assert mobile_state['pixelRatio'] <= 1.15, f"手機 DPR 未受限：{mobile_state}"
        mobile.locator("#btnToggle3DView").click()
        assert mobile.locator("#battle3DWrapper").is_hidden()
        assert mobile.locator("#btnToggle3DView").is_visible(), "Mobile 2D mode hid the view toggle"
        mobile.locator("#btnToggle3DView").click()
        assert mobile.locator("#battle3DWrapper").is_visible(), "Mobile could not return to 3D"
        assert len(mobile_errors) == 0, f"手機戰場瀏覽器錯誤：{mobile_errors}"
        print("[TEST 8] 手機低功耗渲染、DPR 與實例化兵群通過！")
        mobile_context.close()

        print("\n🎉 TopWarlords desktop/mobile 3D 戰場 E2E 測試成功通過！")
        browser.close()
finally:
    server.terminate()
