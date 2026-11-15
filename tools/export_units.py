# -*- coding: utf-8 -*-
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_units_from_data_js() -> list:
    data_path = ROOT / 'js' / 'data.js'
    if shutil.which('node'):
        result = subprocess.run(
            ['node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).UNITS))',
             str(data_path)],
            check=True,
            capture_output=True,
            encoding='utf-8',
        )
        return json.loads(result.stdout)

    from playwright.sync_api import sync_playwright
    js_code = data_path.read_text(encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        units = page.evaluate('(code) => { eval(code + "; globalThis.__UNITS = UNITS;"); return globalThis.__UNITS; }', js_code)
        browser.close()
    return units


units = load_units_from_data_js()
if len(units) != 125 or len({unit['id'] for unit in units}) != 125:
    raise ValueError('Expected 125 distinct units from data.js')

fields = ('id', 'name', 'cat', 'cost', 'tag', 'flag', 'origin', 'weapon')
units_data = [{field: unit[field] for field in fields} for unit in units]

with (ROOT / 'all_warlords.json').open('w', encoding='utf-8') as f:
    json.dump(units, f, ensure_ascii=False, indent=2)

with (ROOT / 'tools' / 'all_units.json').open('w', encoding='utf-8') as f:
    json.dump(units_data, f, ensure_ascii=False, indent=2)

print(f"Exported {len(units_data)} units to all_warlords.json and tools/all_units.json")
