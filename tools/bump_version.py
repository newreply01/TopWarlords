# -*- coding: utf-8 -*-
"""統一升版所有快取版本號 (sw.js / HTML ?v= / JS 內圖片與模型 ?v=)。
用法: python tools/bump_version.py 7.0.0
每次發版都必須執行，否則 Service Worker 會繼續提供舊檔案。"""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ver = sys.argv[1] if len(sys.argv) > 1 else None
if not ver:
    print("usage: bump_version.py <version>"); sys.exit(1)

def sub(path, pattern, repl):
    p = ROOT / path
    s = p.read_text(encoding='utf-8')
    n = re.sub(pattern, repl, s)
    if n != s:
        p.write_text(n, encoding='utf-8')
        print('updated', path)

sub('sw.js', r"const APP_VERSION = '[^']*'", f"const APP_VERSION = '{ver}'")
sub('sw.js', r"battle-3d\.js\?v=[\w.]+", "battle-3d.js?v=${APP_VERSION}")
for html in ['index.html', 'armory.html']:
    sub(html, r"\?v=[\d.]+", f"?v={ver}")
for js in ['js/data.js', 'js/battle-3d.js', 'js/sound.js', 'js/app.js', 'js/armory.js']:
    if (ROOT / js).exists():
        sub(js, r"(\.(?:jpg|png|webp|glb|gltf|ogg|mp3))\?v=[\w.]+", rf"\g<1>?v={ver}")
        sub(js, r"const (?:ASSET_VER|AUDIO_VER) = '[^']*'", lambda m: m.group(0).split('=')[0] + f"= '{ver}'")
print('version ->', ver)

