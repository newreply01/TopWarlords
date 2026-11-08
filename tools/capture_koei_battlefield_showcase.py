# -*- coding: utf-8 -*-
import sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("D:/TopWarlords")
PORT = 8399

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1366, 'height': 820})
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '1254');
        """)
        page = context.new_page()

        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=8000)
        time.sleep(1.5)

        # 1. 截取名將牌庫點將台 (驗證每張卡牌均有高畫質人物畫像)
        page.screenshot(path="C:/Users/MM/.gemini/antigravity/brain/b0afa9b9-effe-45fe-8e7c-5c97e5cc0c7c/koei_deck_builder.png")
        print("Captured koei_deck_builder.png")

        # 2. 隨機補滿陣容並出擊
        page.evaluate("() => document.querySelector('#btnRand').click()")
        time.sleep(0.5)
        page.evaluate("() => document.querySelector('#btnGo').click()")
        page.wait_for_selector("#battle3DCanvas canvas", timeout=8000)
        
        # 等待紋理加載與初陣部隊展開
        time.sleep(2.5)
        page.screenshot(path="C:/Users/MM/.gemini/antigravity/brain/b0afa9b9-effe-45fe-8e7c-5c97e5cc0c7c/koei_3d_battlefield_showcase.png")
        print("Captured koei_3d_battlefield_showcase.png")

        browser.close()
finally:
    server.terminate()
