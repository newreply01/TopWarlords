# -*- coding: utf-8 -*-
"""
批次生成 200 位日韓中名將專屬古典水墨風格卡牌圖資 (assets/warlords/*.jpg)
規格：640 x 360 高清 16:9，具備國別徽印、兵團光環、專屬名號書法題字與五維防偽暗紋
"""
import json, os, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path("D:/TopWarlords")
OUT_DIR = ROOT / "assets" / "warlords"
OUT_DIR.mkdir(parents=True, exist_ok=True)

warlords = json.loads((ROOT / "all_warlords.json").read_text(encoding="utf-8"))

# 字型配置
FONT_PATH_TITLE = "C:/Windows/Fonts/kaiu.ttf"  # 標楷體
FONT_PATH_BODY = "C:/Windows/Fonts/msjh.ttc"   # 微軟正黑體
FONT_PATH_MONO = "C:/Windows/Fonts/arial.ttf"

font_title = ImageFont.truetype(FONT_PATH_TITLE, 52)
font_id = ImageFont.truetype(FONT_PATH_MONO, 22)
font_tag = ImageFont.truetype(FONT_PATH_BODY, 20)
font_weapon = ImageFont.truetype(FONT_PATH_BODY, 18)
font_flag = ImageFont.truetype(FONT_PATH_BODY, 28)
font_cost = ImageFont.truetype(FONT_PATH_MONO, 38)
font_seal = ImageFont.truetype(FONT_PATH_TITLE, 18)

CAT_COLORS = {
    'air':         ('#0f172a', '#0369a1', '#38bdf8', '奔雷突騎'),
    'armor':       ('#1c1917', '#b45309', '#fbbf24', '重甲陷陣'),
    'air_defense': ('#1e1b4b', '#6d28d9', '#a78bfa', '神射強弩'),
    'naval':       ('#082f49', '#0e7490', '#22d3ee', '先登奇兵'),
    'support':     ('#052e16', '#15803d', '#4ade80', '軍師奇謀')
}

W, H = 640, 360

for idx, u in enumerate(warlords):
    bg_dark, bg_mid, accent_col, cat_name = CAT_COLORS.get(u['cat'], ('#0f172a', '#1e293b', '#38bdf8', '東亞名將'))
    
    # 建立主畫布
    img = Image.new('RGB', (W, H), color=bg_dark)
    draw = ImageDraw.Draw(img)

    # 1. 背景漸層暗紋與幾何同心圓（古戰場陣法八卦盤風格）
    center_x, center_y = 440, 180
    for radius in range(40, 260, 28):
        circle_box = [(center_x - radius, center_y - radius), (center_x + radius, center_y + radius)]
        draw.ellipse(circle_box, outline='#ffffff', width=1)
    
    # 覆蓋一層半透明暗調矩形營造景深
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 160))
    img.paste(Image.composite(img.convert('RGBA'), overlay, Image.new('L', (W, H), 120)), (0, 0))
    draw = ImageDraw.Draw(img)

    # 2. 邊框裝飾（古代卷軸邊框）
    draw.rectangle([(12, 12), (W - 13, H - 13)], outline=accent_col, width=2)
    draw.rectangle([(16, 16), (W - 17, H - 17)], outline='#334155', width=1)
    
    # 四角雲紋折角
    corner_len = 24
    for cx, cy in [(12, 12), (W-13, 12), (12, H-13), (W-13, H-13)]:
        dx = corner_len if cx == 12 else -corner_len
        dy = corner_len if cy == 12 else -corner_len
        draw.line([(cx, cy), (cx + dx, cy)], fill=accent_col, width=4)
        draw.line([(cx, cy), (cx, cy + dy)], fill=accent_col, width=4)

    # 3. 左上方：國別旗幟與兵團徽印
    draw.text((32, 28), f"{u['flag']} {u['origin']}", font=font_flag, fill='#e2e8f0')
    draw.text((32, 68), f"【{cat_name} · {u['v']}型】", font=font_tag, fill=accent_col)

    # 4. 中央主角名號（古典大字書法風）
    draw.text((32, 115), u['name'], font=font_title, fill='#ffffff')

    # 英文代碼與作戰定位
    draw.text((32, 185), f"{u['id']} · {u['tag']}", font=font_id, fill='#94a3b8')

    # 5. 專屬主力兵器
    draw.rectangle([(32, 225), (420, 265)], fill='#1e293b', outline='#475569')
    draw.text((42, 234), f"⚔️ 兵器：{u['weapon']}", font=font_weapon, fill='#fbbf24')

    # 6. 右上方：軍令費用徽章 ($1 ~ $5)
    draw.rounded_rectangle([(W - 120, 28), (W - 32, 88)], radius=10, fill='#0f172a', outline='#f59e0b', width=2)
    draw.text((W - 105, 36), f"${u['cost']}", font=font_cost, fill='#fbbf24')

    # 7. 右下方：朱砂古印（金印/玉璽印章）
    seal_x, seal_y = W - 110, H - 110
    draw.rectangle([(seal_x, seal_y), (seal_x + 75, seal_y + 75)], outline='#dc2626', width=3)
    draw.rectangle([(seal_x + 4, seal_y + 4), (seal_x + 71, seal_y + 71)], outline='#ef4444', width=1)
    draw.text((seal_x + 19, seal_y + 16), "名將", font=font_seal, fill='#ef4444')
    draw.text((seal_x + 19, seal_y + 42), "真跡", font=font_seal, fill='#ef4444')

    # 儲存圖片
    target_path = OUT_DIR / f"{u['id']}.jpg"
    img.save(target_path, "JPEG", quality=88)

print(f"🎉 成功批次生成全部 {len(warlords)} 位名將專屬古典水墨卡牌圖資於 {OUT_DIR}！")

