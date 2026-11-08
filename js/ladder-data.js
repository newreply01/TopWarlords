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
      "XIAHOUYUAN",
      "MENGGONG",
      "LUSUARCH",
      "LIXU_V",
      "ZHUGELIANG"
    ],
    "title": "封狼居胥遠征打擊"
  },
  {
    "id": "bot_02",
    "name": "武安死士・長平陷陣軍",
    "flag": "🇨🇳",
    "rp": 53394,
    "doc": "strike",
    "deck": [
      "YUWENTAI",
      "XIANGYU",
      "ZONGZE",
      "DONGXI",
      "WEIXIAOKUAN"
    ],
    "title": "殺神威嚴破軍攻勢"
  },
  {
    "id": "bot_03",
    "name": "蜀漢精銳・諸葛八陣營",
    "flag": "🇨🇳",
    "rp": 52961,
    "doc": "strike",
    "deck": [
      "LINGTONG",
      "GUANYU",
      "HUANGZHONG",
      "ZHANGLIAO_V",
      "YUAN_STRAT"
    ],
    "title": "神機帷幄奇正聯防"
  },
  {
    "id": "bot_04",
    "name": "東吳水督・江表虎臣隊",
    "flag": "🇨🇳",
    "rp": 52271,
    "doc": "defense",
    "deck": [
      "YUWENTAI",
      "DIANWEI",
      "YUANCHONGHUAN",
      "ZHANGLIAO_V",
      "CHENGONG"
    ],
    "title": "赤壁赤焰水陸突襲"
  },
  {
    "id": "bot_05",
    "name": "甲斐赤備・風林火山",
    "flag": "🇯🇵",
    "rp": 51568,
    "doc": "deception",
    "deck": [
      "YAMAGATA",
      "HONDA",
      "TANEGASHIMA",
      "KUKI",
      "MASANOBU"
    ],
    "title": "武田騎兵奔雷撕裂"
  },
  {
    "id": "bot_06",
    "name": "越後軍神・毘沙門天",
    "flag": "🇯🇵",
    "rp": 50946,
    "doc": "defense",
    "deck": [
      "TACHIBANA",
      "SHIMAZUY",
      "SAIKA",
      "MOURI_V",
      "TAKAKAGE"
    ],
    "title": "車懸之陣正面決戰"
  },
  {
    "id": "bot_07",
    "name": "尾張鐵砲・天下布武",
    "flag": "🇯🇵",
    "rp": 50265,
    "doc": "deception",
    "deck": [
      "YOSHITSUNE",
      "SHIMAZUY",
      "KUNITOMO",
      "MOURI_V",
      "SESSAI"
    ],
    "title": "三段輪射火力重壁"
  },
  {
    "id": "bot_08",
    "name": "三韓忠武・鳴梁伏波",
    "flag": "🇰🇷",
    "rp": 49773,
    "doc": "defense",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "SHINRIP",
      "GWAKJAEWOO",
      "SEOHUI"
    ],
    "title": "板屋神龍鐵甲巡防"
  },
  {
    "id": "bot_09",
    "name": "高句麗雄師・薩水破陣",
    "flag": "🇰🇷",
    "rp": 49342,
    "doc": "strike",
    "deck": [
      "KIMYUSHIN",
      "GYEBAEK",
      "SINGIJEON",
      "JEONGJI",
      "RYUSEONGRYONG"
    ],
    "title": "乙支文德伏流奇計"
  },
  {
    "id": "bot_10",
    "name": "大唐天策・玄甲鐵騎",
    "flag": "🇨🇳",
    "rp": 48757,
    "doc": "strike",
    "deck": [
      "LISHIMIN",
      "MENGGONG",
      "ZONGZE",
      "MENGCHONG",
      "WEIXIAOKUAN"
    ],
    "title": "太宗親衛千里奔襲"
  },
  {
    "id": "bot_11",
    "name": "高麗別武班・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 48180,
    "doc": "deception",
    "deck": [
      "EULJI",
      "JEONGMUNBU",
      "CHOIMUSEON",
      "LEEOKGI",
      "JOHON"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_12",
    "name": "關寧鐵騎・子龍部曲",
    "flag": "🇨🇳",
    "rp": 47774,
    "doc": "deception",
    "deck": [
      "CHANGYUCHUN",
      "YUCHIGONG",
      "LUSUARCH",
      "DINGFENG",
      "WEIXIAOKUAN"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_13",
    "name": "耽羅水手・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 47282,
    "doc": "strike",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "CHOIMUSEON",
      "KWONJUN",
      "JOHON"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_14",
    "name": "雞林虎賁・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 46860,
    "doc": "deception",
    "deck": [
      "GAISUWEN",
      "GYEBAEK",
      "KOGURYOBOW",
      "JEONGJI",
      "JOHON"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_15",
    "name": "西涼鐵騎・白起偏將",
    "flag": "🇨🇳",
    "rp": 46226,
    "doc": "strike",
    "deck": [
      "ZHAOYUN",
      "GAOSHUN",
      "LUSUARCH",
      "XIANDENG",
      "ZHANGLIANG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_16",
    "name": "陷陣營・幼常舊部",
    "flag": "🇨🇳",
    "rp": 45683,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZONGZE",
      "WEIYAN",
      "WEIXIAOKUAN"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_17",
    "name": "高麗別武班・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 45122,
    "doc": "defense",
    "deck": [
      "ONDAL",
      "JEONGMUNBU",
      "JUKRIM",
      "YISUNSIN",
      "GANGGAMCHAN"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_18",
    "name": "花郎精銳・崔瑩健兒",
    "flag": "🇰🇷",
    "rp": 44420,
    "doc": "strike",
    "deck": [
      "KIMYUSHIN",
      "GYEBAEK",
      "KIMSIMIN",
      "JANGPOGO",
      "KORYO_CAT"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_19",
    "name": "朝鮮水軍・成桂親軍",
    "flag": "🇰🇷",
    "rp": 43818,
    "doc": "defense",
    "deck": [
      "KIMYUSHIN",
      "JEONGMUNBU",
      "SHINRIP",
      "JEONGJI",
      "JOHON"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_20",
    "name": "越前朝倉・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 43377,
    "doc": "strike",
    "deck": [
      "YAMAGATA",
      "SHIMAZUY",
      "INABA",
      "MOURI_V",
      "EKEI"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_21",
    "name": "義兵伏波隊・保皐水師先鋒",
    "flag": "🇰🇷",
    "rp": 42839,
    "doc": "strike",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "SHINRIP",
      "PANOKSEON",
      "JOHON"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_22",
    "name": "相模風魔・小早川水手長",
    "flag": "🇯🇵",
    "rp": 42310,
    "doc": "strike",
    "deck": [
      "YUKIMURA",
      "SHIMAZUY",
      "NEGORO",
      "KUKI",
      "NAOIE"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_23",
    "name": "江東水師・武穆親隨",
    "flag": "🇨🇳",
    "rp": 41651,
    "doc": "defense",
    "deck": [
      "CAOZHANG",
      "XUCHU",
      "YANYAN",
      "ZHANGLIAO_V",
      "LUSU"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_24",
    "name": "白馬義從・伯約近衛",
    "flag": "🇨🇳",
    "rp": 41236,
    "doc": "deception",
    "deck": [
      "LUBU",
      "YUJIN",
      "LUSUARCH",
      "MENGCHONG",
      "ZHANGLIANG"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_25",
    "name": "陷陣營・元遜帳下",
    "flag": "🇨🇳",
    "rp": 40633,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "DIANWEI",
      "ZHANGXUN",
      "ZHANGLIAO_V",
      "CHENGONG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_26",
    "name": "陷陣營・蒙恬後裔",
    "flag": "🇨🇳",
    "rp": 39909,
    "doc": "defense",
    "deck": [
      "CAOZHANG",
      "YUEFEI",
      "CHUBEE",
      "YANGSU",
      "FAZHENG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_27",
    "name": "陷陣營・龐統高足",
    "flag": "🇨🇳",
    "rp": 39209,
    "doc": "strike",
    "deck": [
      "ZHANGLIAO",
      "MENGTIAN",
      "LUSUARCH",
      "MENGCHONG",
      "PANGTONG"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_28",
    "name": "江東水師・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 38687,
    "doc": "defense",
    "deck": [
      "CAOCHUN",
      "GAOSHUN",
      "YANYAN",
      "ZHOUYU",
      "CHENGONG"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_29",
    "name": "九鬼水軍・道雪刀客",
    "flag": "🇯🇵",
    "rp": 38012,
    "doc": "strike",
    "deck": [
      "YOSHITSUNE",
      "IINAOMASA",
      "TANEGASHIMA",
      "HATTORI",
      "TAKAKAGE"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_30",
    "name": "西涼鐵騎・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 37588,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "YUCHIGONG",
      "SHENBI",
      "SHILANG",
      "WEIXIAOKUAN"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_31",
    "name": "長宗我部一領具足・義經隨騎",
    "flag": "🇯🇵",
    "rp": 37041,
    "doc": "deception",
    "deck": [
      "SHINGEN",
      "SHIMAZUY",
      "TANEGASHIMA",
      "FUMASUB",
      "SESSAI"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_32",
    "name": "朝鮮水軍・保皐水師先鋒",
    "flag": "🇰🇷",
    "rp": 36487,
    "doc": "defense",
    "deck": [
      "ONDAL",
      "CHOIYOUNG",
      "PARKJESANG",
      "LEEOKGI",
      "HOGAK_DRUM"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_33",
    "name": "虎豹騎・幼常舊部",
    "flag": "🇨🇳",
    "rp": 36071,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "YANGYE",
      "YANGYOUJI",
      "DONGXI",
      "PANGTONG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_34",
    "name": "南原忠義隊・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 35595,
    "doc": "defense",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "SINGIJEON",
      "PANOKSEON",
      "JOHON"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_35",
    "name": "漢山先鋒組・崔瑩健兒",
    "flag": "🇰🇷",
    "rp": 34935,
    "doc": "deception",
    "deck": [
      "EULJI",
      "GYEBAEK",
      "JUKRIM",
      "GWAKJAEWOO",
      "GANGGAMCHAN"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_36",
    "name": "白馬義從・白起偏將",
    "flag": "🇨🇳",
    "rp": 34418,
    "doc": "defense",
    "deck": [
      "ZHAOYUN",
      "DIQING",
      "CAOPICROSS",
      "HANSHIZHONG_V",
      "ZHUGUKE"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_37",
    "name": "花郎精銳・庾信花郎隊長",
    "flag": "🇰🇷",
    "rp": 33946,
    "doc": "strike",
    "deck": [
      "KIMYUSHIN",
      "JEONGMUNBU",
      "PARKJESANG",
      "MOKBAE",
      "SEOHUI"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_38",
    "name": "荊襄精銳・伯約近衛",
    "flag": "🇨🇳",
    "rp": 33470,
    "doc": "strike",
    "deck": [
      "GONGSUNDU",
      "QINSHUBAO",
      "ZONGZE",
      "DONGXI",
      "YUAN_STRAT"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_39",
    "name": "幽州突騎・奉先健兒",
    "flag": "🇨🇳",
    "rp": 32920,
    "doc": "deception",
    "deck": [
      "CAOCHUN",
      "GUOZIYI",
      "HUANGZHONG",
      "JIANGQIN",
      "LUXUN"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_40",
    "name": "朝鮮水軍・忠武公旗手",
    "flag": "🇰🇷",
    "rp": 32356,
    "doc": "defense",
    "deck": [
      "GAISUWEN",
      "JEONGMUNBU",
      "JUKRIM",
      "KWONJUN",
      "GANGGAMCHAN"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_41",
    "name": "薩摩示現・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 31722,
    "doc": "deception",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "NAGASHINO",
      "FUMASUB",
      "KANBEI"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_42",
    "name": "奧州黑脛巾・小早川水手長",
    "flag": "🇯🇵",
    "rp": 30993,
    "doc": "defense",
    "deck": [
      "YAMAGATA",
      "ONIKOJIMA",
      "TANEGASHIMA",
      "SHIMAZU_V",
      "KANBEI"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_43",
    "name": "神機營・幼常舊部",
    "flag": "🇨🇳",
    "rp": 30416,
    "doc": "strike",
    "deck": [
      "GONGSUNDU",
      "LANYU",
      "YUANCHONGHUAN",
      "SHILANG",
      "PANGTONG"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_44",
    "name": "江東水師・奉先健兒",
    "flag": "🇨🇳",
    "rp": 29864,
    "doc": "strike",
    "deck": [
      "LIXU",
      "MENGTIAN",
      "SHESHENG",
      "MENGCHONG",
      "XUNYU"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_45",
    "name": "相模風魔・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 29294,
    "doc": "strike",
    "deck": [
      "YUKIMURA",
      "SHIMAZUY",
      "TANEGASHIMA",
      "HATTORI",
      "SESSAI"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_46",
    "name": "白馬義從・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 28653,
    "doc": "deception",
    "deck": [
      "DENGAI",
      "XUCHU",
      "ZONGZE",
      "WANGJUN",
      "CHENGYU"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_47",
    "name": "立花雷神・小早川水手長",
    "flag": "🇯🇵",
    "rp": 27905,
    "doc": "strike",
    "deck": [
      "TACHIBANA",
      "TACHIBANAD",
      "SUZUKI",
      "HATTORI",
      "SANADAMASA"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_48",
    "name": "長宗我部一領具足・小早川水手長",
    "flag": "🇯🇵",
    "rp": 27247,
    "doc": "defense",
    "deck": [
      "TACHIBANA",
      "SHIMAZUY",
      "INABA",
      "YOSHITSUN_V",
      "SESSAI"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_49",
    "name": "神機營・武穆親隨",
    "flag": "🇨🇳",
    "rp": 26832,
    "doc": "defense",
    "deck": [
      "LINGTONG",
      "CAOREN",
      "LIGUANG",
      "HANSHIZHONG_V",
      "CHENGONG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_50",
    "name": "白馬義從・幼常舊部",
    "flag": "🇨🇳",
    "rp": 26095,
    "doc": "deception",
    "deck": [
      "XUETOU",
      "QINSHUBAO",
      "ZONGZE",
      "WEIYAN",
      "FAZHENG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_51",
    "name": "江東水師・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 25654,
    "doc": "strike",
    "deck": [
      "MACHO",
      "LIDIAN",
      "HANSHIZHONG",
      "LUMENG",
      "CHENGYU"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_52",
    "name": "毛利水軍・義經隨騎",
    "flag": "🇯🇵",
    "rp": 25036,
    "doc": "strike",
    "deck": [
      "YUKIMURA",
      "SHIMAZUY",
      "INABA",
      "FUMASUB",
      "NAOIE"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_53",
    "name": "并州飛將・龐統高足",
    "flag": "🇨🇳",
    "rp": 24555,
    "doc": "strike",
    "deck": [
      "XUETOU",
      "LANYU",
      "YUANCHONGHUAN",
      "WEIYAN",
      "SUNBIN"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_54",
    "name": "越前朝倉・小早川水手長",
    "flag": "🇯🇵",
    "rp": 24135,
    "doc": "deception",
    "deck": [
      "FUMA",
      "HONDA",
      "SUZUKI",
      "MOURI_V",
      "SESSAI"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_55",
    "name": "毛利水軍・義經隨騎",
    "flag": "🇯🇵",
    "rp": 23424,
    "doc": "defense",
    "deck": [
      "SHINGEN",
      "SHIMAZUY",
      "TANEGASHIMA",
      "MOURI_V",
      "NAOIE"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_56",
    "name": "毛利水軍・信長側近",
    "flag": "🇯🇵",
    "rp": 22961,
    "doc": "strike",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "SUZUKI",
      "SHIMAZU_V",
      "KOGA_SCOUT"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_57",
    "name": "九鬼水軍・小早川水手長",
    "flag": "🇯🇵",
    "rp": 22330,
    "doc": "defense",
    "deck": [
      "FUMA",
      "SHIBATA",
      "YOICHI",
      "KONISHI",
      "EKEI"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_58",
    "name": "嶽家軍・武穆親隨",
    "flag": "🇨🇳",
    "rp": 21912,
    "doc": "defense",
    "deck": [
      "HULU",
      "LIJING",
      "ZHANGHE",
      "MENGCHONG",
      "WEIXIAOKUAN"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_59",
    "name": "毛利水軍・小早川水手長",
    "flag": "🇯🇵",
    "rp": 21172,
    "doc": "defense",
    "deck": [
      "OBATA",
      "SHIBATA",
      "TANEGASHIMA",
      "MOURI_V",
      "MASASHIGE"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_60",
    "name": "奧州黑脛巾・信玄侍從",
    "flag": "🇯🇵",
    "rp": 20446,
    "doc": "deception",
    "deck": [
      "KENSHIN",
      "SHIMAZUY",
      "NOBUNAGA",
      "FUMASUB",
      "KOGA_SCOUT"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_61",
    "name": "戚家軍・子龍部曲",
    "flag": "🇨🇳",
    "rp": 19776,
    "doc": "defense",
    "deck": [
      "XUETOU",
      "XUCHU",
      "ZHANGXUN",
      "ZHANGLIAO_V",
      "CHENGONG"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_62",
    "name": "白頭突擊部隊・茂宣火砲監",
    "flag": "🇰🇷",
    "rp": 19050,
    "doc": "strike",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "PARKJESANG",
      "GWAKJAEWOO",
      "JOHON"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_63",
    "name": "義兵伏波隊・保皐水師先鋒",
    "flag": "🇰🇷",
    "rp": 18606,
    "doc": "strike",
    "deck": [
      "BAEKJEO",
      "CHOIYOUNG",
      "SINGIJEON",
      "LEEOKGI",
      "SEOHUI"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_64",
    "name": "白頭突擊部隊・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 18088,
    "doc": "strike",
    "deck": [
      "EULJI",
      "JEONGMUNBU",
      "CHOIMUSEON",
      "LEEOKGI",
      "RYUSEONGRYONG"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_65",
    "name": "九鬼水軍・幸村一番槍",
    "flag": "🇯🇵",
    "rp": 17427,
    "doc": "deception",
    "deck": [
      "KENSHIN",
      "SHIMAZUY",
      "NAGASHINO",
      "HATTORI",
      "NAOIE"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_66",
    "name": "并州飛將・元遜帳下",
    "flag": "🇨🇳",
    "rp": 16877,
    "doc": "strike",
    "deck": [
      "GONGSUNDU",
      "DIANWEI",
      "YANYAN",
      "WEIYAN",
      "CHENGONG"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_67",
    "name": "白毦兵・伯約近衛",
    "flag": "🇨🇳",
    "rp": 16396,
    "doc": "strike",
    "deck": [
      "YUWENTAI",
      "YANGYE",
      "ZONGZE",
      "YANGSU",
      "WUQI"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_68",
    "name": "立花雷神・信長側近",
    "flag": "🇯🇵",
    "rp": 15701,
    "doc": "strike",
    "deck": [
      "KEIJI",
      "SHIMAZUY",
      "SUZUKI",
      "HATTORI",
      "SANADAMASA"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_69",
    "name": "白毦兵・冠軍侯屬官",
    "flag": "🇨🇳",
    "rp": 15103,
    "doc": "strike",
    "deck": [
      "ZHANGLIAO",
      "LIANPO",
      "YUANCHONGHUAN",
      "HUANGGAI",
      "TIANDAN"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_70",
    "name": "越前朝倉・正成門生",
    "flag": "🇯🇵",
    "rp": 14669,
    "doc": "deception",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "SUZUKI",
      "MOURI_V",
      "TAKAKAGE"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_71",
    "name": "薩摩示現・信長側近",
    "flag": "🇯🇵",
    "rp": 13994,
    "doc": "strike",
    "deck": [
      "TACHIBANA",
      "KATOKIYOMASA",
      "INABA",
      "MOURI_V",
      "SESSAI"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_72",
    "name": "白頭突擊部隊・茂宣火砲監",
    "flag": "🇰🇷",
    "rp": 13293,
    "doc": "defense",
    "deck": [
      "KIMYUSHIN",
      "JEONGMUNBU",
      "YANGMANCHUN",
      "PANOKSEON",
      "JOHON"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_73",
    "name": "真田赤備・道雪刀客",
    "flag": "🇯🇵",
    "rp": 12856,
    "doc": "strike",
    "deck": [
      "YUKIMURA",
      "KANISAIZO",
      "TANEGASHIMA",
      "MURAKAMI",
      "MASASHIGE"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_74",
    "name": "幽州突騎・伯約近衛",
    "flag": "🇨🇳",
    "rp": 12125,
    "doc": "defense",
    "deck": [
      "WENPING",
      "ZHOUTAI",
      "ZHANGHE",
      "HANSHIZHONG_V",
      "PANGTONG"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_75",
    "name": "虎豹騎・周瑜傳令",
    "flag": "🇨🇳",
    "rp": 11434,
    "doc": "strike",
    "deck": [
      "CHENQINGZHI",
      "QINSHUBAO",
      "WENCHOU",
      "MENGCHONG",
      "PANGTONG"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_76",
    "name": "相模風魔・正成門生",
    "flag": "🇯🇵",
    "rp": 10938,
    "doc": "defense",
    "deck": [
      "DATE",
      "SHIMAZUY",
      "YOICHI",
      "KUMANO",
      "SANADAMASA"
    ],
    "title": "登高觀瞻精確校射"
  },
  {
    "id": "bot_77",
    "name": "平壤神射營・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 10254,
    "doc": "strike",
    "deck": [
      "EULJI",
      "JEONGMUNBU",
      "CHOIMUSEON",
      "PANOKSEON",
      "JOHON"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_78",
    "name": "嶽家軍・龐統高足",
    "flag": "🇨🇳",
    "rp": 9729,
    "doc": "strike",
    "deck": [
      "MACHO",
      "DIANWEI",
      "ZHANGHE",
      "DONGXI",
      "PANGTONG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_79",
    "name": "毛利水軍・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 9150,
    "doc": "strike",
    "deck": [
      "YAMAGATA",
      "SHIMAZUY",
      "SUZUKI",
      "HATTORI",
      "MASASHIGE"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_80",
    "name": "西涼鐵騎・白起偏將",
    "flag": "🇨🇳",
    "rp": 8579,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "ZHANGFEI",
      "YUANCHONGHUAN",
      "MENGCHONG",
      "PANGTONG"
    ],
    "title": "十面埋伏天羅地網"
  },
  {
    "id": "bot_81",
    "name": "花郎精銳・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 7902,
    "doc": "deception",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "KIMSIMIN",
      "LEEOKGI",
      "SEOHUI"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_82",
    "name": "關寧鐵騎・元遜帳下",
    "flag": "🇨🇳",
    "rp": 7393,
    "doc": "deception",
    "deck": [
      "GONGSUNDU",
      "QINSHUBAO",
      "XUERENARROW",
      "ZHUANZHU",
      "PANGTONG"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_83",
    "name": "白馬義從・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 6788,
    "doc": "deception",
    "deck": [
      "XUETOU",
      "DIANWEI",
      "YANYAN",
      "HANSHIZHONG_V",
      "PANGTONG"
    ],
    "title": "神射強弩封鎖全場"
  },
  {
    "id": "bot_84",
    "name": "長宗我部一領具足・幸村一番槍",
    "flag": "🇯🇵",
    "rp": 6310,
    "doc": "defense",
    "deck": [
      "OBATA",
      "TACHIBANAD",
      "NAGASHINO",
      "YOSHITSUN_V",
      "MASASHIGE"
    ],
    "title": "伏波龍骨水陸破暗"
  },
  {
    "id": "bot_85",
    "name": "江東水師・武穆親隨",
    "flag": "🇨🇳",
    "rp": 5815,
    "doc": "strike",
    "deck": [
      "CHANGYUCHUN",
      "XUDA",
      "YANYAN",
      "ZHANGLIAO_V",
      "CHENGYU"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_86",
    "name": "長宗我部一領具足・直政赤備督導",
    "flag": "🇯🇵",
    "rp": 5257,
    "doc": "strike",
    "deck": [
      "KENSHIN",
      "SHIMAZUY",
      "AKECHI",
      "KONISHI",
      "EKEI"
    ],
    "title": "奔雷突襲極致先手"
  },
  {
    "id": "bot_87",
    "name": "白馬義從・幼常舊部",
    "flag": "🇨🇳",
    "rp": 4626,
    "doc": "deception",
    "deck": [
      "CHANGYUCHUN",
      "DIANWEI",
      "LUSUARCH",
      "DINGFENG",
      "WEIXIAOKUAN"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_88",
    "name": "虎豹騎・奉先健兒",
    "flag": "🇨🇳",
    "rp": 4149,
    "doc": "strike",
    "deck": [
      "WENPING",
      "LANYU",
      "ZONGZE",
      "WEIYAN",
      "SUNBIN"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_89",
    "name": "高麗別武班・忠武公旗手",
    "flag": "🇰🇷",
    "rp": 3704,
    "doc": "defense",
    "deck": [
      "GAISUWEN",
      "GYEBAEK",
      "JUKRIM",
      "GWAKJAEWOO",
      "JOHON"
    ],
    "title": "先登奇兵暗夜刺殺"
  },
  {
    "id": "bot_90",
    "name": "奧州黑脛巾・道雪刀客",
    "flag": "🇯🇵",
    "rp": 3103,
    "doc": "deception",
    "deck": [
      "SHINGEN",
      "ONIKOJIMA",
      "TANEGASHIMA",
      "FUMASUB",
      "KANBEI"
    ],
    "title": "玄甲重盾正面死鬥"
  },
  {
    "id": "bot_91",
    "name": "越前朝倉・半藏副手",
    "flag": "🇯🇵",
    "rp": 2551,
    "doc": "strike",
    "deck": [
      "TACHIBANA",
      "TACHIBANAD",
      "NEGORO",
      "YOSHITSUN_V",
      "MASASHIGE"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_92",
    "name": "并州飛將・奉先健兒",
    "flag": "🇨🇳",
    "rp": 1897,
    "doc": "deception",
    "deck": [
      "PANGDE",
      "LANYU",
      "YANGYOUJI",
      "DINGFENG",
      "ZHANGLIANG"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_93",
    "name": "朝鮮水軍・姜邯贊麾下",
    "flag": "🇰🇷",
    "rp": 1259,
    "doc": "strike",
    "deck": [
      "EULJI",
      "CHOIYOUNG",
      "SHINRIP",
      "KWONJUN",
      "JOHON"
    ],
    "title": "重鎧陣線寸步不讓"
  },
  {
    "id": "bot_94",
    "name": "南原忠義隊・權慄軍監",
    "flag": "🇰🇷",
    "rp": 751,
    "doc": "defense",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "YANGMANCHUN",
      "LEEOKGI",
      "KIMJONGSEO"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_95",
    "name": "幽州突騎・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 176,
    "doc": "strike",
    "deck": [
      "XUETOU",
      "LIJING",
      "ZHANGXUN",
      "DINGFENG",
      "YUAN_STRAT"
    ],
    "title": "八陣帷幄奇謀致勝"
  },
  {
    "id": "bot_96",
    "name": "平壤神射營・文德行軍司馬",
    "flag": "🇰🇷",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "ONDAL",
      "GYEBAEK",
      "JUMONG",
      "GWAKJAEWOO",
      "RYUSEONGRYONG"
    ],
    "title": "步騎火砲協同合圍"
  },
  {
    "id": "bot_97",
    "name": "嶽家軍・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "CAOCHUN",
      "CAOREN",
      "HANSHIZHONG",
      "ZHENGCHENG",
      "CHENGONG"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_98",
    "name": "長宗我部一領具足・信長側近",
    "flag": "🇯🇵",
    "rp": 100,
    "doc": "deception",
    "deck": [
      "TACHIBANA",
      "TACHIBANAD",
      "KUNITOMO",
      "MURAKAMI",
      "MASASHIGE"
    ],
    "title": "多路並進漫天火矢"
  },
  {
    "id": "bot_99",
    "name": "背嵬軍・漢卿司馬",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "strike",
    "deck": [
      "DENGAI",
      "YUCHIGONG",
      "LIGUANG",
      "JINGKE",
      "FAZHENG"
    ],
    "title": "先制斬首千里破陣"
  },
  {
    "id": "bot_100",
    "name": "陷陣營・幼常舊部",
    "flag": "🇨🇳",
    "rp": 100,
    "doc": "strike",
    "deck": [
      "XUETOU",
      "YUCHIGONG",
      "YANYAN",
      "LIXU_V",
      "FAZHENG"
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
