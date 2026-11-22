# -*- coding: utf-8 -*-
"""
Single-source version synchronization utility for TopWarlords.
Usage:
    python tools/bump_version.py 7.12.0
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bump(version: str) -> None:
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError(f'Invalid semantic version: {version}')

    # 1. sw.js
    sw_path = ROOT / 'sw.js'
    sw_txt = sw_path.read_text(encoding='utf-8')
    sw_new, n = re.subn(r"const APP_VERSION\s*=\s*'[^']+';", f"const APP_VERSION = '{version}';", sw_txt)
    assert n == 1, f'Failed to update APP_VERSION in sw.js ({n})'
    sw_path.write_text(sw_new, encoding='utf-8', newline='\n')

    # 2. index.html, armory.html & chibi_preview.html query params (?v=...)
    for html_name in ('index.html', 'armory.html', 'chibi_preview.html'):
        p = ROOT / html_name
        txt = p.read_text(encoding='utf-8')
        new_txt = re.sub(r'(\.(?:css|js))\?v=\d+\.\d+\.\d+', rf'\1?v={version}', txt)
        p.write_text(new_txt, encoding='utf-8', newline='\n')

    # 3. js/poster-help.js fallback version
    ph_path = ROOT / 'js' / 'poster-help.js'
    ph_txt = ph_path.read_text(encoding='utf-8')
    ph_new = re.sub(r"return m \? m\[1\] : '\d+\.\d+\.\d+';", f"return m ? m[1] : '{version}';", ph_txt)
    ph_path.write_text(ph_new, encoding='utf-8', newline='\n')

    # 4. js/sound.js AUDIO_VER
    snd_path = ROOT / 'js' / 'sound.js'
    snd_txt = snd_path.read_text(encoding='utf-8')
    snd_new, n = re.subn(r"const AUDIO_VER\s*=\s*'[^']+';", f"const AUDIO_VER = '{version}';", snd_txt)
    assert n == 1, f'Failed to update AUDIO_VER in js/sound.js ({n})'
    snd_path.write_text(snd_new, encoding='utf-8', newline='\n')

    # 5. js/battle-3d.js ASSET_VER
    b3_path = ROOT / 'js' / 'battle-3d.js'
    b3_txt = b3_path.read_text(encoding='utf-8')
    b3_new, n = re.subn(r"const ASSET_VER\s*=\s*'[^']+';", f"const ASSET_VER = '{version}';", b3_txt)
    assert n == 1, f'Failed to update ASSET_VER in js/battle-3d.js ({n})'
    b3_path.write_text(b3_new, encoding='utf-8', newline='\n')

    print(f'[PASS] Synchronized all project files to APP_VERSION={version}')


if __name__ == '__main__':
    ver = sys.argv[1] if len(sys.argv) > 1 else '7.12.0'
    bump(ver)
