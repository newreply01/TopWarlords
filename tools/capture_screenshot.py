# -*- coding: utf-8 -*-
import asyncio, http.server, socketserver, threading
from playwright.async_api import async_playwright

PORT = 8199
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='D:/TopWarlords', **kwargs)
    def log_message(self, format, *args):
        pass

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), Handler) as s:
        s.serve_forever()

async def main():
    t = threading.Thread(target=run, daemon=True)
    t.start()
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.add_init_script("""
            localStorage.setItem('wl15_onboard_done', 'true');
            localStorage.setItem('wl15_help_dismissed', 'true');
            localStorage.setItem('topwarlords_cached_global_visits', '100');
        """)
        page = await ctx.new_page()
        await page.goto(f'http://localhost:{PORT}/index.html')
        await page.wait_for_selector('.m-card', timeout=8000)
        await page.wait_for_timeout(1000)
        await page.screenshot(path='D:/TopWarlords/screenshot_market.png')
        print('Captured market screenshot')

        await page.evaluate("() => document.querySelector('#btnRand').click()")
        await page.wait_for_function("() => !document.querySelector('#btnGo').disabled", timeout=5000)
        await page.evaluate("() => document.querySelector('#btnGo').click()")
        await page.wait_for_selector('#viewBattle:not([hidden])', timeout=5000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path='D:/TopWarlords/screenshot_3d_battle.png')
        print('Captured 3d battle screenshot')
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
