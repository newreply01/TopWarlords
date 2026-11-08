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
        assert tot == '165'
        assert filtered == '165'

        # Test search for 孫武
        page.fill('#searchInput', '孫武')
        page.wait_for_timeout(300)
        c_names = page.evaluate("() => Array.from(document.querySelectorAll('.card-name')).map(e => e.textContent)")
        print(f"Search '孫武': cardNames={c_names}")
        assert '孫武' in c_names

        # Test search for 李牧
        page.fill('#searchInput', '李牧')
        page.wait_for_timeout(300)
        c_names = page.evaluate("() => Array.from(document.querySelectorAll('.card-name')).map(e => e.textContent)")
        print(f"Search '李牧': cardNames={c_names}")
        assert '李牧' in c_names

        # Test search for 劉裕
        page.fill('#searchInput', '劉裕')
        page.wait_for_timeout(300)
        c_names = page.evaluate("() => Array.from(document.querySelectorAll('.card-name')).map(e => e.textContent)")
        print(f"Search '劉裕': cardNames={c_names}")
        assert '劉裕' in c_names

        # Test search for 德川家康
        page.fill('#searchInput', '德川家康')
        page.wait_for_timeout(300)
        c_names = page.evaluate("() => Array.from(document.querySelectorAll('.card-name')).map(e => e.textContent)")
        print(f"Search '德川家康': cardNames={c_names}")
        assert '德川家康' in c_names

        # Test search for 李舜臣
        page.fill('#searchInput', '李舜臣')
        page.wait_for_timeout(300)
        c_names = page.evaluate("() => Array.from(document.querySelectorAll('.card-name')).map(e => e.textContent)")
        print(f"Search '李舜臣': cardNames={c_names}")
        assert '李舜臣' in c_names

        # Filter Korea
        page.fill('#searchInput', '')
        page.click('[data-nat="🇰🇷"]')
        page.wait_for_timeout(300)
        kr_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"Korea filter count: {kr_count}")
        assert kr_count == '17'

        # Filter China
        page.click('[data-nat="🇨🇳"]')
        page.wait_for_timeout(300)
        cn_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"China filter count: {cn_count}")
        assert cn_count == '99'

        # Filter Japan
        page.click('[data-nat="🇯🇵"]')
        page.wait_for_timeout(300)
        jp_count = page.evaluate("() => document.querySelector('#filteredCount').textContent")
        print(f"Japan filter count: {jp_count}")
        assert jp_count == '49'

        browser.close()
    srv.shutdown()
    print("\n[ARMORY VERIFICATION FOR PLAN A PASSED PERFECTLY!]")

if __name__ == '__main__':
    main()
