import json
import re

TO_REMOVE = set([
    # China - Ming & Qing (9)
    'CHANGYUCHUN', 'XUDA', 'LANYU', 'QIJIGUANG', 'YUANCHONGHUAN', 
    'ZHENGCHENG', 'SHILANG', 'LIUBOWEN', 'YUAN_STRAT',
    # Korea - Joseon (16) -- YISUNSIN IS KEPT!
    'YISEONGGYE', 'JEONGMUNBU', 'GAPSABO', 'GWONYUL', 'SHINRIP', 
    'SINGIJEON', 'KIMSIMIN', 'JUKRIM', 'LEEOKGI', 
    'GWAKJAEWOO', 'PANOKSEON', 'KWONJUN', 'MOKBAE', 'JOHON', 
    'KIMJONGSEO', 'RYUSEONGRYONG'
])

MAPPING = {
    # Air
    'CHANGYUCHUN': 'DENGAI',       # air $3
    # Armor
    'YISEONGGYE': 'BAIQI',         # armor $5
    'XUDA': 'LIANPO',              # armor $4
    'LANYU': 'MENGGONG',           # armor $2
    'JEONGMUNBU': 'CAOREN',        # armor $2
    'GAPSABO': 'BYEOLMUBAN',       # armor $1
    # Air Defense
    'QIJIGUANG': 'LIGUANG',        # air_defense $5
    'GWONYUL': 'JUMONG',           # air_defense $5
    'SHINRIP': 'CHOIMUSEON',       # air_defense $3
    'YUANCHONGHUAN': 'LUSUARCH',   # air_defense $2
    'SINGIJEON': 'TANEGASHIMA',    # air_defense $2
    'KIMSIMIN': 'CAOPICROSS',      # air_defense $2
    'JUKRIM': 'KOGURYOBOW',        # air_defense $1
    # Naval (YISUNSIN KEPT!)
    'ZHENGCHENG': 'ZHOUYU',        # naval $5
    'SHILANG': 'KUKI',             # naval $5
    'LEEOKGI': 'GANNING',          # naval $4
    'GWAKJAEWOO': 'JEONGJI',       # naval $3
    'PANOKSEON': 'MENGCHONG',      # naval $2
    'KWONJUN': 'DINGFENG',         # naval $2
    'MOKBAE': 'TAMNA',             # naval $1
    # Support
    'LIUBOWEN': 'HANXIN',          # support $5
    'JOHON': 'PANGTONG',           # support $3
    'YUAN_STRAT': 'LUSU',          # support $2
    'KIMJONGSEO': 'CHENGYU',       # support $2
    'RYUSEONGRYONG': 'NAOIE'       # support $2
}

assert 'YISUNSIN' not in TO_REMOVE
assert 'YISUNSIN' not in MAPPING

def update_data_js():
    path = r"D:\TopWarlords\js\data.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update header comment
    content = content.replace("200 位日韓中純歷史名將", "175 位日韓中純歷史名將")

    # 2. Filter RAW_UNITS
    raw_units_match = re.search(r'(const\s+RAW_UNITS\s*=\s*\[)(.*?)(\];\s*const\s+UNIT_META)', content, re.DOTALL)
    if not raw_units_match:
        raise ValueError("Could not find RAW_UNITS")
    
    raw_units_lines = raw_units_match.group(2).strip().splitlines()
    new_raw_lines = []
    removed_raw_count = 0
    for line in raw_units_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = re.match(r'\[\"([A-Z0-9_]+)\"', line_clean)
        if m:
            uid = m.group(1)
            if uid in TO_REMOVE:
                removed_raw_count += 1
                continue
        new_raw_lines.append(line)
    
    print(f"Removed from RAW_UNITS: {removed_raw_count} (remaining {len(new_raw_lines)})")
    assert removed_raw_count == 25
    assert len(new_raw_lines) == 175
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
            if uid in TO_REMOVE:
                removed_meta_count += 1
                continue
        new_meta_lines.append(line)

    print(f"Removed from UNIT_META: {removed_meta_count} (remaining {len(new_meta_lines)})")
    assert removed_meta_count == 25
    assert len(new_meta_lines) == 175
    new_meta_block = meta_match.group(1) + "\n" + "\n".join(new_meta_lines) + "\n" + meta_match.group(3)
    content = content[:meta_match.start()] + new_meta_block + content[meta_match.end():]

    # 4. Update DRONE_IDS
    content = content.replace(", 'SINGIJEON'", "")
    content = content.replace("'SINGIJEON', ", "")

    # 5. Update TEMPLATES (Keep 鳴梁伏波 with YISUNSIN intact, only update SINGIJEON in 封狼居胥)
    content = content.replace("['HUO', 'BYEOLMUBAN', 'SINGIJEON', 'HATTORI', 'PANGTONG']",
                              "['HUO', 'BYEOLMUBAN', 'LUSUARCH', 'HATTORI', 'PANGTONG']")

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
            if uid in MAPPING:
                new_deck.append(MAPPING[uid])
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

    # In SEED_GHOSTS, keep YISUNSIN and fix the slot/typo issue:
    old_target = "{ id: 'g_swarm', callsign: '忠武公・龜船水師', title: '三道水軍統制使', rating: 1260, wins: 33, losses: 26, deck: ['GONGSUN','GYEBAEK','SAIGA','YISUNSIN','LIUCHENG'], doctrine: 'deception', motto: '鶴翼陣鐵甲龜船，鳴梁海峽以寡擊眾。', isUser: false },"
    new_target = "{ id: 'g_swarm', callsign: '忠武公・龜船水師', title: '三道水軍統制使', rating: 1260, wins: 33, losses: 26, deck: ['GONGSUNDU','KATOKIYOMASA','NAGASHINO','YISUNSIN','PANGTONG'], doctrine: 'deception', motto: '鶴翼陣鐵甲龜船，鳴梁海峽以寡擊眾。', isUser: false },"

    assert old_target in content, "Could not find old g_swarm target in js/app.js"
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
    data1 = [u for u in data1 if u['id'] not in TO_REMOVE]
    print(f"all_warlords.json: {orig_len1} -> {len(data1)}")
    assert len(data1) == 175
    with open(path1, 'w', encoding='utf-8') as f:
        json.dump(data1, f, ensure_ascii=False, indent=2)

    # 2. tools/all_units.json
    path2 = r"D:\TopWarlords\tools\all_units.json"
    with open(path2, 'r', encoding='utf-8') as f:
        data2 = json.load(f)
    orig_len2 = len(data2)
    data2 = [u for u in data2 if u['id'] not in TO_REMOVE]
    print(f"tools/all_units.json: {orig_len2} -> {len(data2)}")
    assert len(data2) == 175
    with open(path2, 'w', encoding='utf-8') as f:
        json.dump(data2, f, ensure_ascii=False, indent=2)

    # 3. tools/chibi_prompts.json
    path3 = r"D:\TopWarlords\tools\chibi_prompts.json"
    with open(path3, 'r', encoding='utf-8') as f:
        data3 = json.load(f)
    orig_len3 = len(data3)
    data3 = [u for u in data3 if u['id'] not in TO_REMOVE]
    print(f"tools/chibi_prompts.json: {orig_len3} -> {len(data3)}")
    assert len(data3) == 175
    with open(path3, 'w', encoding='utf-8') as f:
        json.dump(data3, f, ensure_ascii=False, indent=2)

def update_ui_and_docs():
    # armory.html
    p_armory = r"D:\TopWarlords\armory.html"
    with open(p_armory, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("(200 位日韓中純歷史名將)", "(175 位日韓中純歷史名將)")
    c = c.replace("200 位日韓中純歷史名將", "175 位日韓中純歷史名將")
    c = c.replace("HERO ENCYCLOPEDIA · 200 HISTORICAL WARLORDS", "HERO ENCYCLOPEDIA · 175 HISTORICAL WARLORDS")
    c = c.replace('<div class="num" id="totalUnitsCount">200</div>', '<div class="num" id="totalUnitsCount">175</div>')
    c = c.replace('全部兵團 (200)', '全部兵團 (175)')
    c = c.replace('⚡ 奔雷突騎 (40)', '⚡ 奔雷突騎 (39)')
    c = c.replace('🛡️ 重甲陷陣 (40)', '🛡️ 重甲陷陣 (35)')
    c = c.replace('🏹 神射強弩 (40)', '🏹 神射強弩 (33)')
    c = c.replace('⚔️ 先登奇兵 (40)', '⚔️ 先登奇兵 (33)')
    c = c.replace('📜 軍師奇謀 (40)', '📜 軍師奇謀 (35)')
    c = c.replace('🇨🇳 中國 (114)', '🇨🇳 中國 (105)')
    c = c.replace('🇰🇷 韓國 (38)', '🇰🇷 韓國 (22)')
    c = c.replace('<b id="filteredCount">200</b> 位歷史名將', '<b id="filteredCount">175</b> 位歷史名將')
    c = c.replace('全部 200 位日韓中純歷史名將點將錄', '全部 175 位日韓中純歷史名將點將錄')
    with open(p_armory, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated armory.html")

    # index.html
    p_index = r"D:\TopWarlords\index.html"
    with open(p_index, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("從 200 位日韓中歷史名將組建五大兵團", "從 175 位日韓中歷史名將組建五大兵團")
    c = c.replace("從 200 位日韓中純歷史名將組建五大兵團", "從 175 位日韓中純歷史名將組建五大兵團")
    c = c.replace("瀏覽 200 位日韓中純歷史名將點將錄", "瀏覽 175 位日韓中純歷史名將點將錄")
    with open(p_index, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated index.html")

    # README.md
    p_readme = r"D:\TopWarlords\README.md"
    with open(p_readme, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("200 位日韓中純歷史名將", "175 位日韓中純歷史名將")
    c = c.replace("200 位名將專屬古典水墨卡牌圖資", "175 位名將專屬古典水墨卡牌圖資")
    c = c.replace("200 位名將傳記與兵法辭典", "175 位名將傳記與兵法辭典")
    with open(p_readme, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated README.md")

    # js/poster-help.js
    p_poster = r"D:\TopWarlords\js\poster-help.js"
    with open(p_poster, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("收錄 200 位日韓中純歷史名將", "收錄 175 位日韓中純歷史名將")
    with open(p_poster, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated js/poster-help.js")

    # tools/balance.js
    p_bal = r"D:\TopWarlords\tools\balance.js"
    with open(p_bal, 'r', encoding='utf-8') as f:
        c = f.read()
    c = c.replace("200 位日韓中純歷史名將", "175 位日韓中純歷史名將")
    with open(p_bal, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated tools/balance.js")

if __name__ == '__main__':
    update_data_js()
    update_ladder_data()
    update_app_js()
    update_json_files()
    update_ui_and_docs()
    print("\nALL UPDATES COMPLETED SUCCESSFULLY (175 WARLORDS - YISUNSIN PRESERVED)!")
