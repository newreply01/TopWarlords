# -*- coding: utf-8 -*-
"""
批次調校 TopWarlords UI 標題、命名空間與歷史文案
"""
import re
from pathlib import Path

ROOT = Path("D:/TopWarlords")

def replace_in_file(file_path, replacements):
    text = file_path.read_text(encoding="utf-8")
    for old, new in replacements:
        text = text.replace(old, new)
    file_path.write_text(text, encoding="utf-8")
    print(f"Updated {file_path.name}")

# 1. 調整 index.html
idx_reps = [
    ("TopClash 頂尖對戰：15元聯合作戰 | 軍武預算組隊對戰", "TopWarlords 頂尖對戰：15元名將聯合作戰 | 東亞歷史名將策決"),
    ("TopClash 頂尖對戰：15元聯合作戰", "TopWarlords 頂尖對戰：15元名將聯合作戰"),
    ("TOP CLASH 15 · COMBINED ARMS", "TOP WARLORDS 15 · COMBINED WARLORDS"),
    ("調撥戰區軍火", "點將調撥兵符"),
    ("重新調撥 5 大兵種戰區軍火庫", "隨機徵召 5 大兵團東亞名將池"),
    ("瀏覽 125 款軍武詳細圖鑑全鑑", "瀏覽 200 位日韓中純歷史名將點將錄"),
    ("📖 軍武圖鑑", "📜 名將點將錄"),
    ("topclash_cached_global_visits", "topwarlords_cached_global_visits"),
    ("125 款現代軍武", "200 位日韓中純歷史名將"),
    ("五大兵種", "五大兵團")
]
replace_in_file(ROOT / "index.html", idx_reps)

# 2. 調整 armory.html
arm_reps = [
    ("軍武庫全鑑", "名將點將錄"),
    ("125 款現代軍武", "200 位日韓中純歷史名將"),
    ("TopClash 軍武圖鑑", "TopWarlords 名將點將錄"),
    ("TOP CLASH 15 · ARMORY ARCHIVE", "TOP WARLORDS 15 · HERO ARCHIVE"),
    ("瀏覽 125 款軍武", "瀏覽 200 位歷史名將"),
    ("帶入作戰配置", "召入出征陣容"),
    ("topclash_cached_global_visits", "topwarlords_cached_global_visits")
]
replace_in_file(ROOT / "armory.html", arm_reps)

# 3. 調整 poster-help.js
pos_reps = [
    ("TOP CLASH 15 · COMBINED ARMS", "TOP WARLORDS 15 · COMBINED WARLORDS"),
    ("用 $15 組出你的聯合作戰陣容，來挑戰我！", "用 $15 軍令調配你的名將陣容，來與我一決高下！"),
    ("topclash-15.png", "topwarlords-15.png"),
    ("TopClash 頂尖對戰戰報", "TopWarlords 名將戰報"),
    ("《頂尖對戰：15元聯合作戰》", "《頂尖對戰：15元名將聯合作戰》"),
    ("db15_", "wl15_")
]
replace_in_file(ROOT / "js" / "poster-help.js", pos_reps)

# 4. 調整 app.js 中的前綴與主要文字
app_reps = [
    ("db15_", "wl15_"),
    ("topclash_", "topwarlords_"),
    ("調撥戰區軍火", "點將調撥兵符"),
    ("戰區軍火已重新調撥！", "東亞名將已重新調遣點兵！"),
    ("戰區軍火已全面調撥！", "東亞名將已重新徵召點將！"),
    ("軍武庫", "名將錄"),
    ("軍武", "名將"),
    ("破浪突擊巡防大隊", "虎步先鋒鐵騎營")
]
replace_in_file(ROOT / "js" / "app.js", app_reps)

print("UI 與命名空間調整完成！")

