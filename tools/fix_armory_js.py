# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("D:/TopWarlords/js/armory.js")
text = p.read_text(encoding="utf-8")

text = text.replace("    #natFilterGroup?.addEventListener('click', e => {", "    $('#natFilterGroup')?.addEventListener('click', e => {")
text = text.replace("      ('#natFilterGroup .cost-btn').forEach", "      $$('#natFilterGroup .cost-btn').forEach")

p.write_text(text, encoding="utf-8")
print("Repaired armory.js successfully!")

