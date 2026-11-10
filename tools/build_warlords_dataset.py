# -*- coding: utf-8 -*-
import ast
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'js' / 'data.js'
OUTPUT = ROOT / 'all_warlords.json'

text = SOURCE.read_text(encoding='utf-8')
raw_units = text.split('const RAW_UNITS = [', 1)[1].split('\n];', 1)[0]
units = [
    ast.literal_eval(line.strip().rstrip(','))
    for line in raw_units.splitlines()
    if line.strip().startswith('[')
]

unit_meta = {
    unit_id: {
        'flag': flag,
        'origin': origin,
        'weapon': weapon,
        'sfx': sfx,
    }
    for unit_id, flag, origin, weapon, sfx in re.findall(
        r"^\s*([A-Z_]+):\s*\{ flag:\s*'([^']+)', origin:\s*'([^']+)', "
        r"weapon:\s*'([^']+)', sfx:\s*'([^']+)'",
        text.split('const UNIT_META = {', 1)[1].split('\n};', 1)[0],
        re.MULTILINE,
    )
}

unit_ids = [unit[0] for unit in units]
if len(units) != 125 or len(set(unit_ids)) != 125:
    raise ValueError(f'Expected 125 unique units, found {len(units)}')
if set(unit_ids) != set(unit_meta):
    raise ValueError('RAW_UNITS and UNIT_META IDs do not match')
category_counts = Counter(unit[2] for unit in units)
if len(category_counts) != 5 or any(count != 25 for count in category_counts.values()):
    raise ValueError(f'Expected 25 units in each of five categories: {category_counts}')

json_units = []
for unit in units:
    unit_id, name, cat, cost, variant, tag, desc, stealth, strategy, traits, role_flags, hp, atk, defense = unit
    json_units.append({
        'id': unit_id,
        'name': name,
        'cat': cat,
        'cost': cost,
        'v': variant,
        'tag': tag,
        'desc': desc,
        'st': stealth,
        'ew': strategy,
        'traits': traits,
        'roleFlags': role_flags,
        'hp': hp,
        'atk': atk,
        'def': defense,
        **unit_meta[unit_id],
    })

OUTPUT.write_text(json.dumps(json_units, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(json_units)} units to {OUTPUT}')
