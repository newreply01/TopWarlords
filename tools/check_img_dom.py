# -*- coding: utf-8 -*-
import sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path("D:/TopWarlords")
PORT = 8599

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(ROOT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_init_script("""
            localStorage.setItem('wl15_seen', '1');
            localStorage.setItem('wl15_onboard_done', 'true');
        """)
        page = context.new_page()

        img_requests = []
        page.on("request", lambda r: img_requests.append(r.url) if 'warlords' in r.url or r.resource_type == 'image' else None)
        page.on("requestfailed", lambda r: print("FAILED REQUEST:", r.url, r.failure))

        page.goto(f"http://localhost:{PORT}/index.html")
        page.wait_for_selector(".m-card", timeout=8000)
        time.sleep(2.0)

        print(f"Total image requests: {len(img_requests)}")
        print("Sample image requests:", img_requests[:10])

        # Check DOM img tags
        img_info = page.evaluate("""() => {
            const imgs = Array.from(document.querySelectorAll('.m-avatar-img'));
            return imgs.map(img => ({
                src: img.src,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                complete: img.complete,
                display: window.getComputedStyle(img).display,
                width: img.clientWidth,
                height: img.clientHeight
            })).slice(0, 5);
        }""")
        print("DOM img info:", img_info)

        browser.close()
finally:
    server.terminate()

