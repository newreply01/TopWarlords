# -*- coding: utf-8 -*-
"""
3D 沙盤視覺回歸比對工具（重構 battle-3d.js 前後使用）

用法：
    python tools/compare_3d_visual.py              # 比對 HEAD 與目前工作目錄
    python tools/compare_3d_visual.py --ref main~1 # 比對指定版本
    python tools/compare_3d_visual.py --self-check # 只驗證目前程式碼的截圖可重現性

原理：
  - 頁面載入前把 Math.random 換成固定種子的 mulberry32，並以 Playwright page.clock
    接管 Date / setTimeout / requestAnimationFrame / performance.now，讓戰局、特效與
    動畫在固定時間點完全可重現。
  - 參考版本以 git archive 匯出到暫存目錄，與目前工作目錄各自啟動 HTTP 伺服器，
    在同一台機器、同一個瀏覽器中截取相同時間點的 #battle3DWrapper 畫面後逐像素比對。
  - 不同 GPU／驅動的算繪會有細微差異，因此基準圖不入庫、不放 CI，一律在本機現場產生。
"""
import argparse
import io
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]

FRAME_NAMES = ['deploy', 'deploy_labels']   # 截圖項目：布陣靜態場景、開啟軍旗資訊標籤
VIEWPORT = {'width': 800, 'height': 500}
RENDER_ADVANCE_MS = 450      # 暫停狀態下推進假時鐘以觸發重繪（暫停時引擎每 200ms 重繪一次）
SETTLE_MS = 4000             # 開戰後（假時鐘暫停）等待非同步資源載入的真實時間
FRAME_INTERVAL_MS = 100      # 假時鐘下的動畫幀間隔（軟體 WebGL 每幀成本高，16ms 會使渲染程序過載崩潰）
PIXEL_THRESHOLD = 24          # 單一通道差異超過此值才算「不同」像素（吸收抗鋸齒雜訊）
MAX_DIFF_RATIO = 0.002        # 不同像素占比上限（0.2%）
VERBOSE = '--verbose' in sys.argv

INIT_SCRIPT = """
(() => {
  let a = 20261126 >>> 0;
  // 非同步載入（圖片、模型）會讓開戰前的亂數消耗次數不固定，因此在關鍵時間點重設種子
  window.__twReseed = seed => { a = seed >>> 0; };
  Math.random = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    localStorage.setItem('wl15_seen', '1');
    localStorage.setItem('wl15_onboard_done', 'true');
    localStorage.setItem('wl15_help_dismissed', 'true');
    localStorage.setItem('wl15_vfx_quality', 'low');
  } catch (_) {}
})();
"""


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def serve(directory):
    port = free_port()
    proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(directory)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.8)
    return proc, port


def export_ref(ref, dest):
    data = subprocess.run(['git', '-C', str(ROOT), 'archive', '--format=tar', ref], check=True, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        tf.extractall(dest, filter='data')


HIDE_OVERLAYS_CSS = """
#battle3DCanvas > :not(canvas), .battle-3d-overlay-hud, #battle3DWrapper > :not(#battle3DCanvas),
.toast, #toast, .battle-finale-banner { visibility: hidden !important; }
"""


def capture(browser, port):
    """開戰後立即暫停推演（凍結戰鬥時鐘），只截取 WebGL 畫布：布陣完成的靜態場景（地形、天空、
    兵模、軍旗、營寨、名將圓徽）與開啟軍旗資訊標籤後的畫面。"""
    context = browser.new_context(viewport=VIEWPORT, service_workers='block', device_scale_factor=1)
    context.add_init_script(INIT_SCRIPT)
    for host in ('https://www.gstatic.com/**', 'https://unpkg.com/**', 'https://www.googletagmanager.com/**'):
        context.route(host, lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.clock.install(time=datetime(2026, 11, 26, 12, 0, 0))
    page.goto(f'http://127.0.0.1:{port}/index.html', wait_until='domcontentloaded')
    for _ in range(60):
        if page.locator('.m-card').count():
            break
        page.clock.run_for(250)
    page.evaluate("""(ms) => {
      window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), ms);
      window.cancelAnimationFrame = id => clearTimeout(id);
    }""", FRAME_INTERVAL_MS)
    page.evaluate("() => Battle3DEngine.whenModelsReady && Battle3DEngine.whenModelsReady()")
    page.evaluate("() => { window.__twReseed(1001); document.querySelector('#btnRand').click(); }")
    page.clock.run_for(300)
    page.evaluate("""() => {
      window.__twReseed(2002);
      document.querySelector('#btnGo').click();
      const pause = document.querySelector('#btnPause');
      if (pause && !pause.classList.contains('active')) pause.click();
    }""")
    page.add_style_tag(content=HIDE_OVERLAYS_CSS)
    # 假時鐘暫停中：以真實時間等待模型、頭像等非同步載入完成
    page.wait_for_function("() => Battle3DEngine.getDebugState().plinthCount === 10", polling=200, timeout=60000)
    page.wait_for_timeout(SETTLE_MS)
    page.wait_for_function("() => [...document.images].every(img => img.complete)", polling=200, timeout=30000)
    canvas = page.locator('#battle3DCanvas canvas')
    shots = []
    page.clock.run_for(RENDER_ADVANCE_MS)
    shots.append(Image.open(io.BytesIO(canvas.screenshot())).convert('RGB'))
    page.evaluate("() => document.querySelector('#btnBattleLabels').click()")
    page.clock.run_for(RENDER_ADVANCE_MS)
    shots.append(Image.open(io.BytesIO(canvas.screenshot())).convert('RGB'))
    if VERBOSE:
        print('    debug:', page.evaluate("() => { const d = Battle3DEngine.getDebugState(); return { plinth: d.plinthCount, soldiers: d.soldierCount, paused: d.audioPaused, effects: d.activeEffects }; }"), flush=True)
    context.close()
    return shots, errors


def diff_ratio(a, b):
    if a.size != b.size:
        return 1.0, None
    diff = ImageChops.difference(a, b)
    mask = diff.convert('L').point(lambda v: 255 if v > PIXEL_THRESHOLD else 0)
    changed = sum(1 for v in mask.getdata() if v)
    return changed / (a.size[0] * a.size[1]), mask


def compare_sets(name_a, set_a, name_b, set_b, out_dir):
    ok = True
    for tag, a, b in zip(FRAME_NAMES, set_a, set_b):
        ratio, mask = diff_ratio(a, b)
        status = 'PASS' if ratio <= MAX_DIFF_RATIO else 'DIFF'
        if status == 'DIFF':
            ok = False
            a.save(out_dir / f'{tag}_{name_a}.png')
            b.save(out_dir / f'{tag}_{name_b}.png')
            if mask is not None:
                mask.save(out_dir / f'{tag}_diffmask.png')
        print(f'  [{status}] {tag:<14} 不同像素 {ratio * 100:.3f}%')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', default='HEAD', help='參考版本（git ref），預設 HEAD')
    ap.add_argument('--self-check', action='store_true', help='僅驗證目前程式碼的截圖可重現性')
    ap.add_argument('--verbose', action='store_true', help='顯示各步驟耗時')
    ap.add_argument('--out', default=None, help='差異圖輸出目錄（預設為系統暫存目錄）')
    args = ap.parse_args()

    out_dir = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix='tw3d_diff_'))
    out_dir.mkdir(parents=True, exist_ok=True)
    servers = []
    try:
        cur_srv, cur_port = serve(ROOT)
        servers.append(cur_srv)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            cur1, err1 = capture(browser, cur_port)
            cur2, _ = capture(browser, cur_port)
            for tag, im in zip(FRAME_NAMES, cur1):
                im.save(out_dir / f'{tag}_current.png')
            print('[1] 可重現性自檢（目前程式碼連續截取兩次）')
            stable = compare_sets('run1', cur1, 'run2', cur2, out_dir)
            if err1:
                print('  [WARN] 頁面 JS 錯誤：', err1)
            if not stable:
                print(f'[FAIL] 截圖不可重現，無法作為回歸依據。差異圖：{out_dir}')
                return 2
            if args.self_check:
                print('[PASS] 截圖可重現')
                return 0

            with tempfile.TemporaryDirectory(prefix='tw3d_ref_') as ref_dir:
                export_ref(args.ref, ref_dir)
                ref_srv, ref_port = serve(ref_dir)
                servers.append(ref_srv)
                ref_shots, ref_err = capture(browser, ref_port)
                print(f'[2] 參考版本 {args.ref} 對 目前工作目錄')
                same = compare_sets('ref', ref_shots, 'current', cur1, out_dir)
                if ref_err:
                    print('  [WARN] 參考版本頁面 JS 錯誤：', ref_err)
            browser.close()
        if same:
            print('[PASS] 3D 畫面與參考版本一致')
            return 0
        print(f'[DIFF] 3D 畫面與參考版本不同，差異圖：{out_dir}')
        return 1
    finally:
        for s in servers:
            s.terminate()


if __name__ == '__main__':
    sys.exit(main())
