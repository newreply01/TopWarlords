# -*- coding: utf-8 -*-
from pathlib import Path

p = Path("D:/TopWarlords/index.html")
text = p.read_text(encoding="utf-8")

# 1. 插入 3D 沙盤容器到 battle-grid 前
sand_table_html = """  <!-- 3D 古戰場推演沙盤 (Three.js WebGL Diorama) -->
  <div class="battle-3d-wrapper" id="battle3DWrapper">
    <div class="battle-3d-canvas-container" id="battle3DCanvas"></div>
    <div class="battle-3d-overlay-hud">
      <span class="badge-3d-title">🏛️ 3D 古戰場沙盤推演台</span>
      <button class="btn-view-toggle" id="btnToggle3DView" type="button" title="切換 3D 沙盤與 2D 卡片視圖">切換 3D/2D</button>
    </div>
  </div>\n\n  """

target_grid = '<div class="battle-grid">'
assert target_grid in text, "target_grid not found"
text = text.replace(target_grid, sand_table_html + target_grid, 1)

# 2. 插入 script
script_insertion = """<script defer src="js/libs/three.min.js"></script>
<script defer src="js/battle-3d.js?v=1.0.0"></script>\n"""

target_app = '<script defer src="js/app.js'
assert target_app in text, "target_app not found"
text = text.replace(target_app, script_insertion + target_app, 1)

p.write_text(text, encoding="utf-8")
print("Successfully injected 3D canvas and scripts into index.html!")

