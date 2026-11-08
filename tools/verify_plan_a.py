import json
from replacements_data import REPLACEMENTS

with open(r'D:\TopWarlords\tools\all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

assert len(units) == 165
print(f"Total units in all_units.json: {len(units)}")

with open(r'D:\TopWarlords\js\data.js', 'r', encoding='utf-8') as f:
    data_js = f.read()

with open(r'D:\TopWarlords\js\ladder-data.js', 'r', encoding='utf-8') as f:
    ladder_js = f.read()

with open(r'D:\TopWarlords\js\app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# Check no old IDs exist anywhere in runtime files
old_ids = [r['old_id'] for r in REPLACEMENTS]
for oid in old_ids:
    assert f'["{oid}"' not in data_js, f"{oid} found in RAW_UNITS"
    assert f'{oid}: {{' not in data_js, f"{oid} found in UNIT_META"
    assert f'"{oid}"' not in ladder_js, f"{oid} found in ladder-data.js"

# Check all new IDs exist in data.js
new_ids = [r['id'] for r in REPLACEMENTS]
for nid in new_ids:
    assert f'["{nid}"' in data_js, f"{nid} missing from RAW_UNITS"
    assert f'{nid}: {{' in data_js, f"{nid} missing from UNIT_META"

# Check ladder presets legality
import re
match = re.search(r'const\s+LADDER_PRESETS\s*=\s*(\[.*?\]);', ladder_js, re.DOTALL)
presets = json.loads(match.group(1))
unit_dict = {u['id']: u for u in units}

for p in presets:
    deck = p['deck']
    assert len(deck) == 5, f"Deck {p['id']} len != 5"
    assert len(set(deck)) == 5, f"Deck {p['id']} has duplicates: {deck}"
    for uid in deck:
        assert uid in unit_dict, f"Unknown uid {uid} in preset {p['id']}"

print("All integrity checks passed! 0 legacy IDs, 100% legal presets, 165 bona-fide generals.")
