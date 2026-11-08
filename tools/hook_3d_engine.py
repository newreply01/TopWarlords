# -*- coding: utf-8 -*-
"""
在 app.js 中串接 Battle3DEngine：
1. showBattle 初始化時呼叫 Battle3DEngine.init 與 Battle3DEngine.loadBattle(res)
2. 逐行播放時呼叫 Battle3DEngine.playEvent(ln)
3. 綁定 btnToggle3DView 按鈕切換 3D 沙盤展示與純 2D 卡片視圖
"""
from pathlib import Path

p = Path("D:/TopWarlords/js/app.js")
text = p.read_text(encoding="utf-8")

# 1. 在 showBattle 中初始化 3D 沙盤與載入名將棋子
target_init = """  // 注入左右部隊卡片列表（注入至 unitsCardList 容器，不覆蓋頂部 team-bg-hud）
  const uBoxA = $('#unitsCardListA') || $('#teamUnitsA');
  const uBoxB = $('#unitsCardListB') || $('#teamUnitsB');
  if (uBoxA) uBoxA.innerHTML = teamHtml(T.A, 'A', res.docs?.A);
  if (uBoxB) uBoxB.innerHTML = teamHtml(T.B, 'B', res.docs?.B);"""

replacement_init = """  // 注入左右部隊卡片列表（注入至 unitsCardList 容器，不覆蓋頂部 team-bg-hud）
  const uBoxA = $('#unitsCardListA') || $('#teamUnitsA');
  const uBoxB = $('#unitsCardListB') || $('#teamUnitsB');
  if (uBoxA) uBoxA.innerHTML = teamHtml(T.A, 'A', res.docs?.A);
  if (uBoxB) uBoxB.innerHTML = teamHtml(T.B, 'B', res.docs?.B);

  // 初始化並載入 3D 古戰場推演沙盤
  try {
    const c3d = $('#battle3DCanvas');
    if (c3d && typeof Battle3DEngine !== 'undefined') {
      Battle3DEngine.init(c3d);
      Battle3DEngine.loadBattle(res);
    }
  } catch (e3d) {
    console.warn('Battle3DEngine init warning:', e3d);
  }"""

assert target_init in text, "target_init not found"
text = text.replace(target_init, replacement_init, 1)

# 2. 在 playFx(ln) 後呼叫 Battle3DEngine.playEvent(ln)
target_fx = """        playFx(ln);
        if (!skip) {"""

replacement_fx = """        playFx(ln);
        if (typeof Battle3DEngine !== 'undefined') {
          try { Battle3DEngine.playEvent(ln); } catch (_) {}
        }
        if (!skip) {"""

assert target_fx in text, "target_fx not found"
text = text.replace(target_fx, replacement_fx, 1)

# 3. 綁定切換 3D/2D 按鈕事件監聽
toggle_code = """
// 3D 古戰場沙盤視圖切換
let is3DVisible = true;
$('#btnToggle3DView')?.addEventListener('click', () => {
  is3DVisible = !is3DVisible;
  const wrap = $('#battle3DWrapper');
  const btn = $('#btnToggle3DView');
  if (wrap) wrap.style.display = is3DVisible ? 'block' : 'none';
  if (btn) btn.textContent = is3DVisible ? '切換 3D/2D' : '展開 3D 沙盤';
  if (typeof Battle3DEngine !== 'undefined') {
    Battle3DEngine.toggleMode(is3DVisible);
  }
});
"""

target_end = "/* ---------- 模式切換與預算修剪 ---------- */"
assert target_end in text, "target_end not found"
text = text.replace(target_end, toggle_code + "\n" + target_end, 1)

p.write_text(text, encoding="utf-8")
print("Successfully hooked Battle3DEngine into app.js!")

