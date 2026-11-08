# -*- coding: utf-8 -*-
import urllib.request, ssl, json

ctx = ssl._create_unverified_context()

def search_commons(name):
    query = f"{name} portrait OR 像 OR 畫像"
    url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrlimit=5&prop=imageinfo&iiprop=url|size&format=json"
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

for name in ['霍去病', '衛青', '關羽', '諸葛亮', '曹操', '戚繼光', '李世民', '韓信', '李舜臣', '真田幸村']:
    res = search_commons(name)
    print(f"{name} -> {len(res)} results:")
    for t, u in res[:2]:
        print("   ", t, "->", u)
