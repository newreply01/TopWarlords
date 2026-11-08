# -*- coding: utf-8 -*-
import urllib.request, ssl, os

ctx = ssl._create_unverified_context()
url = "https://upload.wikimedia.org/wikipedia/commons/9/95/Zhuge_Liang.jpg"
req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlordsBot/1.0'})
with urllib.request.urlopen(req, context=ctx, timeout=8) as r, open('D:/TopWarlords/cache/portraits/ZHUGELIANG.jpg', 'wb') as f:
    f.write(r.read())
print("Downloaded real Zhuge Liang portrait! Size:", os.path.getsize('D:/TopWarlords/cache/portraits/ZHUGELIANG.jpg'))

