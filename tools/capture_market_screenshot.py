# -*- coding: utf-8 -*-
import sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("D:/TopWarlords")
PORT = 8499

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
        time.sleep(1.5)
        page.screenshot(path="D:/TopWarlords/screenshot_market.png")
        print("Captured market screenshot successfully without modal!")

        # 點擊隨機補滿並進入 3D 對戰
        page.evaluate("() => document.querySelector('#btnRand').click()")
        page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        time.sleep(0.5)
        page.evaluate("() => document.querySelector('#btnGo').click()")
        time.sleep(2.0)
        page.screenshot(path="D:/TopWarlords/screenshot_3d_battle.png")
        print("Captured 3D battle screenshot successfully!")

        browser.close()
finally:
    server.terminate()
