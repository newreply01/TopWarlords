# -*- coding: utf-8 -*-
import urllib.request, ssl, os, json, time

ctx = ssl._create_unverified_context()
CACHE_DIR = 'D:/TopWarlords/cache/portraits'
os.makedirs(CACHE_DIR, exist_ok=True)

# 精選明確有高畫質畫像的維基檔案名稱清單
SPECIFIC_FILES = {
    'NOBUNAGA': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Oda_Nobunaga.jpg',
    'YUKIMURA': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Sanada_Yukimura.jpg',
    'DATE': 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Date_Masamune.jpg',
    'YISUNSIN': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Yi_Sun-sin%2C_Chungminsa%2C_The_Chosun_Ilbo_1929.jpg',
    'ZHANGFEI': 'https://upload.wikimedia.org/wikipedia/commons/2/27/Zhang_Fei.jpg',
    'SUNQUAN': 'https://upload.wikimedia.org/wikipedia/commons/5/57/Sun_Quan.jpg',
    'LIUBEI': 'https://upload.wikimedia.org/wikipedia/commons/3/38/Liu_Bei.jpg',
    'HUANGZHONG': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Huang_Zhong.jpg',
    'MACHO': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Ma_Chao.jpg',
    'ZHANGLIAO': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Zhang_Liao.jpg',
    'XIAHOUYUAN': 'https://upload.wikimedia.org/wikipedia/commons/3/30/Xiahou_Yuan.jpg',
    'CAOREN': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Cao_Ren_Qing_illustration.jpg',
    'CAOZHEN': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Cao_Zhen_Qing_illustration.jpg',
    'DENGAI': 'https://upload.wikimedia.org/wikipedia/commons/5/53/Deng_Ai_Qing_portrait.jpg',
    'PANGDE': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Pang_De_Qing_portrait.jpg',
    'XUCHU': 'https://upload.wikimedia.org/wikipedia/commons/9/91/Xu_Chu.jpg',
    'DIANWEI': 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Dian_Wei.jpg',
    'GANNING': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Gan_Ning.jpg',
    'LUXUN': 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Lu_Xun.jpg',
    'LUMENG': 'https://upload.wikimedia.org/wikipedia/commons/3/36/Lu_Meng.jpg',
    'TAISHICI': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Taishi_Ci.jpg',
    'PANGTONG': 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Pang_Tong.jpg',
    'SIMAYI': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Sima_Yi.jpg',
    'CHENGONG': 'https://upload.wikimedia.org/wikipedia/commons/5/50/Chen_Gong_Qing_Dynasty_Illustration.jpg',
    'JIAXU': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Jia_Xu.jpg',
    'XUNYU': 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Xun_Yu.jpg',
    'GUOJIA': 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Guo_Jia.jpg',
    'CHENGYU': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Cheng_Yu.jpg',
    'HONDA': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Honda_Tadakatsu.jpg',
    'KATOKIYOMASA': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Kato_Kiyomasa.jpg',
    'SHIBATA': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Shibata_Katsuie.jpg',
    'SHIMAZUY': 'https://upload.wikimedia.org/wikipedia/commons/5/55/Shimazu_Yoshihiro.jpg',
    'KANBEI': 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Kuroda_Yoshitaka.jpg',
    'HANBEI': 'https://upload.wikimedia.org/wikipedia/commons/3/37/Takenaka_Shigeharu.jpg',
    'LIUBOWEN': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Liu_Bowen.jpg',
    'XUDA': 'https://upload.wikimedia.org/wikipedia/commons/d/da/Xu_Da.jpg',
    'CHANGYUCHUN': 'https://upload.wikimedia.org/wikipedia/commons/5/59/Chang_Yuchun.jpg',
    'DIQING': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Di_Qing.jpg',
    'HANSHIZHONG': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Han_Shizhong.jpg',
    'EULJI': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Eulji_Mundeok%2C_1975%2C_Haebang_Ilbo.jpg',
    'GYEBAEK': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Gyebaek.jpg',
    'KIMYUSHIN': 'https://upload.wikimedia.org/wikipedia/commons/2/23/Kim_Yu-sin.jpg',
    'CHOIYOUNG': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Choe_Yeong.jpg',
    'GANGGAMCHAN': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Gang_Gam-chan.jpg',
    'JANGPOGO': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Jang_Bogo.jpg',
    'GWONYUL': 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Gwon_Yul.jpg',
    'GWAKJAEWOO': 'https://upload.wikimedia.org/wikipedia/commons/6/69/Gwak_Jae-u.jpg',
    'YUANCHONGHUAN': 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Yuan_Chonghuan.jpg'
}

for uid, url in SPECIFIC_FILES.items():
    out = f"{CACHE_DIR}/{uid}.jpg"
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        print(f"Skipping {uid} (already cached)")
        continue
    req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlordsBot/1.0 (educational/noncommercial)'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as r, open(out, 'wb') as f:
            f.write(r.read())
        print(f"✅ Downloaded {uid} ({os.path.getsize(out)} bytes)")
    except Exception as e:
        print(f"❌ Failed {uid}: {e}")
    time.sleep(0.6) # 避免 429

print("\nDone fetching specific portraits!")

