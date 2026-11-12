'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 — 天梯榮譽榜資料庫 (Ladder Data)
   包含 100 位古代天梯軍團名冊、11 級古代軍銜與 100% 合法真實防守陣容
   ===================================================== */

const LADDER_RANKS = [
  {
    "tier": 11,
    "name": "天下大將軍",
    "en": "SUPREME GENERAL",
    "icon": "🎖️",
    "minRP": 50000,
    "color": "#f59e0b"
  },
  {
    "tier": 10,
    "name": "驃騎大將軍",
    "en": "GRAND CAVALRY GEN",
    "icon": "⭐⭐⭐⭐",
    "minRP": 42000,
    "color": "#fbbf24"
  },
  {
    "tier": 9,
    "name": "車騎大將軍",
    "en": "GRAND CHARIOT GEN",
    "icon": "⭐⭐⭐",
    "minRP": 35000,
    "color": "#38bdf8"
  },
  {
    "tier": 8,
    "name": "衛將軍",
    "en": "SENIOR PALACE GEN",
    "icon": "⭐⭐",
    "minRP": 28000,
    "color": "#818cf8"
  },
  {
    "tier": 7,
    "name": "前後左右將軍",
    "en": "GENERAL OF DIRECTION",
    "icon": "⭐",
    "minRP": 22000,
    "color": "#a78bfa"
  },
  {
    "tier": 6,
    "name": "都督軍事",
    "en": "COMMANDER-IN-CHIEF",
    "icon": "⚔️⚔️",
    "minRP": 16000,
    "color": "#34d399"
  },
  {
    "tier": 5,
    "name": "中郎將",
    "en": "SENIOR COLONEL",
    "icon": "⚔️",
    "minRP": 11000,
    "color": "#2dd4bf"
  },
  {
    "tier": 4,
    "name": "校尉",
    "en": "COLONEL / ADJUTANT",
    "icon": "🛡️⭐",
    "minRP": 7000,
    "color": "#94a3b8"
  },
  {
    "tier": 3,
    "name": "裨將軍",
    "en": "ASSISTANT GENERAL",
    "icon": "🛡️",
    "minRP": 3500,
    "color": "#64748b"
  },
  {
    "tier": 2,
    "name": "折衝都尉",
    "en": "VANGUARD CAPTAIN",
    "icon": "🔹",
    "minRP": 1500,
    "color": "#547792"
  },
  {
    "tier": 1,
    "name": "軍候百夫長",
    "en": "CENTURION / LEADER",
    "icon": "🔰",
    "minRP": 0,
    "color": "#475569"
  }
];

const LADDER_PRESETS = [
  {
    "id": "bot_01",
    "name": "漢家赤幟・衛霍親衛",
    "flag": "🇨🇳",
    "rp": 54000,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "ZHOUTAI",
      "GENGYAN",
      "WEIYAN",
      "CAOCAO"
    ],
    "title": "封狼居胥遠征打擊"
  },
  {
    "id": "bot_02",
    "name": "武安死士・長平陷陣軍",
    "flag": "🇨🇳",
    "rp": 53350,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "LIGUANG",
      "YUEJIN",
      "YAMAMOTO"
    ],
    "title": "殺神威嚴破軍攻勢"
  },
  {
    "id": "bot_03",
    "name": "蜀漢精銳・諸葛八陣營",
    "flag": "🇨🇳",
    "rp": 52896,
    "doc": "deception",
    "deck": [
      "ZHAOYUN",
      "DIANWEI",
      "FENGYI",
      "YUYUNWEN",
      "LUSU"
    ],
    "title": "神機帷幄奇正聯防"
  },
  {
    "id": "bot_04",
    "name": "東吳水督・江表虎臣隊",
    "flag": "🇨🇳",
    "rp": 52453,
    "doc": "defense",
    "deck": [
      "XIAHOUYUAN",
      "XUCHU",
      "GENGYAN",
      "XUHUANG",
      "SIMAYI"
    ],
    "title": "赤壁赤焰水陸突襲"
  },
  {
    "id": "bot_05",
    "name": "甲斐赤備・風林火山",
    "flag": "🇯🇵",
    "rp": 51709,
    "doc": "defense",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "ASAKURA_SOT",
      "MOURI_MOTO",
      "LUSU"
    ],
    "title": "武田騎兵奔雷撕裂"
  },
  {
    "id": "bot_06",
    "name": "越後軍神・毘沙門天",
    "flag": "🇯🇵",
    "rp": 51064,
    "doc": "strike",
    "deck": [
      "YOSHITSUNE",
      "KATOKIYOMASA",
      "TORII",
      "MOURI_MOTO",
      "LUSU"
    ],
    "title": "車懸之陣正面決戰"
  },
  {
    "id": "bot_07",
    "name": "尾張鐵砲・天下布武",
    "flag": "🇯🇵",
    "rp": 50425,
    "doc": "deception",
    "deck": [
      "YAMAGATA",
      "SHIBATA",
      "TORII",
      "HATTORI",
      "YAMAMOTO"
    ],
    "title": "三段輪射火力重壁"
  },
  {
    "id": "bot_08",
    "name": "三韓忠武・鳴梁伏波",
    "flag": "🇰🇷",
    "rp": 49887,
    "doc": "strike",
    "deck": [
      "PANGDE",
      "GYEBAEK",
      "CHOIMUSEON",
      "JEONGJI",
      "HANBEI"
    ],
    "title": "板屋神龍鐵甲巡防"
  },
  {
    "id": "bot_09",
    "name": "高句麗雄師・薩水破陣",
    "flag": "🇰🇷",
    "rp": 49138,
    "doc": "deception",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "CHOIMUSEON",
      "JEONGJI",
      "PANGTONG"
    ],
    "title": "乙支文德伏流奇計"
  },
  {
    "id": "bot_10",
    "name": "大唐天策・玄甲鐵騎",
    "flag": "🇨🇳",
    "rp": 48605,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "FENGYI",
      "LUMENG",
      "LUSU"
    ],
    "title": "太宗親衛千里奔襲"
  },
  {
    "id": "bot_11",
    "name": "漢山先鋒組・朱蒙射手隊長",
    "flag": "🇰🇷",
    "rp": 48204,
    "doc": "strike",
    "deck": [
      "GAISUWEN",
      "GYEBAEK",
      "MATSUNAGA",
      "JEONGJI",
      "LUSU"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_12",
    "name": "越前朝倉・信長側近",
    "flag": "🇯🇵",
    "rp": 47633,
    "doc": "strike",
    "deck": [
      "DATE",
      "KATOKIYOMASA",
      "ASAKURA_SOT",
      "MOURI_MOTO",
      "SHIMAZU_YOSHIHISA"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_13",
    "name": "大漢羽林・子龍部曲",
    "flag": "🇨🇳",
    "rp": 47141,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZHANGHE",
      "JANGPOGO",
      "SUNWU"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_14",
    "name": "雞林虎賁・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 46719,
    "doc": "deception",
    "deck": [
      "GAISUWEN",
      "GYEBAEK",
      "TANDAOJI",
      "JEONGJI",
      "PANGTONG"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_15",
    "name": "西涼鐵騎・白起偏將",
    "flag": "🇨🇳",
    "rp": 46085,
    "doc": "strike",
    "deck": [
      "ZHAOYUN",
      "XUCHU",
      "GENGYAN",
      "HEQI",
      "HANXIN"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_16",
    "name": "陷陣營・幼常舊部",
    "flag": "🇨🇳",
    "rp": 45537,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZONGZE",
      "YUYUNWEN",
      "FAZHENG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_17",
    "name": "戚家軍・蒙恬後裔",
    "flag": "🇨🇳",
    "rp": 44980,
    "doc": "deception",
    "deck": [
      "LINGTONG",
      "DIANWEI",
      "ZHANGHE",
      "MENGHUO",
      "SIMAYI"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_18",
    "name": "白馬義從・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 44412,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZHANGHE",
      "YUYUNWEN",
      "FAZHENG"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_19",
    "name": "高麗別武班・庾信花郎隊長",
    "flag": "🇰🇷",
    "rp": 43673,
    "doc": "strike",
    "deck": [
      "KIMYUSHIN",
      "YUJIN",
      "YANGMANCHUN",
      "DINGFENG",
      "XUNYU"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_20",
    "name": "雜賀鐵砲眾・正成門生",
    "flag": "🇯🇵",
    "rp": 43250,
    "doc": "defense",
    "deck": [
      "KENSHIN",
      "YUJIN",
      "TORII",
      "WAKIZAKA",
      "KANBEI"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_21",
    "name": "雞林虎賁・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 42616,
    "doc": "strike",
    "deck": [
      "EULJI",
      "KATOKIYOMASA",
      "CHOIMUSEON",
      "JEONGJI",
      "YAMAMOTO"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_22",
    "name": "白馬義從・奉先健兒",
    "flag": "🇨🇳",
    "rp": 42028,
    "doc": "deception",
    "deck": [
      "XIAHOUYUAN",
      "ZHOUTAI",
      "HULUGUANG",
      "XIEXUAN",
      "PANGTONG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_23",
    "name": "信濃先鋒・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 41588,
    "doc": "strike",
    "deck": [
      "YOSHITSUNE",
      "YUJIN",
      "ASAKURA_SOT",
      "KUKI",
      "LUSU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_24",
    "name": "西涼鐵騎・龐統高足",
    "flag": "🇨🇳",
    "rp": 40898,
    "doc": "defense",
    "deck": [
      "ZHAOSHE",
      "CAOREN",
      "ZHANGHE",
      "XIEXUAN",
      "FAZHENG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_25",
    "name": "大漢羽林・龐統高足",
    "flag": "🇨🇳",
    "rp": 40206,
    "doc": "defense",
    "deck": [
      "ZHAOYUN",
      "LIANPO",
      "ZONGZE",
      "MENGHUO",
      "YAMAMOTO"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_26",
    "name": "信濃先鋒・半藏副手",
    "flag": "🇯🇵",
    "rp": 39482,
    "doc": "strike",
    "deck": [
      "YAMAGATA",
      "SHIMAZUY",
      "TORII",
      "MURAKAMI",
      "SANADAMASA"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_27",
    "name": "陷陣營・龐統高足",
    "flag": "🇨🇳",
    "rp": 38782,
    "doc": "strike",
    "deck": [
      "ZHANGLIAO",
      "MENGTIAN",
      "GENGYAN",
      "XUHUANG",
      "PANGTONG"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_28",
    "name": "江東水師・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 38260,
    "doc": "defense",
    "deck": [
      "PANGDE",
      "XUCHU",
      "ZHOUYAFU",
      "YISUNSIN",
      "FAZHENG"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_29",
    "name": "九鬼水軍・道雪刀客",
    "flag": "🇯🇵",
    "rp": 37708,
    "doc": "strike",
    "deck": [
      "YOSHITSUNE",
      "IINAOMASA",
      "MATSUNAGA",
      "HATTORI",
      "SANADAMASA"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_30",
    "name": "花郎精銳・成桂親軍",
    "flag": "🇰🇷",
    "rp": 37076,
    "doc": "strike",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "GENGYAN",
      "JEONGJI",
      "LUXUN"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_31",
    "name": "荊襄精銳・子龍部曲",
    "flag": "🇨🇳",
    "rp": 36347,
    "doc": "defense",
    "deck": [
      "SUNCE",
      "MENGTIAN",
      "TANDAOJI",
      "XUHUANG",
      "LUXUN"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_32",
    "name": "信濃先鋒・義經隨騎",
    "flag": "🇯🇵",
    "rp": 35793,
    "doc": "defense",
    "deck": [
      "YAMAGATA",
      "TACHIBANAD",
      "SAIKA",
      "MURAKAMI",
      "TOKUGAWA"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_33",
    "name": "虎豹騎・幼常舊部",
    "flag": "🇨🇳",
    "rp": 35385,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "CAOREN",
      "LIGUANG",
      "MENGHUO",
      "PANGTONG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_34",
    "name": "虎豹騎・伯約近衛",
    "flag": "🇨🇳",
    "rp": 34673,
    "doc": "defense",
    "deck": [
      "CHENQINGZHI",
      "CAOREN",
      "TAISHICI",
      "GANNING",
      "SUNWU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_35",
    "name": "花郎精銳・成桂親軍",
    "flag": "🇰🇷",
    "rp": 33941,
    "doc": "strike",
    "deck": [
      "EULJI",
      "IINAOMASA",
      "CHOIMUSEON",
      "JIANGWEI",
      "LUSU"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_36",
    "name": "南原忠義隊・茂宣火砲監",
    "flag": "🇰🇷",
    "rp": 33388,
    "doc": "deception",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "CHOIMUSEON",
      "JEONGJI",
      "FAZHENG"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_37",
    "name": "奧州黑脛巾・信長側近",
    "flag": "🇯🇵",
    "rp": 32846,
    "doc": "defense",
    "deck": [
      "TACHIBANA",
      "SHIMAZUY",
      "ASAKURA_SOT",
      "MOURI_MOTO",
      "SHIMAZU_YOSHIHISA"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_38",
    "name": "真田赤備・正成門生",
    "flag": "🇯🇵",
    "rp": 32148,
    "doc": "defense",
    "deck": [
      "TACHIBANA",
      "HOJO_UJIYASU",
      "SAIKA",
      "MURAKAMI",
      "TOKUGAWA"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_39",
    "name": "雞林虎賁・茂宣火砲監",
    "flag": "🇰🇷",
    "rp": 31631,
    "doc": "deception",
    "deck": [
      "EULJI",
      "CHOIYOUNG",
      "MATSUNAGA",
      "JEONGJI",
      "LUSU"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_40",
    "name": "真田赤備・信玄侍從",
    "flag": "🇯🇵",
    "rp": 31214,
    "doc": "strike",
    "deck": [
      "DATE",
      "KATOKIYOMASA",
      "TORII",
      "HATTORI",
      "YAMAMOTO"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_41",
    "name": "背嵬軍・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 30736,
    "doc": "defense",
    "deck": [
      "PANGDE",
      "LIANPO",
      "HULUGUANG",
      "YUEJIN",
      "GUOJIA"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_42",
    "name": "關寧鐵騎・蒙恬後裔",
    "flag": "🇨🇳",
    "rp": 30247,
    "doc": "strike",
    "deck": [
      "XIAHOUYUAN",
      "DIANWEI",
      "TANDAOJI",
      "YUYUNWEN",
      "CAOCAO"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_43",
    "name": "神機營・伯約近衛",
    "flag": "🇨🇳",
    "rp": 29821,
    "doc": "deception",
    "deck": [
      "ZHAOSHE",
      "ZHOUTAI",
      "YANGYOUJI",
      "YUYUNWEN",
      "PANGTONG"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_44",
    "name": "九鬼水軍・謙信旗手",
    "flag": "🇯🇵",
    "rp": 29417,
    "doc": "deception",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "TORII",
      "MURAKAMI",
      "LUSU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_45",
    "name": "虎豹騎・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 28905,
    "doc": "defense",
    "deck": [
      "GONGSUNDU",
      "XUCHU",
      "ZHOUYAFU",
      "YUYUNWEN",
      "FAZHENG"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_46",
    "name": "荊襄精銳・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 28381,
    "doc": "defense",
    "deck": [
      "XIAHOUYUAN",
      "YUEFEI",
      "ZHANGHE",
      "TIANDAN",
      "PANGTONG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_47",
    "name": "白馬義從・伯約近衛",
    "flag": "🇨🇳",
    "rp": 27755,
    "doc": "defense",
    "deck": [
      "ZHAOSHE",
      "XUCHU",
      "GENGYAN",
      "WEIYAN",
      "XUNYU"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_48",
    "name": "嶽家軍・蒙恬後裔",
    "flag": "🇨🇳",
    "rp": 27232,
    "doc": "defense",
    "deck": [
      "WEI",
      "XUCHU",
      "KUANGZHANG",
      "WEIYAN",
      "FAZHENG"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_49",
    "name": "白馬義從・子龍部曲",
    "flag": "🇨🇳",
    "rp": 26489,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "KUANGZHANG",
      "CHOSOKABE",
      "FAZHENG"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_50",
    "name": "耽羅水手・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 26054,
    "doc": "strike",
    "deck": [
      "EULJI",
      "KATOKIYOMASA",
      "CHOIMUSEON",
      "JEONGJI",
      "LIUBOWEN"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_51",
    "name": "白馬義從・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 25453,
    "doc": "defense",
    "deck": [
      "LINGTONG",
      "YANGYE",
      "KUANGZHANG",
      "JANGPOGO",
      "ZHOUYU"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_52",
    "name": "信濃先鋒・信玄侍從",
    "flag": "🇯🇵",
    "rp": 24752,
    "doc": "defense",
    "deck": [
      "YAMAGATA",
      "KATOKIYOMASA",
      "TORII",
      "CHOSOKABE",
      "SANADAMASA"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_53",
    "name": "耽羅水手・保皐水師先鋒",
    "flag": "🇰🇷",
    "rp": 24159,
    "doc": "strike",
    "deck": [
      "TACHIBANA",
      "YANGYE",
      "CHOIMUSEON",
      "JEONGJI",
      "PANGTONG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_54",
    "name": "白毦兵・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 23519,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "XUCHU",
      "ZONGZE",
      "YUYUNWEN",
      "PANGTONG"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_55",
    "name": "南原忠義隊・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 22857,
    "doc": "strike",
    "deck": [
      "EULJI",
      "CHOIYOUNG",
      "FENGYI",
      "DINGFENG",
      "SANADAMASA"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_56",
    "name": "相模風魔・小早川水手長",
    "flag": "🇯🇵",
    "rp": 22246,
    "doc": "defense",
    "deck": [
      "YUKIMURA",
      "SHIMAZUY",
      "ASAKURA_SOT",
      "HATTORI",
      "SANADAMASA"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_57",
    "name": "背嵬軍・元遜帳下",
    "flag": "🇨🇳",
    "rp": 21507,
    "doc": "deception",
    "deck": [
      "PANGDE",
      "GUANYU",
      "GENGYAN",
      "JANGPOGO",
      "FAZHENG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_58",
    "name": "白毦兵・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 20948,
    "doc": "deception",
    "deck": [
      "WEI",
      "ZHOUTAI",
      "FENGYI",
      "WEIYAN",
      "PANGTONG"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_59",
    "name": "大漢羽林・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 20283,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "YUEFEI",
      "HULUGUANG",
      "XUHUANG",
      "LEYI"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_60",
    "name": "西涼鐵騎・龐統高足",
    "flag": "🇨🇳",
    "rp": 19690,
    "doc": "defense",
    "deck": [
      "GONGSUNDU",
      "DIANWEI",
      "ZHOUYAFU",
      "WEIYAN",
      "PANGTONG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_61",
    "name": "江東水師・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 19098,
    "doc": "strike",
    "deck": [
      "CHENQINGZHI",
      "ZHANGFEI",
      "FENGYI",
      "XIEXUAN",
      "LUSU"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_62",
    "name": "荊襄精銳・伯約近衛",
    "flag": "🇨🇳",
    "rp": 18405,
    "doc": "deception",
    "deck": [
      "ZHAOSHE",
      "YANGYE",
      "HANSHIZHONG",
      "WEIYAN",
      "GUOJIA"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_63",
    "name": "九鬼水軍・小早川水手長",
    "flag": "🇯🇵",
    "rp": 17924,
    "doc": "defense",
    "deck": [
      "YUKIMURA",
      "KATOKIYOMASA",
      "TORII",
      "MOURI_MOTO",
      "LUSU"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_64",
    "name": "薩摩示現・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 17340,
    "doc": "defense",
    "deck": [
      "KENSHIN",
      "TACHIBANAD",
      "HONDA_TADATSUGU",
      "MURAKAMI",
      "YAMAMOTO"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_65",
    "name": "戚家軍・龐統高足",
    "flag": "🇨🇳",
    "rp": 16721,
    "doc": "deception",
    "deck": [
      "ZHAOSHE",
      "DIANWEI",
      "HANSHIZHONG",
      "XUHUANG",
      "GUOJIA"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_66",
    "name": "平壤神射營・茂宣火砲監",
    "flag": "🇰🇷",
    "rp": 16079,
    "doc": "deception",
    "deck": [
      "ZHAOSHE",
      "YANGYE",
      "JUMONG",
      "JEONGJI",
      "PANGTONG"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_67",
    "name": "高麗別武班・權慄軍監",
    "flag": "🇰🇷",
    "rp": 15466,
    "doc": "defense",
    "deck": [
      "GAISUWEN",
      "YUJIN",
      "JUMONG",
      "MENGHUO",
      "YAMAMOTO"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_68",
    "name": "關寧鐵騎・白起偏將",
    "flag": "🇨🇳",
    "rp": 14904,
    "doc": "deception",
    "deck": [
      "CHENQINGZHI",
      "CAOREN",
      "ZONGZE",
      "YUEJIN",
      "LIUBOWEN"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_69",
    "name": "西涼鐵騎・龐統高足",
    "flag": "🇨🇳",
    "rp": 14155,
    "doc": "defense",
    "deck": [
      "LUBU",
      "YUEFEI",
      "FENGYI",
      "DINGFENG",
      "SUNWU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_70",
    "name": "花郎精銳・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 13557,
    "doc": "deception",
    "deck": [
      "GAISUWEN",
      "SHIBATA",
      "MATSUNAGA",
      "DINGFENG",
      "SUNWU"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_71",
    "name": "越前朝倉・正成門生",
    "flag": "🇯🇵",
    "rp": 12841,
    "doc": "deception",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "TORII",
      "MOURI_MOTO",
      "SANADAMASA"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_72",
    "name": "相模風魔・小早川水手長",
    "flag": "🇯🇵",
    "rp": 12135,
    "doc": "deception",
    "deck": [
      "TACHIBANA",
      "IINAOMASA",
      "HONDA_TADATSUGU",
      "KUKI",
      "KANBEI"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_73",
    "name": "西涼鐵騎・子龍部曲",
    "flag": "🇨🇳",
    "rp": 11397,
    "doc": "defense",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZHANGHE",
      "WEIYAN",
      "FAZHENG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_74",
    "name": "白頭突擊部隊・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 10832,
    "doc": "strike",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "CHOIMUSEON",
      "LUMENG",
      "YAMAMOTO"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_75",
    "name": "雜賀鐵砲眾・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 10084,
    "doc": "strike",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "ASAKURA_SOT",
      "MOURI_MOTO",
      "LUSU"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_76",
    "name": "背嵬軍・武穆親隨",
    "flag": "🇨🇳",
    "rp": 9356,
    "doc": "defense",
    "deck": [
      "XIAHOUYUAN",
      "DIANWEI",
      "ZHOUYAFU",
      "WEIYAN",
      "FAZHENG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_77",
    "name": "戚家軍・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 8890,
    "doc": "defense",
    "deck": [
      "GONGSUNDU",
      "XUCHU",
      "ZHANGHE",
      "YUYUNWEN",
      "FAZHENG"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_78",
    "name": "江東水師・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 8200,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZONGZE",
      "KUKI",
      "SUNWU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_79",
    "name": "毛利水軍・謙信旗手",
    "flag": "🇯🇵",
    "rp": 7754,
    "doc": "defense",
    "deck": [
      "DATE",
      "KATOKIYOMASA",
      "AKECHI",
      "MURAKAMI",
      "YAMAMOTO"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_80",
    "name": "嶽家軍・白起偏將",
    "flag": "🇨🇳",
    "rp": 7188,
    "doc": "defense",
    "deck": [
      "PANGDE",
      "ZHOUTAI",
      "LIGUANG",
      "WEIYAN",
      "SUNBIN"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_81",
    "name": "雜賀鐵砲眾・義經隨騎",
    "flag": "🇯🇵",
    "rp": 6639,
    "doc": "defense",
    "deck": [
      "TACHIBANA",
      "IINAOMASA",
      "TORII",
      "MURAKAMI",
      "SANADAMASA"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_82",
    "name": "戚家軍・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 6081,
    "doc": "strike",
    "deck": [
      "ZHAOSHE",
      "ZHOUTAI",
      "YANGYOUJI",
      "JANGPOGO",
      "LEYI"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_83",
    "name": "三河武士・幸村一番槍",
    "flag": "🇯🇵",
    "rp": 5426,
    "doc": "deception",
    "deck": [
      "DATE",
      "TACHIBANAD",
      "MATSUNAGA",
      "TOUDO",
      "SANADAMASA"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_84",
    "name": "大漢羽林・元遜帳下",
    "flag": "🇨🇳",
    "rp": 4832,
    "doc": "defense",
    "deck": [
      "ZHAOYUN",
      "XUCHU",
      "GENGYAN",
      "HUANGGAI",
      "YAMAMOTO"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_85",
    "name": "雜賀鐵砲眾・道雪刀客",
    "flag": "🇯🇵",
    "rp": 4230,
    "doc": "deception",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "MATSUNAGA",
      "HATTORI",
      "YAMAMOTO"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_86",
    "name": "關寧鐵騎・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 3767,
    "doc": "strike",
    "deck": [
      "LINGTONG",
      "WANGJIAN",
      "LIGUANG",
      "DINGFENG",
      "SUNWU"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_87",
    "name": "相模風魔・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 3209,
    "doc": "strike",
    "deck": [
      "YAMAGATA",
      "SHIMAZUY",
      "AKECHI",
      "TOUDO",
      "SHIMAZU_YOSHIHISA"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_88",
    "name": "白馬義從・幼常舊部",
    "flag": "🇨🇳",
    "rp": 2578,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "DIANWEI",
      "GENGYAN",
      "DINGFENG",
      "FAZHENG"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_89",
    "name": "虎豹騎・奉先健兒",
    "flag": "🇨🇳",
    "rp": 1994,
    "doc": "strike",
    "deck": [
      "ZHAOSHE",
      "ZHOUTAI",
      "ZONGZE",
      "WEIYAN",
      "XUNYU"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_90",
    "name": "背嵬軍・奉先健兒",
    "flag": "🇨🇳",
    "rp": 1420,
    "doc": "strike",
    "deck": [
      "PANGDE",
      "CAOREN",
      "YANGYOUJI",
      "XIEXUAN",
      "SUNBIN"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_91",
    "name": "陷陣營・奉先健兒",
    "flag": "🇨🇳",
    "rp": 698,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "DIANWEI",
      "YANGYOUJI",
      "XIEXUAN",
      "LEYI"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_92",
    "name": "南原忠義隊・成桂親軍",
    "flag": "🇰🇷",
    "rp": 146,
    "doc": "defense",
    "deck": [
      "MAEDATOSHI",
      "CAOREN",
      "YANGMANCHUN",
      "HUANGGAI",
      "WUQI"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_93",
    "name": "白毦兵・伯約近衛",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "HUO",
      "XUCHU",
      "GENGYAN",
      "XIEXUAN",
      "YAMAMOTO"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_94",
    "name": "嶽家軍・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "YANGYE",
      "GENGYAN",
      "LUMENG",
      "WUQI"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_95",
    "name": "立花雷神・義經隨騎",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "defense",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "ASAKURA_SOT",
      "HATTORI",
      "LUSU"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_96",
    "name": "毛利水軍・正成門生",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "YAMAGATA",
      "SHIBATA",
      "TORII",
      "WAKIZAKA",
      "SANADAMASA"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_97",
    "name": "立花雷神・義經隨騎",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "HONDA_TADATSUGU",
      "MURAKAMI",
      "LUSU"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_98",
    "name": "關寧鐵騎・龐統高足",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "strike",
    "deck": [
      "XIAHOUYUAN",
      "XUCHU",
      "ZHOUYAFU",
      "YUYUNWEN",
      "PANGTONG"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_99",
    "name": "三河武士・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "YUKIMURA",
      "HOJO_UJIYASU",
      "ASAKURA_SOT",
      "CAOBIN",
      "SHIMAZU_YOSHIHISA"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_100",
    "name": "真田赤備・信玄侍從",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "MATSUNAGA",
      "TOUDO",
      "SANADAMASA"
    ],
    "title": "十面埋伏天羅地網"
  }
];

if (typeof window !== 'undefined') {
  window.LADDER_RANKS = LADDER_RANKS;
  window.LADDER_PRESETS = LADDER_PRESETS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LADDER_RANKS, LADDER_PRESETS };
}
