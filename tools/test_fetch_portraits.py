# -*- coding: utf-8 -*-
import urllib.request, ssl, json

ctx = ssl._create_unverified_context()

titles = [
    'File:Oda_Nobunaga.jpg',
    'File:Takeda_Shingen.jpg',
    'File:Uesugi_Kenshin.jpg',
    'File:Tokugawa_Ieyasu.jpg',
    'File:Toyotomi_Hideyoshi.jpg',
    'File:Yi_Sun-sin.jpg',
    'File:Portrait_of_Yue_Fei.jpg',
    'File:Zhuge_Liang.jpg'
]

pipe_titles = '|'.join(titles)
url = f'https://commons.wikimedia.org/w/api.php?action=query&titles={urllib.parse.quote(pipe_titles)}&prop=imageinfo&iiprop=url&format=json'
req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0'})
with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
    data = json.loads(r.read().decode('utf-8'))

for pid, p in data.get('query', {}).get('pages', {}).items():
    info = p.get('imageinfo')
    if info:
        print(p['title'], '->', info[0]['url'])
    else:
        print(p['title'], '-> NOT FOUND')

