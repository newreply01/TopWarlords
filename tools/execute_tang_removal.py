import json
import re

TANG_TO_REMOVE = set([
    'LISHIMIN', 'LIXU', 'XUETOU', 'LIJING', 'GUOZIYI', 
    'QINSHUBAO', 'YUCHIGONG', 'XUERENARROW', 'ZHANGXUN', 'LIXU_V'
])

TANG_MAPPING = {
    # Air
    'LISHIMIN': 'HUO',          # air $5 -> 霍去病
    'LIXU': 'ZHAOYUN',          # air $4 -> 趙雲
    'XUETOU': 'DENGAI',         # air $3 -> 鄧艾
    # Armor
    'LIJING': 'BAIQI',          # armor $5 -> 白起
    'GUOZIYI': 'LIANPO',        # armor $4 -> 廉頗
    'QINSHUBAO': 'DIANWEI',     # armor $3 -> 典韋
    'YUCHIGONG': 'XUCHU',       # armor $3 -> 許褚
    # Air Defense
    'XUERENARROW': 'LIGUANG',   # air_defense $5 -> 李廣
    'ZHANGXUN': 'ZHANGHE',      # air_defense $3 -> 張郃
    # Naval
    'LIXU_V': 'WEIYAN'          # naval $3 -> 魏延
}

with open(r'D:\TopWarlords\tools\all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

unit_map = {u['id']: u for u in units}

# Verify mapping
for src, dst in TANG_MAPPING.items():
    s_unit = unit_map[src]
    d_unit = unit_map[dst]
    assert s_unit['cat'] == d_unit['cat'], f"Cat mismatch {src}->{dst}"
    assert s_unit['cost'] == d_unit['cost'], f"Cost mismatch {src}->{dst}"
    assert dst not in TANG_TO_REMOVE, f"Dst {dst} is also Tang!"

print("Tang mapping verified!")

def update_data_js():
    path = r"D:\TopWarlords\js\data.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update header comment
    content = content.replace("175 位日韓中純歷史名將", "165 位日韓中純歷史名將")

    # 2. Filter RAW_UNITS
    raw_units_match = re.search(r'(const\s+RAW_UNITS\s*=\s*\[)(.*?)(\];\s*const\s+UNIT_META)', content, re.DOTALL)
    if not raw_units_match:
        raise ValueError("Could not find RAW_UNITS")
    
    raw_units_lines = raw_units_match.group(2).strip().splitlines()
    new_raw_lines = []
    removed_count = 0
    for line in raw_units_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = re.match(r'\[\"([A-Z0-9_]+)\"', line_clean)
        if m:
            uid = m.group(1)
            if uid in TANG_TO_REMOVE:
                removed_count += 1
                continue
        new_raw_lines.append(line)
    
    print(f"Removed from RAW_UNITS: {removed_count} (remaining {len(new_raw_lines)})")
    assert removed_count == 10
    assert len(new_raw_lines) == 165
    new_raw_block = raw_units_match.group(1) + "\n" + "\n".join(new_raw_lines) + "\n" + raw_units_match.group(3)
    content = content[:raw_units_match.start()] + new_raw_block + content[raw_units_match.end():]

    # 3. Filter UNIT_META
    meta_match = re.search(r'(const\s+UNIT_META\s*=\s*\{)(.*?)(\};(\s*const\s+UNITS|\s*const DRONE_IDS))', content, re.DOTALL)
    if not meta_match:
        raise ValueError("Could not find UNIT_META")

    meta_lines = meta_match.group(2).strip().splitlines()
    new_meta_lines = []
    removed_meta_count = 0
    for line in meta_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = re.match(r'([A-Z0-9_]+):\s*\{', line_clean)
        if m:
            uid = m.group(1)
            if uid in TANG_TO_REMOVE:
                removed_meta_count += 1
                continue
        new_meta_lines.append(line)

    print(f"Removed from UNIT_META: {removed_meta_count} (remaining {len(new_meta_lines)})")
    assert removed_meta_count == 10
    assert len(new_meta_lines) == 165
    new_meta_block = meta_match.group(1) + "\n" + "\n".join(new_meta_lines) + "\n" + meta_match.group(3)
    content = content[:meta_match.start()] + new_meta_block + content[meta_match.end():]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated js/data.js successfully.")

def update_ladder_data():
    path = r"D:\TopWarlords\js\ladder-data.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'(const\s+LADDER_PRESETS\s*=\s*)(\[.*?\])(;)', content, re.DOTALL)
    if not match:
        raise ValueError("Could not find LADDER_PRESETS in ladder-data.js")

    presets = json.loads(match.group(2))
    mapped_count = 0
    for p in presets:
        new_deck = []
        for uid in p['deck']:
            if uid in TANG_MAPPING:
                new_deck.append(TANG_MAPPING[uid])
                mapped_count += 1
            else:
                new_deck.append(uid)
        p['deck'] = new_deck

    print(f"Mapped {mapped_count} occurrences in LADDER_PRESETS")
    new_presets_json = json.dumps(presets, ensure_ascii=False, indent=2)
    content = content[:match.start(2)] + new_presets_json + content[match.end(2):]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated js/ladder-data.js successfully.")

def update_app_js():
    path = r"D:\TopWarlords\js\app.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # In SEED_GHOSTS, line 55 was:
    # ['LISHIMIN','LIANPO','LIGUANG','YANGSU','XUNYU']
    # Replace LISHIMIN with WEI (衛青) or HUO (霍去病)
    old_target = "{ id: 'g_aegis', callsign: '天策府・玄甲精騎', title: '天策上將', rating: 1720, wins: 104, losses: 25, deck: ['LISHIMIN','LIANPO','LIGUANG','YANGSU','XUNYU'], doctrine: 'strike', motto: '玄甲鐵騎貫陣而入，神射強弩萬箭齊發。', isUser: false }"
    new_target = "{ id: 'g_aegis', callsign: '大司馬・漢軍鐵騎', title: '大將軍大司馬', rating: 1720, wins: 104, losses: 25, deck: ['WEI','LIANPO','LIGUANG','YANGSU','XUNYU'], doctrine: 'strike', motto: '武剛車陣奇兵破虜，神射強弩萬箭齊發。', isUser: false }"

    assert old_target in content, "Could not find old g_aegis target in js/app.js"
    content = content.replace(old_target, new_target)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated js/app.js successfully.")

def update_json_files():
    # 1. all_warlords.json
    path1 = r"D:\TopWarlords\all_warlords.json"
    with open(path1, 'r', encoding='utf-8') as f:
        data1 = json.load(f)
    orig_len1 = len(data1)
    data1 = [u for u in data1 if u['id'] not in TANG_TO_REMOVE]
    print(f"all_warlords.json: {orig_len1} -> {len(data1)}")
    assert len(data1) == 165
    with open(path1, 'w', encoding='utf-8') as f:
        json.dump(data1, f, ensure_ascii=False, indent=2)

    # 2. tools/all_units.json
    path2 = r"D:\TopWarlords\tools\all_units.json"
    with open(path2, 'r', encoding='utf-8') as f:
        data2 = json.load(f)
    orig_len2 = len(data2)
    data2 = [u for u in data2 if u['id'] not in TANG_TO_REMOVE]
    print(f"tools/all_units.json: {orig_len2} -> {len(data2)}")
    assert len(data2) == 165
    with open(path2, 'w', encoding='utf-8') as f:
        json.dump(data2, f, ensure_ascii=False, indent=2)

    # 3. tools/chibi_prompts.json
    path3 = r"D:\TopWarlords\tools\chibi_prompts.json"
    with open(path3, 'r', encoding='utf-8') as f:
        data3 = json.load(f)
    orig_len3 = len(data3)
    data3 = [u for u in data3 if u['id'] not in TANG_TO_REMOVE]
    print(f"tools/chibi_prompts.json: {orig_len3} -> {len(data3)}")
    assert len(data3) == 165
    with open(path3, 'w', encoding='utf-8') as f:
        json.dump(data3, f, ensure_ascii=False, indent=2)

def update_ui_and_docs():
    # armory.html
    p_armory = r"D:\TopWarlords\armory.html"
    with open(p_armory, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("(175 位日韓中純歷史名將)", "(165 位日韓中純歷史名將)")
    c = c.replace("175 位日韓中純歷史名將", "165 位日韓中純歷史名將")
    c = c.replace("HERO ENCYCLOPEDIA · 175 HISTORICAL WARLORDS", "HERO ENCYCLOPEDIA · 165 HISTORICAL WARLORDS")
    c = c.replace('<div class="num" id="totalUnitsCount">175</div>', '<div class="num" id="totalUnitsCount">165</div>')
    c = c.replace('全部兵團 (175)', '全部兵團 (165)')
    c = c.replace('⚡ 奔雷突騎 (39)', '⚡ 奔雷突騎 (36)')
    c = c.replace('🛡️ 重甲陷陣 (35)', '🛡️ 重甲陷陣 (31)')
    c = c.replace('🏹 神射強弩 (33)', '🏹 神射強弩 (31)')
    c = c.replace('⚔️ 先登奇兵 (33)', '⚔️ 先登奇兵 (32)')
    c = c.replace('📜 軍師奇謀 (35)', '📜 軍師奇謀 (35)')
    c = c.replace('🇨🇳 中國 (105)', '🇨🇳 中國 (95)')
    c = c.replace('🇯🇵 日本 (48)', '🇯🇵 日本 (48)')
    c = c.replace('🇰🇷 韓國 (22)', '🇰🇷 韓國 (22)')
    c = c.replace('<b id="filteredCount">175</b> 位歷史名將', '<b id="filteredCount">165</b> 位歷史名將')
    c = c.replace('全部 175 位日韓中純歷史名將點將錄', '全部 165 位日韓中純歷史名將點將錄')
    with open(p_armory, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated armory.html")

    # index.html
    p_index = r"D:\TopWarlords\index.html"
    with open(p_index, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("從 175 位日韓中歷史名將組建五大兵團", "從 165 位日韓中歷史名將組建五大兵團")
    c = c.replace("從 175 位日韓中純歷史名將組建五大兵團", "從 165 位日韓中純歷史名將組建五大兵團")
    c = c.replace("瀏覽 175 位日韓中純歷史名將點將錄", "瀏覽 165 位日韓中純歷史名將點將錄")
    with open(p_index, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated index.html")

    # README.md
    p_readme = r"D:\TopWarlords\README.md"
    with open(p_readme, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("175 位日韓中純歷史名將", "165 位日韓中純歷史名將")
    c = c.replace("175 位名將專屬古典水墨卡牌圖資", "165 位名將專屬古典水墨卡牌圖資")
    c = c.replace("175 位名將傳記與兵法辭典", "165 位名將傳記與兵法辭典")
    with open(p_readme, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated README.md")

    # js/poster-help.js
    p_poster = r"D:\TopWarlords\js\poster-help.js"
    with open(p_poster, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("收錄 175 位日韓中純歷史名將", "收錄 165 位日韓中純歷史名將")
    with open(p_poster, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated js/poster-help.js")

    # tools/balance.js
    p_bal = r"D:\TopWarlords\tools\balance.js"
    with open(p_bal, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("175 位日韓中純歷史名將", "165 位日韓中純歷史名將")
    with open(p_bal, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated tools/balance.js")

if __name__ == '__main__':
    update_data_js()
    update_ladder_data()
    update_app_js()
    update_json_files()
    update_ui_and_docs()
    print("\nALL TANG DYNASTY UNITS REMOVED SUCCESSFULLY (165 WARLORDS)!")
