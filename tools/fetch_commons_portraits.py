# -*- coding: utf-8 -*-
"""
批次檢索與下載維基共享資源中的三國、日本戰國與東亞歷史名將真實人物畫 (Public Domain Historical Portraits)
"""
import urllib.request, urllib.parse, ssl, json, os, time

ctx = ssl._create_unverified_context()

# 讀取 200 位名將資料
with open('D:/TopWarlords/js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
raw_matches = re.findall(r'\[\s*"([A-Z0-9_]+)"\s*,\s*"([^"]+)"\s*,\s*\'([a-z_]+)\'\s*,\s*(\d+)\s*,\s*\'([A-H])\'\s*,\s*"([^"]+)"', text)
print(f"Total units in data.js: {len(raw_matches)}")

# 測試搜索幾十位主要武將
sample_units = [u for u in raw_matches if int(u[3]) >= 3] # $3, $4, $5 名將
print(f"Found {len(sample_units)} top warlords ($3-$5)")

def search_commons_image(name, en_hint=""):
    queries = [f"{en_hint} portrait" if en_hint else "", f"{name} 像", f"{name} portrait", f"{name}"]
    for q in queries:
        if not q.strip(): continue
        url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size|mime&format=json"
        req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0 (historical portrait tool)'})
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=6) as r:
                data = json.loads(r.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, p in pages.items():
                title = p.get('title', '')
                info = p.get('imageinfo', [{}])[0]
                url = info.get('url', '')
                mime = info.get('mime', '')
                if 'image' in mime and not url.endswith('.svg') and not url.endswith('.pdf'):
                    return title, url
        except Exception as e:
            pass
        time.sleep(0.1)
    return None, None

results = {}
for uid, name, cat, cost, variant, tag in sample_units[:25]:
    t, u = search_commons_image(name)
    if u:
        print(f"✅ {name} ({uid}): {t} -> {u[:60]}...")
        results[uid] = u
    else:
        print(f"❌ {name} ({uid}): not found directly")

print(f"\nFound {len(results)} portraits from first 25!")

