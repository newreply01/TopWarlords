# -*- coding: utf-8 -*-
"""
3D 沙盤 WebGL 情境遺失／恢復測試：
1. 戰鬥中以 WEBGL_lose_context 模擬情境遺失 → 3D 停止渲染並自動切換為 2D 戰報
2. 頁面不得產生 JS 錯誤
3. 情境恢復後 3D 引擎解除遺失狀態，可再切回 3D
"""
import sys
import time
import socket
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    PORT = s.getsockname()[1]

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.0)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 800}, service_workers='block')
        context.set_default_timeout(60000)
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
        """)
        context.route("https://www.gstatic.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        context.route("https://unpkg.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        context.route("https://www.googletagmanager.com/**", lambda route: route.fulfill(status=200, content_type="application/javascript", body=""))
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: (errors.append(str(e)), print('[STACK]', e.stack)))
        page.goto(f"http://127.0.0.1:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=15000)

        page.evaluate("() => document.querySelector('#btnRand').click()")
        page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        page.evaluate("() => document.querySelector('#btnGo').click()")
        page.wait_for_function("() => typeof Battle3DEngine !== 'undefined' && Battle3DEngine.getDebugState().isInitialized", timeout=30000)
        page.wait_for_timeout(800)
        assert page.locator('#battle3DWrapper').is_visible(), "戰鬥應預設顯示 3D 沙盤"

        has_ext = page.evaluate("""() => {
          const c = document.querySelector('#battle3DCanvas canvas');
          const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
          window.__loseExt = gl && gl.getExtension('WEBGL_lose_context');
          return !!window.__loseExt;
        }""")
        assert has_ext, "測試環境不支援 WEBGL_lose_context"

        page.evaluate("() => window.__loseExt.loseContext()")
        page.wait_for_function("() => Battle3DEngine.getDebugState().contextLost === true", timeout=5000)
        page.wait_for_function("() => document.querySelector('#battle3DWrapper').hidden === true", timeout=5000)
        print("[PASS] WebGL 情境遺失 → 3D 暫停渲染並自動切換為 2D 戰報")
        page.wait_for_timeout(500)

        page.evaluate("() => window.__loseExt.restoreContext()")
        page.wait_for_function("() => Battle3DEngine.getDebugState().contextLost === false", timeout=5000)
        page.evaluate("() => document.querySelector('#btnToggle3DView').click()")
        page.wait_for_timeout(500)
        assert page.locator('#battle3DWrapper').is_visible(), "恢復後應可切回 3D"
        print("[PASS] WebGL 情境恢復 → 可切回 3D 沙盤")

        real = [e for e in errors if 'peerjs' not in e.lower() and 'firebase' not in e.lower()]
        assert not real, f"頁面 JS 錯誤：{real}"
        print("[PASS] 全程無 JS 錯誤")
        browser.close()
    print("\n[ALL PASS] 3D WebGL 情境遺失／恢復測試通過")
finally:
    server.terminate()
