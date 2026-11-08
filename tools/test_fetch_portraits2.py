# -*- coding: utf-8 -*-
import urllib.request, ssl, json

ctx = ssl._create_unverified_context()

titles = [
    'File:Yue_Fei.jpg',
    'File:Yue_fei.jpg',
    'File:Yi_Sun-sin_shrine.jpg',
    'File:General_Yi_Sun-sin.jpg',
    'File:Yi_Sun-sin_portrait.jpg',
    'File:Choe_Yeong.jpg',
    'File:Guan_Yu_portrait.jpg',
    'File:Guan_Yu_Sancai_Tuhui.jpg',
    'File:Zhang_Fei.jpg',
    'File:Cao_Cao.jpg',
    'File:Zhou_Yu.jpg',
    'File:Lu_Bu.jpg',
    'File:Zhao_Yun.jpg',
    'File:Sun_Quan.jpg',
    'File:Liu_Bei.jpg',
    'File:Sima_Yi.jpg',
    'File:Han_Xin.jpg',
    'File:Bai_Qi.jpg',
    'File:Qi_Jiguang.jpg',
    'File:Li_Shimin.jpg'
]

pipe_titles = '|'.join(titles)
url = f'https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(pipe_titles)}&prop=imageinfo&iiprop=url&format=json'
req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0'})
with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
    data = json.loads(r.read().decode('utf-8'))

found = []
for pid, p in data.get('query', {}).get('pages', {}).items():
    info = p.get('imageinfo')
    if info:
        print('FOUND:', p['title'], '->', info[0]['url'])
        found.append((p['title'], info[0]['url']))
    else:
        print('MISSING:', p['title'])
print(f'Total found: {len(found)} / {len(titles)}')

