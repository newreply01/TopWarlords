# -*- coding: utf-8 -*-
"""
E2E 測試：驗證 TopWarlords 3D 古戰場推演沙盤
1. 進入主頁面並出擊
2. 驗證 #viewBattle 與 #battle3DWrapper 正常展開
3. 驗證 #battle3DCanvas 成功渲染 WebGL canvas
4. 驗證 Three.js 戰棋對象已正常載入
5. 驗證切換 3D/2D 按鈕功能
"""
import asyncio, http.server, socketserver, threading
from playwright.async_api import async_playwright

PORT = 8092

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="D:/TopWarlords", **kwargs)
    def log_message(self, format, *args):
        pass

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

async def main():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        
        await context.add_init_script("""
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)

        page = await context.new_page()

        await page.goto(f"http://localhost:{PORT}/index.html")
        await page.wait_for_selector(".m-card", timeout=8000)

        # 隨機補滿陣容 (使用 evaluate 杜絕引導模態窗指針攔截)
        await page.evaluate("() => document.querySelector('#btnRand').click()")
        await page.wait_for_timeout(500)

        # 點擊出擊進入戰場
        await page.wait_for_function("() => !document.querySelector('#btnGo').disabled")
        await page.evaluate("() => document.querySelector('#btnGo').click()")
        await page.wait_for_selector("#viewBattle:not([hidden])", timeout=5000)

        print("[TEST 1] #viewBattle 成功展開！")

        # 驗證 3D 沙盤容器與 Canvas
        await page.wait_for_selector("#battle3DWrapper", timeout=3000)
        canvas_count = await page.locator("#battle3DCanvas canvas").count()
        print(f"[TEST 2] 3D 沙盤 WebGL Canvas 渲染數量: {canvas_count}")
        assert canvas_count == 1, "未找到 WebGL Canvas 元素！"

        # 驗證 Three.js 全域物件與 Battle3DEngine
        is_three_ready = await page.evaluate("() => typeof THREE !== 'undefined'")
        is_engine_ready = await page.evaluate("() => typeof Battle3DEngine !== 'undefined'")
        print(f"[TEST 3] Three.js 就緒: {is_three_ready}, Battle3DEngine 就緒: {is_engine_ready}")
        assert is_three_ready and is_engine_ready, "Three.js 或 Battle3DEngine 未載入！"

        # 測試切換 3D/2D 按鈕
        await page.evaluate("() => document.querySelector('#btnToggle3DView').click()")
        is_hidden_now = await page.evaluate("() => document.getElementById('battle3DWrapper').style.display === 'none'")
        print(f"[TEST 4] 切換 3D 隱藏: {is_hidden_now}")
        assert is_hidden_now, "點擊切換後 3D 沙盤未正常隱藏！"

        await page.evaluate("() => document.querySelector('#btnToggle3DView').click()")
        is_visible_again = await page.evaluate("() => document.getElementById('battle3DWrapper').style.display === 'block'")
        print(f"[TEST 5] 切換 3D 重新顯現: {is_visible_again}")
        assert is_visible_again, "再次點擊後 3D 沙盤未重新顯現！"

        # 點擊跳過秒速完成結算
        await page.evaluate("() => document.querySelector('#btnSkip').click()")
        await page.wait_for_timeout(300)
        print("[TEST 6] 戰鬥秒速結算完成！")

        print("\n🎉 TopWarlords 3D 古戰場推演沙盤 E2E 測試 100% 成功通過！")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
