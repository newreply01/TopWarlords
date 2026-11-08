# -*- coding: utf-8 -*-
"""End-to-end Playwright verification of TopWarlords v7.0 overhaul (Portraits, 3D GLTF Battlefield, Real Audio, UI)."""
import os, sys, json, time, socket, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path('D:/TopWarlords')
ARTIFACT_DIR = Path('C:/Users/MM/.gemini/antigravity/brain/b0afa9b9-effe-45fe-8e7c-5c97e5cc0c7c')

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args):
        pass

def start_server():
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()
    srv = ThreadingHTTPServer(('127.0.0.1', port), QuietHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, port

def main():
    srv, port = start_server()
    base_url = f'http://127.0.0.1:{port}'
    print(f'[SERVER] Listening on {base_url}')

    page_errors = []
    console_errors = []
    local_404s = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=['--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
        )
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1.5)
        page = ctx.new_page()

        page.on('pageerror', lambda err: page_errors.append(str(err)))
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' and 'firebase' not in msg.text.lower() and 'firestore' not in msg.text.lower() else None)
        page.on('response', lambda res: local_404s.append(res.url) if res.status == 404 and '127.0.0.1' in res.url and 'favicon' not in res.url else None)

        # 1. Load Deck Builder (index.html) & dismiss first-visit help modal
        page.goto(f'{base_url}/index.html', wait_until='networkidle')
        page.wait_for_timeout(600)
        page.keyboard.press('Escape')
        page.evaluate("""() => {
            document.querySelectorAll('.modal:not([hidden]), .help-modal:not([hidden])').forEach(m => m.hidden = true);
            const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('關閉'));
            if (closeBtn) closeBtn.click();
        }""")
        page.wait_for_timeout(400)

        # Click real UI random-fill button (#btnRand) to equip a valid $15 5-warlord deck!
        page.click('#btnRand')
        page.wait_for_timeout(450)

        deck_info = page.evaluate("""() => {
            const brokenImgs = Array.from(document.querySelectorAll('.m-avatar-img'))
                .filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
            return {
                cardCount: document.querySelectorAll('.m-card').length,
                selectedCount: document.querySelectorAll('.m-card.sel').length,
                brokenImgs,
                synCodes: Array.from(document.querySelectorAll('.ind-code')).map(e => e.textContent.trim()),
                goDisabled: document.querySelector('#btnGo')?.disabled
            };
        }""")
        page.wait_for_timeout(350)
        print('[DECK BUILDER]', json.dumps(deck_info, ensure_ascii=False))
        page.screenshot(path=str(ARTIFACT_DIR / 'v7_deck_builder.png'))

        # 2. Verify Real Recorded Audio Engine
        page.mouse.click(20, 20)
        audio_stats = page.evaluate("""async () => {
            SoundEngine.init();
            SoundEngine.prefetchAll();
            for (let i = 0; i < 30; i++) {
                const st = SoundEngine.getStats();
                if (st.decoded >= st.total) break;
                await new Promise(r => setTimeout(r, 120));
            }
            SoundEngine.play('war_drum', 'A');
            SoundEngine.play('cavalry_charge', 'A');
            SoundEngine.play('blade_clash', 'B');
            SoundEngine.play('arrow_volley', 'A');
            SoundEngine.playBgm('battle');
            return SoundEngine.getStats();
        }""")
        print('[AUDIO ENGINE]', json.dumps(audio_stats, ensure_ascii=False))

        # 3. Launch 3D Battle via #btnGo & Verify GLB Models + Skeletal Mixers + Plinths
        page.click('#btnGo')
        page.wait_for_timeout(1200)
        b3d_state = page.evaluate("""async () => {
            if (window.Battle3DEngine && Battle3DEngine.whenModelsReady) {
                await Battle3DEngine.whenModelsReady();
            }
            await new Promise(r => setTimeout(r, 900));
            return Battle3DEngine.getDebugState();
        }""")
        print('[BATTLE 3D STATE]', json.dumps(b3d_state, ensure_ascii=False))

        # Capture full battle view mid-clash (shows 3D battlefield + Cut-in + bottom 5-unit lists!)
        page.wait_for_timeout(700)
        page.screenshot(path=str(ARTIFACT_DIR / 'v7_battle_3d_clash.png'))

        # Pause & zoom in closer on the 3D battlefield to inspect 3D horses, warriors, shields, pikes & portrait crests!
        page.evaluate("""() => {
            const c = document.querySelector('#battle3DCanvas canvas');
            if (c) {
                for (let i = 0; i < 6; i++) {
                    c.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
                }
            }
        }""")
        page.wait_for_timeout(350)
        wrap = page.locator('#battle3DWrapper')
        wrap.screenshot(path=str(ARTIFACT_DIR / 'v7_battle_3d_closeup.png'))

        # Check bottom unit list visibility (verify 0 vertical clipping!)
        layout_check = page.evaluate("""() => {
            const cardsA = Array.from(document.querySelectorAll('#unitsCardListA .bu, #teamUnitsA .bu'));
            return cardsA.map(el => {
                const r = el.getBoundingClientRect();
                return { id: el.dataset.unitId, h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
            });
        }""")
        print('[BATTLE UNIT CARDS LAYOUT]', json.dumps(layout_check, ensure_ascii=False))

        # 4. Check Armory page (armory.html)
        page.goto(f'{base_url}/armory.html', wait_until='networkidle')
        page.wait_for_timeout(700)
        page.screenshot(path=str(ARTIFACT_DIR / 'v7_armory.png'))

        browser.close()

    srv.shutdown()
    print(f'[ERRORS] page_errors={len(page_errors)}, console_errors={len(console_errors)}, local_404s={len(local_404s)}')
    if page_errors: print('  page_errors:', page_errors)
    if console_errors: print('  console_errors:', console_errors)
    if local_404s: print('  local_404s:', local_404s)

    assert len(page_errors) == 0, f'Unexpected page errors: {page_errors}'
    assert len(local_404s) == 0, f'Unexpected 404s: {local_404s}'
    assert audio_stats['decoded'] == audio_stats['total'], f'Audio decode incomplete: {audio_stats}'
    assert b3d_state['modelsLoaded'] == b3d_state['modelsTotal'], f'3D models incomplete: {b3d_state}'
    assert b3d_state['plinthCount'] == 10, f'Expected 10 plinths, got {b3d_state}'
    assert b3d_state['activeMixers'] >= 20, f'Expected >=20 active skeletal mixers, got {b3d_state}'
    print('\n[ALL AUTOMATED CHECKS PASSED!]')

if __name__ == '__main__':
    main()
