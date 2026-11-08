import socket, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path('D:/TopWarlords')

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args):
        pass

def main():
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    srv = ThreadingHTTPServer(('127.0.0.1', port), QuietHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    base_url = f'http://127.0.0.1:{port}'

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(f'{base_url}/armory.html')
        page.wait_for_selector('#totalUnitsCount', timeout=5000)
        page.wait_for_timeout(800)

        # Check total count
        tot = page.evaluate("() => document.querySelector('#totalUnitsCount').textContent")
        filtered = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"Total in Armory: {tot}, Filtered on load: {filtered}")
        assert tot == '175'
        assert filtered == '175'

        # Search for 李舜臣
        page.fill('#searchInput', '李舜臣')
        page.wait_for_timeout(300)
        search_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        card_name = page.evaluate("() => document.querySelector('.card-name')?.textContent")
        print(f"Search '李舜臣': count={search_count}, cardName={card_name}")
        assert search_count == '1'
        assert card_name == '李舜臣'

        # Filter Korea
        page.fill('#searchInput', '')
        page.click('[data-nat="🇰🇷"]')
        page.wait_for_timeout(300)
        kr_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"Korea filter count: {kr_count}")
        assert kr_count == '22'

        # Filter China
        page.click('[data-nat="🇨🇳"]')
        page.wait_for_timeout(300)
        cn_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"China filter count: {cn_count}")
        assert cn_count == '105'

        # Filter Japan
        page.click('[data-nat="🇯🇵"]')
        page.wait_for_timeout(300)
        jp_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"Japan filter count: {jp_count}")
        assert jp_count == '48'

        browser.close()
    srv.shutdown()
    print("\n[ARMORY E2E VERIFICATION PASSED PERFECTLY!]")

if __name__ == '__main__':
    main()
