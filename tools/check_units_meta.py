# -*- coding: utf-8 -*-
import sys
with open('D:/TopWarlords/js/data.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect UNIT_META keys vs RAW_UNITS ids
import re
raw_ids = re.findall(r'\["([A-Z0-9_]+)",\s*"([^"]+)"', text)
print(f'RAW_UNITS count: {len(raw_ids)}')

meta_keys = re.findall(r'([A-Z0-9_]+):\s*\{\s*flag:', text)
print(f'UNIT_META keys count: {len(meta_keys)}')

missing_in_meta = [rid for rid, name in raw_ids if rid not in meta_keys]
print(f'Missing in meta: {len(missing_in_meta)}')
if missing_in_meta:
    print('Sample missing:', missing_in_meta[:10])

# Check sample images
for rid, name in raw_ids[:10]:
    has_meta = rid in meta_keys
    print(f'ID: {rid}, Name: {name}, In META: {has_meta}')
