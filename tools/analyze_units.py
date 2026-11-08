# -*- coding: utf-8 -*-
import json
from collections import Counter

with open('D:/TopWarlords/tools/all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

print(f"Total units: {len(units)}")
print("Categories:", Counter(u['cat'] for u in units))
print("Costs:", Counter(u['cost'] for u in units))

names = [u['name'] for u in units]
print("\nSample named figures:")
named = [n for n in names if not any(w in n for w in ['隊', '營', '組', '車', '卒', '兵', '箭', '弩'])]
squads = [n for n in names if any(w in n for w in ['隊', '營', '組', '車', '卒', '兵', '箭', '弩'])]
print(f"Named generals: {len(named)} (e.g. {named[:15]})")
print(f"Military squads: {len(squads)} (e.g. {squads[:10]})")

