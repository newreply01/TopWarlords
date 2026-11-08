# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("D:/TopWarlords/sw.js")
text = p.read_text(encoding="utf-8")

text = text.replace("topclash-v", "topwarlords-v")
old_entry = "  `./js/app.js?v=${APP_VERSION}`,"
new_entry = """  `./js/libs/three.min.js`,
  `./js/battle-3d.js?v=1.0.0`,
  `./js/app.js?v=${APP_VERSION}`,"""

assert old_entry in text, "old_entry not found"
text = text.replace(old_entry, new_entry, 1)

p.write_text(text, encoding="utf-8")
print("Successfully updated sw.js cache list!")

