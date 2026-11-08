# -*- coding: utf-8 -*-
import json, re

with open('D:/TopWarlords/js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 擷取 RAW_UNITS 列表
raw_matches = re.findall(r'\[\s*"([A-Z0-9_]+)"\s*,\s*"([^"]+)"\s*,\s*\'([a-z_]+)\'\s*,\s*(\d+)\s*,\s*\'([A-H])\'\s*,\s*"([^"]+)"', text)
print(f"Total units in data.js: {len(raw_matches)}")

# 擷取 UNIT_META
meta_dict = {}
for m in re.finditer(r'([A-Z0-9_]+):\s*\{\s*flag:\s*\'([^\']+)\',\s*origin:\s*\'([^\']+)\',\s*weapon:\s*\'([^\']+)\'', text):
    meta_dict[m.group(1)] = {
        'flag': m.group(2),
        'origin': m.group(3),
        'weapon': m.group(4)
    }

units_data = []
for uid, name, cat, cost, variant, tag in raw_matches:
    meta = meta_dict.get(uid, {'flag': '🇨🇳', 'origin': '東亞名將', 'weapon': '百戰名刃'})
    units_data.append({
        'id': uid,
        'name': name,
        'cat': cat,
        'cost': int(cost),
        'tag': tag,
        'flag': meta['flag'],
        'origin': meta['origin'],
        'weapon': meta['weapon']
    })

with open('D:/TopWarlords/tools/all_units.json', 'w', encoding='utf-8') as f:
    json.dump(units_data, f, ensure_ascii=False, indent=2)

print(f"Exported {len(units_data)} units to all_units.json")
