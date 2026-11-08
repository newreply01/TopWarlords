# -*- coding: utf-8 -*-
import urllib.request, ssl, json

ctx = ssl._create_unverified_context()

def search_commons(name):
    query = f"{name} portrait"
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=6) as r:
            data = json.loads(r.read().decode('utf-8'))
        pages = data.get('query', {}).get('pages', {})
        results = []
        for pid, p in pages.items():
            info = p.get('imageinfo', [{}])[0]
            if info.get('url'):
                results.append((p['title'], info['url']))
        return results
    except Exception as e:
        return []

pinyins = [
    'Huo Qubing', 'Wei Qing', 'Guan Yu', 'Cao Cao', 'Qi Jiguang',
    'Li Shimin', 'Han Xin', 'Yi Sun-sin', 'Sanada Yukimura',
    'Date Masamune', 'Kuroda Kanbei', 'Shimazu Yoshihiro'
]

for name in pinyins:
    res = search_commons(name)
    print(f"{name} -> {len(res)} results:")
    for t, u in res[:2]:
        print("   ", t, "->", u)
