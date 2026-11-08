# -*- coding: utf-8 -*-
"""Download Three.js r128 GLTFLoader + SkeletonUtils and curate CC0/CC-BY GLB models into assets/models/."""
import os, sys, re, json, ssl, shutil, struct, urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ssl._create_default_https_context = ssl._create_unverified_context
UA = {'User-Agent': 'Mozilla/5.0'}

ROOT = Path('D:/TopWarlords')
LIBS_DIR = ROOT / 'js' / 'libs'
CACHE_MODELS = ROOT / 'cache' / 'models'
OUT_MODELS = ROOT / 'assets' / 'models'
OUT_MODELS.mkdir(parents=True, exist_ok=True)

# 1. Download Three.js r128 GLTFLoader.js & SkeletonUtils.js (UMD global window.THREE)
THREE_EXTS = [
    ('GLTFLoader.js', [
        'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js',
        'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    ]),
    ('SkeletonUtils.js', [
        'https://unpkg.com/three@0.128.0/examples/js/utils/SkeletonUtils.js',
        'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js',
    ]),
]

for fname, urls in THREE_EXTS:
    dest = LIBS_DIR / fname
    for u in urls:
        try:
            data = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
            txt = data.decode('utf-8', 'ignore')
            if 'THREE.' in txt and len(data) > 2000:
                dest.write_bytes(data)
                print(f'[OK] {fname} ({len(data)//1024} KB) from {u}')
                break
        except Exception as e:
            print(f'[WARN] {fname} {u}: {e}')

# 2. Inspect candidate GLBs in cache/models
def inspect_glb(p: Path):
    data = p.read_bytes()
    if data[:4] != b'glTF':
        return None
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20+ln])
    anims = [a.get('name', f'anim_{i}') for i, a in enumerate(j.get('animations', []))]
    nodes = [n.get('name', '') for n in j.get('nodes', []) if n.get('name')]
    return {
        'kb': len(data) // 1024,
        'meshes': len(j.get('meshes', [])),
        'skins': len(j.get('skins', [])),
        'anims': anims,
        'sample_nodes': nodes[:12],
    }

# Curated candidates from Poly.Pizza (all verified CC0 Quaternius or CC-BY Poly by Google / jeremy)
CURATED = [
    # (target_name, source_id, title, author, license, url)
    ('horse.glb',        'F8HAAcLeBL',  'Horse (Rigged & Animated)',     'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/F8HAAcLeBL'),
    ('horse_armored.glb','qvTrSG9pZF',  'Horse White / Armored',         'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/qvTrSG9pZF'),
    ('infantry.glb',     'DgOCW9ZCRJ',  'Armored Soldier (Animated)',    'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/DgOCW9ZCRJ'),
    ('strategist.glb',   'P5FzFYgG5z',  'Strategist / Robed Scholar',    'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/P5FzFYgG5z'),
    ('spear.glb',        '3zA9NtYBEi',  'Cavalry Lance / Spear',         'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/3zA9NtYBEi'),
    ('pike.glb',         'fH1zmvjPNx',  'Heavy Infantry Long Pike',      'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/fH1zmvjPNx'),
    ('katana.glb',       '15A7InejC7',  'Katana / Sabre',                'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/15A7InejC7'),
    ('sword.glb',        '9lLmH8Et4K',  'Broad Sword',                   'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/9lLmH8Et4K'),
    ('bow.glb',          'QnpqjLSKFU',  'Wooden War Bow',                'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/QnpqjLSKFU'),
    ('arrow.glb',        'Rt48KEPDGt',  'War Arrow',                     'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/Rt48KEPDGt'),
    ('shield_tower.glb', 'xoHSnOjsBG',  'Heavy Tower Shield',            'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/xoHSnOjsBG'),
    ('shield_round.glb', 'lWajrVXcnA',  'Round War Shield',              'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/lWajrVXcnA'),
    ('banner.glb',       'svYG8KZxjq',  'War Banner',                    'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/svYG8KZxjq'),
    ('flag.glb',         'FuOkF3WBrx',  'Command Flag',                  'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/FuOkF3WBrx'),
    ('tent.glb',         '5Q7qIrfDxA',  'Command Tent',                  'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/5Q7qIrfDxA'),
    ('watchtower.glb',   'f2J0aSLVi4',  'Wooden Watchtower',             'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/f2J0aSLVi4'),
    ('rock_a.glb',       'd2VWOdthtR',  'Cliff Rock Large A',            'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/d2VWOdthtR'),
    ('rock_b.glb',       '54jZKTAt5p',  'Cliff Rock Large B',            'Quaternius', 'CC0 1.0', 'https://poly.pizza/m/54jZKTAt5p'),
]

total_kb = 0
credits_lines = [
    '# 3D Models Attribution (assets/models/)',
    '',
    'All 3D `.glb` models used in **TopWarlords** are licensed under **CC0 1.0 (Public Domain)** or **CC-BY 3.0**.',
    '',
    '| File | Original Title | Author | License | Source |',
    '| :--- | :--- | :--- | :--- | :--- |',
]

for target, mid, title, author, lic, url in CURATED:
    src = CACHE_MODELS / f'{mid}.glb'
    if not src.exists():
        # Fetch from poly.pizza if missing
        page = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode('utf-8', 'ignore')
        m = re.search(r'https://static\.poly\.pizza/[^"\'\s]+\.glb', page)
        if m:
            src.write_bytes(urllib.request.urlopen(urllib.request.Request(m.group(0), headers=UA), timeout=30).read())
    if src.exists():
        dst = OUT_MODELS / target
        shutil.copy2(src, dst)
        info = inspect_glb(dst)
        total_kb += info['kb']
        print(f"[MODEL] {target:18s} <- {mid}.glb ({info['kb']:4d} KB) skins={info['skins']} anims={info['anims']}")
        print(f"        nodes: {info['sample_nodes']}")
        credits_lines.append(f'| `{target}` | {title} | {author} | {lic} | {url} |')
    else:
        print(f'[MISS] {target} ({mid})')

(OUT_MODELS / 'CREDITS.md').write_text('\n'.join(credits_lines) + '\n', encoding='utf-8')
print(f'\nTotal 3D models size: {total_kb} KB ({total_kb/1024:.2f} MB)')
