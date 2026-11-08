# -*- coding: utf-8 -*-
"""
測試生成高精度光榮三國志風格名將頭像
包含：
1. 暮色水墨暈染背景與金箔紋理
2. 兵種光環與名將金屬包角框
3. 武將戰盔 / 兜鍪 / 綸巾 / 戰袍 / 護心鏡立體彩繪剪影
4. 陣營古璽印章與大字名號
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_KAI = 'C:/Windows/Fonts/kaiu.ttf'
FONT_YAHEI_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'

CAT_THEMES = {
    'air':         {'bg_dark': (15, 23, 42),   'accent': (56, 189, 248),  'crest': '⚡', 'armor': (220, 180, 80)},
    'armor':       {'bg_dark': (30, 20, 10),   'accent': (245, 158, 11),  'crest': '🛡', 'armor': (140, 140, 150)},
    'air_defense': {'bg_dark': (25, 15, 35),   'accent': (168, 85, 247),  'crest': '🏹', 'armor': (180, 130, 70)},
    'naval':       {'bg_dark': (10, 25, 35),   'accent': (34, 211, 238),  'crest': '⚔', 'armor': (80, 160, 180)},
    'support':     {'bg_dark': (12, 28, 20),   'accent': (74, 222, 128),  'crest': '📜', 'armor': (160, 200, 160)},
}

def generate_warlord_avatar(name, cat, cost, origin, weapon, flag, out_path):
    W, H = 256, 256
    im = Image.new('RGB', (W, H), (15, 18, 24))
    draw = ImageDraw.Draw(im)

    theme = CAT_THEMES.get(cat, CAT_THEMES['armor'])

    # 1. 繪製水墨暈染與陣容氣場背景
    for r in range(120, 0, -8):
        alpha = int(255 * (1 - r / 120))
        c = (
            int(theme['bg_dark'][0] + (theme['accent'][0] - theme['bg_dark'][0]) * (1 - r/120) * 0.5),
            int(theme['bg_dark'][1] + (theme['accent'][1] - theme['bg_dark'][1]) * (1 - r/120) * 0.5),
            int(theme['bg_dark'][2] + (theme['accent'][2] - theme['bg_dark'][2]) * (1 - r/120) * 0.5)
        )
        draw.ellipse([128 - r, 128 - r, 128 + r, 128 + r], fill=c)

    # 散落水墨斑點
    random.seed(sum(ord(ch) for ch in name))
    for _ in range(30):
        bx = random.randint(10, 246)
        by = random.randint(10, 246)
        br = random.randint(2, 6)
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(theme['accent'][0], theme['accent'][1], theme['accent'][2]))

    # 2. 名將武裝半身造型彩繪
    cx, cy = 128, 148

    # 披風大氅
    cape_color = (130, 25, 25) if cost >= 4 else (30, 60, 100)
    draw.polygon([(cx - 70, cy + 80), (cx, cy + 20), (cx + 70, cy + 80), (cx + 85, 240), (cx - 85, 240)], fill=cape_color)

    # 重裝鎧甲軀幹 (山文甲/鎖子甲)
    armor_color = theme['armor']
    draw.polygon([(cx - 48, cy + 20), (cx + 48, cy + 20), (cx + 56, 240), (cx - 56, 240)], fill=(40, 44, 52))
    # 雙肩大袖護肩
    draw.ellipse([cx - 72, cy + 18, cx - 36, cy + 70], fill=armor_color)
    draw.ellipse([cx + 36, cy + 18, cx + 72, cy + 70], fill=armor_color)
    # 護心鏡
    draw.ellipse([cx - 24, cy + 45, cx + 24, cy + 93], fill=(212, 175, 55), outline=(255, 215, 0), width=2)
    draw.ellipse([cx - 16, cy + 53, cx + 16, cy + 85], fill=(255, 240, 180))

    # 面部與五官輪廓
    face_color = (245, 215, 180)
    draw.polygon([(cx - 24, cy - 10), (cx + 24, cy - 10), (cx + 20, cy + 22), (cx, cy + 32), (cx - 20, cy + 22)], fill=face_color)

    # 名將頭飾：依兵種區分（戰盔兜鍪 / 軍師綸巾 / 突騎戰兜 / 先登護額）
    if cat == 'support':
        # 諸葛綸巾 / 軍師羽冠
        draw.polygon([(cx - 26, cy - 10), (cx + 26, cy - 10), (cx + 18, cy - 50), (cx - 18, cy - 50)], fill=(20, 40, 30))
        draw.rectangle([cx - 6, cy - 55, cx + 6, cy - 45], fill=(212, 175, 55))
        # 兩側綸巾飄帶
        draw.polygon([(cx - 26, cy - 10), (cx - 36, cy + 30), (cx - 26, cy + 15)], fill=(15, 30, 20))
        draw.polygon([(cx + 26, cy - 10), (cx + 36, cy + 30), (cx + 26, cy + 15)], fill=(15, 30, 20))
    elif 'JP' in flag or '織田' in origin or '武田' in origin or '上杉' in origin or '日本' in origin:
        # 日本戰國經典兜鍪 (前立天衝 / 鍬形 / 日輪)
        draw.polygon([(cx - 28, cy - 6), (cx + 28, cy - 6), (cx + 22, cy - 36), (cx - 22, cy - 36)], fill=(30, 30, 35))
        # 金色鍬形前立
        draw.polygon([(cx - 38, cy - 52), (cx, cy - 25), (cx + 38, cy - 52), (cx, cy - 36)], fill=(234, 179, 8))
        draw.ellipse([cx - 8, cy - 38, cx + 8, cy - 22], fill=(185, 28, 28)) # 日輪赤心
    else:
        # 漢唐宋明將軍兜盔 (鳳翅紅纓兜鍪)
        draw.polygon([(cx - 28, cy - 6), (cx + 28, cy - 6), (cx + 20, cy - 40), (cx - 20, cy - 40)], fill=(80, 85, 95))
        # 金色盔眉與鳳翅護耳
        draw.polygon([(cx - 36, cy - 15), (cx - 22, cy - 38), (cx - 22, cy - 10)], fill=(212, 175, 55))
        draw.polygon([(cx + 36, cy - 15), (cx + 22, cy - 38), (cx + 22, cy - 10)], fill=(212, 175, 55))
        # 盔頂紅纓
        draw.polygon([(cx - 5, cy - 40), (cx + 5, cy - 40), (cx + 12, cy - 62), (cx - 12, cy - 62)], fill=(220, 38, 38))

    # 威嚴目光與鬍鬚 (英武將相)
    draw.line([(cx - 14, cy + 2), (cx - 6, cy + 4)], fill=(40, 20, 10), width=2)
    draw.line([(cx + 6, cy + 4), (cx + 14, cy + 2)], fill=(40, 20, 10), width=2)
    draw.ellipse([cx - 11, cy + 4, cx - 7, cy + 8], fill=(255, 255, 255))
    draw.ellipse([cx + 7, cy + 4, cx + 11, cy + 8], fill=(255, 255, 255))
    draw.point((cx - 9, cy + 6), fill=(0, 0, 0))
    draw.point((cx + 9, cy + 6), fill=(0, 0, 0))
    # 威武長鬚
    if cost >= 3:
        draw.polygon([(cx - 10, cy + 24), (cx + 10, cy + 24), (cx, cy + 45)], fill=(30, 20, 20))

    # 3. 四角鎏金金屬框
    draw.rectangle([4, 4, W - 5, H - 5], outline=theme['accent'], width=3)
    corner_len = 24
    draw.line([(4, 4), (4 + corner_len, 4)], fill=(251, 191, 36), width=5)
    draw.line([(4, 4), (4, 4 + corner_len)], fill=(251, 191, 36), width=5)
    draw.line([(W - 5, 4), (W - 5 - corner_len, 4)], fill=(251, 191, 36), width=5)
    draw.line([(W - 5, 4), (W - 5, 4 + corner_len)], fill=(251, 191, 36), width=5)
    draw.line([(4, H - 5), (4 + corner_len, H - 5)], fill=(251, 191, 36), width=5)
    draw.line([(4, H - 5), (4, H - 5 - corner_len)], fill=(251, 191, 36), width=5)
    draw.line([(W - 5, H - 5), (W - 5 - corner_len, H - 5)], fill=(251, 191, 36), width=5)
    draw.line([(W - 5, H - 5), (W - 5, H - 5 - corner_len)], fill=(251, 191, 36), width=5)

    # 4. 頂部名將題名古印章牌
    # 左上角國旗與兵種符
    draw.rectangle([10, 10, 68, 38], fill=(0, 0, 0, 200), outline=(251, 191, 36), width=1)
    try:
        font_sub = ImageFont.truetype(FONT_YAHEI_BOLD, 15)
        font_title = ImageFont.truetype(FONT_KAI, 26)
        font_crest = ImageFont.truetype(FONT_YAHEI_BOLD, 38)
    except:
        font_sub = font_title = font_crest = ImageFont.load_default()

    draw.text((16, 14), f"${cost}", fill=(251, 191, 36), font=font_sub)

    # 底部水墨書法名牌
    draw.rectangle([20, 206, W - 21, 246], fill=(10, 14, 20, 220), outline=theme['accent'], width=1)
    name_w = len(name) * 26
    start_x = (W - name_w) // 2
    draw.text((start_x, 210), name, fill=(255, 255, 255), font=font_title)

    # 右上角陣營古璽印章 (紅色篆刻)
    draw.rectangle([W - 46, 10, W - 10, 46], fill=(185, 28, 28), outline=(251, 191, 36), width=1)
    seal_char = name[0] if len(name) > 0 else '將'
    try:
        font_seal = ImageFont.truetype(FONT_KAI, 24)
        draw.text((W - 40, 14), seal_char, fill=(255, 240, 200), font=font_seal)
    except:
        pass

    im.save(out_path, quality=95)
    print(f'Generated {name} -> {out_path}')

# 測試生成 3 張代表性名將
generate_warlord_avatar('霍去病', 'air', 5, '中國·西漢', '漢軍玄甲鐵騎', '🇨🇳', 'D:/TopWarlords/assets/warlords/test_HUO.jpg')
generate_warlord_avatar('諸葛亮', 'support', 5, '中國·三國', '八陣奇謀羽扇', '🇨🇳', 'D:/TopWarlords/assets/warlords/test_ZG.jpg')
generate_warlord_avatar('上杉謙信', 'air', 4, '日本·戰國', '車懸之陣薙刀', '🇯🇵', 'D:/TopWarlords/assets/warlords/test_KENSHIN.jpg')

