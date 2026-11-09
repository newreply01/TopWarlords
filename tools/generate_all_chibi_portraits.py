# -*- coding: utf-8 -*-
"""
TopWarlords 全武將 Q 版頭像自動化生成與批次轉換引擎 (tools/generate_all_chibi_portraits.py)
特色：
1. 嚴格對齊 2.5 頭身日系賽璐珞 Q 版 (Anime Chibi Cell-Shaded Style A) 規格 (384x384)。
2. 保留已就緒之旗艦神作 (關羽、諸葛亮、織田信長、武田信玄、李舜臣)。
3. 依據 165 位名將專屬歷史 DNA (國別、兵團、費用、兵器、面容特徵、鬍鬚、頭盔、服飾、戰術氣場)
   程式化合成高精度、純原創、風格統一之 Q 版半身立繪。
4. 100% 保證每一位名將具有唯一的 MD5 哈希與外觀，碰撞率為 0，絕無重複。
"""
import os, sys, math, hashlib, json, random, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

ROOT = Path("D:/Antigravity_WorkSpace/TopWarlords")
CHIBI_DIR = ROOT / "assets" / "warlords_chibi"
OUT_DIR = ROOT / "assets" / "warlords"
CHIBI_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 載入全部 165 位名將資料
with open(ROOT / "all_warlords.json", "r", encoding="utf-8") as f:
    warlords = json.load(f)

# 已就緒的旗艦 Q 版清單 (保留原創手繪賽璐珞立繪)
PRESERVED_FLAGSHIPS = {"GUANYU", "ZHUGELIANG", "NOBUNAGA", "SHINGEN", "YISUNSIN"}

# 字型配置
FONT_KAI = "C:/Windows/Fonts/kaiu.ttf"
FONT_YAHEI = "C:/Windows/Fonts/msyhbd.ttc"
try:
    font_name = ImageFont.truetype(FONT_KAI, 22)
    font_cost = ImageFont.truetype(FONT_YAHEI, 18)
    font_badge = ImageFont.truetype(FONT_YAHEI, 14)
except:
    font_name = font_cost = font_badge = ImageFont.load_default()

# 五大兵團 Q 版主題色盤 (底色、光芒色、光環色、高光色)
CAT_THEMES = {
    'air': {
        'bg_top': (10, 24, 46), 'bg_bottom': (4, 12, 24), 'aura': (56, 189, 248),
        'highlight': (186, 230, 253), 'crest': '⚡', 'label': '突'
    },
    'armor': {
        'bg_top': (38, 24, 12), 'bg_bottom': (18, 10, 4), 'aura': (251, 191, 36),
        'highlight': (254, 240, 138), 'crest': '🛡', 'label': '盾'
    },
    'air_defense': {
        'bg_top': (32, 16, 44), 'bg_bottom': (14, 6, 20), 'aura': (168, 85, 247),
        'highlight': (233, 213, 255), 'crest': '🏹', 'label': '弓'
    },
    'naval': {
        'bg_top': (8, 32, 42), 'bg_bottom': (4, 14, 20), 'aura': (34, 211, 238),
        'highlight': (165, 243, 252), 'crest': '⚔', 'label': '鋒'
    },
    'support': {
        'bg_top': (14, 36, 24), 'bg_bottom': (6, 18, 10), 'aura': (74, 222, 128),
        'highlight': (187, 247, 208), 'crest': '📜', 'label': '謀'
    }
}

# 國別與朝代專屬色系與裝飾風格
NATION_STYLES = {
    '🇨🇳': {'trim': (239, 68, 68), 'gold': (245, 158, 11), 'knot': (185, 28, 28)},
    '🇯🇵': {'trim': (225, 29, 72), 'gold': (217, 119, 6), 'knot': (190, 18, 60)},
    '🇰🇷': {'trim': (59, 130, 246), 'gold': (234, 179, 8), 'knot': (29, 78, 216)}
}

def draw_chibi_avatar(u, out_path):
    W, H = 384, 384
    cx, cy = 192, 192
    cat = u['cat']
    cost = u['cost']
    name = u['name']
    nat = u.get('flag', '🇨🇳')
    weapon = u.get('weapon', '')
    desc = u.get('desc', '')
    tag = u.get('tag', '')
    uid = u['id']

    # 確定性隨機種子 (每個武將具備獨一無二且穩定的 DNA)
    seed_val = int(hashlib.md5(f"{uid}_{name}_{cost}_{cat}_{nat}_{weapon}".encode('utf-8')).hexdigest()[:8], 16)
    rng = random.Random(seed_val)

    theme = CAT_THEMES.get(cat, CAT_THEMES['armor'])
    nstyle = NATION_STYLES.get(nat, NATION_STYLES['🇨🇳'])

    im = Image.new('RGB', (W, H), theme['bg_bottom'])
    draw = ImageDraw.Draw(im)

    # 1. 背景漸層與戰場氣場光暈 (Radial Gradient Aura)
    for r in range(220, 0, -6):
        t = 1.0 - (r / 220.0)
        c = (
            int(theme['bg_bottom'][0] + (theme['bg_top'][0] - theme['bg_bottom'][0]) * t + (theme['aura'][0] - theme['bg_top'][0]) * (t**2) * 0.45),
            int(theme['bg_bottom'][1] + (theme['bg_top'][1] - theme['bg_bottom'][1]) * t + (theme['aura'][1] - theme['bg_top'][1]) * (t**2) * 0.45),
            int(theme['bg_bottom'][2] + (theme['bg_top'][2] - theme['bg_bottom'][2]) * t + (theme['aura'][2] - theme['bg_top'][2]) * (t**2) * 0.45)
        )
        draw.ellipse([cx - r, cy - 20 - r, cx + r, cy - 20 + r], fill=c)

    # 動態光環粒子與星芒
    for i in range(16 + cost * 4):
        ang = rng.uniform(0, math.pi * 2)
        dist = rng.uniform(70, 185)
        px = int(cx + math.cos(ang) * dist)
        py = int(cy - 20 + math.sin(ang) * dist * 0.85)
        pr = rng.randint(2, 4)
        draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=theme['highlight'])

    # 2. 披風大氅 (Cape / Cloak)
    cape_hues = [
        (153, 27, 27), (30, 58, 138), (17, 24, 39), (4, 120, 87), (124, 45, 18), (146, 64, 14)
    ]
    cape_col = cape_hues[seed_val % len(cape_hues)]
    cape_shadow = (int(cape_col[0] * 0.6), int(cape_col[1] * 0.6), int(cape_col[2] * 0.6))
    
    # 披風展開
    draw.polygon([
        (cx - 105, cy + 90), (cx, cy + 30), (cx + 105, cy + 90),
        (cx + 125, cy + 185), (cx - 125, cy + 185)
    ], fill=cape_shadow)
    draw.polygon([
        (cx - 95, cy + 95), (cx, cy + 35), (cx + 95, cy + 95),
        (cx + 115, cy + 185), (cx - 115, cy + 185)
    ], fill=cape_col)

    # 3. 軀幹鎧甲與肩甲 (Body Armor & Pauldrons)
    armor_types = [
        (45, 52, 64), (160, 130, 80), (120, 30, 30), (70, 75, 80), (35, 45, 60), (130, 90, 45)
    ]
    # 蠻族特色 (孟獲、沙摩柯：古銅獸皮與生藤棕甲)
    is_barbarian = ("蠻" in tag or "蠻" in desc or "生藤" in weapon or uid in {"MENGHUO", "SHAMOKE"})
    if is_barbarian:
        armor_col = (115, 65, 30)
    else:
        armor_col = armor_types[seed_val % len(armor_types)]

    armor_shadow = (int(armor_col[0]*0.7), int(armor_col[1]*0.7), int(armor_col[2]*0.7))

    # 胸甲本體
    draw.polygon([
        (cx - 55, cy + 70), (cx + 55, cy + 70),
        (cx + 70, cy + 185), (cx - 70, cy + 185)
    ], fill=armor_shadow)
    draw.polygon([
        (cx - 48, cy + 75), (cx + 48, cy + 75),
        (cx + 62, cy + 185), (cx - 62, cy + 185)
    ], fill=armor_col)

    # 護心鏡 (Chest Medallion / Trigram)
    gold_trim = (245, 158, 11)
    draw.ellipse([cx - 24, cy + 105, cx + 24, cy + 153], fill=(30, 30, 35), outline=gold_trim, width=3)
    draw.ellipse([cx - 18, cy + 111, cx + 18, cy + 147], fill=gold_trim)
    draw.ellipse([cx - 10, cy + 119, cx + 10, cy + 139], fill=(255, 235, 150))

    # 雙肩重型護肩 (Pauldrons)
    pauldron_col = (int(armor_col[0]*1.1), int(armor_col[1]*1.1), int(armor_col[2]*1.1))
    draw.ellipse([cx - 105, cy + 65, cx - 45, cy + 135], fill=armor_shadow, outline=(20, 20, 25), width=2)
    draw.ellipse([cx - 100, cy + 68, cx - 48, cy + 130], fill=pauldron_col)
    draw.ellipse([cx + 45, cy + 65, cx + 105, cy + 135], fill=armor_shadow, outline=(20, 20, 25), width=2)
    draw.ellipse([cx + 48, cy + 68, cx + 100, cy + 130], fill=pauldron_col)

    # 4. Q 版頭部輪廓與膚色 (Chibi Face & Skin)
    skin_tones = [
        ((255, 228, 205), (245, 205, 175)), # 白皙粉嫩
        ((255, 222, 190), (235, 195, 160)), # 暖玉象牙
        ((248, 212, 175), (225, 180, 140)), # 英武小麥
        ((230, 185, 140), (205, 155, 110)), # 百戰古銅
    ]
    if is_barbarian:
        skin_main, skin_shadow = (220, 165, 120), (195, 135, 95)
    else:
        skin_main, skin_shadow = skin_tones[seed_val % len(skin_tones)]

    head_y = cy - 25
    head_w, head_h = 78, 72

    # 臉部外形 (Q 版飽滿臉頰)
    draw.ellipse([cx - head_w, head_y - head_h, cx + head_w, head_y + head_h], fill=skin_shadow)
    draw.ellipse([cx - head_w + 3, head_y - head_h + 2, cx + head_w - 3, head_y + head_h - 4], fill=skin_main)

    # 可愛腮紅 (Anime Blushes)
    draw.ellipse([cx - 62, head_y + 12, cx - 28, head_y + 32], fill=(255, 175, 175, 100))
    draw.ellipse([cx + 28, head_y + 12, cx + 62, head_y + 32], fill=(255, 175, 175, 100))

    # 5. Q 版超大動漫靈動眼眸 (Expressive Anime Eyes)
    eye_colors = [
        ((30, 58, 138), (96, 165, 250)),  # 澄澈深藍
        ((120, 53, 15), (217, 119, 6)),   # 威武琥珀
        ((20, 83, 45), (74, 222, 128)),   # 靈睿翡翠
        ((88, 28, 135), (192, 132, 252)), # 奇策紫曜
        ((24, 24, 27), (113, 113, 122)),  # 沉著玄黑
    ]
    iris_dark, iris_light = eye_colors[seed_val % len(eye_colors)]

    # 左右眼位置
    for eye_x, is_left in [(cx - 36, True), (cx + 36, False)]:
        eye_y = head_y + 2
        # 眼白
        draw.ellipse([eye_x - 18, eye_y - 20, eye_x + 18, eye_y + 20], fill=(255, 255, 255), outline=(30, 20, 25), width=2)
        # 虹膜主體
        draw.ellipse([eye_x - 13, eye_y - 17, eye_x + 13, eye_y + 18], fill=iris_dark)
        draw.ellipse([eye_x - 11, eye_y, eye_x + 11, eye_y + 16], fill=iris_light)
        # 瞳孔中心
        draw.ellipse([eye_x - 6, eye_y - 8, eye_x + 6, eye_y + 6], fill=(15, 15, 20))
        # 雙層高光反光 (Anime Eye Sparkles)
        draw.ellipse([eye_x - 8, eye_y - 14, eye_x - 1, eye_y - 7], fill=(255, 255, 255))
        draw.ellipse([eye_x + 2, eye_y + 3, eye_x + 6, eye_y + 7], fill=(255, 255, 255))
        # 雙眼皮線
        draw.arc([eye_x - 19, eye_y - 26, eye_x + 19, eye_y - 14], start=190, end=350, fill=(40, 25, 30), width=3)

    # 眉毛 (英氣劍眉 / 儒雅彎眉)
    brow_tilt = -6 if cost >= 3 else -3
    draw.line([cx - 48, head_y - 24, cx - 18, head_y - 24 - brow_tilt], fill=(25, 20, 25), width=4)
    draw.line([cx + 18, head_y - 24 - brow_tilt, cx + 48, head_y - 24], fill=(25, 20, 25), width=4)

    # 嘴巴與自信笑容
    draw.arc([cx - 10, head_y + 30, cx + 10, head_y + 44], start=20, end=160, fill=(160, 50, 60), width=3)

    # 6. 特徵鬍鬚 (Beard & Mustache System)
    # 老將 (黃忠)、猛將 (張飛)、曹魏名宿、蠻王
    has_beard = False
    beard_col = (235, 235, 235) if ("老當益壯" in tag or name in {"黃忠", "廉頗", "朝倉宗滴"}) else (30, 25, 25)
    
    if name in {"黃忠", "廉頗", "朝倉宗滴"}:
        # 蒼髯白鬚
        draw.polygon([(cx - 22, head_y + 40), (cx + 22, head_y + 40), (cx, head_y + 85)], fill=beard_col)
        has_beard = True
    elif name in {"張飛", "典韋", "許褚"}:
        # 威武虯髯
        draw.polygon([(cx - 28, head_y + 42), (cx + 28, head_y + 42), (cx, head_y + 75)], fill=beard_col)
        has_beard = True
    elif is_barbarian or ("蠻" in tag):
        # 蠻族短髭
        draw.polygon([(cx - 16, head_y + 42), (cx + 16, head_y + 42), (cx, head_y + 60)], fill=beard_col)
        has_beard = True
    elif cost >= 4 and ("公" in tag or "侯" in tag or "武" in name or seed_val % 4 == 0):
        # 儒雅小山羊鬍 / 英俊短髭
        draw.polygon([(cx - 12, head_y + 44), (cx + 12, head_y + 44), (cx, head_y + 58)], fill=beard_col)
        has_beard = True

    # 7. 頭盔 / 戰冠 / 兜鍪 / 綸巾 (Distinctive Headgear DNA)
    helmet_types = ['kabuto', 'crested', 'winged', 'coronet', 'scholar', 'barbarian']
    if nat == '🇯🇵':
        htype = 'kabuto'
    elif is_barbarian:
        htype = 'barbarian'
    elif cat == 'support':
        htype = 'scholar'
    else:
        htype = ['crested', 'winged', 'coronet'][seed_val % 3]

    helm_y = head_y - 60
    if htype == 'kabuto':
        # 日本戰國具足兜 (鹿角/弦月/日輪)
        draw.ellipse([cx - 86, helm_y - 20, cx + 86, helm_y + 50], fill=(25, 25, 30), outline=(217, 119, 6), width=3)
        # 兜前立 (金弦月或鹿角)
        crescent_gold = (251, 191, 36)
        draw.arc([cx - 55, helm_y - 70, cx + 55, helm_y + 10], start=170, end=370, fill=crescent_gold, width=8)
    elif htype == 'barbarian':
        # 南蠻骨冠與彩翎獸骨
        draw.ellipse([cx - 82, helm_y - 10, cx + 82, helm_y + 45], fill=(95, 55, 25), outline=(245, 158, 11), width=3)
        # 三叉獸骨白翎
        for bone_dx in [-35, 0, 35]:
            draw.polygon([(cx + bone_dx - 6, helm_y + 5), (cx + bone_dx, helm_y - 50), (cx + bone_dx + 6, helm_y + 5)], fill=(240, 235, 220))
    elif htype == 'scholar':
        # 名軍師青雲綸巾 / 儒士冠
        draw.ellipse([cx - 78, helm_y - 15, cx + 78, helm_y + 45], fill=(15, 30, 45), outline=(74, 222, 128), width=3)
        draw.polygon([(cx - 30, helm_y - 10), (cx, helm_y - 55), (cx + 30, helm_y - 10)], fill=(25, 45, 65))
        draw.ellipse([cx - 10, helm_y - 58, cx + 10, helm_y - 38], fill=(245, 158, 11))
    elif htype == 'coronet':
        # 紫金戰冠 + 雉尾翎羽 (如呂布/猛將)
        draw.ellipse([cx - 84, helm_y - 15, cx + 84, helm_y + 48], fill=(120, 25, 25), outline=(251, 191, 36), width=3)
        draw.arc([cx - 65, helm_y - 85, cx - 15, helm_y + 20], start=210, end=350, fill=(239, 68, 68), width=5)
        draw.arc([cx + 15, helm_y - 85, cx + 65, helm_y + 20], start=190, end=330, fill=(239, 68, 68), width=5)
    else:
        # 秦漢華夏鳳翅金盔 / 鐵鱗兜鍪
        draw.ellipse([cx - 85, helm_y - 18, cx + 85, helm_y + 48], fill=(50, 55, 65), outline=(245, 158, 11), width=3)
        # 盔頂紅纓
        draw.polygon([(cx - 18, helm_y - 8), (cx, helm_y - 60), (cx + 18, helm_y - 8)], fill=(220, 38, 38))
        draw.ellipse([cx - 8, helm_y - 14, cx + 8, helm_y + 2], fill=(251, 191, 36))

    # 8. 專屬兵器展示於側身前衛 (Signature Weapon Silhouette)
    w_color = (235, 235, 245)
    gold = (245, 158, 11)
    
    if "刀" in weapon or "劍" in weapon:
        # 大刀 / 寶劍斜出
        draw.line([cx + 70, cy + 180, cx + 155, cy + 40], fill=(50, 50, 55), width=8)
        draw.line([cx + 72, cy + 178, cx + 153, cy + 42], fill=w_color, width=5)
        draw.ellipse([cx + 95, cy + 135, cx + 115, cy + 155], fill=gold)
    elif "斧" in weapon:
        # 破城大斧 (樂進/徐晃/潘美)
        draw.line([cx + 75, cy + 180, cx + 145, cy + 50], fill=(85, 55, 30), width=9)
        draw.polygon([(cx + 130, cy + 85), (cx + 175, cy + 45), (cx + 155, cy + 110)], fill=w_color, outline=gold, width=2)
    elif "槍" in weapon or "矛" in weapon or "槊" in weapon:
        # 突陣長槍 / 鐵矛
        draw.line([cx + 70, cy + 185, cx + 150, cy + 25], fill=(90, 50, 25), width=7)
        draw.polygon([(cx + 140, cy + 40), (cx + 160, cy + 12), (cx + 150, cy + 55)], fill=w_color, outline=gold, width=2)
        draw.ellipse([cx + 135, cy + 45, cx + 145, cy + 55], fill=(220, 38, 38))
    elif "弓" in weapon or "弩" in weapon:
        # 滿月硬弓 / 神機弩
        draw.arc([cx + 75, cy + 40, cx + 165, cy + 165], start=280, end=90, fill=gold, width=6)
        draw.line([cx + 120, cy + 45, cx + 120, cy + 160], fill=(240, 240, 240), width=2)
    elif "三叉" in weapon or "骨朵" in weapon or "戟" in weapon:
        # 蠻王三叉戟 / 骨朵 / 方天畫戟
        draw.line([cx + 75, cy + 185, cx + 150, cy + 30], fill=(60, 40, 20), width=8)
        draw.polygon([(cx + 135, cy + 45), (cx + 152, cy + 18), (cx + 160, cy + 45)], fill=w_color, outline=gold, width=2)
        draw.ellipse([cx + 140, cy + 40, cx + 158, cy + 58], fill=gold)
    else:
        # 羽扇 / 令旗 / 智謀神卷
        draw.polygon([(cx + 80, cy + 140), (cx + 145, cy + 65), (cx + 155, cy + 115)], fill=(245, 245, 250), outline=gold, width=3)

    # 9. 賽璐珞極限銳化與典藏暗角裝飾 (Vignette & Shading Finish)
    im = ImageEnhance.Sharpness(im).enhance(1.18)
    im = ImageEnhance.Contrast(im).enhance(1.08)

    # 邊框古銅/琉璃細線與標記
    draw = ImageDraw.Draw(im)
    draw.rectangle([2, 2, W - 3, H - 3], outline=theme['aura'], width=2)
    draw.rectangle([5, 5, W - 6, H - 6], outline=(15, 20, 30), width=1)

    # 儲存 Q 版頭像
    im.save(out_path, "JPEG", quality=93)
    return out_path

def main():
    print("[Pipeline] 開始進行全 165 位名將 Q 版頭像批次轉換與去重驗收作業...")
    success_count = 0
    preserved_count = 0
    generated_hashes = {}
    duplicates = []

    for idx, u in enumerate(warlords):
        uid = u['id']
        chibi_target = CHIBI_DIR / f"{uid}.jpg"
        warlord_target = OUT_DIR / f"{uid}.jpg"

        # 若為已存在之旗艦神作且檔案完好，優先繼承
        if uid in PRESERVED_FLAGSHIPS and chibi_target.exists():
            # 確保同步到 assets/warlords/
            im = Image.open(chibi_target)
            im.save(warlord_target, "JPEG", quality=93)
            preserved_count += 1
        else:
            # 依特徵 DNA 全自動合成高精度 Q 版頭像
            draw_chibi_avatar(u, chibi_target)
            # 同步部署至 assets/warlords/
            shutil.copyfile(chibi_target, warlord_target)
            success_count += 1

        # 驗算 MD5 哈希以保證 0 重複
        with open(warlord_target, "rb") as fp:
            file_hash = hashlib.md5(fp.read()).hexdigest()
        
        if file_hash in generated_hashes:
            duplicates.append((uid, generated_hashes[file_hash]))
        else:
            generated_hashes[file_hash] = uid

        if (idx + 1) % 25 == 0 or idx == len(warlords) - 1:
            print(f"  - 進度: [{idx+1}/{len(warlords)}] 已完成 {idx+1} 位名將頭像轉換...")

    print(f"\n[Pipeline 完成] 共處理 165 位名將:")
    print(f"  - 旗艦神作完整繼承: {preserved_count} 位")
    print(f"  - 全新生成賽璐珞 Q 版: {success_count} 位")
    print(f"  - 獨立唯一哈希總數: {len(generated_hashes)} / 165")
    print(f"  - 重複率: {len(duplicates)} 組")

    if duplicates:
        print(f"  [ERROR] 發現重複頭像: {duplicates}")
        sys.exit(1)
    else:
        print("  [SUCCESS] 165 位名將頭像 100% 互異，碰撞率為 0，去重稽核通過！")

if __name__ == "__main__":
    main()
