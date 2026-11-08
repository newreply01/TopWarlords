import json

REPLACEMENTS = [
    # Air
    {
        "old_id": "ONDAL", "id": "ZHAOSHE", "name": "趙奢", "cat": "air", "cost": 2, "style": "H",
        "title": "狹路相逢·馬服奔馳",
        "desc": "戰國名將馬服君，以「狹路相逢勇者勝」之膽魄千里疾馳救援閼與，出其不意大破秦軍主力。",
        "stealth": 38, "strategy": 22, "traits": ["LR", "CAS"], "roleFlags": [],
        "hp": 136, "atk": 82, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 戰國", "weapon": "趙國鐵騎長矛 + 馬服良駒", "sfx": "cavalry_charge"
    },
    {
        "old_id": "KOGURYOTIE", "id": "ZANGBA", "name": "臧霸", "cat": "air", "cost": 1, "style": "G",
        "title": "威虜將軍·泰山突騎",
        "desc": "曹魏名將，統率泰山精銳輕騎，合肥之戰夾擊孫權，破吳軍陣線，威鎮江東。",
        "stealth": 42, "strategy": 12, "traits": ["LR"], "roleFlags": [],
        "hp": 96, "atk": 62, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "泰山快矛 + 精良戰馬", "sfx": "cavalry_charge"
    },
    {
        "old_id": "BAEKJEO", "id": "MAEDATOSHI", "name": "前田利家", "cat": "air", "cost": 1, "style": "H",
        "title": "槍之又左·赤母衣突擊",
        "desc": "戰國著名猛將，織田信長親兵赤母衣眾筆頭，勇冠三軍，以超絕騎槍技術開創加賀百萬石祖業。",
        "stealth": 36, "strategy": 16, "traits": ["LR", "CAS"], "roleFlags": [],
        "hp": 98, "atk": 64, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "朱柄長槍 + 赤母衣良駒", "sfx": "blade_clash"
    },

    # Armor
    {
        "old_id": "HAOMENG", "id": "PANMEI", "name": "潘美", "cat": "armor", "cost": 1, "style": "C",
        "title": "開國沉毅·重步連環",
        "desc": "北宋開國名將，平定南漢、南唐，太原圍城伐北漢，身經百戰重甲陣列堅如磐石。",
        "stealth": 10, "strategy": 18, "traits": ["HEAVY", "APS"], "roleFlags": [],
        "hp": 118, "atk": 38, "def": 0.08,
        "flag": "🇨🇳", "origin": "中國 · 北宋", "weapon": "北宋步兵大斧 + 鐵葉鎧", "sfx": "blade_clash"
    },
    {
        "old_id": "ONIKOJIMA", "id": "SANADA_NOB", "name": "真田信之", "cat": "armor", "cost": 1, "style": "E",
        "title": "信濃之守·固本金湯",
        "desc": "戰國真田家長子，以沉穩堅毅著稱，砥石城堅壁清野，保全真田家松代藩百年基業。",
        "stealth": 12, "strategy": 20, "traits": ["HEAVY"], "roleFlags": [],
        "hp": 122, "atk": 36, "def": 0.08,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "太刀 + 堅固黑漆甲", "sfx": "war_drum"
    },
    {
        "old_id": "KANISAIZO", "id": "NIWA", "name": "丹羽長秀", "cat": "armor", "cost": 1, "style": "F",
        "title": "米五郎左·重鎧如山",
        "desc": "織田四天王之一，以治軍嚴謹沉著稱「米五郎左」，安土城普請與大陣防守無懈可擊。",
        "stealth": 10, "strategy": 18, "traits": ["HEAVY", "APS"], "roleFlags": [],
        "hp": 120, "atk": 38, "def": 0.08,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "朱漆長槍 + 胴丸重鎧", "sfx": "blade_clash"
    },
    {
        "old_id": "BAIERBING", "id": "WANGPING", "name": "王平", "cat": "armor", "cost": 1, "style": "D",
        "title": "沉勇善守·無當鐵壁",
        "desc": "蜀漢名將，統無當飛軍，街亭之戰鳴鼓自守阻斷張郃，興勢之戰以弱制強大破十萬魏軍。",
        "stealth": 14, "strategy": 18, "traits": ["HEAVY", "TRUE_AT"], "roleFlags": [],
        "hp": 124, "atk": 40, "def": 0.08,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "百煉剛刀 + 鐵鱗鎧", "sfx": "blade_clash"
    },
    {
        "old_id": "BYEOLMUBAN", "id": "GANGCHO", "name": "康兆", "cat": "armor", "cost": 1, "style": "H",
        "title": "劍車鐵壁·高麗大將",
        "desc": "高麗名將，創制覆鐵劍車重甲大陣，於通州正面硬撼契丹十萬鐵騎，力戰不屈。",
        "stealth": 10, "strategy": 14, "traits": ["HEAVY", "TRUE_AT"], "roleFlags": [],
        "hp": 126, "atk": 38, "def": 0.08,
        "flag": "🇰🇷", "origin": "韓國 · 高麗", "weapon": "高麗劍車長矛 + 鎖子甲", "sfx": "blade_clash"
    },

    # Air Defense
    {
        "old_id": "HAOZHAO", "id": "LIMU", "name": "李牧", "cat": "air_defense", "cost": 4, "style": "E",
        "title": "破胡武安·萬矢連環",
        "desc": "戰國四大名將，以神射弓弩與車陣大破匈奴十餘萬騎，肥之戰與番吾之戰兩挫強秦，戰功卓絕。",
        "stealth": 18, "strategy": 26, "traits": ["AA_LONG", "SAT"], "roleFlags": [],
        "hp": 184, "atk": 86, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 戰國", "weapon": "趙國鐵角硬弓 + 破甲箭陣", "sfx": "arrow_volley"
    },
    {
        "old_id": "PARKJESANG", "id": "HULUGUANG", "name": "斛律光", "cat": "air_defense", "cost": 4, "style": "H",
        "title": "落雕都督·百步穿石",
        "desc": "北齊軍事支柱，號「落雕都督」，神射天下第一，臨陣射箭無不應弦而倒，生平百戰未嘗一敗。",
        "stealth": 16, "strategy": 22, "traits": ["AA_LONG", "TRUE_AT"], "roleFlags": [],
        "hp": 188, "atk": 88, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 南北朝", "weapon": "黑角落雕強弓 + 鐵羽鑿子箭", "sfx": "arrow_volley"
    },
    {
        "old_id": "YANYAN", "id": "ZHOUYAFU", "name": "周亞夫", "cat": "air_defense", "cost": 3, "style": "C",
        "title": "細柳嚴軍·強弩堅陣",
        "desc": "西漢名將條侯，細柳營號令嚴整「軍中聞將軍令不聞天子之詔」，平定七國之亂箭陣固若金湯。",
        "stealth": 14, "strategy": 24, "traits": ["AA_LONG", "CIWS"], "roleFlags": [],
        "hp": 158, "atk": 74, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 西漢", "weapon": "漢軍武剛弩 + 精鋼大箭", "sfx": "arrow_volley"
    },
    {
        "old_id": "INABA", "id": "TORII", "name": "鳥居元忠", "cat": "air_defense", "cost": 3, "style": "E",
        "title": "三河武士·伏見鐵砲血戰",
        "desc": "德川忠臣，伏見城以少數守軍搭配鐵砲長弓死守半月，拖住西軍四萬主力，壯烈殉節。",
        "stealth": 12, "strategy": 18, "traits": ["AA_LONG", "CIWS"], "roleFlags": [],
        "hp": 160, "atk": 72, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "三河火繩槍 + 伏見箭矢", "sfx": "arrow_volley"
    },
    {
        "old_id": "SUZUKI", "id": "SHIMOTSUMA", "name": "下間賴廉", "cat": "air_defense", "cost": 3, "style": "F",
        "title": "石山軍配·門徒鐵砲總指揮",
        "desc": "本願寺軍事總帥，組織石山合戰一向一揆鐵砲大陣，多次以三段連射重創織田信長大軍。",
        "stealth": 16, "strategy": 20, "traits": ["AA_LONG", "SAT"], "roleFlags": [],
        "hp": 156, "atk": 76, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "一向一揆鐵砲 + 佛號令旗", "sfx": "arrow_volley"
    },
    {
        "old_id": "LUSUARCH", "id": "GENGYAN", "name": "耿弇", "cat": "air_defense", "cost": 2, "style": "A",
        "title": "雲台神將·圍城破援",
        "desc": "東漢雲台二十八將第四，連下四十六郡，精通強弩大陣與圍城打援，光武帝譽其戰功可比韓信。",
        "stealth": 18, "strategy": 20, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 126, "atk": 62, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 東漢", "weapon": "雲台強弩 + 破甲箭匣", "sfx": "arrow_volley"
    },
    {
        "old_id": "CAOPICROSS", "id": "FENGYI", "name": "馮異", "cat": "air_defense", "cost": 2, "style": "C",
        "title": "大樹將軍·巧設強弩",
        "desc": "東漢開國名將大樹將軍，善於以險阻地形設伏弩大陣，崤底之戰大破赤眉主力。",
        "stealth": 16, "strategy": 22, "traits": ["AA_LONG", "CIWS"], "roleFlags": [],
        "hp": 128, "atk": 60, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 東漢", "weapon": "大樹長弓 + 伏射箭列", "sfx": "arrow_volley"
    },
    {
        "old_id": "WENCHOU", "id": "PANGJUAN", "name": "龐涓", "cat": "air_defense", "cost": 2, "style": "B",
        "title": "魏武上將·勁弩列陣",
        "desc": "戰國魏國大將軍，統帥精銳魏武卒與強勁連弩，連克諸侯，威震中原。",
        "stealth": 14, "strategy": 20, "traits": ["AA_LONG", "TRUE_AT"], "roleFlags": [],
        "hp": 130, "atk": 64, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 戰國", "weapon": "魏武卒十二石大弩", "sfx": "arrow_volley"
    },
    {
        "old_id": "NAGASHINO", "id": "ASAKURA_SOT", "name": "朝倉宗滴", "cat": "air_defense", "cost": 2, "style": "E",
        "title": "越前軍神·鐵砲先驅",
        "desc": "越前朝倉家軍事支柱，九頭龍川大破三十萬一揆，晚年率先在實戰中裝備火繩槍連連告捷。",
        "stealth": 14, "strategy": 22, "traits": ["AA_LONG", "CIWS"], "roleFlags": [],
        "hp": 128, "atk": 62, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "越前早期火繩銃", "sfx": "arrow_volley"
    },
    {
        "old_id": "TANEGASHIMA", "id": "MATSUNAGA", "name": "松永久秀", "cat": "air_defense", "cost": 2, "style": "F",
        "title": "亂世梟雄·火藥大陣",
        "desc": "戰國梟雄，最早在戰場大規模部署鐵砲與火藥炸裂戰術之大名，智勇機敏。",
        "stealth": 16, "strategy": 24, "traits": ["AA_LONG", "SAT"], "roleFlags": [],
        "hp": 126, "atk": 64, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "南蠻炸藥引線 + 短鐵砲", "sfx": "arrow_volley"
    },
    {
        "old_id": "ZHUGELIAN", "id": "MANCHONG", "name": "滿寵", "cat": "air_defense", "cost": 1, "style": "A",
        "title": "築城折威·伏弩拒吳",
        "desc": "曹魏名將，合肥新城設計射程極遠之「折威弩」與伏擊陷阱，射殺吳軍大將大破孫權十萬大軍。",
        "stealth": 16, "strategy": 20, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 98, "atk": 46, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "折威守城弩 + 拒馬樁", "sfx": "arrow_volley"
    },
    {
        "old_id": "SHENBI", "id": "TANDAOJI", "name": "檀道濟", "cat": "air_defense", "cost": 1, "style": "B",
        "title": "唱籌量沙·強弩退魏",
        "desc": "劉宋第一名將，唱籌量沙以退敵兵，以強弩大陣壓制北魏鐵騎，自豪「毀汝萬里長城」。",
        "stealth": 14, "strategy": 22, "traits": ["AA_LONG", "CIWS"], "roleFlags": [],
        "hp": 100, "atk": 46, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 南北朝", "weapon": "宋軍神臂大弓 + 鐵羽矢", "sfx": "arrow_volley"
    },
    {
        "old_id": "SHESHENG", "id": "GENGGONG", "name": "耿恭", "cat": "air_defense", "cost": 1, "style": "C",
        "title": "疏勒節烈·萬弩拒胡",
        "desc": "東漢名將，疏勒城以毒箭硬弩連環射殺敵軍，率數百人堅守數月抗擊匈奴數萬，十三將士歸玉門。",
        "stealth": 18, "strategy": 16, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 96, "atk": 48, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 東漢", "weapon": "漢代漆角硬弩 + 毒鏃箭", "sfx": "arrow_volley"
    },
    {
        "old_id": "CHUBEE", "id": "KUANGZHANG", "name": "匡章", "cat": "air_defense", "cost": 1, "style": "D",
        "title": "齊國元戎·垂沙破楚",
        "desc": "戰國齊國名將，統帥齊國萬弩之陣五國伐秦攻破函谷關，垂沙之役大破楚軍，威震列國。",
        "stealth": 14, "strategy": 22, "traits": ["AA_LONG", "SAT"], "roleFlags": [],
        "hp": 98, "atk": 46, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 戰國", "weapon": "齊國臨淄強弩 + 箭陣纛旗", "sfx": "arrow_volley"
    },
    {
        "old_id": "KUNITOMO", "id": "TSUDA_SAN", "name": "津田算長", "cat": "air_defense", "cost": 1, "style": "E",
        "title": "銃術開山·根來射手",
        "desc": "日本火繩槍術開創者，引進種子島火器並創立津田流銃術，使紀州鐵砲名揚天下。",
        "stealth": 16, "strategy": 18, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 96, "atk": 48, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "津田流定制火繩槍", "sfx": "arrow_volley"
    },
    {
        "old_id": "NEGORO", "id": "HONDA_TADATSUGU", "name": "本多忠次", "cat": "air_defense", "cost": 1, "style": "F",
        "title": "鐵砲先鋒·三河老將",
        "desc": "德川家老將，本多忠勝之叔父，長篠之戰指揮三河足輕鐵砲輪射立下首功。",
        "stealth": 14, "strategy": 16, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 98, "atk": 46, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "三河軍制鐵砲 + 火藥袋", "sfx": "arrow_volley"
    },
    {
        "old_id": "KOGURYOBOW", "id": "MILYU", "name": "密友", "cat": "air_defense", "cost": 1, "style": "H",
        "title": "捨身挽弓·決死突圍",
        "desc": "高句麗猛將，母丘儉伐高句麗之際，密友率死士引弓衝殺斬將突圍，救出東川王。",
        "stealth": 20, "strategy": 14, "traits": ["AA_LONG"], "roleFlags": [],
        "hp": 98, "atk": 48, "def": 0,
        "flag": "🇰🇷", "origin": "韓國 · 高句麗", "weapon": "高句麗白角獵弓 + 鐵鏃箭", "sfx": "arrow_volley"
    },

    # Naval
    {
        "old_id": "DENGAI_V", "id": "LIUYU", "name": "劉裕", "cat": "naval", "cost": 5, "style": "A",
        "title": "氣吞萬里·卻月奇陣",
        "desc": "宋武帝劉裕，金戈鐵馬氣吞萬里如虎！開創水陸聯動「卻月陣」殲滅北魏萬餘騎，南征北伐滅南燕後秦。",
        "stealth": 32, "strategy": 28, "traits": ["AMBUSH", "AEGIS"], "roleFlags": [],
        "hp": 348, "atk": 130, "def": 0.12,
        "flag": "🇨🇳", "origin": "中國 · 南北朝", "weapon": "天子神鋒劍 + 卻月水陸戰船", "sfx": "blade_clash"
    },
    {
        "old_id": "SHIMAZU_V", "id": "CHOSOKABE", "name": "長宗我部元親", "cat": "naval", "cost": 5, "style": "F",
        "title": "土佐之蝠·一領具足",
        "desc": "四國霸主，創立水陸兩棲「一領具足」強襲軍團，橫掃四國，海陸突襲所向披靡。",
        "stealth": 36, "strategy": 24, "traits": ["AMBUSH", "SUB"], "roleFlags": [],
        "hp": 352, "atk": 128, "def": 0.12,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "長槍 + 一領具足兩棲甲", "sfx": "blade_clash"
    },
    {
        "old_id": "YOSHITSUN_V", "id": "ZUTI", "name": "祖逖", "cat": "naval", "cost": 4, "style": "B",
        "title": "中流擊楫·北伐光復",
        "desc": "東晉名將，聞雞起舞，中流擊楫誓復中原，率水陸先登健兒北渡長江收復黃河以南失地。",
        "stealth": 30, "strategy": 22, "traits": ["AMBUSH", "ASW"], "roleFlags": [],
        "hp": 248, "atk": 98, "def": 0.08,
        "flag": "🇨🇳", "origin": "中國 · 兩晉", "weapon": "中流擊楫大劍 + 渡江快艇", "sfx": "blade_clash"
    },
    {
        "old_id": "ZHANGLIAO_V", "id": "XIEXUAN", "name": "謝玄", "cat": "naval", "cost": 3, "style": "A",
        "title": "北府都督·淝水奇捷",
        "desc": "東晉北府兵創立者，淝水之戰以八萬北府水陸奇兵過河突擊，大破前秦八十萬大軍。",
        "stealth": 26, "strategy": 26, "traits": ["AMBUSH", "ASW"], "roleFlags": [],
        "hp": 196, "atk": 82, "def": 0.06,
        "flag": "🇨🇳", "origin": "中國 · 兩晉", "weapon": "北府精鋼斬馬刀 + 艨艟", "sfx": "blade_clash"
    },
    {
        "old_id": "HANSHIZHONG_V", "id": "YUYUNWEN", "name": "虞允文", "cat": "naval", "cost": 3, "style": "C",
        "title": "采石折衝·書生大捷",
        "desc": "南宋名臣，采石磯戰役臨危督師，指揮樓船水軍以海鰍船水陸火攻大破完顏亮六十萬金軍。",
        "stealth": 22, "strategy": 28, "traits": ["AMBUSH", "EW"], "roleFlags": [],
        "hp": 192, "atk": 84, "def": 0.06,
        "flag": "🇨🇳", "origin": "中國 · 南宋", "weapon": "采石督師劍 + 海鰍踏浪船", "sfx": "fire_attack"
    },
    {
        "old_id": "MOURI_V", "id": "MOURI_MOTO", "name": "毛利元就", "cat": "naval", "cost": 3, "style": "E",
        "title": "西國謀神·嚴島水陸奇襲",
        "desc": "日本戰國第一智將，嚴島之戰暴風雨夜水陸奇襲陶晴賢兩萬大軍，三矢之訓一統中國地方。",
        "stealth": 32, "strategy": 30, "traits": ["SUB", "AMBUSH"], "roleFlags": [],
        "hp": 194, "atk": 82, "def": 0.06,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "一文字太刀 + 村上嚴島樓船", "sfx": "strategy_gong"
    },
    {
        "old_id": "MENGCHONG", "id": "LUFAN", "name": "呂範", "cat": "naval", "cost": 2, "style": "B",
        "title": "水軍前部·江表巨艦",
        "desc": "東吳名將大司馬，統水軍前部督率五艦大拒曹丕大軍於洞口，風濤之中沉著破敵。",
        "stealth": 24, "strategy": 18, "traits": ["AMBUSH", "ASW"], "roleFlags": [],
        "hp": 142, "atk": 68, "def": 0.04,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "東吳督軍古錠刀 + 巨艦", "sfx": "blade_clash"
    },
    {
        "old_id": "FUMASUB", "id": "WAKIZAKA", "name": "脇坂安治", "cat": "naval", "cost": 2, "style": "E",
        "title": "賤岳槍名·淡路水軍首領",
        "desc": "賤岳七本槍之一，淡路水軍頭領，關原之戰機敏調度，兼備陸戰與海戰將才。",
        "stealth": 26, "strategy": 16, "traits": ["AMBUSH"], "roleFlags": [],
        "hp": 144, "atk": 66, "def": 0.04,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "賤岳長槍 + 淡路戰船", "sfx": "blade_clash"
    },
    {
        "old_id": "KONISHI", "id": "TOUDO", "name": "藤堂高虎", "cat": "naval", "cost": 2, "style": "F",
        "title": "水軍大將·築城宗師",
        "desc": "戰國名將，掌管德川家水軍大陣，築城與水陸攻防皆臻極致，歷事七主終成一方霸主。",
        "stealth": 24, "strategy": 22, "traits": ["AMBUSH", "EW"], "roleFlags": [],
        "hp": 146, "atk": 66, "def": 0.04,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "築城大銃 + 水軍旗艦", "sfx": "war_drum"
    },
    {
        "old_id": "SHUIGUI", "id": "ZHUHUAN", "name": "朱桓", "cat": "naval", "cost": 1, "style": "A",
        "title": "濡須水壁·以寡敵眾",
        "desc": "東吳名將，濡須塢以五千水陸精兵抵擋曹仁大軍，斬將破城以寡敵眾。",
        "stealth": 26, "strategy": 18, "traits": ["AMBUSH"], "roleFlags": [],
        "hp": 98, "atk": 48, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "佩刀 + 濡須防禦柵船", "sfx": "blade_clash"
    },
    {
        "old_id": "XIANDENG", "id": "HEQI", "name": "賀齊", "cat": "naval", "cost": 1, "style": "B",
        "title": "艨艟華彩·百越先登",
        "desc": "東吳名將，戰船艨艟精工甲刃照耀江面，每戰必先登陷陣，平定山越威震江東。",
        "stealth": 24, "strategy": 16, "traits": ["AMBUSH", "ASW"], "roleFlags": [],
        "hp": 100, "atk": 46, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 三國", "weapon": "精鋼短戟 + 先登皮鎧", "sfx": "blade_clash"
    },
    {
        "old_id": "KUMANO", "id": "KUKI_MORI", "name": "九鬼守隆", "cat": "naval", "cost": 1, "style": "E",
        "title": "志摩水軍·大坂破水",
        "desc": "九鬼嘉隆之子，繼承志摩鐵甲水軍總帥，大坂之戰指揮水軍突破木津川大立戰功。",
        "stealth": 22, "strategy": 16, "traits": ["AMBUSH"], "roleFlags": [],
        "hp": 98, "atk": 48, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "水軍大薙刀 + 快船", "sfx": "blade_clash"
    },
    {
        "old_id": "KOGA_SUB", "id": "MIURA", "name": "三浦義澄", "cat": "naval", "cost": 1, "style": "F",
        "title": "相模水軍·壇之浦先驅",
        "desc": "源平合戰相模三浦水軍總帥，壇之浦海戰率大船隊先登衝陣，全殲平氏水軍。",
        "stealth": 26, "strategy": 14, "traits": ["AMBUSH", "SUB"], "roleFlags": [],
        "hp": 96, "atk": 48, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 源平", "weapon": "三浦水軍太刀 + 小早船", "sfx": "blade_clash"
    },
    {
        "old_id": "TAMNA", "id": "BAEJEONG", "name": "裴仲孫", "cat": "naval", "cost": 1, "style": "H",
        "title": "三別抄元帥·珍島抗擊",
        "desc": "高麗三別抄水陸軍隊總帥，以珍島為基地統領千艘戰船海陸游擊抵抗蒙古大軍。",
        "stealth": 28, "strategy": 16, "traits": ["AMBUSH", "ASW"], "roleFlags": [],
        "hp": 98, "atk": 46, "def": 0,
        "flag": "🇰🇷", "origin": "韓國 · 高麗", "weapon": "高麗水軍長刀 + 木板護船", "sfx": "blade_clash"
    },
    {
        "old_id": "JINGKE", "id": "CAOBIN", "name": "曹彬", "cat": "naval", "cost": 1, "style": "C",
        "title": "渡江名帥·不殺仁將",
        "desc": "北宋開國第一良將，採石磯架設浮橋大渡長江擊破南唐水軍，平江南不妄殺一人。",
        "stealth": 20, "strategy": 22, "traits": ["AMBUSH", "EW"], "roleFlags": [],
        "hp": 102, "atk": 44, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 北宋", "weapon": "北宋大纛軍刀 + 浮橋長索", "sfx": "war_drum"
    },
    {
        "old_id": "ZHUANZHU", "id": "WANGBA", "name": "王霸", "cat": "naval", "cost": 1, "style": "D",
        "title": "昆陽先登·破敵無前",
        "desc": "東漢雲台二十八將，昆陽之戰率敢死先登直衝王莽中軍大旗，屢破強敵。",
        "stealth": 26, "strategy": 14, "traits": ["AMBUSH"], "roleFlags": [],
        "hp": 98, "atk": 48, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 東漢", "weapon": "精鐵破陣矛 + 護臂甲", "sfx": "blade_clash"
    },

    # Support
    {
        "old_id": "ZHUGUKE", "id": "FANLI", "name": "范蠡", "cat": "support", "cost": 2, "style": "C",
        "title": "臥薪嘗膽·興越滅吳",
        "desc": "春秋著名軍事家與謀略宗師，輔佐越王勾踐制定二十年滅吳戰略，廟算深沉長策制勝。",
        "stealth": 36, "strategy": 26, "traits": ["EW", "SEAD"], "roleFlags": [],
        "hp": 118, "atk": 56, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 春秋", "weapon": "范蠡兵策竹簡 + 越王佩劍", "sfx": "strategy_gong"
    },
    {
        "old_id": "GUANDU_CAT", "id": "SUNWU", "name": "孫武", "cat": "support", "cost": 1, "style": "A",
        "title": "兵聖大宗·知彼知己",
        "desc": "春秋兵聖，著《孫子兵法》十三篇，輔佐吳王五戰五捷攻入郢都大破強楚，天下兵家之始祖。",
        "stealth": 40, "strategy": 30, "traits": ["EW", "SPOT"], "roleFlags": [],
        "hp": 88, "atk": 46, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 春秋", "weapon": "孫子兵法十三篇 + 吳王授鉞", "sfx": "strategy_gong"
    },
    {
        "old_id": "XIAOSHI_SCOUT", "id": "LEYI", "name": "樂毅", "cat": "support", "cost": 1, "style": "B",
        "title": "昌國拔城·連克七十",
        "desc": "戰國名將，拜為燕昭王上將軍，率五國聯軍濟西破齊，半年連克齊國七十餘城，算無遺策。",
        "stealth": 36, "strategy": 26, "traits": ["EW", "SEAD"], "roleFlags": [],
        "hp": 86, "atk": 48, "def": 0,
        "flag": "🇨🇳", "origin": "中國 · 戰國", "weapon": "昌國君佩劍 + 五國聯軍令旗", "sfx": "strategy_gong"
    },
    {
        "old_id": "KOGA_SCOUT", "id": "YAMAMOTO", "name": "山本勘助", "cat": "support", "cost": 1, "style": "E",
        "title": "啄木鳥智謀·晴幸軍師",
        "desc": "武田信玄傳奇軍師，精通築城、陣形與奇謀，獻「啄木鳥戰法」揚名川中島。",
        "stealth": 38, "strategy": 26, "traits": ["EW", "SPOT"], "roleFlags": [],
        "hp": 86, "atk": 46, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "軍配團扇 + 築城陣圖", "sfx": "strategy_gong"
    },
    {
        "old_id": "KORYO_CAT", "id": "KIMBUSHIK", "name": "金富軾", "cat": "support", "cost": 1, "style": "G",
        "title": "平亂元戎·三國史策",
        "desc": "高麗名相兼統帥，指揮官軍平定妙清西京叛亂，著《三國史記》，文治武略兼備。",
        "stealth": 30, "strategy": 24, "traits": ["EW"], "roleFlags": [],
        "hp": 90, "atk": 44, "def": 0,
        "flag": "🇰🇷", "origin": "韓國 · 高麗", "weapon": "高麗宰相令旗 + 筆牘", "sfx": "strategy_gong"
    },
    {
        "old_id": "HOGAK_DRUM", "id": "TOKUGAWA", "name": "德川家康", "cat": "support", "cost": 1, "style": "F",
        "title": "三河忍耐·天下霸業",
        "desc": "戰國三傑之一，沉著隱忍，關原之戰與大坂之戰運籌帷幄決勝千里，開創江戶幕府二百六十年基業。",
        "stealth": 36, "strategy": 28, "traits": ["EW", "SEAD"], "roleFlags": [],
        "hp": 88, "atk": 46, "def": 0,
        "flag": "🇯🇵", "origin": "日本 · 戰國", "weapon": "葵紋軍配 + 三河統帥刀", "sfx": "war_drum"
    }
]

print(f"Total designed replacements: {len(REPLACEMENTS)}")
seen_ids = set()
for r in REPLACEMENTS:
    assert r['id'] not in seen_ids, f"Duplicate new ID: {r['id']}"
    seen_ids.add(r['id'])
print("All replacement IDs are unique!")
