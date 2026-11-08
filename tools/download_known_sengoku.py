# -*- coding: utf-8 -*-
import urllib.request, ssl, os

ctx = ssl._create_unverified_context()

KNOWN_URLS = {
    'NOBUNAGA': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Oda_Nobunaga.jpg',
    'SHINGEN': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Takeda_Shingen.jpg',
    'KENSHIN': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Uesugi_Kenshin.jpg',
    'IEYASU': 'https://upload.wikimedia.org/wikipedia/commons/8/89/Tokugawa_Ieyasu.jpg',
    'HIDEYOSHI': 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Toyotomi_Hideyoshi.jpg',
    'YUKIMURA': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Sanada_Yukimura.jpg',
    'DATE': 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Date_Masamune.jpg',
    'YOSHITSUNE': 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Minamoto_no_Yoshitsune.jpg',
    'YISUNSIN': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Yi_Sun-sin%2C_Chungminsa%2C_The_Chosun_Ilbo_1929.jpg',
    'ZHUGELIANG': 'https://upload.wikimedia.org/wikipedia/commons/9/95/Zhuge_Liang.jpg'
}

for uid, url in KNOWN_URLS.items():
    out = f"D:/TopWarlords/cache/portraits/{uid}.jpg"
    req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlords/1.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as r, open(out, 'wb') as f:
            f.write(r.read())
        print(f"✅ Downloaded {uid} ({os.path.getsize(out)} bytes)")
    except Exception as e:
        print(f"❌ Failed {uid}: {e}")
