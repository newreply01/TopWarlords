# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path("D:/TopWarlords")

# 1. armory.html
html = (ROOT / "armory.html").read_text(encoding="utf-8")
html = html.replace('🇨🇳 中國 (100)', '🇨🇳 中國 (114)')
html = html.replace('🇯🇵 日本 (65)', '🇯🇵 日本 (48)')
html = html.replace('🇰🇷 韓國 (35)', '🇰🇷 韓國 (38)')
(ROOT / "armory.html").write_text(html, encoding="utf-8")

# 2. test_armory.py
test = (ROOT / "test" / "test_armory.py").read_text(encoding="utf-8")
test = test.replace('assert cn_cards == 100', 'assert cn_cards == 114')
test = test.replace('assert jp_cards == 65', 'assert jp_cards == 48')
test = test.replace('assert kr_cards == 35', 'assert kr_cards == 38')
(ROOT / "test" / "test_armory.py").write_text(test, encoding="utf-8")

print("Updated armory.html and test_armory.py counts!")

