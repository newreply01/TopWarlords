# -*- coding: utf-8 -*-
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

result = subprocess.run(
    ['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).UNITS))',
     str(ROOT / 'js' / 'data.js')],
    check=True,
    capture_output=True,
    encoding='utf-8',
)
units = json.loads(result.stdout)
if len(units) != 125 or len({unit['id'] for unit in units}) != 125:
    raise ValueError('Expected 125 distinct units from data.js')

fields = ('id', 'name', 'cat', 'cost', 'tag', 'flag', 'origin', 'weapon')
units_data = [{field: unit[field] for field in fields} for unit in units]

with (ROOT / 'all_warlords.json').open('w', encoding='utf-8') as f:
    json.dump(units, f, ensure_ascii=False, indent=2)

with (ROOT / 'tools' / 'all_units.json').open('w', encoding='utf-8') as f:
    json.dump(units_data, f, ensure_ascii=False, indent=2)

print(f"Exported {len(units_data)} units to all_warlords.json and tools/all_units.json")
