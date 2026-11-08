# -*- coding: utf-8 -*-
import urllib.request, urllib.parse, ssl, json, os, time

ctx = ssl._create_unverified_context()
CACHE_DIR = 'D:/TopWarlords/cache/portraits'
os.makedirs(CACHE_DIR, exist_ok=True)

with open('D:/TopWarlords/tools/all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

HISTORICAL_MAPPING = {
    'HUO': 'Huo Qubing', 'WEI': 'Wei Qing', 'LUBU': 'Lu Bu', 'YUEYUN': 'Yue Yun',
    'LISHIMIN': 'Tang Taizong', 'YOSHITSUNE': 'Minamoto no Yoshitsune',
    'SHINGEN': 'Takeda Shingen', 'GAISUWEN': 'Yeon Gaesomun',
    'ZHAOYUN': 'Zhao Yun', 'MACHO': 'Ma Chao', 'ZHANGLIAO': 'Zhang Liao',
    'LIXU': 'Li Su', 'CHENQINGZHI': 'Chen Qingzhi', 'KENSHIN': 'Uesugi Kenshin',
    'YUKIMURA': 'Sanada Yukimura', 'KIMYUSHIN': 'Kim Yu-sin', 'DENGAI': 'Deng Ai',
    'XIAHOUYUAN': 'Xiahou Yuan', 'GONGSUNDU': 'Gongsun Zan', 'XUETOU': 'Xue Rengui',
    'CHANGYUCHUN': 'Chang Yuchun', 'DATE': 'Date Masamune', 'KEIJI': 'Maeda Toshimasu',
    'EULJI': 'Eulji Mundeok', 'BAIQI': 'Bai Qi', 'LIANPO': 'Lian Po',
    'WANGJIAN': 'Wang Jian', 'LIJING': 'Li Jing', 'YUEFEI': 'Yue Fei',
    'HONDA': 'Honda Tadakatsu', 'GYEBAEK': 'Gyebaek', 'CAOREN': 'Cao Ren',
    'GUANYU': 'Guan Yu', 'ZHANGFEI': 'Zhang Fei', 'DIANWEI': 'Dian Wei',
    'XUCHU': 'Xu Chu', 'SHIBATA': 'Shibata Katsuie', 'IINAOMASA': 'Ii Naomasa',
    'CHOIYOUNG': 'Choe Yeong', 'DIQING': 'Di Qing', 'HANSHIZHONG': 'Han Shizhong',
    'YANGYE': 'Yang Ye', 'MENGGONG': 'Meng Gong', 'KATOKIYOMASA': 'Kato Kiyomasa',
    'TACHIBANAD': 'Tachibana Dosetsu', 'SHIMAZUY': 'Shimazu Yoshihiro',
    'KIMSIMIN': 'Kim Si-min', 'MENGTIAN': 'Meng Tian', 'WUQI': 'Wu Qi',
    'SUNBIN': 'Sun Bin', 'SUNWU': 'Sun Tzu', 'QIJIGUANG': 'Qi Jiguang',
    'LIGUANG': 'Li Guang', 'HUANGZHONG': 'Huang Zhong', 'TAISHICI': 'Taishi Ci',
    'PANGDE': 'Pang De', 'SAIKA': 'Saika Magoichi', 'GWONYUL': 'Gwon Yul',
    'GWAKJAEWOO': 'Gwak Jae-u', 'SUZUKI': 'Suzuki Shigehide', 'JUMONG': 'Dongmyeong of Goguryeo',
    'ZHENGCHENG': 'Koxinga', 'JANGPOGO': 'Jang Bogo', 'GANNING': 'Gan Ning',
    'ZHOUYU': 'Zhou Yu', 'LUXUN': 'Lu Xun', 'LUMENG': 'Lu Meng',
    'WANGJUN': 'Wang Jun', 'KUKI': 'Kuki Yoshitaka', 'MURAKAMI': 'Murakami Takeyoshi',
    'YISUNSIN': 'Yi Sun-sin', 'LEEOKGI': 'Yi Eok-gi', 'KWONJUN': 'Kwon Jun',
    'ZHUGELIANG': 'Zhuge Liang', 'SIMAYI': 'Sima Yi', 'GUOJIA': 'Guo Jia',
    'XUNYU': 'Xun Yu', 'JIAXU': 'Jia Xu', 'PANGTONG': 'Pang Tong',
    'FAZHENG': 'Fa Zheng', 'LIUBOWEN': 'Liu Ji', 'ZHANGLIANG': 'Zhang Liang',
    'KANBEI': 'Kuroda Yoshitaka', 'HANBEI': 'Takenaka Shigeharu', 'SANADAMASA': 'Sanada Masayuki',
    'NAOIE': 'Ukita Naoie', 'TAKAKAGE': 'Kobayakawa Takakage', 'SESSAI': 'Taigen Sessai',
    'RYUSEONGRYONG': 'Ryu Seong-ryong', 'CHENGONG': 'Chen Gong', 'CAOCAO': 'Cao Cao',
    'SUNQUAN': 'Sun Quan', 'LIUBEI': 'Liu Bei', 'HANXIN': 'Han Xin',
    'NOBUNAGA': 'Oda Nobunaga', 'IEYASU': 'Tokugawa Ieyasu', 'HIDEYOSHI': 'Toyotomi Hideyoshi',
    'FUMA': 'Fuma Kotaro', 'HATTORI': 'Hattori Hanzo', 'YAMAGATA': 'Yamagata Masakage'
}

def search_and_save(uid, en_name, zh_name):
    target_path = f"{CACHE_DIR}/{uid}.jpg"
    if os.path.exists(target_path) and os.path.getsize(target_path) > 5000:
        return True

    # 嘗試精確搜尋
    queries = [f"{en_name} portrait", f"{zh_name} 像", f"{en_name}"]
    for q in queries:
        url = f"https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={urllib.parse.quote(q)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size|mime&format=json"
        req = urllib.request.Request(url, headers={'User-Agent': 'TopWarlordsBot/1.0 (educational/noncommercial)'})
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=7) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            pages = data.get('query', {}).get('pages', {})
            for pid, p in pages.items():
                title = p.get('title', '')
                # 排除現代照片、雕塑近照、地圖
                if any(x in title.lower() for x in ['map', 'tomb', 'statue', 'temple', 'coin', 'money', 'modern']):
                    continue
                info = p.get('imageinfo', [{}])[0]
                img_url = info.get('url', '')
                mime = info.get('mime', '')
                if 'image' in mime and not img_url.endswith('.svg') and not img_url.endswith('.pdf') and not img_url.endswith('.djvu'):
                    img_req = urllib.request.Request(img_url, headers={'User-Agent': 'TopWarlordsBot/1.0'})
                    with urllib.request.urlopen(img_req, context=ctx, timeout=10) as ir, open(target_path, 'wb') as out_f:
                        out_f.write(ir.read())
                    print(f"✅ {uid} ({zh_name}): Downloaded -> {title} ({os.path.getsize(target_path)} bytes)")
                    time.sleep(0.5)
                    return True
        except Exception as e:
            pass
        time.sleep(0.4)
    return False

success = 0
for u in units:
    uid = u['id']
    zh_name = u['name']
    en_name = HISTORICAL_MAPPING.get(uid, zh_name)
    if search_and_save(uid, en_name, zh_name):
        success += 1

print(f"\nFinished fetching! Successfully cached {success} warlord portraits in {CACHE_DIR}")
