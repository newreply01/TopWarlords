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
        context = browser.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)

        page = context.new_page()

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
        assert terrain_state['soldierCount'] == expected_soldiers, f"Unexpected visible soldier count: {terrain_state}"
        assert terrain_state['terrain'] == 'mountain' and not terrain_state['waterwayVisible'], f"山岳地形未切換：{terrain_state}"
        assert terrain_state['battalionRanks'] == 10, f"預期雙方 10 支部隊皆已加入後列兵群：{terrain_state}"
        page.wait_for_function("() => Battle3DEngine.getDebugState().engagedBattalions > 0", timeout=15000)
        desktop_layout = page.evaluate("""() => ({
            stage: document.querySelector('#battle3DWrapper').clientHeight,
            grid: document.querySelector('.battle-grid').clientHeight,
            roster: document.querySelector('#unitsCardListA').clientHeight,
            rosterContent: document.querySelector('#unitsCardListA').scrollHeight,
            card: document.querySelector('#unitsCardListA .bu')?.getBoundingClientRect().height || 0
        })""")
        assert 220 <= desktop_layout['stage'] <= 340, f"3D stage height is outside the viewport budget: {desktop_layout}"
        assert desktop_layout['grid'] >= 250 and desktop_layout['card'] >= 66, f"Battle roster was compressed: {desktop_layout}"
        assert desktop_layout['rosterContent'] <= desktop_layout['roster'] + 1, f"Desktop roster still needs scrolling: {desktop_layout}"

        # 測試切換 3D/2D 按鈕
        page.evaluate("() => document.querySelector('#btnToggle3DView').click()")
        is_hidden_now = page.evaluate("() => document.getElementById('battle3DWrapper').style.display === 'none'")
        print(f"[TEST 5] 切換 3D 隱藏: {is_hidden_now}")
        assert is_hidden_now, "點擊切換後 3D 沙盤未正常隱藏！"

        page.evaluate("() => document.querySelector('#btnToggle3DView').click()")
        is_visible_again = page.evaluate("() => document.getElementById('battle3DWrapper').style.display === 'block'")
        print(f"[TEST 6] 切換 3D 重新顯現: {is_visible_again}")
        assert is_visible_again, "再次點擊後 3D 沙盤未重新顯現！"

        # 點擊跳過秒速完成結算
        page.evaluate("() => document.querySelector('#btnSkip').click()")
        time.sleep(0.5)
        print("[TEST 7] 戰鬥秒速結算完成！")

        context.close()
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
        try:
            mobile.wait_for_selector("#battle3DCanvas canvas", timeout=8000)
        except Exception as error:
            mobile_state = mobile.evaluate("""() => ({
                battleVisible: !document.querySelector('#viewBattle').hidden,
                containerSize: [document.querySelector('#battle3DCanvas').clientWidth, document.querySelector('#battle3DCanvas').clientHeight],
                webgl: Boolean(document.createElement('canvas').getContext('webgl')),
                engine: typeof Battle3DEngine === 'undefined' ? null : Battle3DEngine.getDebugState()
            })""")
            raise AssertionError(f"手機 3D canvas 未初始化：{mobile_state}; browser errors: {mobile_errors}") from error
        try:
            mobile.wait_for_function("() => Battle3DEngine.getDebugState().battalionRanks === 10", timeout=12000)
        except Exception as error:
            debug_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
            raise AssertionError(f"手機兵群未完成載入：{debug_state}; browser errors: {mobile_errors}") from error
        mobile_state = mobile.evaluate("() => Battle3DEngine.getDebugState()")
        assert mobile_state['lowPowerDevice'], f"手機未使用低功耗渲染：{mobile_state}"
        assert mobile_state['pixelRatio'] <= 1.15, f"手機 DPR 未受限：{mobile_state}"
        assert len(mobile_errors) == 0, f"手機戰場瀏覽器錯誤：{mobile_errors}"
        print("[TEST 8] 手機低功耗渲染、DPR 與實例化兵群通過！")
        mobile_context.close()

        print("\n🎉 TopWarlords desktop/mobile 3D 戰場 E2E 測試成功通過！")
        browser.close()
finally:
    server.terminate()
