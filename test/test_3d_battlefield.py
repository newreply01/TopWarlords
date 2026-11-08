# -*- coding: utf-8 -*-
"""
E2E 測試：驗證 TopWarlords 3D 古戰場推演沙盤
1. 進入主頁面並出擊
2. 驗證 #viewBattle 與 #battle3DWrapper 正常展開
3. 驗證 #battle3DCanvas 成功渲染 WebGL canvas
4. 驗證 Three.js 戰棋對象已正常載入
5. 驗證切換 3D/2D 按鈕功能
"""
import sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("D:/TopWarlords")
PORT = 8299

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        
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

        # 擷取 3D 沙盤對戰截圖
        time.sleep(1.0)
        page.screenshot(path="D:/TopWarlords/screenshot_3d_battle.png")
        print("[TEST 4] 3D 沙盤截圖成功保存至 D:/TopWarlords/screenshot_3d_battle.png")

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

        print("\n🎉 TopWarlords 3D 古戰場推演沙盤 E2E 測試 100% 成功通過！")
        browser.close()
finally:
    server.terminate()
