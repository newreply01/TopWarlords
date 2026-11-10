'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords) — 資料層
   125 位日韓中歷史名將，依五大兵團與五階費用編制
   100% 具備專屬戰術特性、專屬兵器與獨立五維數值
   ===================================================== */
const BUDGET = 15;

const CATS = {
  air:         { label: '奔雷突騎', short: 'CAV', color: '#38bdf8' },
  armor:       { label: '重甲陷陣', short: 'ARM', color: '#fbbf24' },
  air_defense: { label: '神射強弩', short: 'ARC', color: '#a78bfa' },
  naval:       { label: '先登奇兵', short: 'VAN', color: '#22d3ee' },
  support:     { label: '軍師奇謀', short: 'STR', color: '#4ade80' }
};

/* 五大兵團專屬槽位 */
const SLOTS = [
  { id: 's1', label: '突騎槽', fixed: 'air' },
  { id: 's2', label: '重甲槽', fixed: 'armor' },
  { id: 's3', label: '神射槽', fixed: 'air_defense' },
  { id: 's4', label: '先登槽', fixed: 'naval' },
  { id: 's5', label: '軍師槽', fixed: 'support' }
];

const TRAITS = {
  CAS:     '側翼包抄：第三階段突擊敵方重甲傷害 ×1.8（一般部隊 ×1.15）',
  LR:      '馳馬遠射：突騎交鋒命中率 +6%',
  HEAVY:   '玄甲厚鎧：精銳重鎧防護（減傷 20%～28%）',
  APS:     '重盾格擋：大盾自動格擋敵軍第一次來襲的重擊',
  AA_LONG: '強弓遠射：神射強弩命中率 +8%',
  CIWS:    '近衛拒馬：敵方死士與連環火攻傷害減半',
  AEGIS:   '斷騎護陣：階段二可協同神射攔截敵方突騎（火力 55%）',
  SUB:     '潛行夜襲：隱匿極高；對未設防部隊傷害 ×1.3',
  ASW:     '看破反伏：專克潛行夜襲與忍者，傷害 ×1.6',
  AMBUSH:  '一番槍先登：對高費（+2 費以上）敵將傷害 ×1.25',
  SWARM:   '多路並進：同時攻擊兩個目標（單次傷害 ×0.6）',
  EW:      '運籌帷幄：謀略值領先越多，敵方命中最多 −15%、己方攻擊最多 +8%',
  SEAD:    '先制破陣：階段一先制打擊敵方神射箭陣',
  DEEP:    '十面埋伏：階段一直擊敵方最昂貴主帥核心',
  ARTY:    '攻城砲火：第三階段持續以投石火砲轟擊敵陣',
  SAT:     '箭雨覆蓋：同時攻擊兩個目標（單次傷害 ×0.75）',
  TRUE_AT: '破甲重擊：無視重鎧減傷（真實傷害），對重甲額外破防加成',
  SPOT:    '登高觀瞻：為友軍攻城器械與火砲提供校射，傷害 +15%'
};

/* [id, 名稱, 兵種, 費用, 風格, 稱號, 傳記, 隱匿, 謀略, 特性[], roleFlags[], HP, ATK, DEF] */
const RAW_UNITS = [
  ["HUO", "霍去病", 'air', 5, 'A', "封狼居胥·千里奔襲", "西漢傳奇驃騎將軍，開創大兵團長途奔襲與穿插包抄，六出塞外殲匈奴數萬，勇冠三軍。", 90, 20, ["LR", "CAS"], ["STAMINA_DEEP"], 230, 134, 0],
  ["WEI", "衛青", 'air', 4, 'B', "車騎並進·七戰七捷", "西漢大將軍大司馬，首創武剛車結陣與奇兵繞後突擊，收復河套，正面硬撼匈奴單于主力。", 72, 26, ["LR", "EW"], ["STAMINA_DEEP"], 204, 112, 0.04],
  ["LUBU", "呂布", 'air', 5, 'C', "人中呂布·馬中赤兔", "三國第一飛將，善騎射長驅破陣，率陷陣並州鐵騎正面踐踏敵陣，無人能擋。", 76, 12, ["LR", "CAS", "TRUE_AT"], ["HEAVY_AP"], 244, 140, 0.05],
  ["YOSHITSUNE", "源義經", 'air', 5, 'F', "鵯越絕壁·戰神逆落", "日本源平合戰第一戰神，率騎兵由陡峭絕壁一躍而下奇襲平氏大營，戰術機動性冠絕戰史。", 88, 24, ["LR", "CAS", "DEEP"], ["STAMINA_DEEP"], 226, 132, 0],
  ["SHINGEN", "武田信玄", 'air', 5, 'G', "甲斐之虎·風林火山", "戰國第一騎兵大師，建立威震列島之赤備騎兵軍團，動如雷霆正面摧垮敵陣。", 80, 28, ["LR", "EW"], ["STAMINA_DEEP"], 234, 128, 0.04],
  ["GAISUWEN", "淵蓋蘇文", 'air', 2, 'H', "身佩五刀·高句麗雄霸", "高句麗末期莫離支統帥，勇武過人善騎戰，身配五把飛刀飛馳衝殺，威震東北亞。", 48, 14, ["LR", "CAS", "TRUE_AT"], ["HEAVY_AP"], 128, 76, 0.02],
  ["ZHAOYUN", "趙雲", 'air', 4, 'A', "渾身是膽·七進七出", "蜀漢常山趙子龍，長坂坡單騎護主突破萬重重圍，漢水之戰大開營門空營退敵，百戰無傷。", 74, 18, ["LR", "CAS"], ["STAMINA_DEEP"], 204, 114, 0.03],
  ["MACHO", "馬超", 'air', 3, 'B', "錦馬超·西涼鐵騎突陣", "西涼名門之後，統帥善長矛重甲之涼州羌胡精騎，渭水之戰一度迫使曹操割鬚棄袍。", 58, 12, ["LR", "CAS"], ["HEAVY_AP"], 164, 96, 0.02],
  ["ZHANGLIAO", "張遼", 'air', 3, 'C', "逍遙津突襲·威震江東", "曹魏五子良將之首，親率八百壯士直衝十萬東吳中軍大旗，名震天下、江東小兒不敢夜啼。", 62, 18, ["LR", "TRUE_AT"], ["STAMINA_DEEP"], 166, 94, 0.02],
  ["CHENQINGZHI", "陳慶之", 'air', 4, 'E', "白袍神兵·名師莫敢前", "南梁名將，率七千白袍精騎深入敵境十四月，歷四十七戰拔三十二城，所向皆靡。", 76, 28, ["LR", "CAS", "EW"], ["STAMINA_DEEP"], 198, 112, 0.02],
  ["KENSHIN", "上杉謙信", 'air', 5, 'F', "越後之龍·車懸奔流", "戰國軍神，以毘沙門天為旗，獨創「車懸之陣」由騎兵輪番交替衝陣，川中島直斬敵帥。", 82, 24, ["LR", "CAS", "SAT"], ["STAMINA_DEEP"], 232, 134, 0.03],
  ["YUKIMURA", "真田幸村", 'air', 4, 'G', "日本第一兵·直衝本陣", "戰國末期傳奇猛將，大阪夏之陣率赤備突擊三次直撞德川家康本陣大旗，英烈千古。", 72, 18, ["LR", "CAS", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 200, 116, 0.02],
  ["KIMYUSHIN", "金庾信", 'air', 2, 'H', "新羅太大角干·風火神騎", "新羅名將興武大王，率精銳騎兵連戰連捷擊破百濟與高句麗，完成三國統一之宏業。", 44, 18, ["LR", "EW"], ["STAMINA_DEEP"], 128, 72, 0.02],
  ["SUNCE", "孫策", 'air', 3, 'I', "小霸王·席捲江東", "東漢末年名將，承父志率軍渡江，迅速平定江東多郡，為孫吳政權奠定根基。", 58, 16, ["LR", "CAS"], ["STAMINA_DEEP"], 162, 94, 0.03],
  ["DENGAI", "鄧艾", 'air', 3, 'A', "涉險越嶺·陰平天降", "曹魏名將，裹氈自山崖滾下行無人之地七百里，神速奇兵直取成都滅蜀。", 64, 24, ["DEEP", "LR", "EW"], ["STAMINA_DEEP"], 160, 90, 0.02],
  ["XIAHOUYUAN", "夏侯淵", 'air', 2, 'B', "虎步關右·三日五百", "曹魏名將，善於極速奔襲調動部隊，「典軍校尉夏侯淵，三日五百，六日一千」。", 48, 12, ["CAS", "LR"], [], 128, 74, 0],
  ["GONGSUNDU", "公孫瓚", 'air', 1, 'C', "白馬義從·塞外破胡", "幽州霸主，親自挑選百步穿楊之騎射勇士組建「白馬義從」，追殺胡虜威震塞北。", 34, 10, ["LR", "TRUE_AT"], [], 98, 54, 0],
  ["DATE", "伊達政宗", 'air', 3, 'F', "獨眼龍·騎鐵先驅", "奧羽霸主，創立裝備火繩槍與重甲之「騎馬鐵砲隊」，兼具機動性與毀滅齊射。", 58, 20, ["EW", "LR", "CAS"], ["STAMINA_DEEP"], 160, 92, 0.02],
  ["EULJI", "乙支文德", 'air', 1, 'H', "神算佯敗·薩水奇襲", "高句麗名將，以退為進示弱誘隋軍三十萬深入，於薩水截水突擊斬殺殆盡。", 36, 20, ["EW", "LR"], [], 98, 54, 0],
  ["LINGTONG", "凌統", 'air', 1, 'B', "國士先鋒·親率死戰", "東吳名將，每戰皆身先士卒作為銳鋒，合肥之戰親率三百突騎捨命救孫權。", 32, 10, ["CAS", "TRUE_AT"], [], 96, 54, 0],
  ["YAMAGATA", "山縣昌景", 'air', 2, 'F', "赤備猛將·長驅衝鋒", "武田四天王之首，身穿鮮紅鎧甲之赤備隊衝入敵陣，威名震懾織田德川聯軍。", 46, 12, ["CAS", "LR"], [], 128, 74, 0.02],
  ["TACHIBANA", "立花宗茂", 'air', 4, 'G', "西國無雙·勇猛無匹", "九州戰神，被豐臣秀吉譽為「西國無雙」，無論野戰突擊或固守皆勇烈超群。", 70, 18, ["LR", "CAS", "TRUE_AT"], ["STAMINA_DEEP"], 202, 114, 0.03],
  ["ZHAOSHE", "趙奢", 'air', 2, 'H', "狹路相逢·馬服奔馳", "戰國名將馬服君，以「狹路相逢勇者勝」之膽魄千里疾馳救援閼與，出其不意大破秦軍主力。", 46, 20, ["LR", "CAS"], [], 126, 72, 0],
  ["PANGDE", "龐德", 'air', 1, 'A', "抬櫬出陣·白馬射關", "曹魏勇將，抬棺出征誓死死戰，樊城陣前一箭正中關羽前額。", 28, 8, ["CAS", "TRUE_AT"], [], 100, 56, 0.02],
  ["MAEDATOSHI", "前田利家", 'air', 1, 'H', "槍之又左·赤母衣突擊", "戰國著名猛將，織田信長親兵赤母衣眾筆頭，勇冠三軍，以超絕騎槍技術開創加賀百萬石祖業。", 34, 12, ["LR", "CAS"], [], 98, 56, 0],
  ["BAIQI", "白起", 'armor', 5, 'A', "武安君·長平殲滅", "戰國四大名將之首，善打殲滅戰，伊闕斬首二十四萬、長平合圍坑趙軍四十五萬，攻無不克。", 10, 18, ["APS", "HEAVY"], ["STAMINA_DEEP"], 365, 124, 0.28],
  ["XIANGYU", "項羽", 'armor', 5, 'B', "霸王破釜·以一當百", "西楚霸王，千古無二之勇力，鉅鹿之戰破釜沉舟九戰九捷擊潰秦軍主力二十萬。", 12, 10, ["APS", "TRUE_AT"], ["HEAVY_AP"], 364, 136, 0.26],
  ["YUEFEI", "岳飛", 'armor', 5, 'C', "撼山易·撼岳家軍難", "南宋民族英雄，創建紀律森嚴之岳家軍，朱仙鎮以麻札刀大破金兀朮拐子馬鐵浮屠。", 12, 24, ["APS", "HEAVY", "EW"], ["STAMINA_DEEP"], 364, 124, 0.28],
  ["WANGJIAN", "王翦", 'armor', 4, 'D', "秦滅六國·穩若泰山", "秦代統帥，以沉穩堅壁著稱，率六十萬秦軍重步大陣相持整年，終滅強楚統一天下。", 10, 22, ["APS", "HEAVY"], ["STAMINA_DEEP"], 306, 98, 0.28],
  ["HONDA", "本多忠勝", 'armor', 5, 'F', "戰國第一槍·五十七戰無傷", "德川四天王之首，一生經歷大小五十七次激烈合戰，未曾受過刀箭之傷，被譽為花實兼備之勇將。", 12, 14, ["APS", "HEAVY", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 360, 130, 0.28],
  ["SHIBATA", "柴田勝家", 'armor', 3, 'G', "破瓶柴田·萬夫莫當", "織田家首席猛將，圍城時砸碎飲水瓶背水一戰大破敵軍，重甲長槍衝鋒所向披靡。", 10, 10, ["APS", "TRUE_AT", "HEAVY"], ["HEAVY_AP"], 252, 90, 0.24],
  ["LIANPO", "廉頗", 'armor', 4, 'A', "負荊善守·長平堅壁", "戰國名將，築固若金湯之重壘固守三年拒強秦，老驥伏櫪志在千里。", 10, 16, ["APS", "HEAVY"], ["STAMINA_DEEP"], 304, 98, 0.28],
  ["MENGTIAN", "蒙恬", 'armor', 3, 'B', "中華第一勇·築長城禦胡", "秦代大將，率三十萬重步大軍北逐匈奴，收復河南地，修築萬里長城。", 10, 16, ["APS", "HEAVY"], ["STAMINA_DEEP"], 254, 86, 0.26],
  ["GUANYU", "關羽", 'armor', 5, 'C', "威震華夏·萬人敵重將", "漢末名將，水淹七軍擒于禁斬龐德威震華夏，白馬坡斬顏良解白馬之圍。", 14, 18, ["APS", "TRUE_AT", "HEAVY"], ["HEAVY_AP"], 358, 132, 0.26],
  ["ZHANGFEI", "張飛", 'armor', 4, 'D', "據水斷橋·萬人敵猛張飛", "漢末勇將，長坂坡據水斷橋瞋目橫矛大喝退曹軍，葭萌關夜戰力挫張郃。", 10, 10, ["HEAVY", "TRUE_AT"], ["HEAVY_AP"], 298, 108, 0.24],
  ["HOJO_UJIYASU", "北條氏康", 'armor', 3, 'E', "相模之獅·小田原堅守", "後北條氏第三代當主，長期經營相模與關東，於河越合戰等戰事展現防衛與統率能力。", 12, 18, ["HEAVY", "APS"], ["STAMINA_DEEP"], 254, 84, 0.26],
  ["XIAHOU_DUN", "夏侯惇", 'armor', 3, 'F', "魏之元勳·親冒矢石", "曹魏重要將領與宗室重臣，長期參與曹操征戰並任前線統帥，以忠勇和治軍著稱。", 10, 12, ["HEAVY", "TRUE_AT"], ["HEAVY_AP"], 250, 88, 0.24],
  ["TACHIBANAD", "立花道雪", 'armor', 3, 'G', "雷神化身·斬雷鐵壁", "九州大名，傳說曾拔刀斬雷身患腿疾，坐轎指揮重甲步陣數十年未嘗一敗。", 10, 18, ["APS", "HEAVY"], ["STAMINA_DEEP"], 250, 86, 0.25],
  ["CHOIYOUNG", "崔瑩", 'armor', 2, 'H', "黃金如石·高麗柱石", "高麗末期名將，「視黃金如爛泥」，歷經百戰擊潰倭寇與紅巾軍，一生剛毅不屈。", 10, 14, ["APS", "HEAVY", "TRUE_AT"], [], 210, 68, 0.24],
  ["DIANWEI", "典韋", 'armor', 2, 'A', "古之惡來·重雙鐵戟", "曹操親隨猛將，勇力過人力抗大旗，宛城之戰手提雙鐵戟堵塞營門力戰至死。", 8, 6, ["HEAVY", "TRUE_AT"], ["HEAVY_AP"], 210, 72, 0.23],
  ["XUCHU", "許褚", 'armor', 1, 'B', "虎癡勇悍·倒拖雙牛", "曹魏宿衛名將，勇冠三軍倒拖雙牛，潼關之戰保護曹操渡河身中重箭不退。", 8, 4, ["HEAVY", "TRUE_AT"], [], 172, 54, 0.23],
  ["SHIMAZUY", "島津義弘", 'armor', 4, 'G', "鬼石曼子·重甲死戰", "薩摩軍神，關原之戰直面十萬東軍重重包圍，率重甲死士正面突破斬開生路。", 14, 14, ["HEAVY", "TRUE_AT", "APS"], ["HEAVY_AP"], 296, 106, 0.25],
  ["SUNJIAN", "孫堅", 'armor', 4, 'I', "江東猛虎·破董先鋒", "東漢末年名將，討伐董卓時率軍屢挫強敵，攻入洛陽並取得傳國玉璽，以勇烈聞名。", 12, 12, ["HEAVY", "TRUE_AT"], ["HEAVY_AP"], 296, 106, 0.24],
  ["GYEBAEK", "階伯", 'armor', 1, 'H', "黃山伐決死·五千烈士", "百濟最後將領，以五千重步死士迎戰金庾信五萬新羅大軍，四戰四捷壯烈殉國。", 8, 6, ["HEAVY"], [], 168, 50, 0.23],
  ["YANGYE", "楊業", 'armor', 2, 'B', "金刀楊無敵·雁門破遼", "北宋名將，雁門關大捷斬遼國節度使，陳家谷身中數十箭力竭被俘不食而死。", 10, 14, ["HEAVY", "APS", "TRUE_AT"], [], 208, 68, 0.24],
  ["CAOREN", "曹仁", 'armor', 2, 'C', "鐵壁天人·固守樊城", "曹魏第一防守大將，濡須與樊城數次面對絕境堅壁抗敵，被曹操譽為「天人之勇」。", 8, 16, ["HEAVY", "APS"], ["STAMINA_DEEP"], 212, 64, 0.26],
  ["ZHOUTAI", "周泰", 'armor', 1, 'D', "滿身傷疤·身如鐵石", "東吳猛將，宣城之戰以身代盾護衛孫權，身上傷口幾十處皮膚如刻畫。", 8, 4, ["HEAVY", "TRUE_AT"], [], 170, 52, 0.22],
  ["IINAOMASA", "井伊直政", 'armor', 2, 'F', "井伊赤鬼·赤備先鋒", "德川四天王之一，身披赤紅厚甲勇猛善戰，長篠與關原奮勇作戰負傷不退。", 12, 10, ["APS", "HEAVY", "TRUE_AT"], [], 206, 68, 0.23],
  ["KATOKIYOMASA", "加藤清正", 'armor', 1, 'G', "賤岳七本槍·築城重將", "豐臣家猛將，朝鮮之役建立蔚山倭城抗明聯軍，手使片鎌槍防禦極堅。", 8, 8, ["HEAVY", "APS"], [], 170, 52, 0.23],
  ["YUJIN", "于禁", 'armor', 1, 'A', "毅重治軍·持節抗敵", "曹魏五子良將，行軍治軍最為威嚴沉穩，逢難必爭死守營陣。", 8, 14, ["HEAVY", "APS"], [], 170, 50, 0.24],
  ["LIGUANG", "李廣", 'air_defense', 5, 'A', "漢之飛將·射石沒羽", "西漢名將，射術通神，「林暗草驚風，將軍夜引弓；平明尋白羽，沒在石稜中」。", 18, 22, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 256, 132, 0.06],
  ["YANGYOUJI", "養由基", 'air_defense', 5, 'B', "百步穿楊·一矢斃命", "春秋楚國神射手，百步之外射楊柳葉百發百中，一箭能穿透七層重鎧。", 18, 20, ["AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 252, 136, 0.08],
  ["NOBUNAGA", "織田信長", 'air_defense', 5, 'D', "長篠三段·鐵砲破雷", "天下布武織田信長，長篠合戰集結三千火繩槍以三段輪射粉碎武田勝賴赤備騎兵。", 16, 28, ["AA_LONG", "EW", "TRUE_AT"], ["FORMATION_SHIELD"], 250, 132, 0.06],
  ["YOICHI", "那須與一", 'air_defense', 4, 'E', "扇之的·神弓定浪", "日本源平名射手，屋島合戰波濤洶湧中一箭射中搖晃戰船上的紅底金箔紅扇。", 18, 16, ["AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 198, 106, 0.04],
  ["JUMONG", "朱蒙", 'air_defense', 5, 'F', "東明神王·百發百中", "高句麗開國神王，因善射被尊稱「朱蒙」（善射者之意），騎射功夫通神。", 18, 22, ["AA_LONG", "CIWS", "TRUE_AT"], ["PASSIVE_VOLLEY"], 252, 130, 0.06],
  ["HUANGZHONG", "黃忠", 'air_defense', 4, 'A', "老當益壯·定軍神弦", "蜀漢五虎上將，百步穿楊弦無虛發，定軍山策馬衝鋒陣斬曹魏主帥夏侯淵。", 14, 14, ["AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 204, 108, 0.05],
  ["TAISHICI", "太史慈", 'air_defense', 3, 'B', "猿臂善射·搴旗斬將", "東吳名將，長於射術箭無虛發，城樓之上將反叛者之手一箭釘於城樓護木。", 14, 12, ["CIWS", "AA_LONG", "TRUE_AT"], [], 166, 88, 0.06],
  ["HANSHIZHONG", "韓世忠", 'air_defense', 4, 'C', "克敵神弓·大破鐵浮", "南宋名將，創「克敵弓」射程達數百步可貫雙甲，大破金兵連環鐵騎。", 14, 20, ["AA_LONG", "TRUE_AT"], [], 204, 104, 0.06],
  ["LIMU", "李牧", 'air_defense', 5, 'E', "破胡武安·萬矢連環", "戰國四大名將，以神射弓弩與車陣大破匈奴十餘萬騎，肥之戰與番吾之戰兩挫強秦，戰功卓絕。", 20, 34, ["AA_LONG", "CIWS", "SAT"], ["PASSIVE_VOLLEY"], 258, 132, 0.08],
  ["AKECHI", "明智光秀", 'air_defense', 3, 'E', "鐵砲名手·本能寺雷火", "戰國智勇名將，精通鐵砲連射戰法，曾於浪人時期以一槍百步穿錢名揚天下。", 18, 22, ["SAT", "AA_LONG"], [], 162, 86, 0.04],
  ["SAIKA", "雜賀孫市", 'air_defense', 3, 'F', "紀伊鐵砲·八咫烏之王", "雜賀眾首領鈴木重秀，率鐵砲傭兵重創織田信長大軍，火器游擊戰之宗師。", 20, 16, ["CIWS", "AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 162, 88, 0.04],
  ["YANGMANCHUN", "楊萬春", 'air_defense', 2, 'G', "安市神弓·射退太宗", "高句麗安市城城主，堅守城池數月，據傳於城頭開硬弓射傷敵方先鋒。", 14, 14, ["CIWS", "AA_LONG"], [], 132, 68, 0.06],
  ["HULUGUANG", "斛律光", 'air_defense', 4, 'H', "落雕都督·百步穿石", "北齊軍事支柱，號「落雕都督」，神射天下第一，臨陣射箭無不應弦而倒，生平百戰未嘗一敗。", 16, 24, ["AA_LONG", "CIWS", "TRUE_AT"], [], 202, 106, 0.06],
  ["ZHANGHE", "張郃", 'air_defense', 3, 'A', "木門伏射·巧變良將", "曹魏五子良將，擅於利用地形設伏，街亭一戰斷蜀軍水源大破馬謖。", 22, 20, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 166, 86, 0.06],
  ["ZHOUYAFU", "周亞夫", 'air_defense', 4, 'C', "細柳嚴軍·強弩堅陣", "西漢名將條侯，細柳營號令嚴整「軍中聞將軍令不聞天子之詔」，平定七國之亂箭陣固若金湯。", 16, 30, ["AA_LONG", "CIWS", "EW"], ["FORMATION_SHIELD"], 206, 102, 0.08],
  ["ZONGZE", "宗澤", 'air_defense', 2, 'D', "汴京連弩·過河名將", "南宋初年抗金名臣，重整東京汴京城防，築連弩箭樓二十餘座阻截金騎。", 14, 20, ["AA_LONG", "CIWS"], [], 134, 66, 0.06],
  ["TORII", "鳥居元忠", 'air_defense', 1, 'E', "三河武士·伏見鐵砲血戰", "德川忠臣，伏見城以少數守軍搭配鐵砲長弓死守半月，拖住西軍四萬主力，壯烈殉節。", 12, 14, ["AA_LONG", "CIWS"], [], 104, 50, 0.06],
  ["CHOIMUSEON", "崔茂宣", 'air_defense', 1, 'G', "高麗火砲之父·鎮海轟雷", "高麗科學家兼將領，首次自製火藥，並創立走火砲與神機箭破除倭寇。", 16, 18, ["CIWS", "AA_LONG", "SAT"], [], 102, 52, 0.04],
  ["GENGYAN", "耿弇", 'air_defense', 2, 'A', "雲台神將·圍城破援", "東漢雲台二十八將第四，連下四十六郡，精通強弩大陣與圍城打援，光武帝譽其戰功可比韓信。", 16, 20, ["AA_LONG", "CIWS"], [], 132, 68, 0.05],
  ["PANGJUAN", "龐涓", 'support', 1, 'B', "魏武上將·馬陵伏誅", "戰國魏國大將軍，統帥魏武卒征戰諸侯，與孫臏交鋒於桂陵、馬陵，最終中伏敗亡。", 16, 38, ["EW", "DEEP"], ["STRATEGIST"], 106, 56, 0.04],
  ["FENGYI", "馮異", 'air_defense', 2, 'C', "大樹將軍·巧設強弩", "東漢開國名將大樹將軍，善於以險阻地形設伏弩大陣，崤底之戰大破赤眉主力。", 18, 22, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 132, 66, 0.06],
  ["ASAKURA_SOT", "朝倉宗滴", 'air_defense', 2, 'E', "越前軍神·鐵砲先驅", "越前朝倉家軍事支柱，九頭龍川大破三十萬一揆，晚年率先在實戰中裝備火繩槍連連告捷。", 14, 22, ["AA_LONG", "CIWS"], [], 130, 68, 0.04],
  ["MATSUNAGA", "松永久秀", 'air_defense', 1, 'F', "亂世梟雄·火藥大陣", "戰國梟雄，最早在戰場大規模部署鐵砲與火藥炸裂戰術之大名，智勇機敏。", 16, 18, ["AA_LONG", "SAT"], [], 98, 52, 0],
  ["TANDAOJI", "檀道濟", 'air_defense', 3, 'B', "唱籌量沙·強弩退魏", "劉宋第一名將，唱籌量沙以退敵兵，以強弩大陣壓制北魏鐵騎，自豪「毀汝萬里長城」。", 18, 26, ["AA_LONG", "CIWS", "EW"], [], 168, 84, 0.06],
  ["KUANGZHANG", "匡章", 'air_defense', 1, 'D', "齊國元戎·垂沙破楚", "戰國齊國名將，統帥齊國萬弩之陣五國伐秦攻破函谷關，垂沙之役大破楚軍，威震列國。", 14, 18, ["AA_LONG", "SAT"], [], 102, 52, 0.04],
  ["HONDA_TADATSUGU", "本多忠次", 'air_defense', 1, 'F', "鐵砲先鋒·三河老將", "德川家老將，本多忠勝之叔父，長篠之戰指揮三河足輕鐵砲輪射立下首功。", 14, 14, ["AA_LONG", "CIWS"], [], 100, 48, 0.02],
  ["ZHOUYU", "周瑜", 'support', 3, 'A', "雅量江東·赤壁連環火", "東吳大都督，精研水戰與火攻奇策，赤壁之戰以少勝多一把大火焚盡曹軍樓船水寨。", 24, 64, ["EW", "DEEP"], ["STRATEGIST", "FORMATION_SHIELD"], 158, 88, 0.04],
  ["YISUNSIN", "李舜臣", 'naval', 5, 'D', "忠武公·鳴梁神話龜船", "朝鮮海神，創制鐵甲覆頂之「龜甲船」，於鳴梁海峽以十二艘板屋船大破敵艦百餘艘。", 84, 24, ["SUB", "DEEP", "ASW"], ["STAMINA_DEEP"], 350, 132, 0.14],
  ["KUKI", "九鬼嘉隆", 'naval', 4, 'E', "海賊大名·鐵甲船破水", "織田家水軍統帥，建造外覆鐵皮以防箭火之巨型「鐵甲船」，第二次木津川口之戰大勝毛利水軍。", 32, 20, ["AEGIS", "ASW", "TRUE_AT"], ["STAMINA_DEEP"], 284, 108, 0.14],
  ["CHOSOKABE", "長宗我部元親", 'naval', 3, 'F', "土佐之蝠·一領具足", "四國霸主，創立水陸兩棲「一領具足」強襲軍團，橫掃四國，海陸突襲所向披靡。", 40, 22, ["AMBUSH", "SUB"], ["STAMINA_DEEP"], 222, 88, 0.1],
  ["JANGPOGO", "張保皐", 'naval', 3, 'H', "清海鎮霸·東亞海王", "新羅海上霸主，於清海鎮築城建立海上貿易與強大海軍，肅清黃海海盜。", 32, 24, ["AEGIS", "ASW"], ["STAMINA_DEEP"], 224, 86, 0.12],
  ["LUMENG", "呂蒙", 'naval', 5, 'A', "白衣渡江·神速襲南郡", "東吳大都督，精妙偽裝商船「白衣渡江」無聲奪取烽火台，襲取荊州擒殺關羽。", 86, 32, ["SUB", "DEEP", "EW"], ["STAMINA_DEEP"], 346, 126, 0.12],
  ["GANNING", "甘寧", 'naval', 5, 'B', "百騎夜襲·錦帆鈴聲", "東吳猛將，頭插鳥羽腰繫銅鈴，濡須之戰親率百名死士夜襲曹操四十萬大營全身而退。", 64, 18, ["ASW", "AMBUSH", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 348, 134, 0.12],
  ["HUANGGAI", "黃蓋", 'naval', 3, 'C', "苦肉火船·赤壁烈焰", "東吳老將，行苦肉計駕十艘滿載膏油柴草之艨艟火船直撞曹軍連環巨艦。", 46, 20, ["AMBUSH", "SWARM"], [], 220, 86, 0.1],
  ["JIANGWEI", "姜維", 'naval', 4, 'D', "天水麒麟·九伐奇謀", "蜀漢大將軍，諸葛亮親傳弟子，智勇雙全，善出奇兵險道穿插隴右九伐中原，劍閣據險挫敵十萬。", 42, 34, ["EW", "AMBUSH", "TRUE_AT"], ["STAMINA_DEEP"], 278, 108, 0.12],
  ["MURAKAMI", "村上武吉", 'naval', 2, 'G', "能島水軍·焙烙玉焚艦", "瀨戶內海霸主村上水軍統帥，善用陶罐投擲炸藥「焙烙玉」焚毀敵艦。", 42, 16, ["ASW", "AMBUSH", "SWARM"], [], 172, 72, 0.08],
  ["XIEXUAN", "謝玄", 'naval', 5, 'A', "北府都督·淝水奇捷", "東晉北府兵創立者，淝水之戰以八萬北府水陸奇兵過河突擊，大破前秦八十萬大軍。", 48, 34, ["AMBUSH", "ASW", "EW"], ["STAMINA_DEEP"], 354, 130, 0.14],
  ["YUYUNWEN", "虞允文", 'naval', 1, 'C', "采石折衝·書生大捷", "南宋名臣，采石磯戰役臨危督師，指揮樓船水軍以海鰍船水陸火攻大破完顏亮六十萬金軍。", 24, 22, ["EW", "ASW"], [], 116, 48, 0.06],
  ["WEIYAN", "魏延", 'naval', 4, 'C', "子午奇略·勇略先登", "蜀漢猛將，長年鎮守漢中金湯不失，常請精兵五千出子午谷直撲長安。", 50, 18, ["AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 280, 112, 0.12],
  ["MOURI_MOTO", "毛利元就", 'naval', 4, 'E', "西國謀神·嚴島水陸奇襲", "日本戰國第一智將，嚴島之戰暴風雨夜水陸奇襲陶晴賢兩萬大軍，三矢之訓一統中國地方。", 48, 36, ["SUB", "AMBUSH", "EW"], ["STAMINA_DEEP"], 272, 104, 0.1],
  ["HATTORI", "服部半藏", 'naval', 4, 'F', "鬼半藏·伊賀忍軍統領", "德川家康麾下伊賀忍者統領，擅於潛入、暗殺、情報蒐集與陣前開道。", 86, 20, ["SUB", "AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 264, 114, 0.08],
  ["JEONGJI", "鄭地", 'naval', 2, 'G', "鎮浦火砲·水師斬寇", "高麗水軍將領，於鎮浦海戰首創以艦載火砲轟碎倭寇五百餘艘戰船。", 28, 16, ["AEGIS", "ASW"], [], 174, 68, 0.1],
  ["YUEJIN", "樂進", 'naval', 3, 'A', "五子良將·每戰先登", "曹魏五子良將，容貌短小而膽勇過人，從征官渡、烏桓、合肥，每戰必先登陷陣斬將搴旗。", 32, 18, ["AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 224, 90, 0.12],
  ["MENGHUO", "孟獲", 'naval', 1, 'B', "南中夷王·象甲藤兵", "南中蠻夷各部大姓渠帥，聚南中各洞勇士以生藤重甲與象兵據險固守，山川泥沼間赤身跳蕩突擊。", 45, 10, ["AMBUSH", "SUB"], ["STAMINA_DEEP"], 124, 56, 0.08],
  ["DINGFENG", "丁奉", 'naval', 3, 'C', "雪中奮短兵·東興破敵", "東吳晚期名將，東興之戰率三千敢死隊頂風冒雪脫去兜鍪短兵突入魏軍。", 48, 18, ["AMBUSH", "TRUE_AT"], [], 220, 88, 0.1],
  ["XUHUANG", "徐晃", 'naval', 5, 'D', "長驅直入·聲東破陣", "曹魏五子良將，樊城之戰聲東擊西長驅直入大破關羽四塚連營，曹操讚其「有周亞夫之風，長驅直入古今未有」。", 36, 24, ["TRUE_AT", "AMBUSH"], ["STAMINA_DEEP", "HEAVY_AP"], 356, 132, 0.14],
  ["WAKIZAKA", "脇坂安治", 'naval', 1, 'E', "賤岳槍名·淡路水軍首領", "賤岳七本槍之一，淡路水軍頭領，關原之戰機敏調度，兼備陸戰與海戰將才。", 28, 14, ["AMBUSH"], [], 116, 52, 0.06],
  ["TOUDO", "藤堂高虎", 'naval', 1, 'F', "水軍大將·築城宗師", "戰國名將，掌管德川家水軍大陣，築城與水陸攻防皆臻極致，歷事七主終成一方霸主。", 24, 18, ["AMBUSH", "EW"], [], 118, 50, 0.08],
  ["SHAMOKE", "沙摩柯", 'naval', 1, 'A', "五溪蠻王·鐵蒺首登", "五溪蠻夷首領，面如噀血碧眼突出，率蠻兵助劉備伐吳，手使鐵蒺藜骨朵，身披五色錦衣威震山谷。", 48, 10, ["AMBUSH", "TRUE_AT"], [], 120, 56, 0.06],
  ["HEQI", "賀齊", 'naval', 2, 'B', "艨艟華彩·百越先登", "東吳名將，戰船艨艟精工甲刃照耀江面，每戰必先登陷陣，平定山越威震江東。", 32, 18, ["AMBUSH", "ASW"], [], 176, 70, 0.1],
  ["CAOBIN", "曹彬", 'naval', 2, 'C', "渡江名帥·不殺仁將", "北宋開國第一良將，採石磯架設浮橋大渡長江擊破南唐水軍，平江南不妄殺一人。", 28, 24, ["AEGIS", "EW"], [], 176, 64, 0.1],
  ["ZHUGELIANG", "諸葛亮", 'support', 5, 'A', "臥龍智聖·八陣通神", "三國蜀漢丞相，千古智聖，隆中對三分天下，創八陣圖與諸葛連弩，神機妙算運籌決勝。", 12, 80, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 224, 94, 0],
  ["HANXIN", "韓信", 'support', 5, 'B', "兵仙神算·十面埋伏", "漢初三傑之一，兵家四勢之兵形勢代表，「多多益善」，明修棧道暗度陳倉、十面埋伏垓下破楚。", 86, 80, ["EW", "DEEP", "TRUE_AT"], ["STRATEGIST", "STAMINA_DEEP"], 222, 116, 0.04],
  ["ZHANGLIANG", "張良", 'support', 5, 'C', "運籌帷幄·決勝千里", "漢初三傑之謀聖，運籌策帷帳之中，決勝於千里之外，圯上敬履得《太公兵法》，佐劉邦定天下。", 20, 79, ["EW", "SPOT"], ["STRATEGIST"], 220, 90, 0.04],
  ["SIMAYI", "司馬懿", 'support', 4, 'D', "鷹視狼顧·深謀待時", "曹魏太傅，深沉有度深謀遠慮，熬死諸葛亮、平定遼東，為晉朝開國奠定基業。", 24, 69, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 180, 90, 0.06],
  ["TOYOTOMI", "豐臣秀吉", 'support', 3, 'E', "太閤天下·統一大將", "戰國三傑之一，從織田信長麾下崛起，經多場戰事完成日本大部分地區統一；其軍事才能以統帥與調度見長。", 22, 58, ["EW", "SPOT"], ["STRATEGIST"], 156, 82, 0.04],
  ["CAOCAO", "曹操", 'support', 4, 'I', "亂世雄略·官渡制勝", "東漢末年政治家、軍事家，挾天子以令諸侯，官渡之戰擊敗袁紹，奠定曹魏基業。", 36, 70, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 184, 96, 0.06],
  ["HANBEI", "竹中半兵衛", 'support', 3, 'F', "今孔明·十人奪城", "戰國天才軍師，僅帶十六名隨從便智奪固若金湯之稻葉山城，輔佐豐臣秀吉天下布武。", 26, 61, ["EW", "SPOT"], ["STRATEGIST"], 152, 80, 0.04],
  ["KANBEI", "黑田官兵衛", 'support', 4, 'G', "如水大謀·天下二兵衛", "戰國頂級軍略家，高松城水攻、中國大返還之總策劃者，智謀令豐臣秀吉亦為之忌憚。", 28, 70, ["EW", "DEEP", "SPOT"], ["STRATEGIST"], 176, 92, 0.04],
  ["SUNBIN", "孫臏", 'support', 4, 'A', "圍魏救趙·馬陵道伏兵", "戰國兵家宗師，著《孫臏兵法》，桂陵之戰圍魏救趙、馬陵之戰減灶誘敵射殺龐涓。", 28, 72, ["EW", "SEAD", "ARTY"], ["STRATEGIST"], 178, 94, 0.04],
  ["WUQI", "吳起", 'support', 5, 'B', "吳子治軍·兼併無敵", "戰國兵法名家，與孫子並稱「孫吳」，治西河大戰七十六全勝六十四，魏武卒所向披靡。", 26, 78, ["EW", "SEAD", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 224, 102, 0.06],
  ["GUOJIA", "郭嘉", 'support', 2, 'C', "十勝十敗·鬼謀奇策", "曹操心腹謀士，「郭嘉不死，便無赤壁」，算準孫策之死，力主遠征烏桓白狼山大勝。", 36, 50, ["EW", "DEEP"], ["STRATEGIST"], 128, 70, 0],
  ["XUNYU", "荀彧", 'support', 2, 'D', "王佐之才·深謀遠猷", "曹操首席戰略大師，深謀遠慮為曹操規劃統一北方大略，官渡之戰扼守後方力主相持。", 30, 50, ["EW", "SPOT"], ["STRATEGIST"], 130, 68, 0.04],
  ["JIAXU", "賈詡", 'support', 1, 'E', "算無遺策·毒士洞察", "三國第一洞察軍師，宛城奇計重創曹操，潼關離間韓遂馬超，生平出謀劃策無一失手。", 42, 42, ["EW", "SEAD"], ["STRATEGIST"], 104, 54, 0],
  ["LUXUN", "陸遜", 'support', 2, 'F', "火燒連營·夷陵破蜀", "東吳大都督，白面書生深藏不露，夷陵之戰後發制人，一把火燒連營七百里擊潰劉備。", 32, 48, ["EW", "TRUE_AT", "DEEP"], ["STRATEGIST"], 128, 72, 0.04],
  ["SHIMAZU_YOSHIHISA", "島津義久", 'support', 1, 'I', "薩摩之雄·九州統帥", "島津氏第十六代當主，與弟義弘等家族將領協力擴張，統率島津家在九州各地的軍事行動。", 24, 38, ["EW", "SPOT"], ["STRATEGIST"], 104, 52, 0.04],
  ["PANGTONG", "龐統", 'support', 3, 'A', "鳳雛奇策·連環上策", "劉備軍師，與諸葛亮並稱「伏龍鳳雛」，入蜀大戰獻上中下三策，親臨戰陣指揮破敵。", 24, 60, ["EW", "ARTY", "SPOT"], ["STRATEGIST"], 156, 84, 0.06],
  ["FAZHENG", "法正", 'support', 1, 'B', "定軍奇畫·斬將夏侯", "劉備首席謀臣，曹操歎曰「吾收奸雄略盡，獨不得法正邪」，定軍山親自登高指揮陣斬夏侯淵。", 20, 40, ["EW", "ARTY", "SPOT"], ["STRATEGIST"], 104, 54, 0.04],
  ["SANADAMASA", "真田昌幸", 'support', 3, 'F', "表裏比興·上田鬼謀", "真田幸村之父，以極小之上田城兩度挫敗德川數萬大軍，連豐臣秀吉亦嘆其為「表裏比興之者」。", 30, 59, ["EW", "TRUE_AT"], ["STRATEGIST"], 154, 82, 0.06],
  ["LUSU", "魯肅", 'support', 2, 'A', "榻上大策·三分雄圖", "東吳戰略擘劃大師，早於諸葛亮提出天下二分／三分之榻上策，力促孫劉結盟。", 24, 52, ["EW", "SPOT"], ["STRATEGIST"], 132, 68, 0.04],
  ["TIANDAN", "田單", 'naval', 2, 'A', "火牛奇陣·齊國破燕", "戰國齊名將，即墨守城以千餘頭牛角綁利刃尾繫浸油蘆葦衝入敵營，一舉收復七十餘城。", 44, 24, ["AMBUSH", "SWARM"], [], 170, 68, 0.08],
  ["LIUBOWEN", "劉伯溫", 'support', 1, 'J', "神機妙算·佐明開國", "明初政治家與軍事謀臣，輔佐朱元璋制定統一戰略，參與平定群雄與建立明朝。", 20, 42, ["EW", "SPOT"], ["STRATEGIST"], 106, 54, 0.04],
  ["SUNWU", "孫武", 'support', 5, 'A', "兵聖大宗·知彼知己", "春秋兵聖，著《孫子兵法》十三篇，輔佐吳王五戰五捷攻入郢都大破強楚，天下兵家之始祖。", 30, 82, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 228, 98, 0.06],
  ["LEYI", "樂毅", 'support', 2, 'B', "昌國拔城·連克七十", "戰國名將，拜為燕昭王上將軍，率五國聯軍濟西破齊，半年連克齊國七十餘城，算無遺策。", 28, 51, ["EW", "SEAD"], ["STRATEGIST"], 132, 72, 0.04],
  ["TOKUGAWA", "德川家康", 'support', 4, 'F', "三河忍耐·天下霸業", "戰國三傑之一，沉著隱忍，關原之戰與大坂之戰運籌帷幄決勝千里，開創江戶幕府二百六十年基業。", 26, 68, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP", "FORMATION_SHIELD"], 184, 92, 0.08],
];

const UNIT_META = {
HUO: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢軍玄甲鐵騎 + 環首刀', sfx: 'blade_clash', img: 'assets/warlords/HUO.jpg?v=7.7.9' },
  WEI: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '武剛突騎大陣 + 漢劍', sfx: 'war_drum', img: 'assets/warlords/WEI.jpg?v=7.7.9' },
  LUBU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '方天畫戟 + 赤兔馬', sfx: 'blade_clash', img: 'assets/warlords/LUBU.jpg?v=7.7.9' },
  YOSHITSUNE: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '薄綠太刀 + 黑葦威鎧', sfx: 'blade_clash', img: 'assets/warlords/YOSHITSUNE.jpg?v=7.7.9' },
  SHINGEN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '軍配團扇 + 諏訪法性兜', sfx: 'war_drum', img: 'assets/warlords/SHINGEN.jpg?v=7.7.9' },
  GAISUWEN: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '五口寶刀 + 鐵騎長矛', sfx: 'blade_clash', img: 'assets/warlords/GAISUWEN.jpg?v=7.7.9' },
  ZHAOYUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青釭劍 + 亮銀龍膽槍', sfx: 'blade_clash', img: 'assets/warlords/ZHAOYUN.jpg?v=7.7.9' },
  MACHO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭湛金槍 + 白袍銀鎧', sfx: 'blade_clash', img: 'assets/warlords/MACHO.jpg?v=7.7.9' },
  ZHANGLIAO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '問天青龍雙戟 + 塞外駿馬', sfx: 'blade_clash', img: 'assets/warlords/ZHANGLIAO.jpg?v=7.7.9' },
  CHENQINGZHI: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '白袍麾旗 + 輕騎快槍', sfx: 'strategy_gong', img: 'assets/warlords/CHENQINGZHI.jpg?v=7.7.9' },
  KENSHIN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '順慶手太刀 + 毘字旗', sfx: 'war_drum', img: 'assets/warlords/KENSHIN.jpg?v=7.7.9' },
  YUKIMURA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '十文字槍 + 六文錢赤備', sfx: 'blade_clash', img: 'assets/warlords/YUKIMURA.jpg?v=7.7.9' },
  KIMYUSHIN: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '龍鳳環首刀 + 金花官服戰鎧', sfx: 'blade_clash', img: 'assets/warlords/KIMYUSHIN.jpg?v=7.7.9' },
  DENGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '登山步稍 + 奇襲輕甲', sfx: 'blade_clash', img: 'assets/warlords/DENGAI.jpg?v=7.7.9' },
  XIAHOUYUAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '精鋼長矛 + 快馬大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/XIAHOUYUAN.jpg?v=7.7.9' },
  GONGSUNDU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白馬長槊 + 雕花角弓', sfx: 'arrow_volley', img: 'assets/warlords/GONGSUNDU.jpg?v=7.7.9' },
  DATE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '黑漆弦月盔 + 騎鐵火繩槍', sfx: 'arrow_volley', img: 'assets/warlords/DATE.jpg?v=7.7.9' },
  EULJI: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗環刀 + 輕步快騎', sfx: 'strategy_gong', img: 'assets/warlords/EULJI.jpg?v=7.7.9' },
  LINGTONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '烈火大刀 + 隨身精短劍', sfx: 'blade_clash', img: 'assets/warlords/LINGTONG.jpg?v=7.7.9' },
  YAMAGATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長柄槍 + 赤漆塗胴具足', sfx: 'blade_clash', img: 'assets/warlords/YAMAGATA.jpg?v=7.7.9' },
  TACHIBANA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '雷切脇差 + 栗色鎧甲', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANA.jpg?v=7.7.9' },
  ZHAOSHE: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '趙國鐵騎長矛 + 馬服良駒', sfx: 'cavalry_charge', img: 'assets/warlords/ZHAOSHE.jpg?v=7.7.9' },
  PANGDE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭大刀 + 白馬重鐵鞍', sfx: 'blade_clash', img: 'assets/warlords/PANGDE.jpg?v=7.7.9' },
  MAEDATOSHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱柄長槍 + 赤母衣良駒', sfx: 'blade_clash', img: 'assets/warlords/MAEDATOSHI.jpg?v=7.7.9' },
  BAIQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '武安君銅劍 + 戰國玄甲', sfx: 'war_drum', img: 'assets/warlords/BAIQI.jpg?v=7.7.9' },
  XIANGYU: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '霸王楚戟 + 烏騅馬鎧', sfx: 'blade_clash', img: 'assets/warlords/XIANGYU.jpg?v=7.7.9' },
  YUEFEI: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '瀝泉神槍 + 岳字白旄大旗', sfx: 'war_drum', img: 'assets/warlords/YUEFEI.jpg?v=7.7.9' },
  WANGJIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '大秦青銅長戈 + 重甲鐵盾', sfx: 'war_drum', img: 'assets/warlords/WANGJIAN.jpg?v=7.7.9' },
  HONDA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '蜻蛉切神槍 + 鹿角脇立兜', sfx: 'blade_clash', img: 'assets/warlords/HONDA.jpg?v=7.7.9' },
  SHIBATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '瓶割刀 + 漆黑重甲具足', sfx: 'blade_clash', img: 'assets/warlords/SHIBATA.jpg?v=7.7.9' },
  LIANPO: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '青銅重戟 + 戰國大盾', sfx: 'war_drum', img: 'assets/warlords/LIANPO.jpg?v=7.7.9' },
  MENGTIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '秦軍重弩 + 狼毫筆', sfx: 'war_drum', img: 'assets/warlords/MENGTIAN.jpg?v=7.7.9' },
  HOJO_UJIYASU: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 太刀', sfx: 'war_drum', img: 'assets/warlords/HOJO_UJIYASU.jpg?v=7.7.9' },
  GUANYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青龍偃月刀 + 美髯綠袍鎧', sfx: 'blade_clash', img: 'assets/warlords/GUANYU.jpg?v=7.7.9' },
  ZHANGFEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '丈八蛇矛 + 烏金鐵環甲', sfx: 'blade_clash', img: 'assets/warlords/ZHANGFEI.jpg?v=7.7.9' },
  XIAHOU_DUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '環首刀 + 曹魏軍旗', sfx: 'blade_clash', img: 'assets/warlords/XIAHOU_DUN.jpg?v=7.7.9' },
  TACHIBANAD: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名刀雷切 + 轎載鐵盾', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANAD.jpg?v=7.7.9' },
  CHOIYOUNG: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗大刀 + 頭頂鐵胄', sfx: 'blade_clash', img: 'assets/warlords/CHOIYOUNG.jpg?v=7.7.9' },
  DIANWEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '雙鐵戟 + 重裝近衛鎧', sfx: 'blade_clash', img: 'assets/warlords/DIANWEI.jpg?v=7.7.9' },
  XUCHU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭大金刀 + 粗鐵皮甲', sfx: 'blade_clash', img: 'assets/warlords/XUCHU.jpg?v=7.7.9' },
  SHIMAZUY: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '野太刀 + 黑漆塗二枚胴', sfx: 'blade_clash', img: 'assets/warlords/SHIMAZUY.jpg?v=7.7.9' },
  GYEBAEK: { flag: '🇰🇷', origin: '韓國 · 百濟', weapon: '百濟環首大刀 + 鐵鱗背心', sfx: 'blade_clash', img: 'assets/warlords/GYEBAEK.jpg?v=7.7.9' },
  YANGYE: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '九環金刀 + 雁門重甲', sfx: 'blade_clash', img: 'assets/warlords/YANGYE.jpg?v=7.7.9' },
  CAOREN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '重鋼大盾 + 短刃佩刀', sfx: 'war_drum', img: 'assets/warlords/CAOREN.jpg?v=7.7.9' },
  ZHOUTAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭厚刃刀 + 肉盾鐵軀', sfx: 'blade_clash', img: 'assets/warlords/ZHOUTAI.jpg?v=7.7.9' },
  IINAOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱漆大槍 + 金箔天衝脇立', sfx: 'blade_clash', img: 'assets/warlords/IINAOMASA.jpg?v=7.7.9' },
  KATOKIYOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '片鎌槍 + 長烏帽子形兜', sfx: 'blade_clash', img: 'assets/warlords/KATOKIYOMASA.jpg?v=7.7.9' },
  YUJIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵環長刀 + 堅木大盾', sfx: 'war_drum', img: 'assets/warlords/YUJIN.jpg?v=7.7.9' },
  LIGUANG: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢家雕弓 + 白羽穿甲箭', sfx: 'arrow_volley', img: 'assets/warlords/LIGUANG.jpg?v=7.7.9' },
  YANGYOUJI: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '穿楊神弓 + 七札破甲箭', sfx: 'arrow_volley', img: 'assets/warlords/YANGYOUJI.jpg?v=7.7.9' },
  NOBUNAGA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '南蠻鐵砲火銃 + 織田木瓜旗', sfx: 'arrow_volley', img: 'assets/warlords/NOBUNAGA.jpg?v=7.7.9' },
  YOICHI: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '滋野籐弓 + 白羽神箭', sfx: 'arrow_volley', img: 'assets/warlords/YOICHI.jpg?v=7.7.9' },
  JUMONG: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗神弓 + 鹿角箭', sfx: 'arrow_volley', img: 'assets/warlords/JUMONG.jpg?v=7.7.9' },
  HUANGZHONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵胎寶弓 + 鳳嘴刀', sfx: 'arrow_volley', img: 'assets/warlords/HUANGZHONG.jpg?v=7.7.9' },
  TAISHICI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂歌戟 + 穿甲大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/TAISHICI.jpg?v=7.7.9' },
  HANSHIZHONG: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '克敵勁弩 + 倒馬長槍', sfx: 'arrow_volley', img: 'assets/warlords/HANSHIZHONG.jpg?v=7.7.9' },
  LIMU: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '趙國鐵角硬弓 + 破甲箭陣', sfx: 'arrow_volley', img: 'assets/warlords/LIMU.jpg?v=7.7.9' },
  AKECHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名銃備前鐵砲 + 桔梗紋旗', sfx: 'arrow_volley', img: 'assets/warlords/AKECHI.jpg?v=7.7.9' },
  SAIKA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三連發火繩銃 + 八咫烏標記', sfx: 'arrow_volley', img: 'assets/warlords/SAIKA.jpg?v=7.7.9' },
  YANGMANCHUN: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗城防硬角弓 + 火弩', sfx: 'arrow_volley', img: 'assets/warlords/YANGMANCHUN.jpg?v=7.7.9' },
  HULUGUANG: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '黑角落雕強弓 + 鐵羽鑿子箭', sfx: 'arrow_volley', img: 'assets/warlords/HULUGUANG.jpg?v=7.7.9' },
  ZHANGHE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '巧變長弓 + 綠沉槍', sfx: 'arrow_volley', img: 'assets/warlords/ZHANGHE.jpg?v=7.7.9' },
  ZHOUYAFU: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢軍武剛弩 + 精鋼大箭', sfx: 'arrow_volley', img: 'assets/warlords/ZHOUYAFU.jpg?v=7.7.9' },
  ZONGZE: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '連弩機樓 + 宣慰刀', sfx: 'arrow_volley', img: 'assets/warlords/ZONGZE.jpg?v=7.7.9' },
  TORII: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三河火繩槍 + 伏見箭矢', sfx: 'arrow_volley', img: 'assets/warlords/TORII.jpg?v=7.7.9' },
  CHOIMUSEON: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '走火火箭 + 鎮浦銅砲', sfx: 'fire_attack', img: 'assets/warlords/CHOIMUSEON.jpg?v=7.7.9' },
  GENGYAN: { flag: '🇨🇳', origin: '中國 · 東漢', weapon: '雲台強弩 + 破甲箭匣', sfx: 'arrow_volley', img: 'assets/warlords/GENGYAN.jpg?v=7.7.9' },
  PANGJUAN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '魏武卒十二石大弩', sfx: 'arrow_volley', img: 'assets/warlords/PANGJUAN.jpg?v=7.7.9' },
  FENGYI: { flag: '🇨🇳', origin: '中國 · 東漢', weapon: '大樹長弓 + 伏射箭列', sfx: 'arrow_volley', img: 'assets/warlords/FENGYI.jpg?v=7.7.9' },
  ASAKURA_SOT: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '越前早期火繩銃', sfx: 'arrow_volley', img: 'assets/warlords/ASAKURA_SOT.jpg?v=7.7.9' },
  MATSUNAGA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '南蠻炸藥引線 + 短鐵砲', sfx: 'arrow_volley', img: 'assets/warlords/MATSUNAGA.jpg?v=7.7.9' },
  TANDAOJI: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '宋軍神臂大弓 + 鐵羽矢', sfx: 'arrow_volley', img: 'assets/warlords/TANDAOJI.jpg?v=7.7.9' },
  KUANGZHANG: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '齊國臨淄強弩 + 箭陣纛旗', sfx: 'arrow_volley', img: 'assets/warlords/KUANGZHANG.jpg?v=7.7.9' },
  HONDA_TADATSUGU: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三河軍制鐵砲 + 火藥袋', sfx: 'arrow_volley', img: 'assets/warlords/HONDA_TADATSUGU.jpg?v=7.7.9' },
  ZHOUYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '赤壁督軍劍 + 樓船令旗', sfx: 'fire_attack', img: 'assets/warlords/ZHOUYU.jpg?v=7.7.9' },
  YISUNSIN: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '忠武公三尺寶劍 + 龜甲船', sfx: 'fire_attack', img: 'assets/warlords/YISUNSIN.jpg?v=7.7.9' },
  KUKI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '海賊大太刀 + 安宅鐵甲船', sfx: 'war_drum', img: 'assets/warlords/KUKI.jpg?v=7.7.9' },
  CHOSOKABE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長槍 + 一領具足兩棲甲', sfx: 'blade_clash', img: 'assets/warlords/CHOSOKABE.jpg?v=7.7.9' },
  JANGPOGO: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '清海鎮寶刀 + 大海船樓舵', sfx: 'war_drum', img: 'assets/warlords/JANGPOGO.jpg?v=7.7.9' },
  LUMENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白衣偽裝袍 + 吳地雙手劍', sfx: 'blade_clash', img: 'assets/warlords/LUMENG.jpg?v=7.7.9' },
  GANNING: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短戟飛刀 + 銅鈴錦帆', sfx: 'blade_clash', img: 'assets/warlords/GANNING.jpg?v=7.7.9' },
  HUANGGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '火攻燃引火箭 + 艨艟衝角', sfx: 'fire_attack', img: 'assets/warlords/HUANGGAI.jpg?v=7.7.9' },
  JIANGWEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '天水綠沉長槍 + 蜀錦奇兵袍', sfx: 'war_drum', img: 'assets/warlords/JIANGWEI.jpg?v=7.7.9' },
  MURAKAMI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '焙烙火玉 + 鯨船快櫓', sfx: 'fire_attack', img: 'assets/warlords/MURAKAMI.jpg?v=7.7.9' },
  XIEXUAN: { flag: '🇨🇳', origin: '中國 · 兩晉', weapon: '北府精鋼斬馬刀 + 艨艟', sfx: 'blade_clash', img: 'assets/warlords/XIEXUAN.jpg?v=7.7.9' },
  YUYUNWEN: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '采石督師劍 + 海鰍踏浪船', sfx: 'fire_attack', img: 'assets/warlords/YUYUNWEN.jpg?v=7.7.9' },
  WEIYAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂骨環刀 + 伏兵令旗', sfx: 'blade_clash', img: 'assets/warlords/WEIYAN.jpg?v=7.7.9' },
  MOURI_MOTO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '一文字太刀 + 村上嚴島樓船', sfx: 'strategy_gong', img: 'assets/warlords/MOURI_MOTO.jpg?v=7.7.9' },
  HATTORI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '伊賀鎖鎌 + 漆黑忍衣', sfx: 'blade_clash', img: 'assets/warlords/HATTORI.jpg?v=7.7.9' },
  JEONGJI: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗火銃銅管 + 海上長矛', sfx: 'fire_attack', img: 'assets/warlords/JEONGJI.jpg?v=7.7.9' },
  YUEJIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短柄破城大斧 + 先登飛爪', sfx: 'blade_clash', img: 'assets/warlords/YUEJIN.jpg?v=7.7.9' },
  MENGHUO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '南中神木三叉戟 + 獸皮生藤甲', sfx: 'blade_clash', img: 'assets/warlords/MENGHUO.jpg?v=7.7.9' },
  DINGFENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '雪夜白刃 + 短皮小盾', sfx: 'blade_clash', img: 'assets/warlords/DINGFENG.jpg?v=7.7.9' },
  XUHUANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣花開山大斧 + 破陣鎧', sfx: 'heavy_strike', img: 'assets/warlords/XUHUANG.jpg?v=7.7.9' },
  WAKIZAKA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '賤岳長槍 + 淡路戰船', sfx: 'blade_clash', img: 'assets/warlords/WAKIZAKA.jpg?v=7.7.9' },
  TOUDO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '築城大銃 + 水軍旗艦', sfx: 'war_drum', img: 'assets/warlords/TOUDO.jpg?v=7.7.9' },
  SHAMOKE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵蒺藜骨朵 + 蠻夷硬角弓', sfx: 'blade_clash', img: 'assets/warlords/SHAMOKE.jpg?v=7.7.9' },
  HEQI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '精鋼短戟 + 先登皮鎧', sfx: 'blade_clash', img: 'assets/warlords/HEQI.jpg?v=7.7.9' },
  CAOBIN: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '北宋大纛軍刀 + 浮橋長索', sfx: 'war_drum', img: 'assets/warlords/CAOBIN.jpg?v=7.7.9' },
  ZHUGELIANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '羽扇綸巾 + 諸葛八陣圖', sfx: 'strategy_gong', img: 'assets/warlords/ZHUGELIANG.jpg?v=7.7.9' },
  HANXIN: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '兵仙令劍 + 十面埋伏陣', sfx: 'blade_clash', img: 'assets/warlords/HANXIN.jpg?v=7.7.9' },
  ZHANGLIANG: { flag: '🇨🇳', origin: '中國 · 漢朝', weapon: '太公兵法卷軸 + 漢印佩玉', sfx: 'strategy_gong', img: 'assets/warlords/ZHANGLIANG.jpg?v=7.7.9' },
  SIMAYI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣帝佩劍 + 陣列令旗', sfx: 'strategy_gong', img: 'assets/warlords/SIMAYI.jpg?v=7.7.9' },
  TOYOTOMI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 陣太刀', sfx: 'war_drum', img: 'assets/warlords/TOYOTOMI.jpg?v=7.7.9' },
  CAOCAO: { flag: '🇨🇳', origin: '中國 · 東漢末／三國', weapon: '環首刀 + 丞相令旗', sfx: 'strategy_gong', img: 'assets/warlords/CAOCAO.jpg?v=7.7.9' },
  HANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '竹中軍配 + 一之谷形兜', sfx: 'strategy_gong', img: 'assets/warlords/HANBEI.jpg?v=7.7.9' },
  KANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '合子形兜 + 水攻策圖卷', sfx: 'strategy_gong', img: 'assets/warlords/KANBEI.jpg?v=7.7.9' },
  SUNBIN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '孫臏兵法木牘 + 獨輪戰車', sfx: 'strategy_gong', img: 'assets/warlords/SUNBIN.jpg?v=7.7.9' },
  WUQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '吳子兵書 + 魏武卒精矛', sfx: 'war_drum', img: 'assets/warlords/WUQI.jpg?v=7.7.9' },
  GUOJIA: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '十勝十敗論卷 + 謀士羽扇', sfx: 'strategy_gong', img: 'assets/warlords/GUOJIA.jpg?v=7.7.9' },
  XUNYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '王佐印信 + 荀氏家傳竹簡', sfx: 'strategy_gong', img: 'assets/warlords/XUNYU.jpg?v=7.7.9' },
  JIAXU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '離間策書 + 毒士算籌', sfx: 'strategy_gong', img: 'assets/warlords/JIAXU.jpg?v=7.7.9' },
  LUXUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '夷陵火計箭符 + 吳都督佩劍', sfx: 'fire_attack', img: 'assets/warlords/LUXUN.jpg?v=7.7.9' },
  SHIMAZU_YOSHIHISA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 島津家旗印', sfx: 'strategy_gong', img: 'assets/warlords/SHIMAZU_YOSHIHISA.jpg?v=7.7.9' },
  PANGTONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鳳雛連環策 + 青銅短劍', sfx: 'strategy_gong', img: 'assets/warlords/PANGTONG.jpg?v=7.7.9' },
  FAZHENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '定軍指旗 + 蜀川圖誌', sfx: 'strategy_gong', img: 'assets/warlords/FAZHENG.jpg?v=7.7.9' },
  SANADAMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '上田城地圖 + 誘敵令旗', sfx: 'strategy_gong', img: 'assets/warlords/SANADAMASA.jpg?v=7.7.9' },
  LUSU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '榻上策竹簡 + 結盟令劍', sfx: 'strategy_gong', img: 'assets/warlords/LUSU.jpg?v=7.7.9' },
  TIANDAN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '火牛蘆葦火把 + 衝角雙刃', sfx: 'fire_attack', img: 'assets/warlords/TIANDAN.jpg?v=7.7.9' },
  SUNWU: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '孫子兵法十三篇 + 吳王授鉞', sfx: 'strategy_gong', img: 'assets/warlords/SUNWU.jpg?v=7.7.9' },
  LEYI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '昌國君佩劍 + 五國聯軍令旗', sfx: 'strategy_gong', img: 'assets/warlords/LEYI.jpg?v=7.7.9' },
  SUNCE: { flag: '🇨🇳', origin: '中國 · 東漢末', weapon: '霸王槍 + 江東戰旗', sfx: 'cavalry_charge', img: 'assets/warlords/SUNCE.jpg?v=7.7.9' },
  SUNJIAN: { flag: '🇨🇳', origin: '中國 · 東漢末', weapon: '古錠刀 + 虎頭戰盔', sfx: 'blade_clash', img: 'assets/warlords/SUNJIAN.jpg?v=7.7.9' },
  LIUBOWEN: { flag: '🇨🇳', origin: '中國 · 明初', weapon: '軍師羽扇 + 明軍令旗', sfx: 'strategy_gong', img: 'assets/warlords/LIUBOWEN.jpg?v=7.7.9' },
  TOKUGAWA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '葵紋軍配 + 三河統帥刀', sfx: 'war_drum', img: 'assets/warlords/TOKUGAWA.jpg?v=7.7.9' },
};

const UNIT_SKILLS = {
  HUO: { name: '封狼居胥', phase: 'P3', desc: '千里奔襲直取敵方後排，突擊傷害提升並奪取敵軍士氣' },
  WEI: { name: '武剛龍城', phase: 'P2', desc: '展開武剛車陣協同鐵騎，降低全軍突騎所受遠程傷害並提升命中' },
  CHENQINGZHI: { name: '白袍千軍', phase: 'P3', desc: '七千白袍連破三十二城，突破防線時全軍突騎連擊與戰意大幅提升' },
  LUBU: { name: '轅門無雙', phase: 'P3', desc: '飛將赤兔冠絕三軍，衝陣與單挑無視重鎧減傷並造成毀滅打擊' },
  SHINGEN: { name: '風林火山', phase: 'P3', desc: '疾如風、徐如林、侵掠如火、不動如山，攻防與謀略雙重加成' },
  DENGAI: { name: '陰平天降', phase: 'P1', desc: '裹氈翻越摩天絕嶺，繞過前排防線直襲敵方後營主帥' },
  ZHANGLIAO: { name: '威震逍遙', phase: 'P3', desc: '八百壯士直衝十萬大軍，以少打多時破甲與暴擊大幅提升' },
  ZHAOYUN: { name: '七進七出', phase: 'P3', desc: '渾身是膽單騎救主，殘血時閃避率與反擊威力大幅暴增' },
  YOSHITSUNE: { name: '鵯越逆落', phase: 'P3', desc: '絕壁奇襲一躍而下，高閃避繞過重甲重創敵方後排' },
  KENSHIN: { name: '車懸之陣', phase: 'P2', desc: '毘沙門天軍神輪番衝陣，同時壓制敵方雙目標並無視陣型減傷' },
  ZHAOSHE: { name: '狹路勇勝', phase: 'P3', desc: '狹路相逢勇者勝，遭遇高費強敵時先手率與突擊暴擊大幅提升' },
  SUNCE: { name: '霸王怒濤', phase: 'P3', desc: '江東小霸王席捲千軍，壓制敵方前鋒並大幅提升單挑勝率' },
  MACHO: { name: '西涼鐵騎', phase: 'P3', desc: '統率西涼羌胡長標精騎，側翼包抄重甲與弓兵穿透加成' },
  EULJI: { name: '薩水誘敵', phase: 'P2', desc: '神算佯敗誘敵深入，降低敵方突騎命中並觸發伏擊反傷' },
  GAISUWEN: { name: '五刀威震', phase: 'P3', desc: '身佩五把飛刀飛馳衝殺，衝陣前連續破甲削弱敵軍防禦' },
  XIAHOUYUAN: { name: '虎步關右', phase: 'P2', desc: '三日五百六日一千，極速奔襲搶奪突騎交鋒先手' },
  GONGSUNDU: { name: '白馬義從', phase: 'P2', desc: '幽州善射白馬精騎，馳馬遠射兼具破甲貫穿效果' },
  KIMYUSHIN: { name: '花郎誓天', phase: 'P3', desc: '統御新羅花郎精騎，提振全軍韌性與持久戰力' },
  DATE: { name: '獨眼龍騎銃', phase: 'P2', desc: '騎馬鐵砲隊先驅，衝鋒前以火繩槍齊射破除敵方護盾' },
  YUKIMURA: { name: '六文錢決死', phase: 'P3', desc: '赤備死士直衝敵方本陣，對高費用主將造成決死穿刺' },
  PANGDE: { name: '抬櫬決死', phase: 'P3', desc: '抬棺出征誓死不退，瀕死時爆發絕命破甲反擊' },
  LINGTONG: { name: '國士死戰', phase: 'P3', desc: '逍遙津捨命護主，為主將分擔傷害並強化近身反擊' },
  MAEDATOSHI: { name: '槍之又左', phase: 'P3', desc: '赤母衣眾筆頭，輕騎朱柄長槍突刺高機率無視防禦' },
  TACHIBANA: { name: '西國疾風', phase: 'P3', desc: '西國無雙迅猛突擊，兼具破甲與靈巧閃避' },
  YAMAGATA: { name: '赤備先驅', phase: 'P3', desc: '武田赤備開路先鋒，協同高階突騎時衝鋒傷害加成' },
  BAIQI: { name: '長平殲滅', phase: 'P3', desc: '武安君包圍殲滅戰，對受創敵軍造成額外斬殺傷害' },
  WANGJIAN: { name: '秦滅六國', phase: 'P3', desc: '六十萬大軍穩若泰山，全軍護甲提升且後期決戰火力遞增' },
  XIANGYU: { name: '霸王破釜', phase: 'P3', desc: '破釜沉舟千古無二，近戰與單挑爆發毀滅性破甲重擊' },
  YUEFEI: { name: '背嵬撼山', phase: 'P3', desc: '撼山易撼岳家軍難，重創敵方突騎並鞏固中軍防線' },
  GUANYU: { name: '威震華夏', phase: 'P3', desc: '武聖青龍偃月刀，首波交鋒高機率斬落敵方前鋒名將' },
  LIANPO: { name: '長平堅壁', phase: 'P3', desc: '展開戰國巨盾壁壘，大幅吸收敵方遠程弓弩與火砲傷害' },
  MENGTIAN: { name: '萬里長城', phase: 'P3', desc: '構築長城連陣提升全軍防禦，強效壓制敵方騎兵衝鋒' },
  ZHANGFEI: { name: '當陽斷橋', phase: 'P3', desc: '據水斷橋怒吼震退敵軍，削弱敵方士氣並發動丈八蛇矛連刺' },
  SUNJIAN: { name: '江東猛虎', phase: 'P3', desc: '破虜先鋒古錠刀斬將，主動進攻時無視敵方格擋' },
  CHOIYOUNG: { name: '高麗柱石', phase: 'P3', desc: '見金如石剛毅不屈，免疫混亂並反彈近戰傷害' },
  CAOREN: { name: '樊城天人', phase: 'P3', desc: '曹魏大司馬固守樊城，展開八門金鎖護盾大幅提升防禦' },
  XIAHOU_DUN: { name: '拔矢啖睛', phase: 'P3', desc: '曹魏大將軍剛烈無畏，受創後激發血性強化爆擊反擊' },
  YANGYE: { name: '金刀楊無敵', phase: 'P3', desc: '雁門關大破契丹鐵騎，對奔雷突騎造成額外迎擊重傷' },
  HOJO_UJIYASU: { name: '相模獅籠城', phase: 'P3', desc: '小田原堅守搭配河越夜襲，持續恢復中軍防線韌性' },
  HONDA: { name: '蜻蛉切無傷', phase: 'P3', desc: '生涯五十七戰無傷，格擋首波致命重擊並穩守陣線' },
  DIANWEI: { name: '古之惡來', phase: 'P3', desc: '雙鐵戟八十斤死守轅門，為主帥攔截單挑與斬首突襲' },
  XUCHU: { name: '裸衣虎癡', phase: 'P3', desc: '虎衛軍統領倒拖雙牛，近身肉搏時爆擊與減傷同步提升' },
  YUJIN: { name: '毅重假節', phase: 'P3', desc: '五子良將治軍嚴整，穩固營陣免疫首回合伏擊動搖' },
  TACHIBANAD: { name: '雷神斬雷', phase: 'P3', desc: '乘輿督戰不敗老將，格擋敵軍攻擊時以雷切反擊' },
  SHIMAZUY: { name: '鬼石曼子背進', phase: 'P3', desc: '關原敵中突破，處於劣勢時破甲與突圍傷害提升' },
  ZHOUTAI: { name: '膚如刻畫', phase: 'P3', desc: '身受十二創護衛孫權，每次受創疊加堅韌減傷' },
  GYEBAEK: { name: '黃山伐決死', phase: 'P3', desc: '五千決死隊血戰到底，兵力越低防禦與反擊越高' },
  SHIBATA: { name: '破瓶柴田', phase: 'P3', desc: '砸碎水瓶背水猛進，提升近戰破甲衝擊力' },
  KATOKIYOMASA: { name: '肥後虎之壘', phase: 'P3', desc: '築城名手加固石垣，開局提升前排基礎防護' },
  IINAOMASA: { name: '井伊赤鬼', phase: 'P3', desc: '赤備重甲先鋒，重甲中具備最高先手出擊速度' },
  LIMU: { name: '代郡萬弩', phase: 'P2', desc: '戰國四大名將萬矢連環，全面壓制敵方突騎並覆蓋雙目標' },
  ZHOUYAFU: { name: '細柳堅陣', phase: 'P2', desc: '細柳營號令嚴整，庇護全軍免遭先制奇襲並強化強弩反擊' },
  LIGUANG: { name: '射石沒羽', phase: 'P2', desc: '漢之飛將夜引神弓，齊射無視部分護甲並重創敵方突騎' },
  YANGYOUJI: { name: '百步穿楊', phase: 'P2', desc: '春秋神射之祖一矢貫七札，鎖定敵方核心進行必中穿甲狙殺' },
  NOBUNAGA: { name: '長篠三段擊', phase: 'P2', desc: '三千火繩槍三段輪射，連續粉碎敵方突騎與重甲防線' },
  HANSHIZHONG: { name: '克敵神弓', phase: 'P2', desc: '親研克敵弓可貫雙甲，對重甲陷陣與突騎造成額外破防' },
  TANDAOJI: { name: '唱籌量沙', phase: 'P2', desc: '國家萬里長城，以量沙疑兵瓦解敵方追擊並穩固強弩陣線' },
  HULUGUANG: { name: '落雕都督', phase: 'P2', desc: '百步穿石未嘗一敗，開局精準狙擊敵方高速突擊名將' },
  HUANGZHONG: { name: '定軍神弦', phase: 'P2', desc: '老當益壯定軍斬帥，對高費用敵將造成額外斬首傷害' },
  JUMONG: { name: '東明神矢', phase: 'P2', desc: '高句麗開國神弓，無視敵方隱匿與夜色掩護精準命中' },
  ZHANGHE: { name: '木門伏弩', phase: 'P2', desc: '巧變良將設伏木門道，對突進之敵方騎兵造成致命伏射' },
  ZONGZE: { name: '汴京連弩', phase: 'P2', desc: '東京留守築連弩機樓，加固全軍防線並阻截敵騎' },
  GENGYAN: { name: '雲台破齊', phase: 'P2', desc: '連下四十六郡圍城打援，強弩齊射壓制敵方側翼' },
  FENGYI: { name: '大樹伏弩', phase: 'P2', desc: '大樹將軍謙退設伏，隱蔽箭陣免遭點名並強化反擊' },
  KUANGZHANG: { name: '垂沙破楚', phase: 'P2', desc: '齊國元戎統萬弩破函谷，箭雨覆蓋同時削弱敵軍前排防禦' },
  TAISHICI: { name: '猿臂貫手', phase: 'P2', desc: '猿臂善射弦無虛發，遠程攔截與近身雙戟格鬥兼備' },
  AKECHI: { name: '本能寺雷火', phase: 'P2', desc: '百步穿錢鐵砲名手，火繩槍齊射附帶火焰灼燒' },
  ASAKURA_SOT: { name: '九頭龍銃陣', phase: 'P2', desc: '越前軍神實戰部署鐵砲，提升遠程攔截穩定度' },
  YANGMANCHUN: { name: '安市挽弓', phase: 'P2', desc: '安市城頭開硬弓守禦，防守反擊時箭矢威力提升' },
  CHOIMUSEON: { name: '火桶神機箭', phase: 'P2', desc: '高麗火藥宗師，發射走火神機箭造成雙目標爆破傷害' },
  YOICHI: { name: '屋島扇之的', phase: 'P2', desc: '屋島狂瀾一箭射落扇靶，低費高精準貫穿狙擊' },
  SAIKA: { name: '八咫烏銃擊', phase: 'P2', desc: '紀伊雜賀眾火銃游擊，強化近衛攔截火網' },
  MATSUNAGA: { name: '平蜘蛛爆烈', phase: 'P2', desc: '火藥大陣齊射，退場時引爆火藥重創來敵' },
  TORII: { name: '伏見絕唱', phase: 'P2', desc: '伏見城死守到底，力戰不退阻滯敵軍攻勢' },
  HONDA_TADATSUGU: { name: '三河銃衛', phase: 'P2', desc: '長篠三河鐵砲先鋒，穩定提供低費反騎支援' },
  XIEXUAN: { name: '北府風鶴', phase: 'P2', desc: '淝水之戰八萬破八十萬，擊潰前鋒引發風聲鶴唳使敵軍恐慌減攻' },
  TIANDAN: { name: '即墨火牛陣', phase: 'P2', desc: '千頭五彩火牛狂奔衝陣，以兩孤城復齊七十餘城，全場烈焰混亂' },
  LUMENG: { name: '白衣渡江', phase: 'P1', desc: '白衣商船無聲奪取烽火台，極高隱匿直襲敵方主帥與中軍' },
  CAOBIN: { name: '浮橋平江南', phase: 'P2', desc: '北宋開國第一元帥架浮橋渡長江，統帥全軍協同護陣並強化攻堅' },
  YISUNSIN: { name: '鳴梁龜船', phase: 'P2', desc: '忠武公十二艘破百三十三艘，鐵甲龜船進退自如兼克潛行奇兵' },
  YUYUNWEN: { name: '采石霹靂', phase: 'P2', desc: '采石磯一萬八千破完顏亮四十萬大軍，海鰍船霹靂火砲轟碎敵陣' },
  JIANGWEI: { name: '九伐天水', phase: 'P2', desc: '天水麒麟文武兼備，兼具軍師謀略先機與險道穿插破甲' },
  XUHUANG: { name: '長驅破十屯', phase: 'P3', desc: '周亞夫之風長驅直入，連破關羽十重鹿角無視防禦工事' },
  GANNING: { name: '百騎劫營', phase: 'P2', desc: '頭插鳥羽腰繫銅鈴，百騎夜襲曹營不損一人，奇襲暴擊大增' },
  MOURI_MOTO: { name: '三矢嚴島', phase: 'P2', desc: '西國謀神暴風雨夜水陸奇襲，三矢齊發同時削弱敵方攻防與謀略' },
  YUEJIN: { name: '無堅不陷', phase: 'P2', desc: '五子良將每戰先登，首波交鋒強勢破除敵方護甲防線' },
  WEIYAN: { name: '子午奇略', phase: 'P2', desc: '奇兵直出子午谷，對敵方高價值主將造成額外伏擊暴擊' },
  DINGFENG: { name: '雪中奮短兵', phase: 'P3', desc: '東興之戰頂風冒雪卸甲持短兵突入敵陣，近戰連擊破防' },
  HUANGGAI: { name: '苦肉火船', phase: 'P2', desc: '赤壁詐降駕膏油火船撞擊連環戰艦，同時焚燒雙目標' },
  JANGPOGO: { name: '清海鎮海王', phase: 'P2', desc: '制霸黃海肅清海盜，協同防空攔截並看破敵方潛行奇襲' },
  HEQI: { name: '艨艟丹陽甲', phase: 'P2', desc: '兵甲器械極盡精良，強化先登防護並反制敵方伏兵' },
  CHOSOKABE: { name: '一領具足', phase: 'P2', desc: '土佐半農半兵神速動員，水陸兩棲突襲攻守兼備' },
  KUKI: { name: '鐵甲船大筒', phase: 'P2', desc: '外覆鐵皮防箭防火，協同攔截並為攻城火器提供觀瞻引導' },
  HATTORI: { name: '伊賀影縫', phase: 'P2', desc: '鬼半藏極高隱匿潛入敵陣，專門暗殺未設防之高費目標' },
  JEONGJI: { name: '觀音浦斬寇', phase: 'P2', desc: '高麗水師艦載火砲齊發，壓制敵方水陸奇兵' },
  MENGHUO: { name: '南中藤甲象', phase: 'P3', desc: '南中生藤重甲與象兵據險突擊，山岳森林四夷陣攻防提升50%' },
  SHAMOKE: { name: '鐵蒺藜骨朵', phase: 'P2', desc: '五溪蠻王神力破甲，山岳森林四夷陣爆發越級奇襲' },
  TOUDO: { name: '水城改築', phase: 'P2', desc: '水軍與築城兼通，穩定提供低費謀略與先登支援' },
  WAKIZAKA: { name: '淡路快船', phase: 'P2', desc: '賤岳七本槍水軍先鋒，輕舟快櫓搶先登岸' },
  MURAKAMI: { name: '能島焙烙玉', phase: 'P2', desc: '瀨戶內海能島水軍，投擲焙烙火藥玉焚燒敵船' },
  SUNWU: { name: '兵聖十三篇', phase: 'P1', desc: '知彼知己百戰不殆，全場最高謀略壓制敵陣並展開護軍大陣' },
  ZHUGELIANG: { name: '八陣通神', phase: 'P1', desc: '臥龍奇門八陣圖，運籌帷幄奪取先機並化解敵方先制斬首' },
  HANXIN: { name: '十面埋伏', phase: 'P1', desc: '韓信點兵多多益善，兼具頂級兵仙謀略與垓下十面埋伏斬首' },
  ZHANGLIANG: { name: '運籌千里', phase: 'P1', desc: '運籌帷幄之中決勝千里之外，大幅提升全軍命中與攻城校射' },
  WUQI: { name: '吳子魏武卒', phase: 'P1', desc: '兵家亞聖七十六戰全勝，先制破除敵方箭陣並強化全軍戰力' },
  SUNBIN: { name: '圍魏救趙', phase: 'P1', desc: '減灶誘敵與馬陵道伏兵，先制瓦解敵方遠程並持續火力壓制' },
  LEYI: { name: '昌國合縱', phase: 'P1', desc: '統率五國聯軍連克齊城七十餘座，聯合作戰大幅壓制敵方陣列' },
  LIUBOWEN: { name: '神機誠意', phase: 'P1', desc: '大明開國帝師神機妙算，洞悉天機提升全軍謀略與校射威力' },
  CAOCAO: { name: '孟德新書', phase: 'P1', desc: '挾天子以令諸侯，官渡奇謀奪取戰場先機並提振全軍統率' },
  SIMAYI: { name: '鷹視狼顧', phase: 'P1', desc: '深謀遠慮堅壁待時，持久戰氣力深厚並穩固全軍陣腳' },
  ZHOUYU: { name: '赤壁東風', phase: 'P1', desc: '雅量江東火燒連環船，展開護軍水陣並直擊敵方主帥核心' },
  XUNYU: { name: '王佐居中', phase: 'P1', desc: '王佐之才留守調度，穩固大軍後勤並提供精準戰場觀瞻' },
  PANGTONG: { name: '鳳雛連環', phase: 'P1', desc: '與臥龍齊名之鳳雛，獻連環奇策鎖定敵陣並引導攻城重轟' },
  TOKUGAWA: { name: '東照大權現', phase: 'P1', desc: '三河隱忍開創江戶幕府，百戰氣力深厚於持久戰後發制人' },
  TOYOTOMI: { name: '中國大返還', phase: 'P1', desc: '太閤神速行軍與黃金調度，大幅強化全軍謀略協同' },
  LUSU: { name: '榻上宏圖', phase: 'P1', desc: '提出榻上策促成孫劉聯盟，以$2費用即可啟動八陣神機網(謀略≥50)' },
  GUOJIA: { name: '十勝遺計', phase: 'P1', desc: '十勝十敗鬼才奇策，謀略達50並於首階段直取敵方主帥' },
  JIAXU: { name: '毒士亂武', phase: 'P1', desc: '算無遺策離間破敵，高隱匿先制瓦解敵方遠程防線' },
  LUXUN: { name: '火燒連營', phase: 'P1', desc: '書生都督後發制人，夷陵烈火連綿七百里貫穿敵方重甲' },
  FAZHENG: { name: '定軍奇畫', phase: 'P1', desc: '蜀漢奇謀翼侯登高指授，引導全軍集火斬將' },
  PANGJUAN: { name: '桂陵急攻', phase: 'P1', desc: '魏武上將強勢進逼，低費提供階段一主帥打擊與謀略支援' },
  KANBEI: { name: '如水奇策', phase: 'P1', desc: '備中高松水攻幕僚，以$1低費提供高謀略與觀瞻校射' },
  HANBEI: { name: '十人奪城', phase: 'P1', desc: '美濃今孔明智奪稻葉山城，輕費奇謀輔佐大軍' },
  SANADAMASA: { name: '表裏比興', phase: 'P1', desc: '上田城鬼謀以小博大，對敵軍造成破甲奇計傷害' },
  SHIMAZU_YOSHIHISA: { name: '薩摩釣野伏', phase: 'P1', desc: '九州三州太守，配合先登與突騎設伏合圍敵軍' }
};

const UNITS = RAW_UNITS.map(r => {
  const [id, name, cat, cost, v, tag, desc, st, ew, traits, roleFlags, hp, atk, def] = r;
  const meta = UNIT_META[id] || {
    flag: '🇨🇳', origin: '東亞名將',
    weapon: '傳世名兵',
    sfx: 'blade_clash',
    img: ''
  };
  const skill = UNIT_SKILLS[id] || { name: tag.split('·')[0] || '名將絕技', phase: 'P3', desc: desc };
  return {
    id, name, cat, cost, v, tag, desc, traits, roleFlags,
    st, ew,
    hp, atk, def,
    skill,
    flag: meta.flag,
    origin: meta.origin,
    weapon: meta.weapon,
    sfx: meta.sfx,
    img: meta.img
  };
});

const UNIT_MAP = {};
UNITS.forEach(u => { UNIT_MAP[u.id] = u; });

/* ---------- 古代軍陣協同羈絆 (Ancient Battle Formations) ---------- */
const DRONE_IDS = new Set(['TIANDAN', 'HUANGGAI', 'MURAKAMI', 'SHAMOKE', 'MATSUNAGA']);

const SYNERGIES = [
  {
    id: 'cec',
    icon: '📜',
    name: '八陣神機網',
    desc: '頂尖智聖 (謀略≥50) ＋ 斷騎護將／遠程神射：全軍謀略 +12、神射命中 +6%',
    check: units => units.some(u => (u.ew || 0) >= 50) && units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG')),
    partial: units => {
      const hasEw = units.some(u => (u.ew || 0) >= 50);
      const hasAa = units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG'));
      if (hasEw && !hasAa) return '已備妥頂級軍師，再選【神射強弩或斷騎護將】即可啟動：全軍謀略 +12、神射命中 +6%';
      if (!hasEw && hasAa) return '已備妥神射大陣，再選【$5 頂級軍師 (謀略≥50)】即可啟動：全軍謀略 +12、神射命中 +6%';
      return null;
    }
  },
  {
    id: 'mumt',
    icon: '⚡',
    name: '奇正相生陣',
    desc: '$5 傳奇飛將突騎 ＋ 死士／奇兵伏擊／火攻隊：奇兵與器械傷害 +15%、全體隱匿 +5',
    check: units => units.some(u => u.cat === 'air' && u.cost === 5) && units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM')),
    partial: units => {
      const has5th = units.some(u => u.cat === 'air' && u.cost === 5);
      const hasDrone = units.some(u => DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM'));
      if (has5th && !hasDrone) return '已備妥 $5 飛將突騎，再選【先登死士／奇兵／火攻隊】即可啟動：奇兵傷害 +15%、全軍隱匿 +5';
      if (!has5th && hasDrone) return '已備妥奇兵部隊，再選【$5 傳奇飛將突騎】即可啟動：奇兵傷害 +15%、全軍隱匿 +5';
      return null;
    }
  },
  {
    id: 'asw_net',
    icon: '⚔️',
    name: '水陸伏波破暗陣',
    desc: '先登奇兵／潛行將領 ＋ 謀略高士 (謀略≥15 或 SPOT)：先登命中 +6%、先登傷害 +12%',
    check: units => units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB')) && units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasNav = units.some(u => (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB'));
      const hasSpot = units.some(u => (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT'));
      if (hasNav && !hasSpot) return '已備妥先登奇兵，再選【高智謀臣或觀瞻名將 (謀略≥15)】即可啟動：先登命中 +6%、先登傷害 +12%';
      return null;
    }
  },
  {
    id: 'iron_fist',
    icon: '🛡️',
    name: '步騎火砲合圍',
    desc: '重甲陷陣大將 ＋ 攻城器械／前觀引導：階段三重甲與火砲傷害 +10%',
    check: units => units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS')) && units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT')),
    partial: units => {
      const hasTank = units.some(u => (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS'));
      const hasArty = units.some(u => (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT'));
      if (hasTank && !hasArty) return '已備妥重甲中軍，再選【攻城投石／火器器械／觀瞻名將】即可啟動：重甲與砲火傷害 +10%';
      if (!hasTank && hasArty) return '已備妥攻城支援，再選【重甲陷陣／大盾名將】即可啟動：重甲與砲火傷害 +10%';
      return null;
    }
  }
];

function getDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length < 2) return [];
  return SYNERGIES.filter(syn => syn.check(units));
}

function getPartialDeckSynergies(idsOrUnits) {
  const units = (idsOrUnits || []).map(x => (typeof x === 'string' ? UNIT_MAP[x] : x)).filter(Boolean);
  if (units.length === 0 || units.length >= 5) return [];
  const out = [];
  for (const syn of SYNERGIES) {
    if (!syn.check(units) && typeof syn.partial === 'function') {
      const hint = syn.partial(units);
      if (hint) out.push({ id: syn.id, icon: syn.icon, name: syn.name, hint });
    }
  }
  return out;
}

function getUnitSynergyHints(u) {
  if (!u) return [];
  const hints = [];
  const isCecEw = (u.ew || 0) >= 50;
  const isCecAa = (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG');
  if (isCecEw) hints.push({ icon: '📜', name: '八陣神機網', hint: '搭配【斷騎護將／神射弩陣】可啟動：全軍謀略+12、神射命中+6%' });
  if (isCecAa) hints.push({ icon: '📜', name: '八陣神機網', hint: '搭配【$5 頂尖智聖】可啟動：全軍謀略+12、神射命中+6%' });

  const is5th = u.cat === 'air' && u.cost === 5;
  const isDrone = DRONE_IDS.has(u.id) || (u.traits || []).includes('SWARM');
  if (is5th) hints.push({ icon: '⚡', name: '奇正相生陣', hint: '搭配【先登死士／奇兵／火攻隊】可啟動：奇兵傷害+15%、全軍隱匿+5' });
  if (isDrone) hints.push({ icon: '⚡', name: '奇正相生陣', hint: '搭配【$5 傳奇飛將突騎】可啟動：奇兵傷害+15%、全軍隱匿+5' });

  const isNav = (u.traits || []).includes('ASW') || (u.traits || []).includes('SUB');
  const isSpot = (u.ew || 0) >= 15 || (u.traits || []).includes('SPOT');
  if (isNav) hints.push({ icon: '⚔️', name: '水陸伏波破暗陣', hint: '搭配【高智謀臣或觀瞻名將】可啟動：先登命中+6%、先登傷害+12%' });
  if (isSpot && u.cat !== 'naval') hints.push({ icon: '⚔️', name: '水陸伏波破暗陣', hint: '搭配【先登奇兵／潛行將領】可啟動：先登命中+6%、先登傷害+12%' });

  const isTank = (u.traits || []).includes('HEAVY') || (u.traits || []).includes('APS');
  const isArty = (u.traits || []).includes('ARTY') || (u.traits || []).includes('SPOT');
  if (isTank) hints.push({ icon: '🛡️', name: '步騎火砲合圍', hint: '搭配【攻城器械／前觀引導】可啟動：重甲與火砲傷害+10%' });
  if (isArty && u.cat !== 'armor') hints.push({ icon: '🛡️', name: '步騎火砲合圍', hint: '搭配【重甲陷陣／大盾名將】可啟動：重甲與火砲傷害+10%' });

  return hints;
}

const MAX_HP = Math.max(...UNITS.map(u => u.hp));
const MAX_ATK = Math.max(...UNITS.map(u => u.atk));

const CAT_HINT = {
  air:         '擅長：高速突擊、側翼破陣。害怕：神射強弩（隱匿奇襲可減少箭雨攔截）。',
  armor:       '擅長：正面死鬥、掌握戰線控制分。害怕：側翼包抄、刺客死士與攻城火砲。',
  air_defense: '擅長：攔截突騎（×2.5）。害怕：階段一被軍師奇謀先制破陣。',
  naval:       '擅長：陣前鬥將、先登水陸奇襲。潛行夜襲刺客需靠看破反伏將領克制。',
  support:     '擅長：軍師謀略先攻、先制破陣斬首、攻城火砲。本身需護衛保護。'
};

/* ---------- 名將氣力與戰術能力標籤 ---------- */
function getUnitRealismBadges(u) {
  if (!u) return { magLabel: '', specials: [] };
  const isDeep = (u.roleFlags || []).includes('STAMINA_DEEP');
  const magLabel = isDeep
    ? '🥋 百戰老將（主力招式 5 波 ➔ 次要 3 波 ➔ 貼身肉搏）'
    : '🥋 充沛氣力（主力招式 4 波 ➔ 次要 3 波 ➔ 貼身肉搏）';
  const specials = [];
  if (u.skill && u.skill.name) {
    specials.push({ icon: '🔥', title: `專屬戰法【${u.skill.name}】`, desc: u.skill.desc });
  }
  if (isDeep) {
    specials.push({ icon: '🔋', title: '氣力深厚 (+1波)', desc: '主力招式與次要武技各多 1 波深度，持久戰戰力衰退更慢。' });
  }
  if ((u.roleFlags || []).includes('PASSIVE_VOLLEY')) {
    specials.push({ icon: '🏹', title: '隱蔽伏弩', desc: '善用地形隱蔽，階段一不會遭敵方先制破陣優先點名（若被鎖定敵命中 -18%）。' });
  }
  if ((u.roleFlags || []).includes('FORMATION_SHIELD')) {
    specials.push({ icon: '🛡️', title: '護軍大陣', desc: '階段一 78% 機率以大陣化解敵方首波斬首奇襲庇護全軍；無敵騎時轉為號令調度友軍。' });
  }
  if ((u.roleFlags || []).includes('STRATEGIST')) {
    specials.push({ icon: '📜', title: '運籌帷幄', desc: '運籌帷幄調動全軍集火打擊目標，自身不參與近身白刃戰。' });
  }
  if ((u.roleFlags || []).includes('HEAVY_AP')) {
    specials.push({ icon: '🗡️', title: '神兵破甲', desc: '即便進入力竭貼身肉搏階段，仍完整保有破甲（TRUE_AT）無視減傷能力。' });
  }
  return { magLabel, isDeep, specials };
}

/* ---------- 名將征戰服役勳章 (Mastery Ribbons) ---------- */
const MASTERY_STORAGE_KEY = 'wl15_unit_mastery';

function getUnitMasteryMap() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(MASTERY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function getUnitMasteryBadge(unitId) {
  if (!unitId) return null;
  const map = getUnitMasteryMap();
  const rec = map[unitId];
  if (!rec || !rec.s) return null;
  const s = Number(rec.s) || 0;
  const w = Number(rec.w) || 0;
  const m = Number(rec.m) || 0;
  const d = Math.round(Number(rec.d) || 0);
  const winRate = Math.round((w / Math.max(1, s)) * 100);
  let tier = 'service', icon = '🎖️', title = '實戰服役紀錄', color = '#38bdf8', nextHint = '';
  if (s >= 1000 && w >= 650 && (m >= 200 || w >= 800)) {
    tier = 'diamond'; icon = '💎'; title = '玉璽傳奇綬帶'; color = '#a855f7';
    nextHint = '已達最高傳奇服役榮譽';
  } else if (s >= 400 && w >= 250 && (m >= 80 || w >= 320)) {
    tier = 'gold'; icon = '🥇'; title = '金印名將綬帶'; color = '#fbbf24';
    nextHint = `晉升💎玉璽傳奇：出征 ${s}/1000 · 勝場 ${w}/650 · 斬將破陣 ${m}/200`;
  } else if (s >= 150 && w >= 90 && (m >= 30 || w >= 120)) {
    tier = 'silver'; icon = '🥈'; title = '銀印精銳綬帶'; color = '#e2e8f0';
    nextHint = `晉升🥇金印名將：出征 ${s}/400 · 勝場 ${w}/250 · 斬將破陣 ${m}/80`;
  } else if (s >= 50 && w >= 30 && (m >= 10 || w >= 40)) {
    tier = 'bronze'; icon = '🥉'; title = '銅印百戰綬帶'; color = '#f59e0b';
    nextHint = `晉升🥈銀印精銳：出征 ${s}/150 · 勝場 ${w}/90 · 斬將破陣 ${m}/30`;
  } else {
    nextHint = `解鎖🥉銅印百戰：出征 ${s}/50 · 勝場 ${w}/30 · 斬將破陣 ${m}/10`;
  }
  return {
    tier, icon, title, color,
    sorties: s, wins: w, mvps: m, dmg: d, winRate, nextHint,
    summary: `出征 ${s} 場 · 勝場 ${w} (${winRate}%) · 斬將破陣 ${m} 次 · 累計殺傷 ${d.toLocaleString()}`
  };
}

function recordUnitMasteryFromBattle(res, mySide = 'A') {
  try {
    if (typeof localStorage === 'undefined' || !res || !res.final) return;
    const myUnits = res.final[mySide] || [];
    if (!myUnits.length) return;
    const won = res.winner === mySide;
    const myMvp = res.mvp ? res.mvp[mySide] : null;
    const map = getUnitMasteryMap();
    myUnits.forEach(u => {
      if (!u || !u.id) return;
      const cur = map[u.id] || { s: 0, w: 0, m: 0, d: 0 };
      cur.s = (Number(cur.s) || 0) + 1;
      if (won) {
        cur.w = (Number(cur.w) || 0) + 1;
        if (myMvp && myMvp.id === u.id && (Number(u.dmgDone) || 0) > 0) {
          cur.m = (Number(cur.m) || 0) + 1;
        }
      }
      cur.d = Math.round((Number(cur.d) || 0) + (Number(u.dmgDone) || 0));
      map[u.id] = cur;
    });
    localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

/* ---------- 推薦經典名將陣容 (Recommended Historical Formations) ---------- */
const TEMPLATES = [
  { name: '八陣神機', note: '諸葛奇謀＋八陣合圍', ids: ['ZHANGLIAO', 'DIANWEI', 'ZHANGHE', 'SHAMOKE', 'ZHUGELIANG'] },
  { name: '封狼居胥', note: '霍去病千里奔襲破敵', ids: ['HUO', 'YUJIN', 'TAISHICI', 'DINGFENG', 'PANGTONG'] },
  { name: '殺神陷陣', note: '武安君白起正面破陣', ids: ['XIAHOUYUAN', 'BAIQI', 'CHOIMUSEON', 'CHOSOKABE', 'TOKUGAWA'] },
  { name: '鳴梁伏波', note: '周瑜火攻與忠武公李舜臣水陸連環', ids: ['LINGTONG', 'CAOREN', 'ZONGZE', 'YISUNSIN', 'ZHOUYU'] },
  { name: '天下布武', note: '織田信長三段火器與日本名將合擊', ids: ['YAMAGATA', 'SHIBATA', 'NOBUNAGA', 'HATTORI', 'SHIMAZU_YOSHIHISA'] }
];

/* 暴露至全域物件以便跨模組與 Playwright 調用 */
if (typeof window !== 'undefined') {
  window.BUDGET = BUDGET;
  window.CATS = CATS;
  window.TRAITS = TRAITS;
  window.CAT_HINT = CAT_HINT;
  window.UNITS = UNITS;
  window.UNIT_SKILLS = UNIT_SKILLS;
  window.UNIT_MAP = UNIT_MAP;
  window.SYNERGIES = SYNERGIES;
  window.TEMPLATES = TEMPLATES;
  window.getDeckSynergies = getDeckSynergies;
  window.getUnitSynergyHints = getUnitSynergyHints;
  window.getUnitRealismBadges = getUnitRealismBadges;
  window.getUnitMasteryBadge = getUnitMasteryBadge;
  window.recordUnitMasteryFromBattle = recordUnitMasteryFromBattle;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUDGET, CATS, TRAITS, CAT_HINT, UNITS, UNIT_MAP, SYNERGIES, TEMPLATES,
    getDeckSynergies, getUnitSynergyHints, getUnitRealismBadges,
    getUnitMasteryBadge, recordUnitMasteryFromBattle
  };
}