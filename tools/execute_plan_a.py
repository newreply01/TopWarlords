import json
import re
from replacements_data import REPLACEMENTS

REP_MAP = {r['old_id']: r for r in REPLACEMENTS}
OLD_TO_NEW_ID = {r['old_id']: r['id'] for r in REPLACEMENTS}

def update_data_js():
    path = r"D:\TopWarlords\js\data.js"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update RAW_UNITS
    raw_units_match = re.search(r'(const\s+RAW_UNITS\s*=\s*\[)(.*?)(\];\s*const\s+UNIT_META)', content, re.DOTALL)
    if not raw_units_match:
        raise ValueError("Could not find RAW_UNITS in data.js")

    raw_lines = raw_units_match.group(2).strip().splitlines()
    new_raw_lines = []
    replaced_count = 0

    for line in raw_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = re.match(r'\[\"([A-Z0-9_]+)\"', line_clean)
        if m and m.group(1) in REP_MAP:
            r = REP_MAP[m.group(1)]
            # Format: ["ID", "Name", 'cat', cost, 'style', "Title", "Desc", stealth, strategy, traits, roleFlags, hp, atk, def],
            traits_str = json.dumps(r['traits'], ensure_ascii=False)
            roles_str = json.dumps(r['roleFlags'], ensure_ascii=False)
            new_line = f'  ["{r["id"]}", "{r["name"]}", \'{r["cat"]}\', {r["cost"]}, \'{r["style"]}\', "{r["title"]}", "{r["desc"]}", {r["stealth"]}, {r["strategy"]}, {traits_str}, {roles_str}, {r["hp"]}, {r["atk"]}, {r["def"]}],'
            new_raw_lines.append(new_line)
            replaced_count += 1
        else:
            new_raw_lines.append(line)

    print(f"Replaced {replaced_count} lines in RAW_UNITS")
    assert replaced_count == 47
    assert len(new_raw_lines) == 165

    new_raw_block = raw_units_match.group(1) + "\n" + "\n".join(new_raw_lines) + "\n" + raw_units_match.group(3)
    content = content[:raw_units_match.start()] + new_raw_block + content[raw_units_match.end():]

    # 2. Update UNIT_META
    meta_match = re.search(r'(const\s+UNIT_META\s*=\s*\{)(.*?)(\};(\s*const\s+UNITS|\s*const DRONE_IDS))', content, re.DOTALL)
    if not meta_match:
        raise ValueError("Could not find UNIT_META in data.js")

    meta_lines = meta_match.group(2).strip().splitlines()
    new_meta_lines = []
    replaced_meta = 0

    for line in meta_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        m = re.match(r'([A-Z0-9_]+):\s*\{', line_clean)
        if m and m.group(1) in REP_MAP:
            r = REP_MAP[m.group(1)]
            new_meta_line = f"  {r['id']}: {{ flag: '{r['flag']}', origin: '{r['origin']}', weapon: '{r['weapon']}', sfx: '{r['sfx']}', img: 'assets/warlords/{r['id']}.jpg?v=7.3.0' }},"
            new_meta_lines.append(new_meta_line)
            replaced_meta += 1
        else:
            new_meta_lines.append(line)

    print(f"Replaced {replaced_meta} entries in UNIT_META")
    assert replaced_meta == 47
    assert len(new_meta_lines) == 165

    new_meta_block = meta_match.group(1) + "\n" + "\n".join(new_meta_lines) + "\n" + meta_match.group(3)
    content = content[:meta_match.start()] + new_meta_block + content[meta_match.end():]

    # 3. Update DRONE_IDS (奇正相生陣)
    # Old: 'TIANDAN', 'GUANDU_CAT', 'XIAOSHI_SCOUT', 'CHENTANG', 'MASANOBU', 'KOGA_SCOUT', 'KORYO_CAT', 'HOGAK_DRUM', 'SHUIGUI', 'KUMANO'
    # Replaced: GUANDU_CAT -> SUNWU, XIAOSHI_SCOUT -> LEYI, KOGA_SCOUT -> YAMAMOTO, KORYO_CAT -> KIMBUSHIK, HOGAK_DRUM -> TOKUGAWA, SHUIGUI -> ZHUHUAN, KUMANO -> KUKI_MORI
    drone_pattern = r"const DRONE_IDS = new Set\(\[(.*?)\]\);"
    new_drones = "const DRONE_IDS = new Set(['TIANDAN', 'SUNWU', 'LEYI', 'CHENTANG', 'MASANOBU', 'YAMAMOTO', 'KIMBUSHIK', 'TOKUGAWA', 'ZHUHUAN', 'KUKI_MORI']);"
    content = re.sub(drone_pattern, new_drones, content)

    # 4. Update TEMPLATES
    content = content.replace("['CAOZHANG', 'DIANWEI', 'ZHUGELIAN', 'SHUIGUI', 'ZHUGELIANG']",
                              "['CAOZHANG', 'DIANWEI', 'MANCHONG', 'ZHUHUAN', 'ZHUGELIANG']")
    content = content.replace("['HUO', 'BYEOLMUBAN', 'LUSUARCH', 'HATTORI', 'PANGTONG']",
                              "['HUO', 'WANGPING', 'GENGYAN', 'HATTORI', 'PANGTONG']")
    content = content.replace("['DENGAI', 'BAIQI', 'CHOIMUSEON', 'JIANGQIN', 'ZHUGUKE']",
                              "['DENGAI', 'BAIQI', 'CHOIMUSEON', 'JIANGQIN', 'FANLI']")

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
            if uid in OLD_TO_NEW_ID:
                new_deck.append(OLD_TO_NEW_ID[uid])
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

    old_seed_match = re.search(r'const\s+SEED_GHOSTS\s*=\s*\[(.*?)\];', content, re.DOTALL)
    if not old_seed_match:
        raise ValueError("Could not find SEED_GHOSTS in app.js")

    new_seed = """const SEED_GHOSTS = [
  { id: 'g_falcon', callsign: '冠軍侯・驃騎營', title: '驃騎將軍', rating: 1420, wins: 58, losses: 19, deck: ['HUO','ZHOUTAI','GENGYAN','GANNING','FANLI'], doctrine: 'strike', motto: '疾如風千里奔襲，閃擊直取中軍帥帳！', isUser: false },
  { id: 'g_iron', callsign: '武安君・鐵壁陣', title: '鎮國大將軍', rating: 1310, wins: 41, losses: 22, deck: ['DATE','BAIQI','ZONGZE','JIANGQIN','WEIXIAOKUAN'], doctrine: 'defense', motto: '不動如山大盾重甲，長平鐵壁固若金湯。', isUser: false },
  { id: 'g_shadow', callsign: '臥龍崗・八陣圖', title: '軍師祭酒', rating: 1490, wins: 64, losses: 14, deck: ['ZHAOYUN','MENGGONG','HUANGZHONG','CAOBIN','ZHUGELIANG'], doctrine: 'deception', motto: '奇門八陣迷霧困敵，未戰而廟算先勝。', isUser: false },
  { id: 'g_swarm', callsign: '忠武公・龜船水師', title: '三道水軍統制使', rating: 1260, wins: 33, losses: 26, deck: ['GONGSUNDU','KATOKIYOMASA','ASAKURA_SOT','YISUNSIN','PANGTONG'], doctrine: 'deception', motto: '鶴翼陣鐵甲龜船，鳴梁海峽以寡擊眾。', isUser: false },
  { id: 'g_viper', callsign: '毘沙門天・車懸陣', title: '越後守護', rating: 1610, wins: 88, losses: 21, deck: ['KENSHIN','ZHANGFEI','TORII','DONGXI','GUOJIA'], doctrine: 'strike', motto: '車懸輪番急襲破陣，白刃一騎討斬將奪旗。', isUser: false },
  { id: 'g_aegis', callsign: '大司馬・漢軍鐵騎', title: '大將軍大司馬', rating: 1720, wins: 104, losses: 25, deck: ['WEI','LIANPO','MANCHONG','YANGSU','TIANDAN'], doctrine: 'strike', motto: '武剛車陣奇兵破虜，神射強弩萬箭齊發。', isUser: false }
];"""

    content = content[:old_seed_match.start()] + new_seed + content[old_seed_match.end():]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated js/app.js successfully.")

def update_json_files():
    # 1. all_warlords.json
    path1 = r"D:\TopWarlords\all_warlords.json"
    with open(path1, 'r', encoding='utf-8') as f:
        data1 = json.load(f)
    for u in data1:
        if u['id'] in REP_MAP:
            r = REP_MAP[u['id']]
            u['id'] = r['id']
            u['name'] = r['name']
            u['title'] = r['title']
            u['desc'] = r['desc']
            u['origin'] = r['origin']
            u['flag'] = r['flag']
            u['weapon'] = r['weapon']
            u['stealth'] = r['stealth']
            u['strategy'] = r['strategy']
            u['traits'] = r['traits']
            u['hp'] = r['hp']
            u['atk'] = r['atk']
            u['def'] = r['def']
    with open(path1, 'w', encoding='utf-8') as f:
        json.dump(data1, f, ensure_ascii=False, indent=2)

    # 2. tools/all_units.json
    path2 = r"D:\TopWarlords\tools\all_units.json"
    with open(path2, 'r', encoding='utf-8') as f:
        data2 = json.load(f)
    for u in data2:
        if u['id'] in REP_MAP:
            r = REP_MAP[u['id']]
            u['id'] = r['id']
            u['name'] = r['name']
            u['title'] = r['title']
            u['desc'] = r['desc']
            u['origin'] = r['origin']
            u['flag'] = r['flag']
            u['weapon'] = r['weapon']
            u['stealth'] = r['stealth']
            u['strategy'] = r['strategy']
            u['traits'] = r['traits']
            u['hp'] = r['hp']
            u['atk'] = r['atk']
            u['def'] = r['def']
    with open(path2, 'w', encoding='utf-8') as f:
        json.dump(data2, f, ensure_ascii=False, indent=2)

    # 3. tools/chibi_prompts.json
    path3 = r"D:\TopWarlords\tools\chibi_prompts.json"
    with open(path3, 'r', encoding='utf-8') as f:
        data3 = json.load(f)
    for u in data3:
        if u['id'] in REP_MAP:
            r = REP_MAP[u['id']]
            u['id'] = r['id']
            u['name'] = r['name']
            u['title'] = r['title']
            u['desc'] = r['desc']
            u['origin'] = r['origin']
            u['flag'] = r['flag']
            u['weapon'] = r['weapon']
            u['prompt'] = f"masterpiece, best quality, cute chibi 2D anime general portrait, {r['name']}, {r['title']}, historical armor {r['weapon']}, vivid expression, rich details, clean lines, transparent or pure background"
    with open(path3, 'w', encoding='utf-8') as f:
        json.dump(data3, f, ensure_ascii=False, indent=2)

    print("Updated all JSON files successfully.")

def update_armory_html():
    path = r"D:\TopWarlords\armory.html"
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    c = c.replace('🇨🇳 中國 (95)', '🇨🇳 中國 (99)')
    c = c.replace('🇯🇵 日本 (48)', '🇯🇵 日本 (49)')
    c = c.replace('🇰🇷 韓國 (22)', '🇰🇷 韓國 (17)')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated armory.html nation filter counts.")

if __name__ == '__main__':
    update_data_js()
    update_ladder_data()
    update_app_js()
    update_json_files()
    update_armory_html()
    print("\nALL 47 REPLACEMENTS APPLIED SUCCESSFULLY!")

