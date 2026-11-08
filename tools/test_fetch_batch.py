# -*- coding: utf-8 -*-
"""
測試精準抓取 20 位代表性歷史名將在維基共享資源上的真實歷史人物畫 (人物肖像畫)
"""
import urllib.request, urllib.parse, ssl, json, os, time
from PIL import Image

ctx = ssl._create_unverified_context()
os.makedirs('D:/TopWarlords/cache/portraits', exist_ok=True)

WARLORD_QUERIES = {
    'HUO': ['Huo Qubing', 'General Huo Qubing', '霍去病'],
    'WEI': ['Wei Qing', 'General Wei Qing', '衛青'],
    'LUBU': ['Lu Bu', 'Lü Bu portrait', '呂布'],
    'CAOCAO': ['Cao Cao Portrait ROTK', 'Cao Cao', '曹操'],
    'GUANYU': ['Guan Yu Portrait', 'Guan Yu 02', '關羽'],
    'ZHAOYUN': ['Zhao Yun', 'General Zhao Yun', '趙雲'],
    'ZHUGELIANG': ['Zhuge Liang', 'Zhuge Kongming Sancai Tuhui', '諸葛亮'],
    'BAIQI': ['Bai Qi', 'General Bai Qi', '白起'],
    'HANXIN': ['Han Xin', '明人画韩信像轴', '韓信'],
    'YUEFEI': ['Yue Fei', 'Portrait of Yue Fei', '岳飛'],
    'QIJIGUANG': ['Qi Jiguang Portrait', 'Qi Jiguang', '戚繼光'],
    'ZHENGCHENG': ['Koxinga', 'Zheng Chenggong', '鄭成功'],
    'NOBUNAGA': ['Oda Nobunaga', '織田信長'],
    'SHINGEN': ['Takeda Shingen', '武田信玄'],
    'KENSHIN': ['Uesugi Kenshin', '上杉謙信'],
    'IEYASU': ['Tokugawa Ieyasu', '德川家康'],
    'YUKIMURA': ['Sanada Yukimura', '真田幸村'],
    'DATE': ['Date Masamune', 'Masamune Portrait', '伊達政宗'],
    'YISUNSIN': ['Yi Sun-sin, Chungminsa, The Chosun Ilbo 1929', 'Yi Sun-sin', '李舜臣'],
    'EULJI': ['Eulji Mundeok', '乙支文德']
}

def search_and_download(uid, queries):
    for q in queries:
        url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size|mime&format=json"
        req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0 (educational historical project)'})
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=6) as r:
                data = json.loads(r.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, p in pages.items():
                info = p.get('imageinfo', [{}])[0]
                img_url = info.get('url', '')
                mime = info.get('mime', '')
                if 'image' in mime and not img_url.endswith('.svg') and not img_url.endswith('.pdf') and not img_url.endswith('.djvu'):
                    out_path = f"D:/TopWarlords/cache/portraits/{uid}.jpg"
                    # 下載圖檔
                    img_req = urllib.request.Request(img_url, headers={'User-Agent': 'TopWarlords/1.0'})
                    with urllib.request.urlopen(img_req, context=ctx, timeout=8) as ir, open(out_path, 'wb') as f:
                        f.write(ir.read())
                    print(f"✅ {uid} ({queries[0]}): Downloaded -> {p['title']}")
                    return True
        except Exception as e:
            pass
        time.sleep(0.1)
    print(f"❌ {uid} ({queries[0]}): Not found")
    return False

for uid, qlist in WARLORD_QUERIES.items():
    search_and_download(uid, qlist)

print("\nDone initial test fetch!")
