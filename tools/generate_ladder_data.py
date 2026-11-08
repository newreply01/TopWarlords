# -*- coding: utf-8 -*-
"""
生成 TopWarlords 天梯 100 席位名冊 (D:/TopWarlords/js/ladder-data.js)
包含 11 級古代軍銜、100 支歷史合法防守軍團
"""
import json, random
from pathlib import Path

ROOT = Path("D:/TopWarlords")
warlords = json.loads((ROOT / "all_warlords.json").read_text(encoding="utf-8"))
w_map = {w['id']: w for w in warlords}

LADDER_RANKS = [
  { 'tier': 11, 'name': '天下大將軍', 'en': 'SUPREME GENERAL',       'icon': '🎖️', 'minRP': 50000, 'color': '#f59e0b' },
  { 'tier': 10, 'name': '驃騎大將軍', 'en': 'GRAND CAVALRY GEN',     'icon': '⭐⭐⭐⭐', 'minRP': 42000, 'color': '#fbbf24' },
  { 'tier': 9,  'name': '車騎大將軍', 'en': 'GRAND CHARIOT GEN',     'icon': '⭐⭐⭐',   'minRP': 35000, 'color': '#38bdf8' },
  { 'tier': 8,  'name': '衛將軍',     'en': 'SENIOR PALACE GEN',     'icon': '⭐⭐',     'minRP': 28000, 'color': '#818cf8' },
  { 'tier': 7,  'name': '前後左右將軍','en': 'GENERAL OF DIRECTION',   'icon': '⭐',       'minRP': 22000, 'color': '#a78bfa' },
  { 'tier': 6,  'name': '都督軍事',   'en': 'COMMANDER-IN-CHIEF',    'icon': '⚔️⚔️',    'minRP': 16000, 'color': '#34d399' },
  { 'tier': 5,  'name': '中郎將',     'en': 'SENIOR COLONEL',        'icon': '⚔️',      'minRP': 11000, 'color': '#2dd4bf' },
  { 'tier': 4,  'name': '校尉',       'en': 'COLONEL / ADJUTANT',    'icon': '🛡️⭐',    'minRP': 7000,  'color': '#94a3b8' },
  { 'tier': 3,  'name': '裨將軍',     'en': 'ASSISTANT GENERAL',     'icon': '🛡️',      'minRP': 3500,  'color': '#64748b' },
  { 'tier': 2,  'name': '折衝都尉',   'en': 'VANGUARD CAPTAIN',      'icon': '🔹',       'minRP': 1500,  'color': '#547792' },
  { 'tier': 1,  'name': '軍候百夫長', 'en': 'CENTURION / LEADER',    'icon': '🔰',       'minRP': 0,     'color': '#475569' }
]

by_cat_cost = {}
for w in warlords:
    by_cat_cost.setdefault((w['cat'], w['cost']), []).append(w)

cats = ['air', 'armor', 'air_defense', 'naval', 'support']

DOCS = ['strike', 'defense', 'deception']

HISTORICAL_BOTS = [
  ('漢家赤幟・衛霍親衛', '🇨🇳', '封狼居胥遠征打擊'),
  ('武安死士・長平陷陣軍', '🇨🇳', '殺神威嚴破軍攻勢'),
  ('蜀漢精銳・諸葛八陣營', '🇨🇳', '神機帷幄奇正聯防'),
  ('東吳水督・江表虎臣隊', '🇨🇳', '赤壁赤焰水陸突襲'),
  ('甲斐赤備・風林火山', '🇯🇵', '武田騎兵奔雷撕裂'),
  ('越後軍神・毘沙門天', '🇯🇵', '車懸之陣正面決戰'),
  ('尾張鐵砲・天下布武', '🇯🇵', '三段輪射火力重壁'),
  ('三韓忠武・鳴梁伏波', '🇰🇷', '板屋神龍鐵甲巡防'),
  ('高句麗雄師・薩水破陣', '🇰🇷', '乙支文德伏流奇計'),
  ('大唐天策・玄甲鐵騎', '🇨🇳', '太宗親衛千里奔襲'),
]

PREFIXES_CN = ['幽州突騎', '并州飛將', '陷陣營', '背嵬軍', '白馬義從', '大漢羽林', '白毦兵', '虎豹騎', '西涼鐵騎', '神機營', '關寧鐵騎', '戚家軍', '嶽家軍', '江東水師', '荊襄精銳']
PREFIXES_JP = ['薩摩示現', '三河武士', '信濃先鋒', '奧州黑脛巾', '相模風魔', '長宗我部一領具足', '真田赤備', '立花雷神', '雜賀鐵砲眾', '毛利水軍', '九鬼水軍', '越前朝倉']
PREFIXES_KR = ['高麗別武班', '花郎精銳', '朝鮮水軍', '義兵伏波隊', '耽羅水手', '白頭突擊部隊', '雞林虎賁', '平壤神射營', '漢山先鋒組', '南原忠義隊']

COMMANDERS_CN = ['蒙恬後裔', '周瑜傳令', '龐統高足', '白起偏將', '子龍部曲', '漢卿司馬', '奉先健兒', '冠軍侯屬官', '武穆親隨', '伯約近衛', '元遜帳下', '幼常舊部']
COMMANDERS_JP = ['正成門生', '幸村一番槍', '信玄侍從', '謙信旗手', '信長側近', '直政赤備督導', '半藏副手', '小早川水手長', '道雪刀客', '義經隨騎']
COMMANDERS_KR = ['忠武公旗手', '文德行軍司馬', '庾信花郎隊長', '姜邯贊麾下', '朱蒙射手隊長', '權慄軍監', '成桂親軍', '崔瑩健兒', '茂宣火砲監', '保皐水師先鋒']

TITLES = [
  '奔雷突襲極致先手', '重鎧陣線寸步不讓', '神射強弩封鎖全場', '先登奇兵暗夜刺殺',
  '八陣帷幄奇謀致勝', '步騎火砲協同合圍', '伏波龍骨水陸破暗', '先制斬首千里破陣',
  '玄甲重盾正面死鬥', '十面埋伏天羅地網', '多路並進漫天火矢', '登高觀瞻精確校射'
]

BUDGET_POOLS = [
  [5, 4, 3, 2, 1], # 15
  [5, 3, 3, 2, 2], # 15
  [4, 4, 3, 2, 2], # 15
  [5, 3, 3, 3, 1], # 15
  [4, 3, 3, 3, 2], # 15
  [5, 5, 2, 2, 1], # 15
  [4, 4, 4, 2, 1], # 15
  [3, 3, 3, 3, 3], # 15
  [4, 3, 3, 2, 2], # 14
  [3, 3, 3, 2, 2], # 13
]

random.seed(42)

bots = []
rp = 54000
for i in range(100):
    bot_id = f'bot_{i+1:02d}'
    if i < len(HISTORICAL_BOTS):
        name, flag, title = HISTORICAL_BOTS[i]
    else:
        r_nat = random.random()
        if r_nat < 0.50:
            flag = '🇨🇳'
            pfx = random.choice(PREFIXES_CN)
            cmd = random.choice(COMMANDERS_CN)
        elif r_nat < 0.80:
            flag = '🇯🇵'
            pfx = random.choice(PREFIXES_JP)
            cmd = random.choice(COMMANDERS_JP)
        else:
            flag = '🇰🇷'
            pfx = random.choice(PREFIXES_KR)
            cmd = random.choice(COMMANDERS_KR)
        name = f'{pfx}・{cmd}'
        title = random.choice(TITLES)

    doc = random.choice(DOCS)
    
    b_part = random.choice(BUDGET_POOLS).copy()
    random.shuffle(b_part)
    
    deck = []
    for cat_idx, cat in enumerate(cats):
        cost = b_part[cat_idx]
        candidates = by_cat_cost.get((cat, cost), [])
        flag_cands = [w for w in candidates if w['flag'] == flag]
        pool = flag_cands if flag_cands else candidates
        chosen = random.choice(pool)
        deck.append(chosen['id'])
    
    if i == 0:
        bot_rp = 54000
    else:
        decay = int(random.uniform(400, 750))
        rp = max(100, rp - decay)
        bot_rp = rp

    bots.append({
        'id': bot_id,
        'name': name,
        'flag': flag,
        'rp': bot_rp,
        'doc': doc,
        'deck': deck,
        'title': title
    })

ranks_json = json.dumps(LADDER_RANKS, ensure_ascii=False, indent=2)
presets_json = json.dumps(bots, ensure_ascii=False, indent=2)

content = f"""'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 — 天梯榮譽榜資料庫 (Ladder Data)
   包含 100 位古代天梯軍團名冊、11 級古代軍銜與 100% 合法真實防守陣容
   ===================================================== */

const LADDER_RANKS = {ranks_json};

const LADDER_PRESETS = {presets_json};

if (typeof window !== 'undefined') {{
  window.LADDER_RANKS = LADDER_RANKS;
  window.LADDER_PRESETS = LADDER_PRESETS;
}}
if (typeof module !== 'undefined' && module.exports) {{
  module.exports = {{ LADDER_RANKS, LADDER_PRESETS }};
}}
"""

(ROOT / "js" / "ladder-data.js").write_text(content, encoding="utf-8")
print(f"成功生成 D:/TopWarlords/js/ladder-data.js，包含 100 位歷史軍團與 11 級古代軍階！")

