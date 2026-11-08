import json
import re

with open(r'D:\TopWarlords\tools\all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

print(f"Total units in tools/all_units.json: {len(units)}")
assert len(units) == 175

# Verify YISUNSIN
yisunsin = next((u for u in units if u['id'] == 'YISUNSIN'), None)
print("YISUNSIN found in json:", yisunsin['name'], yisunsin['cat'], yisunsin['cost'])
assert yisunsin is not None

with open(r'D:\TopWarlords\all_warlords.json', 'r', encoding='utf-8') as f:
    all_w = json.load(f)
assert len(all_w) == 175
assert any(u['id'] == 'YISUNSIN' for u in all_w)

with open(r'D:\TopWarlords\js\data.js', 'r', encoding='utf-8') as f:
    data_js = f.read()

# Check YISUNSIN in RAW_UNITS and UNIT_META
assert '["YISUNSIN", "李舜臣"' in data_js
assert 'YISUNSIN: {' in data_js
assert 'ids: [\'LINGTONG\', \'KATOKIYOMASA\', \'CHOIMUSEON\', \'YISUNSIN\', \'CHENGYU\']' in data_js

# Check 25 removed units are completely gone from js/data.js
to_remove = [
    'CHANGYUCHUN', 'XUDA', 'LANYU', 'QIJIGUANG', 'YUANCHONGHUAN', 
    'ZHENGCHENG', 'SHILANG', 'LIUBOWEN', 'YUAN_STRAT',
    'YISEONGGYE', 'JEONGMUNBU', 'GAPSABO', 'GWONYUL', 'SHINRIP', 
    'SINGIJEON', 'KIMSIMIN', 'JUKRIM', 'LEEOKGI', 
    'GWAKJAEWOO', 'PANOKSEON', 'KWONJUN', 'MOKBAE', 'JOHON', 
    'KIMJONGSEO', 'RYUSEONGRYONG'
]

for uid in to_remove:
    assert f'["{uid}"' not in data_js, f"{uid} still in RAW_UNITS"
    assert f'{uid}: {{' not in data_js, f"{uid} still in UNIT_META"

# Check js/ladder-data.js has NO removed units
with open(r'D:\TopWarlords\js\ladder-data.js', 'r', encoding='utf-8') as f:
    ladder_js = f.read()

for uid in to_remove:
    assert f'"{uid}"' not in ladder_js, f"{uid} still in ladder-data.js"

# Check js/app.js has NO removed units
with open(r'D:\TopWarlords\js\app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

for uid in to_remove:
    assert f"'{uid}'" not in app_js, f"{uid} still in app.js"

print("All assertion checks passed successfully! 0 removed units found in runtime files.")
