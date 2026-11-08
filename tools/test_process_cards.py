# -*- coding: utf-8 -*-
"""
測試將真實歷史人物畫精準裁切頭部/胸像，並加上光榮風格金屬陣營框與姓名角標
"""
from PIL import Image, ImageDraw, ImageFont

FONT_KAI = 'C:/Windows/Fonts/kaiu.ttf'
FONT_YAHEI = 'C:/Windows/Fonts/msyhbd.ttc'

try:
    font_name = ImageFont.truetype(FONT_KAI, 24)
    font_cost = ImageFont.truetype(FONT_YAHEI, 18)
    font_tag = ImageFont.truetype(FONT_KAI, 14)
except:
    font_name = font_cost = font_tag = ImageFont.load_default()

def process_warlord_card(img_path, name, cost, badge_text, out_path, crop_box=None):
    W, H = 256, 256
    im = Image.open(img_path).convert('RGB')
    
    # 若有指定 crop_box 則精準裁切人臉區域
    if crop_box:
        im = im.crop(crop_box)
    else:
        # 預設裁切中央偏上方 (人臉多在中央上方)
        orig_w, orig_h = im.size
        side = min(orig_w, orig_h)
        left = (orig_w - side) // 2
        top = int((orig_h - side) * 0.15)
        im = im.crop((left, top, left + side, top + side))

    im = im.resize((W, H), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(im)

    # 1. 四角鎏金金屬框
    gold_color = (251, 191, 36)
    draw.rectangle([2, 2, W - 3, H - 3], outline=gold_color, width=3)
    draw.rectangle([5, 5, W - 6, H - 6], outline=(180, 130, 40), width=1)

    # 四角雲紋金飾
    cl = 20
    for pt in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3)]:
        dx = cl if pt[0] == 2 else -cl
        dy = cl if pt[1] == 2 else -cl
        draw.line([(pt[0], pt[1]), (pt[0] + dx, pt[1])], fill=gold_color, width=4)
        draw.line([(pt[0], pt[1]), (pt[0], pt[1] + dy)], fill=gold_color, width=4)

    # 2. 左上軍令費金牌 ($5 突)
    draw.rectangle([6, 6, 64, 32], fill=(15, 23, 42, 230), outline=gold_color, width=1)
    draw.text((10, 8), f"${cost}", fill=gold_color, font=font_cost)
    draw.text((40, 9), badge_text, fill=(56, 189, 248), font=font_tag)

    # 3. 底部水墨名牌 (半透明深色黑金底，襯托書法姓名)
    draw.rectangle([10, H - 38, W - 11, H - 8], fill=(12, 16, 24, 230), outline=gold_color, width=1)
    name_len = len(name)
    name_x = (W - name_len * 24) // 2
    draw.text((name_x, H - 36), name, fill=(255, 255, 255), font=font_name)

    im.save(out_path, quality=95)
    print(f"Processed card: {name} -> {out_path}")

# 測試 5 張
# 武田信玄裁切面部 (原圖 1400x2088)
shingen_im = Image.open('D:/TopWarlords/cache/portraits/SHINGEN.jpg')
sw, sh = shingen_im.size
process_warlord_card('D:/TopWarlords/cache/portraits/SHINGEN.jpg', '武田信玄', 5, '突', 'D:/TopWarlords/cache/portraits/card_SHINGEN.jpg',
                     crop_box=(int(sw*0.1), int(sh*0.25), int(sw*0.9), int(sh*0.75)))

# 上杉謙信裁切面部
kenshin_im = Image.open('D:/TopWarlords/cache/portraits/KENSHIN.jpg')
kw, kh = kenshin_im.size
process_warlord_card('D:/TopWarlords/cache/portraits/KENSHIN.jpg', '上杉謙信', 4, '突', 'D:/TopWarlords/cache/portraits/card_KENSHIN.jpg',
                     crop_box=(int(kw*0.2), int(kh*0.08), int(kw*0.8), int(kh*0.68)))

# 關羽裁切頭胸
gy_im = Image.open('D:/TopWarlords/cache/portraits/GUANYU.jpg')
gw, gh = gy_im.size
process_warlord_card('D:/TopWarlords/cache/portraits/GUANYU.jpg', '關羽', 4, '盾', 'D:/TopWarlords/cache/portraits/card_GUANYU.jpg',
                     crop_box=(int(gw*0.35), int(gh*0.04), int(gw*0.95), int(gh*0.48)))

# 曹操裁切
cc_im = Image.open('D:/TopWarlords/cache/portraits/CAOCAO.jpg')
cw, ch = cc_im.size
process_warlord_card('D:/TopWarlords/cache/portraits/CAOCAO.jpg', '曹操', 4, '謀', 'D:/TopWarlords/cache/portraits/card_CAOCAO.jpg',
                     crop_box=(int(cw*0.05), int(ch*0.02), int(cw*0.8), int(ch*0.6)))

# 呂布裁切
lb_im = Image.open('D:/TopWarlords/cache/portraits/LUBU.jpg')
lw, lh = lb_im.size
process_warlord_card('D:/TopWarlords/cache/portraits/LUBU.jpg', '呂布', 5, '突', 'D:/TopWarlords/cache/portraits/card_LUBU.jpg',
                     crop_box=(int(lw*0.35), int(lh*0.15), int(lw*0.85), int(lh*0.6)))
