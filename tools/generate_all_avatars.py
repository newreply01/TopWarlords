# -*- coding: utf-8 -*-
"""
生成全套 200 位歷史名將光榮特庫摩古典軍事水墨頭像 (256x256)
"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFont

FONT_KAI = 'C:/Windows/Fonts/kaiu.ttf'
FONT_YAHEI_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'

try:
    font_large_char = ImageFont.truetype(FONT_KAI, 102)
    font_name = ImageFont.truetype(FONT_KAI, 26)
    font_seal = ImageFont.truetype(FONT_KAI, 22)
    font_cost = ImageFont.truetype(FONT_YAHEI_BOLD, 22)
    font_type = ImageFont.truetype(FONT_KAI, 18)
    font_tag = ImageFont.truetype(FONT_KAI, 15)
except:
    font_large_char = font_name = font_seal = font_cost = font_type = font_tag = ImageFont.load_default()

CAT_PALETTES = {
    'air': {
        'bg1': (16, 42, 68), 'bg2': (6, 16, 28), 'accent': (56, 189, 248), 'gold': (251, 191, 36),
        'seal_bg': (180, 83, 9), 'badge': '突', 'type': '突騎'
    },
    'armor': {
        'bg1': (56, 32, 14), 'bg2': (24, 12, 6), 'accent': (245, 158, 11), 'gold': (251, 191, 36),
        'seal_bg': (154, 52, 18), 'badge': '盾', 'type': '重甲'
    },
    'air_defense': {
        'bg1': (44, 24, 60), 'bg2': (18, 10, 26), 'accent': (168, 85, 247), 'gold': (251, 191, 36),
        'seal_bg': (126, 34, 206), 'badge': '弓', 'type': '神射'
    },
    'naval': {
        'bg1': (12, 44, 56), 'bg2': (6, 20, 26), 'accent': (34, 211, 238), 'gold': (251, 191, 36),
        'seal_bg': (14, 116, 144), 'badge': '鋒', 'type': '先登'
    },
    'support': {
        'bg1': (18, 48, 30), 'bg2': (8, 22, 14), 'accent': (74, 222, 128), 'gold': (251, 191, 36),
        'seal_bg': (21, 128, 61), 'badge': '謀', 'type': '軍師'
    }
}

COMPOUND_SURNAMES = {
    '諸葛': '亮', '司馬': '懿', '夏侯': '惇', '上杉': '謙', '武田': '信',
    '織田': '信', '德川': '康', '豐臣': '吉', '真田': '村', '伊達': '宗',
    '毛利': '元', '島津': '弘', '長宗': '我', '北條': '氏', '立花': '道'
}

def get_core_char(name):
    for comp, ch in COMPOUND_SURNAMES.items():
        if name.startswith(comp):
            return ch
    return name[0]

def render_warlord(id, name, cat, cost, tag, flag, origin, weapon, out_path):
    W, H = 256, 256
    im = Image.new('RGB', (W, H), (12, 14, 18))
    draw = ImageDraw.Draw(im)

    pal = CAT_PALETTES.get(cat, CAT_PALETTES['armor'])
    cx, cy = 128, 116

    # 1. 古戰場水墨絹本漸層背景 (Radial Gradient)
    for r in range(128, 0, -5):
        t = 1.0 - (r / 128.0)
        c = (
            int(pal['bg2'][0] + (pal['bg1'][0] - pal['bg2'][0]) * t),
            int(pal['bg2'][1] + (pal['bg1'][1] - pal['bg2'][1]) * t),
            int(pal['bg2'][2] + (pal['bg1'][2] - pal['bg2'][2]) * t)
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

    # 金箔與戰場星火飛屑 (Gold Flakes & Sparks)
    random.seed(sum(ord(c) for c in id + name))
    for _ in range(50):
        gx = random.randint(12, 244)
        gy = random.randint(12, 244)
        gr = random.randint(1, 3)
        draw.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=pal['gold'] if random.random() > 0.4 else pal['accent'])

    # 2. 雙重古典青銅 / 鎏金戰徽圓輪 (Sun / Moon Crest Aura)
    draw.ellipse([cx - 78, cy - 78, cx + 78, cy + 78], outline=(pal['gold'][0]//2, pal['gold'][1]//2, pal['gold'][2]//2), width=1)
    draw.ellipse([cx - 72, cy - 72, cx + 72, cy + 72], outline=pal['gold'], width=2)
    draw.ellipse([cx - 66, cy - 66, cx + 66, cy + 66], outline=pal['accent'], width=1)

    # 3. 巨幅名將書法大字 (Central Calligraphy Char)
    core_char = get_core_char(name)
    # 外層水墨陰影
    for ox in [-3, 0, 3]:
        for oy in [-3, 0, 3]:
            draw.text((cx - 51 + ox, cy - 65 + oy), core_char, fill=(0, 0, 0), font=font_large_char)
    # 金邊勾勒
    for ox in [-1, 1]:
        for oy in [-1, 1]:
            draw.text((cx - 51 + ox, cy - 65 + oy), core_char, fill=pal['gold'], font=font_large_char)
    # 大字主色 (象牙玉白)
    draw.text((cx - 51, cy - 65), core_char, fill=(255, 252, 242), font=font_large_char)

    # 4. 下方雄渾重鎧將軍護肩與胸甲 (Armored Torso & Pauldrons)
    draw.polygon([(46, 204), (88, 160), (128, 148), (168, 160), (210, 204)], fill=(18, 22, 28))
    # 雙肩甲金屬緣飾
    draw.ellipse([34, 164, 88, 206], fill=(42, 48, 60), outline=pal['gold'], width=2)
    draw.ellipse([168, 164, 222, 206], fill=(42, 48, 60), outline=pal['gold'], width=2)
    # 中央鎏金護心鏡
    draw.ellipse([106, 156, 150, 200], fill=(212, 175, 55), outline=pal['gold'], width=2)
    draw.ellipse([114, 164, 142, 192], fill=(255, 248, 220))

    # 5. 典雅古典裝飾邊框 (青銅鎏金四角雲紋框)
    draw.rectangle([4, 4, W - 5, H - 5], outline=pal['accent'], width=2)
    draw.rectangle([7, 7, W - 8, H - 8], outline=pal['gold'], width=1)

    # 四角雲紋金屬角花
    cl = 24
    for pt in [(4, 4), (W - 5, 4), (4, H - 5), (W - 5, H - 5)]:
        dx = cl if pt[0] == 4 else -cl
        dy = cl if pt[1] == 4 else -cl
        draw.line([(pt[0], pt[1]), (pt[0] + dx, pt[1])], fill=pal['gold'], width=4)
        draw.line([(pt[0], pt[1]), (pt[0], pt[1] + dy)], fill=pal['gold'], width=4)

    # 6. 頂部徽章標籤 (左上軍令角標，右上篆刻古璽)
    # 左上軍令費金牌 + 兵種徽記
    draw.rectangle([8, 8, 76, 38], fill=(12, 18, 26, 240), outline=pal['gold'], width=1)
    draw.text((14, 10), f"${cost}", fill=pal['gold'], font=font_cost)
    draw.text((50, 12), pal['badge'], fill=pal['accent'], font=font_type)

    # 右上紅色朱砂篆刻印章 (如「漢」「蜀」「魏」「秦」「日」「韓」)
    draw.rectangle([W - 46, 8, W - 8, 46], fill=(185, 28, 28), outline=pal['gold'], width=1)
    dynasty_char = '漢'
    if '三國' in origin or '蜀' in origin: dynasty_char = '蜀'
    elif '魏' in origin: dynasty_char = '魏'
    elif '吳' in origin: dynasty_char = '吳'
    elif '唐' in origin: dynasty_char = '唐'
    elif '宋' in origin: dynasty_char = '宋'
    elif '明' in origin: dynasty_char = '明'
    elif '秦' in origin: dynasty_char = '秦'
    elif '戰國' in origin or '日本' in origin or 'JP' in flag: dynasty_char = '和'
    elif '朝鮮' in origin or '高麗' in origin or '新羅' in origin or 'KR' in flag: dynasty_char = '韓'
    draw.text((W - 39, 13), dynasty_char, fill=(255, 240, 200), font=font_seal)

    # 7. 底部名將題名黑金水墨銘牌 (大字楷體 + 金色邊飾)
    draw.rectangle([12, 204, W - 13, 246], fill=(10, 14, 22, 245), outline=pal['gold'], width=2)
    # 銘牌左側陣營國別標籤
    dyn_short = '中' if ('CN' in flag or '漢' in origin or '唐' in origin or '秦' in origin or '三國' in origin) else '日' if ('JP' in flag or '日本' in origin) else '韓'
    draw.text((18, 212), dyn_short, fill=pal['accent'], font=font_tag)

    # 名將姓名居中
    name_len = len(name)
    name_x = (W - name_len * 26) // 2 + 10
    draw.text((name_x, 208), name, fill=(255, 255, 255), font=font_name)

    im.save(out_path, quality=95)

# 讀取 data.js 中的 200 位名將並重新生成
with open('D:/TopWarlords/js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
raw_matches = re.findall(r'\[\s*"([A-Z0-9_]+)"\s*,\s*"([^"]+)"\s*,\s*\'([a-z_]+)\'\s*,\s*(\d+)\s*,\s*\'([A-H])\'\s*,\s*"([^"]+)"', text)
meta_dict = {}
for m in re.finditer(r'([A-Z0-9_]+):\s*\{\s*flag:\s*\'([^\']+)\',\s*origin:\s*\'([^\']+)\',\s*weapon:\s*\'([^\']+)\'', text):
    meta_dict[m.group(1)] = {
        'flag': m.group(2),
        'origin': m.group(3),
        'weapon': m.group(4)
    }

count = 0
for uid, name, cat, cost, variant, tag in raw_matches:
    meta = meta_dict.get(uid, {'flag': '🇨🇳', 'origin': '中國·歷史名將', 'weapon': '百戰神兵'})
    out_file = f'D:/TopWarlords/assets/warlords/{uid}.jpg'
    render_warlord(uid, name, cat, int(cost), tag, meta['flag'], meta['origin'], meta['weapon'], out_file)
    count += 1

print(f'\n🎉 Successfully regenerated all {count} authentic Koei-style warlord portrait avatars!')
