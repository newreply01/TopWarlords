# -*- coding: utf-8 -*-
"""Download and inspect verified CC0 / PD / CC-BY raw audio packs & Commons files into cache/audio_raw."""
import os, sys, json, ssl, zipfile, urllib.request, urllib.parse
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ssl._create_default_https_context = ssl._create_unverified_context

RAW_DIR = Path('D:/TopWarlords/cache/audio_raw')
RAW_DIR.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'TopWarlordsAudioBuilder/1.0 (https://github.com/newreply01/TopWarlords)'}

OGA_DIRECT = [
    # CC0
    ('war_drums_hector.wav', 'https://opengameart.org/sites/default/files/horde_war_drums_by_william_hector.wav',
     'Horde War Drums Loop', 'William Hector (kptemreu)', 'CC0', 'https://opengameart.org/content/horde-war-drums-loop'),
    ('sword_attacks.zip', 'https://opengameart.org/sites/default/files/sword_-_starninjas_1.zip',
     '20 Sword Sound Effects (Attacks)', 'StarNinjas / MedicineStorm', 'CC0', 'https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes'),
    ('sword_clashes.zip', 'https://opengameart.org/sites/default/files/sword_clash_-_starninjas_0.zip',
     '20 Sword Sound Effects (Clashes)', 'StarNinjas / MedicineStorm', 'CC0', 'https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes'),
    ('shield_impacts.zip', 'https://opengameart.org/sites/default/files/impact_-_starninjas.zip',
     '10 Impact / Shield Blocks', 'StarNinjas', 'CC0', 'https://opengameart.org/content/10-impactshield-blocks'),
    ('rpg_sound_pack.zip', 'https://opengameart.org/sites/default/files/rpg_sound_pack.zip',
     'RPG Sound Pack', 'artisticdude (HaelDB)', 'CC0', 'https://opengameart.org/content/rpg-sound-pack'),
    ('distant_explosion.wav', 'https://opengameart.org/sites/default/files/NenadSimic%20-%20Muffled%20Distant%20Explosion.wav',
     'Muffled Distant Explosion', 'NenadSimic', 'CC0', 'https://opengameart.org/content/muffled-distant-explosion'),
    ('fireball.wav', 'https://opengameart.org/sites/default/files/105016__julien-matthey__jm-fx-fireball-01.wav',
     'Fireball 1', 'Julien Matthey', 'CC0', 'https://opengameart.org/content/fireball-1'),
    # CC-BY 3.0 / 4.0
    ('archers_shooting.flac', 'https://opengameart.org/sites/default/files/Archers-shooting.flac',
     'Archers Shooting', 'pawelpdg9', 'CC-BY 3.0', 'https://opengameart.org/content/archers-shooting'),
    ('gallop.zip', 'https://opengameart.org/sites/default/files/gallop.zip',
     'Horse Gallop Loop', 'isaiah658 / Lamoot', 'CC-BY 3.0', 'https://opengameart.org/content/horse-gallop-loop'),
    ('massive_horn.wav', 'https://opengameart.org/sites/default/files/Massive%20Horn.wav',
     'Scary Echoey Horn', 'qubodup / p0ss', 'CC-BY 4.0', 'https://opengameart.org/content/scary-echoey-horn-esque-sound'),
]

def dl(url, dest: Path):
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    try:
        req = urllib.request.Request(url, headers=UA)
        data = urllib.request.urlopen(req, timeout=45).read()
        dest.write_bytes(data)
        print(f'[OK] {dest.name} ({len(data)//1024} KB)')
        return True
    except Exception as e:
        print(f'[ERR] {dest.name}: {e}')
        return False

for fname, url, *_ in OGA_DIRECT:
    dest = RAW_DIR / fname
    if dl(url, dest) and fname.endswith('.zip'):
        ex_dir = RAW_DIR / fname[:-4]
        if not ex_dir.exists():
            ex_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(dest, 'r') as zf:
                zf.extractall(ex_dir)
        files = sorted([str(p.relative_to(ex_dir)) for p in ex_dir.rglob('*') if p.is_file()])
        print(f'  -> {fname} contents ({len(files)}): {files[:25]}')

def commons_search(q, limit=8):
    params = {
        'action': 'query', 'format': 'json',
        'generator': 'search', 'gsrsearch': f'{q} filetype:audio',
        'gsrnamespace': 6, 'gsrlimit': limit,
        'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata'
    }
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params)
    r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read())
    res = []
    for p in (r.get('query', {}).get('pages', {}) or {}).values():
        ii = p['imageinfo'][0]
        md = ii.get('extmetadata', {})
        lic = md.get('LicenseShortName', {}).get('value', '?')
        artist = md.get('Artist', {}).get('value', '?')
        # Filter out SA / NC / ND
        if any(bad in lic.upper() for bad in ['SA', 'NC', 'ND', 'FAIR']):
            continue
        res.append((p['title'], lic, ii['size']//1024, ii['url'], artist[:50]))
    return res

for query in ['guzheng', 'erhu', 'koto', 'taiko', 'chinese gong', 'horse neigh', 'Kevin MacLeod', 'battle music orchestral']:
    print(f'\n=== Commons: {query} ===')
    for row in commons_search(query, 8):
        print(' | '.join(str(x) for x in row))

