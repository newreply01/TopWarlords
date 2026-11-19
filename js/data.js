'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords) — 資料層
   125 位日韓中歷史名將，依五大兵團與五階費用編制
   100% 具備專屬戰術特性、專屬兵器與獨立五維數值
   ===================================================== */
const BUDGET = 15;

const CATS = {
  air:         { label: '奔雷突騎', short: '騎軍', color: '#d97706' },
  armor:       { label: '重甲陷陣', short: '盾衛', color: '#b45309' },
  air_defense: { label: '神射強弩', short: '強弩', color: '#7c3aed' },
  naval:       { label: '先登奇兵', short: '先登', color: '#0d9488' },
  support:     { label: '軍師奇謀', short: '奇謀', color: '#15803d' }
};

/* 五軍種各一位將領；每隊預算仍為 15 */
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
  HEAVY:   '玄甲厚鎧：精銳重鎧防護（減傷 22%～28%；遭破甲攻擊時仍保留 25% 底線護甲）',
  APS:     '重盾格擋：大盾自動格擋敵軍第一次來襲的重擊',
  AA_LONG: '強弓遠射：神射強弩命中率 +8%',
  CIWS:    '近衛拒馬：敵方死士與連環火攻傷害減半',
  AEGIS:   '斷騎護陣：階段二可協同神射攔截敵方突騎（火力 55%）',
  SUB:     '潛行夜襲：隱匿極高；對未設防部隊傷害 ×1.3',
  ASW:     '看破反伏：專克潛行夜襲與忍者，傷害 ×1.6',
  AMBUSH:  '奇襲（跨軍種）：每場首次成功攻擊高費目標（高出 ≥2 費，或四／五費精銳對決四／五費目標），傷害 ×1.25',
  SWARM:   '多路並進：同時攻擊兩個目標（單次傷害 ×0.6）',
  EW:      '運籌帷幄：謀略值領先越多，敵方命中最多 −9%、己方攻擊最多 +7%',
  SEAD:    '先制破陣：階段一先制打擊敵方神射箭陣',
  DEEP:    '十面埋伏：階段一直擊敵方最昂貴主帥核心',
  ARTY:    '攻城砲火：第三階段持續以投石火砲轟擊敵陣',
  SAT:     '箭雨覆蓋：同時攻擊兩個目標（單次傷害 ×0.75）',
  TRUE_AT: '破甲重擊：無視重鎧減傷（真實傷害），對重甲額外破防加成',
  SPOT:    '登高觀瞻：為友軍攻城器械與火砲提供校射，傷害 +15%'
};

/* [id, 名稱, 兵種, 費用, 風格, 稱號, 傳記, 隱匿, 謀略, 特性[], roleFlags[], HP, ATK, DEF] */
const RAW_UNITS = [
  ["HUO", "霍去病", 'air', 5, 'A', "封狼居胥·千里奔襲", "西漢傳奇驃騎將軍，開創大兵團長途奔襲與穿插包抄，六出塞外殲匈奴數萬，勇冠三軍。", 90, 22, ["LR", "CAS"], ["STAMINA_DEEP"], 238, 140, 0.02],
  ["WEI", "衛青", 'air', 4, 'B', "車騎並進·七戰七捷", "西漢大將軍大司馬，首創武剛車結陣與奇兵繞後突擊，收復河套，正面硬撼匈奴單于主力。", 74, 28, ["LR", "CAS", "EW"], ["STAMINA_DEEP"], 212, 120, 0.04],
  ["LUBU", "呂布", 'air', 5, 'C', "人中呂布·馬中赤兔", "三國第一飛將，善騎射長驅破陣，率陷陣並州鐵騎正面踐踏敵陣，無人能擋。", 76, 14, ["LR", "CAS", "TRUE_AT"], ["HEAVY_AP"], 248, 146, 0.05],
  ["YOSHITSUNE", "源義經", 'air', 5, 'F', "鵯越絕壁·戰神逆落", "日本源平合戰第一戰神，率騎兵由一之谷絕壁馳騁逆落、繞過正面盾陣直撲敵軍後陣弩炮與本營，機動突襲冠絕戰史。", 88, 26, ["LR", "CAS", "DEEP"], ["STAMINA_DEEP"], 232, 136, 0.02],
  ["SHINGEN", "武田信玄", 'air', 5, 'G', "甲斐之虎·風林火山", "戰國第一騎兵大師，建立威震列島之赤備騎兵軍團，動如雷霆正面摧垮敵陣。", 80, 30, ["LR", "CAS", "EW"], ["STAMINA_DEEP"], 240, 134, 0.04],
  ["GAISUWEN", "淵蓋蘇文", 'air', 2, 'H', "身佩五刀·高句麗雄霸", "高句麗末期莫離支統帥，勇武過人善騎戰，身配五把飛刀飛馳衝殺，威震東北亞。", 52, 16, ["LR", "CAS", "TRUE_AT"], ["HEAVY_AP"], 142, 86, 0.02],
  ["ZHAOYUN", "趙雲", 'air', 4, 'A', "渾身是膽·七進七出", "蜀漢常山趙子龍，長坂坡單騎護主突破萬重重圍，漢水之戰大開營門空營退敵，百戰無傷。", 76, 20, ["LR", "CAS"], ["STAMINA_DEEP"], 212, 120, 0.03],
  ["MACHO", "馬超", 'air', 3, 'B', "錦馬超·西涼鐵騎突陣", "西涼名門之後，統帥善長矛重甲之涼州羌胡精騎，渭水之戰一度迫使曹操割鬚棄袍。", 60, 14, ["LR", "CAS", "TRUE_AT"], ["HEAVY_AP"], 174, 104, 0.02],
  ["ZHANGLIAO", "張遼", 'air', 4, 'C', "逍遙津突襲·威震江東", "曹魏五子良將之首，親率八百壯士直衝十萬東吳中軍大旗，名震天下、江東小兒不敢夜啼。", 76, 24, ["LR", "TRUE_AT"], ["STAMINA_DEEP"], 212, 120, 0.03],
  ["CHENQINGZHI", "陳慶之", 'air', 4, 'E', "白袍神兵·名師莫敢前", "南梁名將，率七千白袍精騎深入敵境十四月，歷四十七戰拔三十二城，所向皆靡。", 78, 32, ["LR", "CAS", "EW"], ["STAMINA_DEEP"], 206, 118, 0.02],
  ["KENSHIN", "上杉謙信", 'air', 5, 'F', "越後之龍·車懸奔流", "戰國軍神，以毘沙門天為旗，獨創「車懸之陣」由騎兵輪番交替衝陣，川中島直斬敵帥。", 82, 26, ["LR", "CAS", "SAT"], ["STAMINA_DEEP"], 236, 138, 0.03],
  ["YUKIMURA", "真田幸村", 'air', 3, 'G', "日本第一兵·直衝本陣", "戰國末期傳奇猛將，大阪夏之陣率赤備突擊三次直撞德川家康本陣大旗，英烈千古。", 62, 18, ["LR", "CAS", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 172, 104, 0.02],
  ["KIMYUSHIN", "金庾信", 'air', 4, 'H', "新羅太大角干·風火神騎", "新羅名將興武大王，統御花郎精銳鐵騎連戰連捷擊破百濟與高句麗，完成三國統一之宏業。", 74, 28, ["LR", "EW", "CAS"], ["STAMINA_DEEP"], 210, 116, 0.03],
  ["SUNCE", "孫策", 'air', 3, 'I', "小霸王·席捲江東", "東漢末年名將，承父志率軍渡江，迅速平定江東多郡，為孫吳政權奠定根基。", 60, 18, ["LR", "CAS"], ["STAMINA_DEEP"], 172, 102, 0.03],
  ["GAOCHANGGONG", "高長恭", 'air', 3, 'A', "邙山破圍·蘭陵鐵面", "北齊蘭陵王，音容兼美而勇冠三軍，邙山之戰戴猙獰鐵面率五百重騎直貫北周十萬重圍解洛陽之困，軍中歌〈蘭陵王入陣曲〉。", 62, 22, ["CAS", "LR", "TRUE_AT"], ["HEAVY_AP"], 172, 100, 0.05],
  ["XIAHOUYUAN", "夏侯淵", 'air', 2, 'B', "虎步關右·三日五百", "曹魏名將，善於極速奔襲調動部隊，「典軍校尉夏侯淵，三日五百，六日一千」。", 52, 14, ["CAS", "LR"], [], 140, 84, 0],
  ["MADAI", "馬岱", 'air', 1, 'C', "西涼輕騎·北伐斬叛", "蜀漢平北將軍、西涼名將馬超從弟，善率西涼輕騎迂迴突襲，從征北伐破牛金、受遺計追斬魏延。", 44, 16, ["LR", "TRUE_AT"], [], 112, 68, 0],
  ["DATE", "伊達政宗", 'air', 3, 'F', "獨眼龍·騎鐵先驅", "奧羽霸主，創立裝備火繩槍與重甲之「騎馬鐵砲隊」，兼具機動性與毀滅齊射。", 62, 22, ["EW", "LR", "CAS"], ["STAMINA_DEEP"], 170, 100, 0.02],
  ["EULJI", "乙支文德", 'air', 2, 'H', "佯退誘敵·薩水反擊", "高句麗將領，於隋軍深入後利用佯退與追擊取得薩水之戰勝利；截水築壩故事缺乏同時代來源支持。", 52, 30, ["EW", "LR"], [], 140, 84, 0.01],
  ["WANGSHUANG", "王雙", 'air', 1, 'B', "陳倉猛追·萬夫莫當", "曹魏陳倉虎將，膂力過人善使大刀與流星錘，率鐵騎追擊撤退蜀軍連斬數將，勇冠三軍。", 36, 12, ["CAS", "TRUE_AT"], [], 114, 68, 0],
  ["YAMAGATA", "山縣昌景", 'air', 1, 'F', "赤備猛將·長驅衝鋒", "武田四天王之首，身穿鮮紅鎧甲之赤備先鋒隊躍馬衝陣，威名震懾織田德川聯軍。", 38, 12, ["CAS", "LR"], [], 114, 68, 0.01],
  ["TACHIBANA", "立花宗茂", 'air', 2, 'G', "西國無雙·勇猛無匹", "九州名將，以迅猛機敏的野戰突襲與突圍見長，被豐臣秀吉讚譽為「西國無雙」。", 50, 18, ["LR", "CAS", "TRUE_AT"], ["STAMINA_DEEP"], 142, 86, 0.02],
  ["ZHAOSHE", "趙奢", 'air', 2, 'H', "狹路相逢·馬服奔馳", "戰國名將馬服君，以「狹路相逢勇者勝」之膽魄千里疾馳救援閼與，出其不意大破秦軍主力。", 48, 24, ["LR", "CAS"], [], 138, 84, 0],
  ["PANGDE", "龐德", 'air', 1, 'A', "抬櫬出陣·白馬射關", "曹魏勇將，抬棺出征誓死死戰，樊城陣前一箭正中關羽前額。", 34, 12, ["CAS", "TRUE_AT"], [], 116, 70, 0.02],
  ["MAEDATOSHI", "前田利家", 'air', 1, 'H', "槍之又左·赤母衣突擊", "戰國著名猛將，織田信長親兵赤母衣眾筆頭，勇冠三軍，以超絕騎槍技術開創加賀百萬石祖業。", 38, 14, ["LR", "CAS"], [], 112, 68, 0],
  ["BAIQI", "白起", 'armor', 5, 'A', "武安君·長平殲滅", "戰國四大名將之首，善打殲滅戰，伊闕斬首二十四萬、長平合圍坑趙軍四十五萬，攻無不克。", 10, 20, ["APS", "HEAVY", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 380, 132, 0.28],
  ["XIANGYU", "項羽", 'armor', 5, 'B', "霸王破釜·以一當百", "西楚霸王，千古無二之勇力，鉅鹿之戰破釜沉舟九戰九捷擊潰秦軍主力二十萬。", 12, 12, ["APS", "TRUE_AT"], ["HEAVY_AP"], 376, 142, 0.26],
  ["YUEFEI", "岳飛", 'armor', 5, 'C', "撼山易·撼岳家軍難", "南宋民族英雄，創建紀律森嚴之岳家軍，朱仙鎮以麻札刀大破金兀朮拐子馬鐵浮屠。", 12, 26, ["APS", "HEAVY", "EW"], ["STAMINA_DEEP"], 380, 136, 0.28],
  ["WANGJIAN", "王翦", 'armor', 4, 'D', "秦滅六國·穩若泰山", "秦代統帥，以沉穩堅壁著稱，率六十萬秦軍重步大陣相持整年，終滅強楚統一天下。", 10, 24, ["APS", "HEAVY"], ["STAMINA_DEEP"], 326, 110, 0.28],
  ["HONDA", "本多忠勝", 'armor', 5, 'F', "戰國第一槍·五十七戰無傷", "德川四天王之首，一生經歷大小五十七次激烈合戰，未曾受過刀箭之傷，被譽為花實兼備之勇將。", 12, 16, ["APS", "HEAVY", "TRUE_AT"], ["STAMINA_DEEP"], 368, 130, 0.28],
  ["SHIBATA", "柴田勝家", 'armor', 2, 'G', "破瓶柴田·萬夫莫當", "織田家首席猛將，圍城時砸碎飲水瓶背水一戰大破敵軍，重甲長槍衝鋒所向披靡。", 10, 12, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 218, 82, 0.24],
  ["LIANPO", "廉頗", 'armor', 4, 'A', "負荊善守·長平堅壁", "戰國名將，築固若金湯之重壘固守三年拒強秦，老驥伏櫪志在千里。", 10, 18, ["APS", "HEAVY"], ["STAMINA_DEEP"], 322, 108, 0.28],
  ["MENGTIAN", "蒙恬", 'air_defense', 4, 'B', "秦軍強弩·築長城禦胡", "秦代大將，率三十萬秦軍北逐匈奴，依託秦軍重弩大陣與長城壁壘阻絕匈奴鐵騎，威震塞外。", 14, 22, ["AA_LONG", "CIWS", "TRUE_AT"], ["STAMINA_DEEP", "FORMATION_SHIELD"], 216, 112, 0.08],
  ["GUANYU", "關羽", 'armor', 5, 'C', "威震華夏·萬人敵重將", "漢末名將，水淹七軍擒于禁斬龐德威震華夏，白馬坡斬顏良解白馬之圍。", 14, 22, ["APS", "TRUE_AT", "HEAVY"], ["HEAVY_AP"], 372, 136, 0.26],
  ["ZHANGFEI", "張飛", 'armor', 4, 'D', "據水斷橋·萬人敵猛張飛", "漢末勇將，長坂坡據水斷橋瞋目橫矛大喝退曹軍，葭萌關夜戰力挫張郃。", 10, 12, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 316, 114, 0.25],
  ["HOJO_UJIYASU", "北條氏康", 'armor', 3, 'E', "相模之獅·小田原堅守", "後北條氏第三代當主，長期經營相模與關東，於河越合戰等戰事展現防衛與統率能力。", 12, 20, ["HEAVY", "APS"], ["STAMINA_DEEP"], 266, 94, 0.26],
  ["XIAHOU_DUN", "夏侯惇", 'armor', 2, 'F', "魏之元勳·拔矢啖睛", "曹魏重要將領與宗室重臣，長期參與曹操征戰並任前線統帥，拔矢啖睛剛烈無畏、以忠勇著稱。", 10, 14, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 226, 84, 0.24],
  ["TACHIBANAD", "立花道雪", 'armor', 3, 'G', "雷神化身·斬雷鐵壁", "九州大名，傳說曾拔刀斬雷身患腿疾，坐轎指揮重甲步陣數十年未嘗一敗。", 10, 20, ["APS", "HEAVY"], ["STAMINA_DEEP"], 264, 96, 0.26],
  ["CHOIYOUNG", "崔瑩", 'armor', 2, 'H', "黃金如石·高麗柱石", "高麗末期名將，「視黃金如爛泥」，歷經百戰擊潰倭寇與紅巾軍，一生剛毅不屈。", 10, 16, ["APS", "HEAVY"], [], 228, 84, 0.24],
  ["DIANWEI", "典韋", 'armor', 1, 'A', "古之惡來·雙鐵戟護主", "曹操親隨猛將，勇力過人力抗大旗，宛城之戰手提雙鐵戟堵塞營門死戰護主。", 8, 10, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 176, 68, 0.23],
  ["XUCHU", "許褚", 'armor', 3, 'B', "虎癡勇悍·倒拖雙牛", "曹魏武衛虎侯，勇冠三軍倒拖雙牛，潼關之戰護衛曹操渡河、渭南平馬超威震敵膽。", 8, 14, ["APS", "HEAVY", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 264, 96, 0.26],
  ["SHIMAZUY", "島津義弘", 'armor', 4, 'G', "鬼石曼子·重甲死戰", "薩摩軍神，關原之戰直面十萬東軍重重包圍，率重甲死士正面突破斬開生路。", 14, 16, ["HEAVY", "TRUE_AT", "APS"], ["HEAVY_AP"], 306, 110, 0.25],
  ["SUNJIAN", "孫堅", 'armor', 3, 'I', "江東猛虎·破董先鋒", "東漢末年名將，討伐董卓時率軍屢挫強敵，攻入洛陽並取得傳國玉璽，以勇烈聞名。", 12, 14, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 260, 96, 0.25],
  ["GYEBAEK", "階伯", 'armor', 1, 'H', "黃山伐決死·五千烈士", "百濟最後將領，以五千重步死士迎戰金庾信五萬新羅大軍，四戰四捷壯烈殉國。", 8, 12, ["APS", "HEAVY"], [], 176, 68, 0.23],
  ["YANGYE", "楊業", 'armor', 2, 'B', "金刀楊無敵·雁門破遼", "北宋名將，雁門關大捷斬遼國節度使，陳家谷身中數十箭力竭被俘不食而死。", 10, 16, ["HEAVY", "APS"], [], 228, 84, 0.25],
  ["CAOREN", "曹仁", 'armor', 3, 'C', "鐵壁天人·固守樊城", "曹魏第一防守大將，濡須與樊城數次面對絕境堅壁抗敵，被曹操譽為「天人之勇」。", 8, 18, ["HEAVY", "APS"], ["STAMINA_DEEP"], 266, 92, 0.27],
  ["ZHOUTAI", "周泰", 'armor', 1, 'D', "滿身傷疤·身如鐵石", "東吳猛將，宣城之戰以身代盾護衛孫權，身上傷口幾十處皮膚如刻畫。", 8, 10, ["APS", "HEAVY", "TRUE_AT"], [], 176, 66, 0.23],
  ["IINAOMASA", "井伊直政", 'armor', 2, 'F', "井伊赤鬼·赤備先鋒", "德川四天王之一，身披赤紅厚甲勇猛善戰，長篠與關原奮勇作戰負傷不退。", 12, 14, ["APS", "HEAVY", "TRUE_AT"], ["HEAVY_AP"], 228, 86, 0.25],
  ["KATOKIYOMASA", "加藤清正", 'armor', 1, 'G', "賤岳七本槍·築城重將", "豐臣家猛將，朝鮮之役建立蔚山倭城抗明聯軍，手使片鎌槍防禦極堅。", 8, 12, ["HEAVY", "APS"], [], 178, 68, 0.23],
  ["YUJIN", "于禁", 'armor', 1, 'A', "毅重治軍·持節抗敵", "曹魏五子良將，行軍治軍最為威嚴沉穩，逢難必爭死守營陣。", 8, 16, ["HEAVY", "APS"], [], 174, 66, 0.24],
  ["LIGUANG", "李廣", 'air_defense', 5, 'A', "漢之飛將·射石沒羽", "西漢名將，射術通神，「林暗草驚風，將軍夜引弓；平明尋白羽，沒在石稜中」。", 18, 22, ["AA_LONG", "CIWS", "TRUE_AT"], ["PASSIVE_VOLLEY"], 260, 138, 0.06],
  ["YANGYOUJI", "養由基", 'air_defense', 5, 'B', "百步穿楊·一矢斃命", "春秋楚國神射手，百步之外射楊柳葉百發百中，一箭能穿透七層重鎧。", 18, 20, ["AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 256, 142, 0.08],
  ["NOBUNAGA", "織田信長", 'air_defense', 5, 'D', "長篠三段·鐵砲破雷", "天下布武織田信長，長篠合戰集結三千火繩槍以三段輪射粉碎武田勝賴赤備騎兵。", 16, 28, ["AA_LONG", "CIWS", "TRUE_AT"], ["FORMATION_SHIELD"], 256, 136, 0.06],
  ["YOICHI", "那須與一", 'air_defense', 3, 'E', "扇之的·神弓定浪", "日本源平名射手，屋島合戰波濤洶湧中一箭射中搖晃戰船上的紅底金箔紅扇。", 18, 18, ["AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 172, 94, 0.04],
  ["JUMONG", "朱蒙", 'air_defense', 5, 'F', "東明神王·百發百中", "高句麗開國神王，因善射被尊稱「朱蒙」（善射者之意），騎射功夫通神。", 18, 22, ["AA_LONG", "CIWS", "TRUE_AT"], ["PASSIVE_VOLLEY"], 258, 136, 0.06],
  ["HUANGZHONG", "黃忠", 'air_defense', 4, 'A', "老當益壯·定軍神弦", "蜀漢五虎上將，百步穿楊弦無虛發，定軍山策馬衝鋒陣斬曹魏主帥夏侯淵。", 16, 20, ["AA_LONG", "CIWS", "TRUE_AT"], ["PASSIVE_VOLLEY"], 214, 114, 0.06],
  ["TAISHICI", "太史慈", 'air_defense', 3, 'B', "猿臂善射·搴旗斬將", "東吳名將，長於射術箭無虛發，城樓之上將反叛者之手一箭釘於城樓護木。", 14, 14, ["CIWS", "AA_LONG", "TRUE_AT"], [], 174, 96, 0.06],
  ["HANSHIZHONG", "韓世忠", 'air_defense', 4, 'C', "克敵神弓·大破鐵浮", "南宋名將，創「克敵弓」射程達數百步可貫雙甲，大破金兵連環鐵騎。", 16, 22, ["AA_LONG", "CIWS", "TRUE_AT"], [], 216, 114, 0.06],
  ["LIMU", "李牧", 'air_defense', 5, 'E', "破胡武安·萬矢連環", "戰國四大名將，以神射弓弩與車陣大破匈奴十餘萬騎，肥之戰與番吾之戰兩挫強秦，戰功卓絕。", 20, 34, ["AA_LONG", "CIWS", "SAT"], ["PASSIVE_VOLLEY"], 264, 136, 0.08],
  ["AKECHI", "明智光秀", 'air_defense', 3, 'E', "鐵砲名手·本能寺雷火", "戰國智勇名將，精通鐵砲連射戰法，曾於浪人時期以一槍百步穿錢名揚天下。", 18, 24, ["SAT", "AA_LONG"], [], 170, 92, 0.04],
  ["SAIKA", "雜賀孫市", 'air_defense', 4, 'F', "紀伊鐵砲·八咫烏之王", "雜賀眾首領鈴木重秀，率鐵砲傭兵重創織田信長大軍，火器游擊戰之宗師。", 20, 20, ["CIWS", "AA_LONG", "TRUE_AT"], ["PASSIVE_VOLLEY"], 208, 114, 0.05],
  ["GWONYUL", "權慄", 'air_defense', 2, 'G', "幸州大捷·火車拒敵", "朝鮮王朝中興名將，1593年壬辰倭亂期間於幸州山城運用神機箭火車、弓弩與滾石以少勝多擊退數萬日軍。", 14, 16, ["CIWS", "AA_LONG"], [], 142, 78, 0.06],
  ["HULUGUANG", "斛律光", 'air_defense', 4, 'H', "落雕都督·百步穿石", "北齊軍事支柱，號「落雕都督」，神射天下第一，臨陣射箭無不應弦而倒，生平百戰未嘗一敗。", 16, 24, ["AA_LONG", "CIWS", "TRUE_AT"], [], 210, 112, 0.06],
  ["MALONG", "馬隆", 'air_defense', 3, 'A', "奇謀強弩·涼州平叛", "西晉名將，率三千五百精兵孤軍深入涼州，依《八陣圖》創製偏箱車與強弩矢陣大破禿髮樹機能數萬鐵騎，威震西陲。", 18, 28, ["AA_LONG", "CIWS", "EW"], ["PASSIVE_VOLLEY"], 174, 94, 0.07],
  ["ZHOUYAFU", "周亞夫", 'armor', 4, 'C', "細柳嚴軍·重步堅壁", "西漢名將條侯，細柳營號令嚴整、披甲執銳連營固守，「軍中聞將軍令不聞天子之詔」，平定七國之亂營壘固若金湯。", 10, 26, ["APS", "HEAVY", "EW"], ["STAMINA_DEEP", "FORMATION_SHIELD"], 324, 110, 0.28],
  ["ZONGZE", "宗澤", 'air_defense', 2, 'D', "汴京連弩·過河名將", "南宋初年抗金名臣，重整東京汴京城防，築連弩箭樓二十餘座阻截金騎。", 14, 24, ["AA_LONG", "CIWS"], [], 144, 78, 0.06],
  ["TORII", "鳥居元忠", 'air_defense', 1, 'E', "三河武士·伏見鐵砲血戰", "德川忠臣，伏見城以少數守軍搭配鐵砲長弓死守半月，拖住西軍四萬主力，壯烈殉節。", 12, 16, ["AA_LONG", "CIWS"], [], 116, 62, 0.06],
  ["CHOIMUSEON", "崔茂宣", 'air_defense', 1, 'G', "高麗火砲之父·鎮海轟雷", "高麗科學家兼將領，首次自製火藥，並創立走火砲與神機箭破除倭寇。", 16, 20, ["CIWS", "AA_LONG", "SAT"], [], 114, 62, 0.04],
  ["GENGYAN", "耿弇", 'air_defense', 2, 'A', "雲台神將·圍城破援", "東漢雲台二十八將第四，連下四十六郡，精通強弩大陣與圍城打援，光武帝譽其戰功可比韓信。", 16, 22, ["AA_LONG", "CIWS"], [], 142, 78, 0.05],
  ["YAMAMOTO", "山本勘助", 'support', 1, 'E', "啄木鳥智謀·晴幸軍師", "武田信玄首席獨眼軍師，精通城郭築城、奇門陣法與兵略，於川中島合戰獻「啄木鳥戰法」名震戰國。", 38, 60, ["EW", "SPOT"], ["STRATEGIST"], 118, 58, 0.04],
  ["FENGYI", "馮異", 'air_defense', 2, 'C', "大樹將軍·巧設強弩", "東漢開國名將大樹將軍，善於以險阻地形設伏弩大陣，崤底之戰大破赤眉主力。", 18, 24, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 142, 78, 0.06],
  ["ASAKURA_SOT", "朝倉宗滴", 'air_defense', 2, 'E', "越前軍神·鐵砲先驅", "越前朝倉家軍事支柱，九頭龍川大破三十萬一揆，晚年率先在實戰中裝備火繩槍連連告捷。", 14, 22, ["AA_LONG", "CIWS"], [], 140, 78, 0.04],
  ["MATSUNAGA", "松永久秀", 'air_defense', 1, 'F', "亂世梟雄·火藥大陣", "戰國梟雄，最早在戰場大規模部署鐵砲與火藥炸裂戰術之大名，智勇機敏。", 16, 20, ["AA_LONG", "SAT"], [], 110, 62, 0.02],
  ["SHIMAZU_IEHISA", "島津家久", 'air_defense', 3, 'B', "釣野伏·沖田畷之射", "薩摩島津四兄弟么弟、戰術鬼才；擅長「釣野伏」誘敵包圍，耳川與沖田畷之戰以鐵砲齊射與伏兵陣大敗優勢敵軍。", 20, 26, ["AA_LONG", "CIWS", "EW"], ["PASSIVE_VOLLEY"], 176, 94, 0.06],
  ["TAKIGAWA", "瀧川一益", 'air_defense', 1, 'D', "進退自在·甲賀鐵砲眾", "織田四天王之一，出身近江甲賀，精於火繩槍（鐵砲）部署與忍者偵察，「進退俱是瀧川」威震關東與伊勢戰線。", 18, 22, ["AA_LONG", "CIWS"], [], 114, 62, 0.04],
  ["HONDA_TADATSUGU", "本多忠次", 'air_defense', 1, 'F', "鐵砲先鋒·三河老將", "德川家老將，本多忠勝之叔父，長篠之戰指揮三河足輕鐵砲輪射立下首功。", 14, 16, ["AA_LONG", "CIWS"], [], 114, 62, 0.04],
  ["ZHOUYU", "周瑜", 'support', 3, 'A', "雅量江東·赤壁連環火", "東吳大都督，精研水戰與火攻奇策，赤壁之戰以少勝多一把大火焚盡曹軍樓船水寨。", 24, 72, ["EW", "DEEP"], ["STRATEGIST", "FORMATION_SHIELD"], 172, 78, 0.04],
  ["YISUNSIN", "李舜臣", 'naval', 5, 'D', "忠武公·鳴梁扼流", "朝鮮水軍將領，鳴梁之戰以十三艘戰船利用海峽與潮流抗擊優勢敵軍；戰前奏報尚有十二艘，不與實戰船數或龜船事蹟混為一談。", 84, 26, ["SUB", "DEEP", "ASW"], ["STAMINA_DEEP"], 356, 136, 0.14],
  ["KUKI", "九鬼嘉隆", 'naval', 4, 'E', "海賊大名·鐵甲船破水", "織田家水軍統帥，建造外覆鐵皮以防箭火之巨型「鐵甲船」，第二次木津川口之戰大勝毛利水軍。", 34, 22, ["AEGIS", "ASW", "TRUE_AT"], ["STAMINA_DEEP"], 292, 114, 0.14],
  ["LUXUN", "陸遜", 'naval', 4, 'F', "火燒連營·夷陵破蜀", "東吳大都督，白面書生深藏不露，夷陵之戰後發制人，一把火燒連營七百里擊潰劉備。", 54, 46, ["AMBUSH", "TRUE_AT", "EW"], ["STAMINA_DEEP"], 288, 114, 0.11],
  ["YUNGWAN", "尹瓘", 'naval', 3, 'H', "別武班帥·東北九城", "高麗名將，組建由神騎軍、神步軍與降魔軍構成之精銳特種部隊「別武班」，率奇兵北伐破女真、開拓東北九城。", 48, 28, ["AMBUSH", "ASW", "TRUE_AT"], ["STAMINA_DEEP"], 234, 98, 0.12],
  ["LUMENG", "呂蒙", 'naval', 5, 'A', "白衣渡江·神速襲南郡", "東吳大都督，精妙偽裝商船「白衣渡江」無聲奪取烽火台，襲取荊州擒殺關羽。", 86, 34, ["SUB", "DEEP", "EW"], ["STAMINA_DEEP"], 350, 130, 0.12],
  ["GANNING", "甘寧", 'naval', 3, 'B', "百騎夜襲·錦帆鈴聲", "東吳猛將，頭插鳥羽腰繫銅鈴，濡須之戰親率百名死士夜襲曹操四十萬大營全身而退。", 64, 18, ["ASW", "AMBUSH", "TRUE_AT"], ["STAMINA_DEEP", "HEAVY_AP"], 238, 102, 0.12],
  ["HUANGGAI", "黃蓋", 'naval', 2, 'C', "苦肉火船·赤壁烈焰", "東吳老將，行苦肉計駕十艘滿載膏油柴草之艨艟火船直撞曹軍連環巨艦。", 44, 20, ["AMBUSH", "SWARM"], [], 184, 78, 0.08],
  ["JIANGWEI", "姜維", 'naval', 3, 'D', "天水麒麟·九伐奇謀", "蜀漢大將軍，諸葛亮親傳弟子，智勇雙全，善出奇兵險道穿插隴右九伐中原，劍閣據險挫敵十萬。", 46, 32, ["EW", "AMBUSH", "TRUE_AT"], ["STAMINA_DEEP"], 236, 98, 0.11],
  ["LIJING", "李靖", 'naval', 5, 'A', "衛國軍神·夜襲陰山", "大唐衛國公、開國軍神，善出奇制勝，長江十日破蕭銑、雪夜千騎奔襲陰山滅東突厥，著有《李衛公問對》。", 68, 38, ["DEEP", "AMBUSH", "TRUE_AT"], ["STAMINA_DEEP"], 354, 134, 0.13],
  ["DENGAI", "鄧艾", 'naval', 4, 'A', "涉險越嶺·陰平天降", "曹魏名將，裹氈自山崖滾下行無人之地七百里，神速奇兵直取成都滅蜀。", 72, 28, ["DEEP", "AMBUSH", "EW"], ["STAMINA_DEEP"], 284, 116, 0.1],
  ["MURAKAMI", "村上武吉", 'naval', 1, 'G', "能島水軍·焙烙玉焚艦", "瀨戶內海霸主村上水軍統帥，善用陶罐投擲炸藥「焙烙玉」焚毀敵艦。", 38, 16, ["ASW", "AMBUSH", "SWARM"], [], 130, 62, 0.07],
  ["XIEXUAN", "謝玄", 'naval', 5, 'A', "北府都督·淝水奇捷", "東晉北府兵創立者，淝水之戰以八萬北府水陸奇兵過河突擊，大破前秦八十萬大軍。", 50, 36, ["AMBUSH", "ASW", "EW"], ["STAMINA_DEEP"], 360, 134, 0.14],
  ["YUYUNWEN", "虞允文", 'naval', 1, 'C', "采石折衝·書生大捷", "南宋名臣，采石磯戰役臨危督師，指揮樓船水軍以海鰍船水陸火攻大破完顏亮六十萬金軍。", 26, 26, ["EW", "ASW"], [], 128, 60, 0.06],
  ["WEIYAN", "魏延", 'naval', 4, 'C', "子午奇略·勇略先登", "蜀漢猛將，長年鎮守漢中金湯不失，常請精兵五千出子午谷直撲長安。", 52, 20, ["AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 290, 118, 0.12],
  ["MOURI_MOTO", "毛利元就", 'naval', 5, 'E', "西國謀神·嚴島水陸奇襲", "日本戰國第一智將，嚴島之戰暴風雨夜水陸奇襲陶晴賢兩萬大軍，三矢之訓制霸西國地方。", 52, 38, ["SUB", "AMBUSH", "EW"], ["STAMINA_DEEP"], 346, 128, 0.12],
  ["HATTORI", "服部半藏", 'naval', 3, 'F', "鬼半藏·伊賀忍軍統領", "德川家康麾下伊賀忍者統領，擅於潛入、暗殺、情報蒐集與陣前開道。", 86, 22, ["SUB", "AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 226, 100, 0.07],
  ["JEONGJI", "鄭地", 'naval', 2, 'G', "鎮浦火砲·水師斬寇", "高麗水軍將領，於鎮浦海戰首創以艦載火砲轟碎倭寇五百餘艘戰船。", 30, 18, ["AEGIS", "ASW"], [], 184, 76, 0.1],
  ["YUEJIN", "樂進", 'naval', 2, 'A', "五子良將·每戰先登", "曹魏五子良將，容貌短小而膽勇過人，從征官渡、烏桓、合肥，每戰必先登陷陣斬將搴旗。", 34, 18, ["AMBUSH", "TRUE_AT"], ["HEAVY_AP"], 186, 78, 0.11],
  ["MENGHUO", "孟獲", 'naval', 1, 'B', "南中夷王·象甲藤兵", "南中蠻夷各部大姓渠帥，聚南中各洞勇士以生藤重甲與象兵據險固守，山川泥沼間赤身跳蕩突擊。", 46, 12, ["AMBUSH", "SUB"], ["STAMINA_DEEP"], 138, 66, 0.08],
  ["XUHUANG", "徐晃", 'naval', 4, 'D', "漢水背水·聲東破圍", "曹魏五子良將，漢水背水結陣抗蜀軍、更於樊城聲東擊西長驅直入破關羽十重鹿角，曹操讚其「有周亞夫之風」。", 42, 24, ["TRUE_AT", "AMBUSH"], ["STAMINA_DEEP", "HEAVY_AP"], 296, 116, 0.14],
  ["WAKIZAKA", "脇坂安治", 'naval', 1, 'E', "賤岳槍名·淡路水軍首領", "賤岳七本槍之一，淡路水軍頭領，關原之戰機敏調度，兼備陸戰與海戰將才。", 30, 16, ["AMBUSH"], [], 128, 62, 0.06],
  ["TOUDO", "藤堂高虎", 'naval', 1, 'F', "水軍大將·築城宗師", "戰國名將，掌管德川家水軍大陣，築城與水陸攻防皆臻極致，歷事七主終成一方霸主。", 26, 22, ["AMBUSH", "EW"], [], 130, 62, 0.08],
  ["ZHANGHE", "張郃", 'naval', 3, 'A', "巧變奇兵·街亭斷汲", "曹魏五子良將之一，以用兵巧變、善依地形設奇斷敵軍要害聞名；街亭之戰率奇兵繞斷馬謖汲道取勝，後於木門追擊蜀軍時中伏身亡。", 54, 24, ["AMBUSH", "EW", "TRUE_AT"], ["STAMINA_DEEP"], 234, 98, 0.11],
  ["CAOBIN", "曹彬", 'naval', 2, 'C', "渡江名帥·不殺仁將", "北宋開國第一良將，採石磯架設浮橋大渡長江擊破南唐水軍，平江南不妄殺一人。", 30, 28, ["AEGIS", "EW"], [], 186, 76, 0.1],
  ["ZHUGELIANG", "諸葛亮", 'support', 5, 'A', "臥龍智聖·八陣通神", "三國蜀漢丞相，千古智聖，隆中對三分天下，創八陣圖與諸葛連弩，神機妙算運籌決勝。", 28, 88, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 238, 92, 0.06],
  ["HANXIN", "韓信", 'support', 5, 'B', "兵仙神算·十面埋伏", "漢初三傑之一，兵家四勢之兵形勢代表，「多多益善」，明修棧道暗度陳倉、十面埋伏垓下破楚。", 34, 84, ["EW", "DEEP", "TRUE_AT"], ["STRATEGIST", "STAMINA_DEEP"], 228, 102, 0.04],
  ["ZHANGLIANG", "張良", 'support', 5, 'C', "運籌帷幄·決勝千里", "漢初三傑之謀聖，運籌策帷帳之中，決勝於千里之外，圯上敬履得《太公兵法》，佐劉邦定天下。", 26, 87, ["EW", "SPOT"], ["STRATEGIST"], 232, 90, 0.06],
  ["SIMAYI", "司馬懿", 'support', 3, 'D', "鷹視狼顧·深謀待時", "曹魏太傅，深沉有度深謀遠慮，熬死諸葛亮、平定遼東，為晉朝開國奠定基業。", 24, 72, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 176, 76, 0.06],
  ["TOYOTOMI", "豐臣秀吉", 'support', 5, 'E', "太閤天下·統一大將", "戰國三傑之一，從織田信長麾下崛起，經多場戰事完成日本大部分地區統一；其軍事才能以統帥與調度見長。", 28, 84, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 232, 96, 0.06],
  ["CAOCAO", "曹操", 'support', 4, 'I', "亂世雄略·官渡制勝", "東漢末年政治家、軍事家，挾天子以令諸侯，官渡之戰擊敗袁紹，奠定曹魏基業。", 36, 78, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 206, 88, 0.06],
  ["HANBEI", "竹中半兵衛", 'support', 2, 'F', "今孔明·十人奪城", "戰國天才軍師，僅帶十六名隨從便智奪固若金湯之稻葉山城，輔佐豐臣秀吉天下布武。", 26, 65, ["EW", "SPOT"], ["STRATEGIST"], 146, 66, 0.04],
  ["KANBEI", "黑田官兵衛", 'support', 2, 'G', "如水大謀·天下二兵衛", "戰國頂級軍略家，高松城水攻、西國大返還之總策劃者，智謀令豐臣秀吉亦為之忌憚。", 28, 66, ["EW", "DEEP", "SPOT"], ["STRATEGIST"], 144, 66, 0.04],
  ["KANGGAMCHAN", "姜邯贊", 'support', 3, 'H', "龜州大捷·高麗護國相", "高麗顯宗朝名相兼西北面行營都統使，於龜州大捷以決堤水攻與伏兵合圍殲滅契丹十萬大軍，與乙支文德、李舜臣並稱韓國三大護國名將。", 26, 72, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 174, 76, 0.06],
  ["SUNBIN", "孫臏", 'support', 3, 'A', "圍魏救趙·馬陵道伏兵", "戰國兵家宗師，著《孫臏兵法》，桂陵之戰圍魏救趙、馬陵之戰減灶誘敵射殺龐涓。", 28, 73, ["EW", "SEAD", "ARTY"], ["STRATEGIST"], 170, 72, 0.04],
  ["WUQI", "吳起", 'support', 4, 'B', "吳子治軍·兼併無敵", "戰國兵法名家，與孫子並稱「孫吳」，治西河大戰七十六全勝六十四，魏武卒所向披靡。", 26, 78, ["EW", "SEAD", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 206, 92, 0.06],
  ["GUOJIA", "郭嘉", 'support', 3, 'C', "十勝十敗·鬼謀奇策", "曹操心腹謀士，「郭嘉不死，便無赤壁」，算準孫策之死，力主遠征烏桓白狼山大勝。", 36, 73, ["EW", "DEEP"], ["STRATEGIST"], 172, 74, 0.04],
  ["XUNYU", "荀彧", 'support', 2, 'D', "王佐之才·深謀遠猷", "曹操首席戰略大師，深謀遠慮為曹操規劃統一北方大略，官渡之戰扼守後方力主相持。", 30, 67, ["EW", "SPOT"], ["STRATEGIST"], 144, 62, 0.04],
  ["JIAXU", "賈詡", 'support', 1, 'E', "算無遺策·毒士洞察", "三國第一洞察軍師，宛城奇計重創曹操，潼關離間韓遂馬超，生平出謀劃策無一失手。", 42, 62, ["EW", "SEAD"], ["STRATEGIST"], 118, 54, 0.02],
  ["SHIMAZU_YOSHIHISA", "島津義久", 'support', 1, 'I', "薩摩之雄·九州統帥", "島津氏第十六代當主，與弟義弘等家族將領協力擴張，統率島津家在九州各地的軍事行動。", 24, 58, ["EW", "SPOT"], ["STRATEGIST"], 118, 56, 0.04],
  ["PANGTONG", "龐統", 'support', 2, 'A', "鳳雛奇策·連環上策", "劉備軍師，與諸葛亮並稱「伏龍鳳雛」，入蜀大戰獻上中下三策，親臨戰陣指揮破敵。", 24, 66, ["EW", "ARTY", "SPOT"], ["STRATEGIST"], 142, 64, 0.06],
  ["FAZHENG", "法正", 'support', 1, 'B', "定軍奇畫·斬將夏侯", "劉備首席謀臣，曹操歎曰「吾收奸雄略盡，獨不得法正邪」，定軍山親自登高指揮陣斬夏侯淵。", 22, 60, ["EW", "ARTY", "SPOT"], ["STRATEGIST"], 114, 52, 0.04],
  ["SANADAMASA", "真田昌幸", 'support', 1, 'F', "表裏比興·上田鬼謀", "真田幸村之父，以極小之上田城兩度挫敗德川數萬大軍，連豐臣秀吉亦嘆其為「表裏比興之者」。", 30, 61, ["EW", "TRUE_AT"], ["STRATEGIST"], 118, 56, 0.06],
  ["LUSU", "魯肅", 'support', 2, 'A', "榻上大策·三分雄圖", "東吳戰略擘劃大師，早於諸葛亮提出天下二分／三分之榻上策，力促孫劉結盟。", 24, 66, ["EW", "SPOT"], ["STRATEGIST"], 150, 68, 0.04],
  ["TIANDAN", "田單", 'naval', 2, 'A', "火牛奇陣·齊國破燕", "戰國齊名將，即墨守城以千餘頭牛角綁利刃尾繫浸油蘆葦衝入敵營，一舉收復七十餘城。", 46, 28, ["AMBUSH", "SWARM"], [], 180, 78, 0.08],
  ["LIUBOWEN", "劉伯溫", 'support', 4, 'J', "神機妙算·佐明開國", "明初政治家與軍事謀臣，輔佐朱元璋制定統一戰略，參與平定群雄與建立明朝。", 24, 81, ["EW", "SPOT"], ["STRATEGIST"], 206, 82, 0.06],
  ["SUNWU", "孫武", 'support', 5, 'A', "兵聖大宗·知彼知己", "春秋兵聖，著《孫子兵法》十三篇，輔佐吳王五戰五捷攻入郢都大破強楚，天下兵家之始祖。", 30, 88, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 236, 98, 0.06],
  ["LEYI", "樂毅", 'support', 4, 'B', "昌國拔城·連克七十", "戰國名將，拜為燕昭王上將軍，率五國聯軍濟西破齊，半年連克齊國七十餘城，算無遺策。", 28, 79, ["EW", "SEAD"], ["STRATEGIST"], 206, 90, 0.06],
  ["TOKUGAWA", "德川家康", 'support', 4, 'F', "三河忍耐·天下霸業", "戰國三傑之一，沉著隱忍，關原之戰與大坂之戰運籌帷幄決勝千里，開創江戶幕府二百六十年基業。", 26, 77, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP", "FORMATION_SHIELD"], 206, 84, 0.08],
];

const UNIT_META = {
HUO: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢軍玄甲鐵騎 + 環首刀', sfx: 'blade_clash', img: 'assets/warlords/HUO.jpg?v=7.11.1' },
  WEI: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '武剛突騎大陣 + 漢劍', sfx: 'war_drum', img: 'assets/warlords/WEI.jpg?v=7.11.1' },
  LUBU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '方天畫戟 + 赤兔馬', sfx: 'blade_clash', img: 'assets/warlords/LUBU.jpg?v=7.11.1' },
  YOSHITSUNE: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '薄綠太刀 + 黑葦威鎧', sfx: 'blade_clash', img: 'assets/warlords/YOSHITSUNE.jpg?v=7.11.1' },
  SHINGEN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '軍配團扇 + 諏訪法性兜', sfx: 'war_drum', img: 'assets/warlords/SHINGEN.jpg?v=7.11.1' },
  GAISUWEN: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '五口寶刀 + 鐵騎長矛', sfx: 'blade_clash', img: 'assets/warlords/GAISUWEN.jpg?v=7.11.1' },
  ZHAOYUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青釭劍 + 亮銀龍膽槍', sfx: 'blade_clash', img: 'assets/warlords/ZHAOYUN.jpg?v=7.11.1' },
  MACHO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭湛金槍 + 白袍銀鎧', sfx: 'blade_clash', img: 'assets/warlords/MACHO.jpg?v=7.11.1' },
  ZHANGLIAO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '問天青龍雙戟 + 塞外駿馬', sfx: 'blade_clash', img: 'assets/warlords/ZHANGLIAO.jpg?v=7.11.1' },
  CHENQINGZHI: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '白袍麾旗 + 輕騎快槍', sfx: 'strategy_gong', img: 'assets/warlords/CHENQINGZHI.jpg?v=7.11.1' },
  KENSHIN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '順慶手太刀 + 毘字旗', sfx: 'war_drum', img: 'assets/warlords/KENSHIN.jpg?v=7.11.1' },
  YUKIMURA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '十文字槍 + 六文錢赤備', sfx: 'blade_clash', img: 'assets/warlords/YUKIMURA.jpg?v=7.11.1' },
  KIMYUSHIN: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '龍鳳環首刀 + 金花官服戰鎧', sfx: 'blade_clash', img: 'assets/warlords/KIMYUSHIN.jpg?v=7.11.59' },
  GAOCHANGGONG: { flag: '🇨🇳', origin: '中國 · 北齊', weapon: '具裝長槊 + 蘭陵鐵面', sfx: 'blade_clash', img: 'assets/warlords/GAOCHANGGONG.jpg?v=7.11.87' },
  XIAHOUYUAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '精鋼長矛 + 快馬大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/XIAHOUYUAN.jpg?v=7.11.87' },
  MADAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '西涼輕騎長矛 + 隨身連弩', sfx: 'arrow_volley', img: 'assets/warlords/MADAI.jpg?v=7.11.59' },
  DATE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '黑漆弦月盔 + 騎鐵火繩槍', sfx: 'arrow_volley', img: 'assets/warlords/DATE.jpg?v=7.11.1' },
  EULJI: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗環刀 + 輕步快騎', sfx: 'strategy_gong', img: 'assets/warlords/EULJI.jpg?v=7.11.68' },
  WANGSHUANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '六十斤大刀 + 飛擊流星錘', sfx: 'blade_clash', img: 'assets/warlords/WANGSHUANG.jpg?v=7.11.58' },
  YAMAGATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長柄槍 + 赤漆塗胴具足', sfx: 'blade_clash', img: 'assets/warlords/YAMAGATA.jpg?v=7.11.93' },
  TACHIBANA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '雷切脇差 + 栗色鎧甲', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANA.jpg?v=7.11.68' },
  ZHAOSHE: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '趙國鐵騎長矛 + 馬服良駒', sfx: 'cavalry_charge', img: 'assets/warlords/ZHAOSHE.jpg?v=7.11.87' },
  PANGDE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭大刀 + 白馬重鐵鞍', sfx: 'blade_clash', img: 'assets/warlords/PANGDE.jpg?v=7.11.93' },
  MAEDATOSHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱柄長槍 + 赤母衣良駒', sfx: 'blade_clash', img: 'assets/warlords/MAEDATOSHI.jpg?v=7.11.93' },
  BAIQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '武安君銅劍 + 戰國玄甲', sfx: 'war_drum', img: 'assets/warlords/BAIQI.jpg?v=7.11.1' },
  XIANGYU: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '霸王楚戟 + 烏騅馬鎧', sfx: 'blade_clash', img: 'assets/warlords/XIANGYU.jpg?v=7.11.46' },
  YUEFEI: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '瀝泉神槍 + 岳字白旄大旗', sfx: 'war_drum', img: 'assets/warlords/YUEFEI.jpg?v=7.11.1' },
  WANGJIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '大秦青銅長戈 + 重甲鐵盾', sfx: 'war_drum', img: 'assets/warlords/WANGJIAN.jpg?v=7.11.1' },
  HONDA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '蜻蛉切神槍 + 鹿角脇立兜', sfx: 'blade_clash', img: 'assets/warlords/HONDA.jpg?v=7.11.1' },
  SHIBATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '瓶割刀 + 漆黑重甲具足', sfx: 'blade_clash', img: 'assets/warlords/SHIBATA.jpg?v=7.11.1' },
  LIANPO: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '青銅重戟 + 戰國大盾', sfx: 'war_drum', img: 'assets/warlords/LIANPO.jpg?v=7.11.1' },
  MENGTIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '秦軍重弩 + 狼毫筆', sfx: 'arrow_volley', img: 'assets/warlords/MENGTIAN.jpg?v=7.11.1' },
  HOJO_UJIYASU: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 太刀', sfx: 'war_drum', img: 'assets/warlords/HOJO_UJIYASU.jpg?v=7.11.59' },
  GUANYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青龍偃月刀 + 美髯綠袍鎧', sfx: 'blade_clash', img: 'assets/warlords/GUANYU.jpg?v=7.11.1' },
  ZHANGFEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '丈八蛇矛 + 烏金鐵環甲', sfx: 'blade_clash', img: 'assets/warlords/ZHANGFEI.jpg?v=7.11.1' },
  XIAHOU_DUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '環首刀 + 曹魏軍旗', sfx: 'blade_clash', img: 'assets/warlords/XIAHOU_DUN.jpg?v=7.11.87' },
  TACHIBANAD: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名刀雷切 + 轎載鐵盾', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANAD.jpg?v=7.11.87' },
  CHOIYOUNG: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗大刀 + 頭頂鐵胄', sfx: 'blade_clash', img: 'assets/warlords/CHOIYOUNG.jpg?v=7.11.87' },
  DIANWEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '雙鐵戟 + 重裝近衛鎧', sfx: 'blade_clash', img: 'assets/warlords/DIANWEI.jpg?v=7.11.93' },
  XUCHU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭大金刀 + 粗鐵皮甲', sfx: 'blade_clash', img: 'assets/warlords/XUCHU.jpg?v=7.11.68' },
  SHIMAZUY: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '野太刀 + 黑漆塗二枚胴', sfx: 'blade_clash', img: 'assets/warlords/SHIMAZUY.jpg?v=7.11.59' },
  GYEBAEK: { flag: '🇰🇷', origin: '韓國 · 百濟', weapon: '百濟環首大刀 + 鐵鱗背心', sfx: 'blade_clash', img: 'assets/warlords/GYEBAEK.jpg?v=7.11.94' },
  YANGYE: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '九環金刀 + 雁門重甲', sfx: 'blade_clash', img: 'assets/warlords/YANGYE.jpg?v=7.11.68' },
  CAOREN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '重鋼大盾 + 短刃佩刀', sfx: 'war_drum', img: 'assets/warlords/CAOREN.jpg?v=7.11.59' },
  ZHOUTAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭厚刃刀 + 肉盾鐵軀', sfx: 'blade_clash', img: 'assets/warlords/ZHOUTAI.jpg?v=7.11.94' },
  IINAOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱漆大槍 + 金箔天衝脇立', sfx: 'blade_clash', img: 'assets/warlords/IINAOMASA.jpg?v=7.11.87' },
  KATOKIYOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '片鎌槍 + 長烏帽子形兜', sfx: 'blade_clash', img: 'assets/warlords/KATOKIYOMASA.jpg?v=7.11.95' },
  YUJIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵環長刀 + 堅木大盾', sfx: 'war_drum', img: 'assets/warlords/YUJIN.jpg?v=7.11.94' },
  LIGUANG: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢家雕弓 + 白羽穿甲箭', sfx: 'arrow_volley', img: 'assets/warlords/LIGUANG.jpg?v=7.11.1' },
  YANGYOUJI: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '穿楊神弓 + 七札破甲箭', sfx: 'arrow_volley', img: 'assets/warlords/YANGYOUJI.jpg?v=7.11.1' },
  NOBUNAGA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '南蠻鐵砲火銃 + 織田木瓜旗', sfx: 'arrow_volley', img: 'assets/warlords/NOBUNAGA.jpg?v=7.11.1' },
  YOICHI: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '滋野籐弓 + 白羽神箭', sfx: 'arrow_volley', img: 'assets/warlords/YOICHI.jpg?v=7.11.1' },
  JUMONG: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗神弓 + 鹿角箭', sfx: 'arrow_volley', img: 'assets/warlords/JUMONG.jpg?v=7.11.1' },
  HUANGZHONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵胎寶弓 + 鳳嘴刀', sfx: 'arrow_volley', img: 'assets/warlords/HUANGZHONG.jpg?v=7.11.1' },
  TAISHICI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂歌戟 + 穿甲大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/TAISHICI.jpg?v=7.11.59' },
  HANSHIZHONG: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '克敵勁弩 + 倒馬長槍', sfx: 'arrow_volley', img: 'assets/warlords/HANSHIZHONG.jpg?v=7.11.86' },
  LIMU: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '趙國鐵角硬弓 + 破甲箭陣', sfx: 'arrow_volley', img: 'assets/warlords/LIMU.jpg?v=7.11.1' },
  AKECHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名銃備前鐵砲 + 桔梗紋旗', sfx: 'arrow_volley', img: 'assets/warlords/AKECHI.jpg?v=7.11.1' },
  SAIKA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三連發火繩銃 + 八咫烏標記', sfx: 'arrow_volley', img: 'assets/warlords/SAIKA.jpg?v=7.11.87' },
  GWONYUL: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '神機箭火車 + 幸州守城角弓', sfx: 'arrow_volley', img: 'assets/warlords/GWONYUL.jpg?v=7.11.87' },
  HULUGUANG: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '黑角落雕強弓 + 鐵羽鑿子箭', sfx: 'arrow_volley', img: 'assets/warlords/HULUGUANG.jpg?v=7.11.87' },
  MALONG: { flag: '🇨🇳', origin: '中國 · 西晉', weapon: '西晉強弩 + 偏箱車八陣', sfx: 'arrow_volley', img: 'assets/warlords/MALONG.jpg?v=7.11.91' },
  ZHOUYAFU: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢軍大盾長戟 + 細柳令旗', sfx: 'war_drum', img: 'assets/warlords/ZHOUYAFU.jpg?v=7.11.1' },
  ZONGZE: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '連弩機樓 + 宣慰刀', sfx: 'arrow_volley', img: 'assets/warlords/ZONGZE.jpg?v=7.11.68' },
  TORII: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三河火繩槍 + 伏見箭矢', sfx: 'arrow_volley', img: 'assets/warlords/TORII.jpg?v=7.11.92' },
  CHOIMUSEON: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '走火火箭 + 鎮浦銅砲', sfx: 'fire_attack', img: 'assets/warlords/CHOIMUSEON.jpg?v=7.11.59' },
  GENGYAN: { flag: '🇨🇳', origin: '中國 · 東漢', weapon: '雲台強弩 + 破甲箭匣', sfx: 'arrow_volley', img: 'assets/warlords/GENGYAN.jpg?v=7.11.68' },
  YAMAMOTO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '軍配團扇 + 築城陣圖', sfx: 'strategy_gong', img: 'assets/warlords/YAMAMOTO.jpg?v=7.11.92' },
  FENGYI: { flag: '🇨🇳', origin: '中國 · 東漢', weapon: '大樹長弓 + 伏射箭列', sfx: 'arrow_volley', img: 'assets/warlords/FENGYI.jpg?v=7.11.68' },
  ASAKURA_SOT: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '越前早期火繩銃', sfx: 'arrow_volley', img: 'assets/warlords/ASAKURA_SOT.jpg?v=7.11.87' },
  MATSUNAGA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '南蠻炸藥引線 + 短鐵砲', sfx: 'arrow_volley', img: 'assets/warlords/MATSUNAGA.jpg?v=7.11.59' },
  SHIMAZU_IEHISA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '薩摩種子島鐵砲 + 釣野伏陣圖', sfx: 'arrow_volley', img: 'assets/warlords/SHIMAZU_IEHISA.jpg?v=7.11.91' },
  TAKIGAWA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '甲賀連發鐵砲 + 瀧川丸旗', sfx: 'arrow_volley', img: 'assets/warlords/TAKIGAWA.jpg?v=7.11.92' },
  HONDA_TADATSUGU: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三河軍制鐵砲 + 火藥袋', sfx: 'arrow_volley', img: 'assets/warlords/HONDA_TADATSUGU.jpg?v=7.11.92' },
  ZHOUYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '赤壁督軍劍 + 樓船令旗', sfx: 'fire_attack', img: 'assets/warlords/ZHOUYU.jpg?v=7.11.96' },
  YISUNSIN: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '忠武公三尺寶劍 + 龜甲船', sfx: 'fire_attack', img: 'assets/warlords/YISUNSIN.jpg?v=7.11.1' },
  KUKI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '海賊大太刀 + 安宅鐵甲船', sfx: 'war_drum', img: 'assets/warlords/KUKI.jpg?v=7.11.87' },
  YUNGWAN: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '別武班長矛 + 東北九城令旗', sfx: 'war_drum', img: 'assets/warlords/YUNGWAN.jpg?v=7.11.67' },
  LUMENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白衣偽裝袍 + 吳地雙手劍', sfx: 'blade_clash', img: 'assets/warlords/LUMENG.jpg?v=7.11.1' },
  GANNING: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短戟飛刀 + 銅鈴錦帆', sfx: 'blade_clash', img: 'assets/warlords/GANNING.jpg?v=7.11.1' },
  HUANGGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '火攻燃引火箭 + 艨艟衝角', sfx: 'fire_attack', img: 'assets/warlords/HUANGGAI.jpg?v=7.11.96' },
  JIANGWEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '天水綠沉長槍 + 蜀錦奇兵袍', sfx: 'war_drum', img: 'assets/warlords/JIANGWEI.jpg?v=7.11.1' },
  LIJING: { flag: '🇨🇳', origin: '中國 · 唐', weapon: '唐軍橫刀 + 衛公兵法節杖', sfx: 'war_drum', img: 'assets/warlords/LIJING.jpg?v=7.11.86' },
  DENGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '登山步稍 + 奇襲輕甲', sfx: 'blade_clash', img: 'assets/warlords/DENGAI.jpg?v=7.11.1' },
  MURAKAMI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '焙烙火玉 + 鯨船快櫓', sfx: 'fire_attack', img: 'assets/warlords/MURAKAMI.jpg?v=7.11.95' },
  XIEXUAN: { flag: '🇨🇳', origin: '中國 · 兩晉', weapon: '北府精鋼斬馬刀 + 艨艟', sfx: 'blade_clash', img: 'assets/warlords/XIEXUAN.jpg?v=7.11.1' },
  YUYUNWEN: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '采石督師劍 + 海鰍踏浪船', sfx: 'fire_attack', img: 'assets/warlords/YUYUNWEN.jpg?v=7.11.95' },
  WEIYAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂骨環刀 + 伏兵令旗', sfx: 'blade_clash', img: 'assets/warlords/WEIYAN.jpg?v=7.11.59' },
  MOURI_MOTO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '一文字太刀 + 村上嚴島樓船', sfx: 'strategy_gong', img: 'assets/warlords/MOURI_MOTO.jpg?v=7.11.58' },
  HATTORI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '伊賀鎖鎌 + 漆黑忍衣', sfx: 'blade_clash', img: 'assets/warlords/HATTORI.jpg?v=7.11.87' },
  JEONGJI: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗火銃銅管 + 海上長矛', sfx: 'fire_attack', img: 'assets/warlords/JEONGJI.jpg?v=7.11.68' },
  YUEJIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短柄破城大斧 + 先登飛爪', sfx: 'blade_clash', img: 'assets/warlords/YUEJIN.jpg?v=7.11.1' },
  MENGHUO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '南中神木三叉戟 + 獸皮生藤甲', sfx: 'blade_clash', img: 'assets/warlords/MENGHUO.jpg?v=7.11.1' },
  XUHUANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣花開山大斧 + 破陣鎧', sfx: 'heavy_strike', img: 'assets/warlords/XUHUANG.jpg?v=7.11.1' },
  WAKIZAKA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '賤岳長槍 + 淡路戰船', sfx: 'blade_clash', img: 'assets/warlords/WAKIZAKA.jpg?v=7.11.95' },
  TOUDO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '築城大銃 + 水軍旗艦', sfx: 'war_drum', img: 'assets/warlords/TOUDO.jpg?v=7.11.95' },
  ZHANGHE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '巧變綠沉槍 + 截道奇兵旗', sfx: 'blade_clash', img: 'assets/warlords/ZHANGHE.jpg?v=7.11.1' },
  CAOBIN: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '北宋大纛軍刀 + 浮橋長索', sfx: 'war_drum', img: 'assets/warlords/CAOBIN.jpg?v=7.11.1' },
  ZHUGELIANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '羽扇綸巾 + 諸葛八陣圖', sfx: 'strategy_gong', img: 'assets/warlords/ZHUGELIANG.jpg?v=7.11.1' },
  HANXIN: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '兵仙令劍 + 十面埋伏陣', sfx: 'blade_clash', img: 'assets/warlords/HANXIN.jpg?v=7.11.1' },
  ZHANGLIANG: { flag: '🇨🇳', origin: '中國 · 漢朝', weapon: '太公兵法卷軸 + 漢印佩玉', sfx: 'strategy_gong', img: 'assets/warlords/ZHANGLIANG.jpg?v=7.11.1' },
  SIMAYI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣帝佩劍 + 陣列令旗', sfx: 'strategy_gong', img: 'assets/warlords/SIMAYI.jpg?v=7.11.1' },
  TOYOTOMI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 陣太刀', sfx: 'war_drum', img: 'assets/warlords/TOYOTOMI.jpg?v=7.11.58' },
  CAOCAO: { flag: '🇨🇳', origin: '中國 · 東漢末／三國', weapon: '環首刀 + 丞相令旗', sfx: 'strategy_gong', img: 'assets/warlords/CAOCAO.jpg?v=7.11.1' },
  HANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '竹中軍配 + 一之谷形兜', sfx: 'strategy_gong', img: 'assets/warlords/HANBEI.jpg?v=7.11.1' },
  KANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '合子形兜 + 水攻策圖卷', sfx: 'strategy_gong', img: 'assets/warlords/KANBEI.jpg?v=7.11.1' },
  KANGGAMCHAN: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '龜州督軍劍 + 高麗水攻令旗', sfx: 'strategy_gong', img: 'assets/warlords/KANGGAMCHAN.jpg?v=7.11.67' },
  SUNBIN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '孫臏兵法木牘 + 獨輪戰車', sfx: 'strategy_gong', img: 'assets/warlords/SUNBIN.jpg?v=7.11.1' },
  WUQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '吳子兵書 + 魏武卒精矛', sfx: 'war_drum', img: 'assets/warlords/WUQI.jpg?v=7.11.1' },
  GUOJIA: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '十勝十敗論卷 + 謀士羽扇', sfx: 'strategy_gong', img: 'assets/warlords/GUOJIA.jpg?v=7.11.1' },
  XUNYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '王佐印信 + 荀氏家傳竹簡', sfx: 'strategy_gong', img: 'assets/warlords/XUNYU.jpg?v=7.11.1' },
  JIAXU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '離間策書 + 毒士算籌', sfx: 'strategy_gong', img: 'assets/warlords/JIAXU.jpg?v=7.11.91' },
  LUXUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '夷陵火計箭符 + 吳都督佩劍', sfx: 'fire_attack', img: 'assets/warlords/LUXUN.jpg?v=7.11.59' },
  SHIMAZU_YOSHIHISA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '采配 + 島津家旗印', sfx: 'strategy_gong', img: 'assets/warlords/SHIMAZU_YOSHIHISA.jpg?v=7.11.92' },
  PANGTONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鳳雛連環策 + 青銅短劍', sfx: 'strategy_gong', img: 'assets/warlords/PANGTONG.jpg?v=7.11.67' },
  FAZHENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '定軍指旗 + 蜀川圖誌', sfx: 'strategy_gong', img: 'assets/warlords/FAZHENG.jpg?v=7.11.92' },
  SANADAMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '上田城地圖 + 誘敵令旗', sfx: 'strategy_gong', img: 'assets/warlords/SANADAMASA.jpg?v=7.11.1' },
  LUSU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '榻上策竹簡 + 結盟令劍', sfx: 'strategy_gong', img: 'assets/warlords/LUSU.jpg?v=7.11.92' },
  TIANDAN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '火牛蘆葦火把 + 衝角雙刃', sfx: 'fire_attack', img: 'assets/warlords/TIANDAN.jpg?v=7.11.1' },
  SUNWU: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '孫子兵法十三篇 + 吳王授鉞', sfx: 'strategy_gong', img: 'assets/warlords/SUNWU.jpg?v=7.11.1' },
  LEYI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '昌國君佩劍 + 五國聯軍令旗', sfx: 'strategy_gong', img: 'assets/warlords/LEYI.jpg?v=7.11.59' },
  SUNCE: { flag: '🇨🇳', origin: '中國 · 東漢末', weapon: '霸王槍 + 江東戰旗', sfx: 'cavalry_charge', img: 'assets/warlords/SUNCE.jpg?v=7.11.59' },
  SUNJIAN: { flag: '🇨🇳', origin: '中國 · 東漢末', weapon: '古錠刀 + 虎頭戰盔', sfx: 'blade_clash', img: 'assets/warlords/SUNJIAN.jpg?v=7.11.59' },
  LIUBOWEN: { flag: '🇨🇳', origin: '中國 · 明初', weapon: '軍師羽扇 + 明軍令旗', sfx: 'strategy_gong', img: 'assets/warlords/LIUBOWEN.jpg?v=7.11.59' },
  TOKUGAWA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '葵紋軍配 + 三河統帥刀', sfx: 'war_drum', img: 'assets/warlords/TOKUGAWA.jpg?v=7.11.1' },
};

const UNIT_SKILLS = {
  HUO: { name: '封狼居胥', phase: 'P3', desc: '千里奔襲直取敵方後排，突擊傷害提升並奪取敵軍士氣' },
  WEI: { name: '武剛龍城', phase: 'P2', desc: '展開武剛車陣協同鐵騎，降低全軍突騎所受遠程傷害並提升命中' },
  CHENQINGZHI: { name: '白袍千軍', phase: 'P3', desc: '七千白袍連破三十二城，突破防線時全軍突騎連擊與戰意大幅提升' },
  LUBU: { name: '轅門無雙', phase: 'P3', desc: '飛將赤兔冠絕三軍，衝陣與單挑無視重鎧減傷並造成毀滅打擊' },
  SHINGEN: { name: '風林火山', phase: 'P3', desc: '疾如風、徐如林、侵掠如火、不動如山，攻防與謀略雙重加成' },
  GAOCHANGGONG: { name: '蘭陵入陣曲', phase: 'P3', desc: '邙山五百精騎戴面直貫敵陣，大幅強化對重甲破防與突擊威力' },
  ZHANGLIAO: { name: '威震逍遙', phase: 'P3', desc: '八百壯士直衝十萬大軍，以少打多時破甲與暴擊大幅提升' },
  ZHAOYUN: { name: '七進七出', phase: 'P3', desc: '渾身是膽單騎救主，殘血時閃避率與反擊威力大幅暴增' },
  YOSHITSUNE: { name: '鵯越逆落', phase: 'P3', desc: '一之谷絕壁奇襲繞過重甲正面防線，優先狙殺敵方後排神射與軍師' },
  KENSHIN: { name: '車懸之陣', phase: 'P2', desc: '毘沙門天軍神輪番衝陣，同時壓制敵方雙目標並無視陣型減傷' },
  ZHAOSHE: { name: '狹路勇勝', phase: 'P3', desc: '狹路相逢勇者勝，遭遇高費強敵時先手率與突擊暴擊大幅提升' },
  SUNCE: { name: '霸王怒濤', phase: 'P3', desc: '江東小霸王席捲千軍，壓制敵方前鋒並大幅提升單挑勝率' },
  MACHO: { name: '西涼鐵騎', phase: 'P3', desc: '統率西涼羌胡長標精騎，側翼包抄重甲與弓兵穿透加成' },
  EULJI: { name: '薩水誘敵', phase: 'P2', desc: '神算佯敗誘敵深入，大幅降低敵方突騎命中並穩固反擊' },
  GAISUWEN: { name: '五刀威震', phase: 'P3', desc: '身佩五把飛刀飛馳衝殺，衝陣前連續破甲削弱敵軍防禦' },
  XIAHOUYUAN: { name: '虎步關右', phase: 'P2', desc: '三日五百六日一千，極速奔襲搶奪突騎交鋒先手' },
  MADAI: { name: '西涼追襲', phase: 'P2', desc: '西涼輕騎迂迴射擊並伺機追斬敵將，兼具馳射命中與破甲貫穿' },
  KIMYUSHIN: { name: '花郎誓天', phase: 'P3', desc: '統御新羅花郎精銳鐵騎，大幅提振全軍韌性與持久戰力' },
  DATE: { name: '獨眼龍騎銃', phase: 'P2', desc: '騎馬鐵砲隊先驅，衝鋒前以火繩槍齊射破除敵方護盾' },
  YUKIMURA: { name: '六文錢決死', phase: 'P3', desc: '赤備死士直衝敵方本陣，對高費用主將造成決死穿刺' },
  PANGDE: { name: '抬櫬決死', phase: 'P3', desc: '抬棺出征誓死不退，瀕死時爆發絕命破甲反擊' },
  WANGSHUANG: { name: '流星狂追', phase: 'P3', desc: '陳倉猛將揮舞流星錘與大刀死命追殺，對殘血與重甲敵軍造成猛烈重擊' },
  MAEDATOSHI: { name: '槍之又左', phase: 'P3', desc: '赤母衣眾筆頭，輕騎朱柄長槍突刺高機率無視防禦' },
  TACHIBANA: { name: '西國疾風', phase: 'P3', desc: '西國無雙輕捷突擊，兼具靈巧破甲與戰場切入' },
  YAMAGATA: { name: '赤備先驅', phase: 'P3', desc: '武田赤備輕捷開路先鋒，協同突騎搶攻提升全軍命中' },
  BAIQI: { name: '長平殲滅', phase: 'P3', desc: '武安君包圍殲滅戰，破甲貫穿前陣並對受創敵軍造成高額斬殺傷害' },
  WANGJIAN: { name: '秦滅六國', phase: 'P3', desc: '六十萬大軍穩若泰山，全軍護甲大幅提升且突破敵軍防線' },
  XIANGYU: { name: '霸王破釜', phase: 'P3', desc: '破釜沉舟千古無二，近戰與單挑爆發毀滅性破甲重擊' },
  YUEFEI: { name: '背嵬撼山', phase: 'P3', desc: '撼山易撼岳家軍難，麻札刀重劈破除重甲並鞏固全軍防線' },
  GUANYU: { name: '威震華夏', phase: 'P3', desc: '武聖青龍偃月刀，首波交鋒高機率斬落敵方前鋒名將' },
  LIANPO: { name: '長平堅壁', phase: 'P3', desc: '展開戰國巨盾壁壘，大幅減傷並協同守護友軍陣線' },
  MENGTIAN: { name: '萬里長城', phase: 'P2', desc: '依託秦軍重弩與長城連壘阻絕胡騎，守護全軍免受奔襲並強化強弩壓制' },
  ZHANGFEI: { name: '當陽斷橋', phase: 'P3', desc: '據水斷橋怒吼震退敵軍，削弱敵方士氣並發動丈八蛇矛連刺' },
  SUNJIAN: { name: '江東猛虎', phase: 'P3', desc: '破虜先鋒古錠刀斬將，主動進攻時無視敵方格擋' },
  CHOIYOUNG: { name: '高麗柱石', phase: 'P3', desc: '見金如石剛毅不屈，免疫混亂並反彈近戰傷害' },
  CAOREN: { name: '樊城天人', phase: 'P3', desc: '曹魏大司馬固守樊城，展開八門金鎖護盾大幅提升防禦' },
  XIAHOU_DUN: { name: '拔矢啖睛', phase: 'P3', desc: '曹魏大將軍剛烈無畏，受創後激發血性強化爆擊反擊' },
  YANGYE: { name: '金刀楊無敵', phase: 'P3', desc: '雁門關大破契丹鐵騎，對奔雷突騎造成額外迎擊重傷' },
  HOJO_UJIYASU: { name: '相模獅籠城', phase: 'P3', desc: '小田原堅守搭配河越夜襲，持續恢復中軍防線韌性' },
  HONDA: { name: '蜻蛉切無傷', phase: 'P3', desc: '生涯五十七戰無傷，格擋首波致命重擊並穩守陣線' },
  DIANWEI: { name: '古之惡來', phase: 'P3', desc: '雙鐵戟死守營門護主，提供全軍輕量防護並維持破甲重擊' },
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
  ZHOUYAFU: { name: '細柳堅陣', phase: 'P3', desc: '細柳營披甲執銳堅壁抗敵，庇護全軍免遭先制奇襲並強化護甲防線' },
  LIGUANG: { name: '射石沒羽', phase: 'P2', desc: '漢之飛將夜引神弓，齊射無視部分護甲並重創敵方突騎' },
  YANGYOUJI: { name: '百步穿楊', phase: 'P2', desc: '春秋神射之祖一矢貫七札，鎖定敵方核心進行必中穿甲狙殺' },
  NOBUNAGA: { name: '長篠三段擊', phase: 'P2', desc: '三千火繩槍三段輪射，連續粉碎敵方突騎與重甲防線' },
  HANSHIZHONG: { name: '克敵神弓', phase: 'P2', desc: '親研克敵弓可貫雙甲，中距離齊射兼顧防空精準與重甲破防' },
  SHIMAZU_IEHISA: { name: '釣野伏齊射', phase: 'P2', desc: '佯退誘敵踏入鐵砲伏擊圈，削弱敵軍命中並重創來襲突騎' },
  HULUGUANG: { name: '落雕都督', phase: 'P2', desc: '百步穿石未嘗一敗，開局精準狙擊敵方高速突擊名將' },
  HUANGZHONG: { name: '定軍神弦', phase: 'P2', desc: '老當益壯定軍斬帥，對高費用敵將造成額外斬首傷害' },
  JUMONG: { name: '東明神矢', phase: 'P2', desc: '高句麗開國神弓，無視敵方隱匿與夜色掩護精準命中' },
  MALONG: { name: '偏箱強弩陣', phase: 'P2', desc: '依八陣圖編練偏箱車與強弩齊射，精準克制突騎並兼顧全軍防守' },
  ZONGZE: { name: '汴京連弩', phase: 'P2', desc: '東京留守築連弩機樓，加固全軍防線並阻截敵騎' },
  GENGYAN: { name: '雲台破齊', phase: 'P2', desc: '連下四十六郡圍城打援，強弩齊射壓制敵方側翼' },
  FENGYI: { name: '大樹伏弩', phase: 'P2', desc: '大樹將軍謙退設伏，隱蔽箭陣免遭點名並強化反擊' },
  TAKIGAWA: { name: '甲賀鐵砲齊射', phase: 'P2', desc: '甲賀火繩槍交替輪射，低費提供精準壓制與弱點破甲' },
  TAISHICI: { name: '猿臂貫手', phase: 'P2', desc: '猿臂善射弦無虛發，遠程攔截與近身雙戟格鬥兼備' },
  AKECHI: { name: '本能寺雷火', phase: 'P2', desc: '百步穿錢鐵砲名手，火繩槍齊射附帶火焰灼燒' },
  ASAKURA_SOT: { name: '九頭龍銃陣', phase: 'P2', desc: '越前軍神實戰部署鐵砲，提升遠程攔截穩定度' },
  GWONYUL: { name: '幸州火車', phase: 'P2', desc: '幸州山城齊射神機箭火車並築壘死守，防守反擊威力與抗傷同步提升' },
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
  YISUNSIN: { name: '鳴梁扼流', phase: 'P2', desc: '取材鳴梁海峽以潮流與地形抵禦優勢敵軍的戰役，不附會龜船參戰' },
  YUYUNWEN: { name: '采石霹靂', phase: 'P2', desc: '采石磯一萬八千破完顏亮四十萬大軍，海鰍船霹靂火砲轟碎敵陣' },
  JIANGWEI: { name: '九伐天水', phase: 'P2', desc: '天水麒麟文武兼備，兼具軍師謀略先機與險道穿插破甲' },
  LIJING: { name: '雪夜襲陰山', phase: 'P1', desc: '千里奇兵雪夜奔襲直搗敵營核心，兼備極高謀略壓制與真實破甲' },
  DENGAI: { name: '陰平天降', phase: 'P1', desc: '裹氈翻越摩天絕嶺，繞過前排防線直襲敵方後營主帥' },
  XUHUANG: { name: '聲東破圍', phase: 'P3', desc: '漢水背水結陣兼以樊城聲東破圍，長驅連破敵營並無視重鎧防禦' },
  GANNING: { name: '百騎劫營', phase: 'P2', desc: '頭插鳥羽腰繫銅鈴，百騎夜襲曹營不損一人，奇襲暴擊大增' },
  MOURI_MOTO: { name: '三矢嚴島', phase: 'P2', desc: '西國謀神暴風雨夜水陸奇襲，三矢齊發同時削弱敵方攻防與謀略' },
  YUEJIN: { name: '無堅不陷', phase: 'P2', desc: '五子良將每戰先登，首波交鋒強勢破除敵方護甲防線' },
  WEIYAN: { name: '子午奇略', phase: 'P2', desc: '奇兵直出子午谷，對敵方高價值主將造成額外伏擊暴擊' },
  HUANGGAI: { name: '苦肉火船', phase: 'P2', desc: '赤壁詐降駕膏油火船撞擊敵艦，對先登奇兵與水陣造成高熱焚毀' },
  YUNGWAN: { name: '別武班突擊', phase: 'P2', desc: '統率神騎神步特種奇兵北伐突襲，看破敵軍潛行並強化全軍命中' },
  ZHANGHE: { name: '巧變斷汲', phase: 'P2', desc: '依託地形巧變奇兵切斷敵軍補給，高命中與破甲貫穿敵陣要害' },
  KUKI: { name: '鐵甲船大筒', phase: 'P2', desc: '外覆鐵皮防箭防火，協同攔截並為攻城火器提供觀瞻引導' },
  HATTORI: { name: '伊賀影縫', phase: 'P2', desc: '鬼半藏極高隱匿潛入敵陣，專門暗殺未設防之高費目標' },
  JEONGJI: { name: '觀音浦斬寇', phase: 'P2', desc: '高麗水師艦載火砲齊發，壓制敵方水陸奇兵' },
  MENGHUO: { name: '南中藤甲象', phase: 'P3', desc: '南中生藤重甲與象兵據險突擊，山岳森林四夷陣攻防提升50%' },
  TOUDO: { name: '水城改築', phase: 'P2', desc: '水軍與築城兼通，穩定提供低費謀略與先登支援' },
  WAKIZAKA: { name: '淡路快船', phase: 'P2', desc: '賤岳七本槍水軍先鋒，輕舟快櫓搶先登岸' },
  MURAKAMI: { name: '能島焙烙玉', phase: 'P2', desc: '瀨戶內海能島水軍低費先登，投擲焙烙火藥玉破甲燒船' },
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
  TOYOTOMI: { name: '太閤號令', phase: 'P1', desc: '太閤神速調度與黃金軍令，開局大幅強化全軍攻勢與命中協同' },
  LUSU: { name: '榻上宏圖', phase: 'P1', desc: '提出榻上策促成孫劉聯盟，以$2費用即可啟動八陣神機網(謀略≥50)' },
  GUOJIA: { name: '十勝遺計', phase: 'P1', desc: '十勝十敗鬼才奇策，謀略達50並於首階段直取敵方主帥' },
  JIAXU: { name: '毒士亂武', phase: 'P1', desc: '算無遺策離間破敵，高隱匿先制瓦解敵方遠程防線' },
  LUXUN: { name: '火燒連營', phase: 'P2', desc: '書生都督後發制人，夷陵烈火連綿七百里貫穿敵方重甲' },
  FAZHENG: { name: '定軍奇畫', phase: 'P1', desc: '蜀漢奇謀翼侯登高指授，引導全軍集火斬將' },
  YAMAMOTO: { name: '啄木鳥奇策', phase: 'P1', desc: '川中島分兵夾擊與高嶺城築壘奇謀，以$1低費提升全軍命中與開局奇襲壓制力' },
  KANBEI: { name: '如水奇策', phase: 'P1', desc: '備中高松水攻謀主，兼具先制滲透與全軍命中、觀瞻校射增益' },
  KANGGAMCHAN: { name: '龜州水淹', phase: 'P1', desc: '高麗護國名相決堤設伏，提升全軍戰力與陣型防護並干擾敵軍攻勢' },
  HANBEI: { name: '十人奪城', phase: 'P1', desc: '美濃今孔明智奪稻葉山城，輕費奇謀輔佐大軍' },
  SANADAMASA: { name: '表裏比興', phase: 'P1', desc: '上田城鬼謀以小博大，對敵軍造成破甲奇計傷害' },
  SHIMAZU_YOSHIHISA: { name: '薩摩釣野伏', phase: 'P1', desc: '九州三州太守，配合先登與突騎設伏合圍敵軍' }
};

const UNIT_SKILL_EFFECTS = {
  HUO: { damage: 1.22, bonusVs: { air_defense: 0.16, support: 0.16 }, enemyHit: 0.03 },
  WEI: { damage: 1.08, teamGuard: 0.06, teamHit: 0.03 },
  CHENQINGZHI: { damage: 1.2, teamHit: 0.04 },
  LUBU: { damage: 1.3 },
  SHINGEN: { damage: 1.14, guard: 0.1, teamHit: 0.02 },
  GAOCHANGGONG: { damage: 1.18, armorPierce: 0.25, hit: 0.06 },
  ZHANGLIAO: { damage: 1.16, highCostDamage: 0.22 },
  ZHAOYUN: { damage: 1.08, missingHpDamage: 0.3, guard: 0.1 },
  YOSHITSUNE: { damage: 1.15, armorPierce: 0.5, hit: 0.06 },
  KENSHIN: { damage: 1.12, armorPierce: 0.45, enemyHit: 0.03 },
  ZHAOSHE: { damage: 1.16, highCostDamage: 0.24, hit: 0.06 },
  SUNCE: { damage: 1.24, hit: 0.04 },
  MACHO: { damage: 1.12, bonusVs: { armor: 0.18, air_defense: 0.12 } },
  EULJI: { damage: 1.16, enemyHit: 0.08, guard: 0.12 },
  GAISUWEN: { damage: 1.15, armorPierce: 0.45 },
  XIAHOUYUAN: { damage: 1.18, hit: 0.1 },
  MADAI: { damage: 1.14, armorPierce: 0.35, hit: 0.08 },
  KIMYUSHIN: { damage: 1.14, teamGuard: 0.1, heal: 0.12 },
  DATE: { damage: 1.14, armorPierce: 0.55 },
  YUKIMURA: { damage: 1.14, highCostDamage: 0.26 },
  PANGDE: { damage: 1.12, missingHpDamage: 0.55 },
  WANGSHUANG: { damage: 1.15, armorPierce: 0.3, woundedTargetDamage: 0.18 },
  MAEDATOSHI: { damage: 1.14, armorPierce: 0.65 },
  TACHIBANA: { damage: 1.14, armorPierce: 0.35, guard: 0.08 },
  YAMAGATA: { damage: 1.16, teamHit: 0.04 },
  BAIQI: { damage: 1.12, woundedTargetDamage: 0.4 },
  WANGJIAN: { damage: 1.14, teamGuard: 0.12, armorPierce: 0.25 },
  XIANGYU: { damage: 1.24, missingHpDamage: 0.14 },
  YUEFEI: { damage: 1.22, armorPierce: 0.5, teamGuard: 0.08 },
  GUANYU: { damage: 1.2, woundedTargetDamage: 0.16 },
  LIANPO: { damage: 1.08, guard: 0.18, teamGuard: 0.05 },
  MENGTIAN: { damage: 1.12, teamGuard: 0.1, guard: 0.1, bonusVs: { air: 0.18 } },
  ZHANGFEI: { damage: 1.16, guard: 0.1, enemyHit: 0.04 },
  SUNJIAN: { damage: 1.2, hit: 0.03 },
  CHOIYOUNG: { damage: 1.14, guard: 0.16, armorPierce: 0.35 },
  CAOREN: { damage: 1.08, guard: 0.2, teamGuard: 0.06 },
  XIAHOU_DUN: { damage: 1.12, missingHpDamage: 0.45, guard: 0.14 },
  YANGYE: { damage: 1.14, bonusVs: { air: 0.35 }, guard: 0.16, armorPierce: 0.35 },
  HOJO_UJIYASU: { damage: 1.12, heal: 0.2, guard: 0.14, teamGuard: 0.05 },
  HONDA: { damage: 1.08, guard: 0.1, heal: 0.06 },
  DIANWEI: { damage: 1.16, teamGuard: 0.09, guard: 0.12, armorPierce: 0.35 },
  XUCHU: { damage: 1.2, guard: 0.16, teamGuard: 0.06, armorPierce: 0.4 },
  YUJIN: { damage: 1.08, teamGuard: 0.1, teamHit: 0.03 },
  TACHIBANAD: { damage: 1.2, guard: 0.16, armorPierce: 0.4 },
  SHIMAZUY: { damage: 1.12, missingHpDamage: 0.26, guard: 0.1 },
  ZHOUTAI: { damage: 1.1, guard: 0.18, heal: 0.1 },
  GYEBAEK: { damage: 1.14, missingHpDamage: 0.5, guard: 0.16 },
  SHIBATA: { damage: 1.15, hit: 0.06, guard: 0.12, missingHpDamage: 0.22 },
  KATOKIYOMASA: { damage: 1.12, teamGuard: 0.09, guard: 0.14 },
  IINAOMASA: { damage: 1.2, hit: 0.08, armorPierce: 0.45, guard: 0.1 },
  LIMU: { damage: 1.12, bonusVs: { air: 0.24 }, teamHit: 0.03 },
  ZHOUYAFU: { damage: 1.12, teamGuard: 0.12, guard: 0.14, armorPierce: 0.25 },
  LIGUANG: { damage: 1.14, armorPierce: 0.45, bonusVs: { air: 0.14 }, hit: 0.08 },
  YANGYOUJI: { damage: 1.06, hit: 0.18, armorPierce: 0.35 },
  NOBUNAGA: { damage: 1.2, bonusVs: { air: 0.18 }, hit: 0.06 },
  HANSHIZHONG: { damage: 1.18, armorPierce: 0.55, hit: 0.06 },
  SHIMAZU_IEHISA: { damage: 1.16, enemyHit: 0.06, bonusVs: { air: 0.18 }, guard: 0.05 },
  HULUGUANG: { damage: 1.14, bonusVs: { air: 0.16 }, hit: 0.04 },
  HUANGZHONG: { damage: 1.20, highCostDamage: 0.24, hit: 0.08 },
  JUMONG: { damage: 1.1, hit: 0.2 },
  MALONG: { damage: 1.14, bonusVs: { air: 0.22 }, teamGuard: 0.06, hit: 0.06 },
  ZONGZE: { damage: 1.1, teamGuard: 0.08, bonusVs: { air: 0.16 } },
  GENGYAN: { damage: 1.14, enemyHit: 0.03, hit: 0.03 },
  FENGYI: { damage: 1.14, guard: 0.12, hit: 0.06 },
  TAKIGAWA: { damage: 1.14, armorPierce: 0.4, hit: 0.06 },
  TAISHICI: { damage: 1.16, guard: 0.06 },
  AKECHI: { damage: 1.24, armorPierce: 0.1 },
  ASAKURA_SOT: { damage: 1.14, hit: 0.12, teamHit: 0.03 },
  GWONYUL: { damage: 1.12, guard: 0.16, bonusVs: { air: 0.12 } },
  CHOIMUSEON: { damage: 1.26, armorPierce: 0.15 },
  YOICHI: { damage: 1.04, hit: 0.2, armorPierce: 0.25 },
  SAIKA: { damage: 1.14, bonusVs: { air: 0.16 }, hit: 0.06 },
  MATSUNAGA: { damage: 1.28, missingHpDamage: 0.1 },
  TORII: { damage: 1.1, guard: 0.16, heal: 0.1 },
  HONDA_TADATSUGU: { damage: 1.14, bonusVs: { air: 0.2 }, teamHit: 0.02 },
  XIEXUAN: { damage: 1.12, enemyHit: 0.06 },
  TIANDAN: { damage: 1.24, enemyHit: 0.04 },
  LUMENG: { damage: 1.16, hit: 0.14, armorPierce: 0.2 },
  CAOBIN: { damage: 1.12, teamGuard: 0.09, teamHit: 0.03 },
  YISUNSIN: { damage: 1.14, bonusVs: { naval: 0.16 }, guard: 0.08 },
  YUYUNWEN: { damage: 1.18, bonusVs: { naval: 0.18 }, teamHit: 0.02 },
  JIANGWEI: { damage: 1.1, armorPierce: 0.35, teamHit: 0.02 },
  LIJING: { damage: 1.18, armorPierce: 0.4, hit: 0.08 },
  DENGAI: { damage: 1.2, hit: 0.12 },
  XUHUANG: { damage: 1.18, armorPierce: 0.5, hit: 0.04 },
  GANNING: { damage: 1.24, hit: 0.06 },
  MOURI_MOTO: { damage: 1.1, enemyHit: 0.04, teamGuard: 0.04 },
  YUEJIN: { damage: 1.16, armorPierce: 0.55 },
  WEIYAN: { damage: 1.12, highCostDamage: 0.25 },
  HUANGGAI: { damage: 1.2, bonusVs: { naval: 0.12 } },
  YUNGWAN: { damage: 1.12, bonusVs: { air: 0.14, naval: 0.14 }, teamHit: 0.03 },
  ZHANGHE: { damage: 1.16, armorPierce: 0.4, hit: 0.05 },
  KUKI: { damage: 1.08, guard: 0.12, teamHit: 0.02 },
  HATTORI: { damage: 1.08, highCostDamage: 0.28, hit: 0.06 },
  JEONGJI: { damage: 1.16, bonusVs: { naval: 0.24 } },
  MENGHUO: { damage: 1.14, guard: 0.16, terrainDamage: 0.14 },
  TOUDO: { damage: 1.1, teamGuard: 0.08, teamHit: 0.04 },
  WAKIZAKA: { damage: 1.18, hit: 0.08 },
  MURAKAMI: { damage: 1.16, armorPierce: 0.2 },
  SUNWU: { commandAttack: 0.05, teamGuard: 0.09, enemyHit: 0.04 },
  ZHUGELIANG: { commandAttack: 0.06, teamGuard: 0.11, teamHit: 0.04 },
  HANXIN: { commandAttack: 0.06, teamHit: 0.04, enemyHit: 0.03 },
  ZHANGLIANG: { commandAttack: 0.05, teamHit: 0.09, teamGuard: 0.07 },
  WUQI: { commandAttack: 0.05, teamGuard: 0.06, teamHit: 0.03 },
  SUNBIN: { commandAttack: 0.03, enemyHit: 0.06 },
  LEYI: { commandAttack: 0.05, teamHit: 0.06, teamGuard: 0.05 },
  LIUBOWEN: { commandAttack: 0.05, teamHit: 0.06, teamGuard: 0.06 },
  CAOCAO: { commandAttack: 0.06, teamHit: 0.05, teamGuard: 0.05 },
  SIMAYI: { commandAttack: 0.03, teamGuard: 0.09, enemyHit: 0.04 },
  ZHOUYU: { commandAttack: 0.06, enemyHit: 0.04, teamHit: 0.02 },
  XUNYU: { commandAttack: 0.03, teamGuard: 0.06, teamHit: 0.05 },
  PANGTONG: { commandAttack: 0.04, teamHit: 0.04, enemyHit: 0.03 },
  TOKUGAWA: { commandAttack: 0.04, teamGuard: 0.1, teamHit: 0.04 },
  TOYOTOMI: { commandAttack: 0.07, teamHit: 0.07, teamGuard: 0.06 },
  LUSU: { commandAttack: 0.03, teamGuard: 0.05, teamHit: 0.04 },
  GUOJIA: { commandAttack: 0.05, enemyHit: 0.06, teamHit: 0.03 },
  JIAXU: { commandAttack: 0.03, enemyHit: 0.06 },
  LUXUN: { damage: 1.16, armorPierce: 0.45, enemyHit: 0.04 },
  FAZHENG: { commandAttack: 0.03, teamHit: 0.04 },
  YAMAMOTO: { commandAttack: 0.03, teamHit: 0.05 },
  KANBEI: { commandAttack: 0.03, teamHit: 0.05, enemyHit: 0.03 },
  KANGGAMCHAN: { commandAttack: 0.04, teamGuard: 0.07, enemyHit: 0.03 },
  HANBEI: { commandAttack: 0.04, enemyHit: 0.05, teamHit: 0.02 },
  SANADAMASA: { commandAttack: 0.03, enemyHit: 0.03, teamGuard: 0.03 },
  SHIMAZU_YOSHIHISA: { commandAttack: 0.03, enemyHit: 0.03, teamHit: 0.03 }
};

function describeSkillEffects(skill, effects, isCommand) {
  const percent = value => Math.round(value * 100);
  const categories = { air: '突騎', armor: '重甲', air_defense: '神射', naval: '奇兵', support: '軍師' };
  const parts = [];
  if (effects.damage && effects.damage !== 1) parts.push(`本次傷害 ×${effects.damage}`);
  if (effects.hit) parts.push(`本次命中 +${percent(effects.hit)} 個百分點（上限 96%）`);
  if (effects.armorPierce) parts.push(`本次忽略 ${percent(effects.armorPierce)}% 護甲（與破甲重擊疊加可穿透玄甲底線）`);
  if (effects.missingHpDamage) parts.push(`每損失 10% 自身兵力，本次傷害倍率 +${percent(effects.missingHpDamage) / 10}%`);
  if (effects.woundedTargetDamage) parts.push(`目標每損失 10% 兵力，本次傷害倍率 +${percent(effects.woundedTargetDamage) / 10}%`);
  if (effects.highCostDamage) parts.push(`目標費用高於自身（或同為四／五費精銳對決）時，本次傷害倍率 +${percent(effects.highCostDamage)}%`);
  if (effects.terrainDamage) parts.push(`山岳／森林本次傷害倍率 +${percent(effects.terrainDamage)}%`);
  for (const [category, bonus] of Object.entries(effects.bonusVs || {})) parts.push(`對${categories[category]}本次傷害倍率 +${percent(bonus)}%`);
  if (effects.heal) parts.push(`回復自身 ${percent(effects.heal)}% 最大兵力`);
  if (effects.guard) parts.push(`自身後續受傷減少 ${percent(effects.guard)}%`);
  if (effects.teamGuard) parts.push(`全軍後續受傷減少 ${percent(effects.teamGuard)}%（同類取最高）`);
  if (effects.commandAttack) parts.push(`全軍後續傷害 ×${1 + effects.commandAttack}`);
  if (effects.teamHit) parts.push(`全軍後續命中 +${percent(effects.teamHit)} 個百分點（同類取最高）`);
  if (effects.enemyHit) parts.push(`敵軍後續命中 -${percent(effects.enemyHit)} 個百分點（同類取最高）`);
  return `${skill.phase} ${isCommand ? '開局號令' : '首次命中時'}，每戰一次：${parts.join('；')}。持續效果至戰鬥結束。`;
}

const SKILL_FX_ARCHETYPES = {
  fire_storm:      { icon: '🔥', label: '烈焰火計' },
  thunder_strike:  { icon: '⚡', label: '雷霆天罰' },
  bagua_array:     { icon: '☯️', label: '奇門八陣' },
  overlord_cleave: { icon: '💥', label: '霸王破甲' },
  piercing_volley: { icon: '🏹', label: '神射貫穿' },
  tidal_surge:     { icon: '🌊', label: '怒濤伏波' },
  aegis_command:   { icon: '🛡️', label: '金剛鐵壁' },
  shadow_ambush:   { icon: '🌑', label: '暗影奇襲' }
};

const UNIT_SKILL_FX = {
  // 🔥 烈焰火計 (15)
  ZHOUYU: 'fire_storm', LUXUN: 'fire_storm', HUANGGAI: 'fire_storm', TIANDAN: 'fire_storm',
  YUYUNWEN: 'fire_storm', AKECHI: 'fire_storm', CHOIMUSEON: 'fire_storm', MATSUNAGA: 'fire_storm',
  MURAKAMI: 'fire_storm', PANGTONG: 'fire_storm', JEONGJI: 'fire_storm', KUKI: 'fire_storm',
  YUKIMURA: 'fire_storm', YAMAGATA: 'fire_storm', IINAOMASA: 'fire_storm',
  // ⚡ 雷霆天罰 (11)
  HUO: 'thunder_strike', TACHIBANAD: 'thunder_strike', TACHIBANA: 'thunder_strike', YOSHITSUNE: 'thunder_strike',
  XIAHOUYUAN: 'thunder_strike', CHENQINGZHI: 'thunder_strike', KENSHIN: 'thunder_strike', SHINGEN: 'thunder_strike',
  GAISUWEN: 'thunder_strike', ZHAOSHE: 'thunder_strike', MACHO: 'thunder_strike',
  // ☯️ 奇門八陣 (18)
  SUNWU: 'bagua_array', ZHUGELIANG: 'bagua_array', ZHANGLIANG: 'bagua_array', LIUBOWEN: 'bagua_array',
  WUQI: 'bagua_array', SUNBIN: 'bagua_array', LEYI: 'bagua_array', CAOCAO: 'bagua_array',
  SIMAYI: 'bagua_array', XUNYU: 'bagua_array', TOYOTOMI: 'bagua_array', LUSU: 'bagua_array',
  GUOJIA: 'bagua_array', FAZHENG: 'bagua_array', YAMAMOTO: 'bagua_array', KANBEI: 'bagua_array', KANGGAMCHAN: 'bagua_array',
  HANBEI: 'bagua_array', JIANGWEI: 'bagua_array',
  // 💥 霸王破甲 (20)
  LUBU: 'overlord_cleave', XIANGYU: 'overlord_cleave', GUANYU: 'overlord_cleave', ZHANGFEI: 'overlord_cleave',
  BAIQI: 'overlord_cleave', SUNJIAN: 'overlord_cleave', SUNCE: 'overlord_cleave', XUCHU: 'overlord_cleave',
  XIAHOU_DUN: 'overlord_cleave', PANGDE: 'overlord_cleave', SHIBATA: 'overlord_cleave', SHIMAZUY: 'overlord_cleave',
  GYEBAEK: 'overlord_cleave', MAEDATOSHI: 'overlord_cleave', YUEJIN: 'overlord_cleave', XUHUANG: 'overlord_cleave',
  GAOCHANGGONG: 'overlord_cleave', WANGSHUANG: 'overlord_cleave', MENGHUO: 'overlord_cleave', YANGYE: 'overlord_cleave',
  // 🏹 神射貫穿 (20)
  LIGUANG: 'piercing_volley', YANGYOUJI: 'piercing_volley', HUANGZHONG: 'piercing_volley', JUMONG: 'piercing_volley',
  NOBUNAGA: 'piercing_volley', YOICHI: 'piercing_volley', SAIKA: 'piercing_volley', LIMU: 'piercing_volley',
  HANSHIZHONG: 'piercing_volley', HULUGUANG: 'piercing_volley', TAISHICI: 'piercing_volley', ASAKURA_SOT: 'piercing_volley',
  GWONYUL: 'piercing_volley', HONDA_TADATSUGU: 'piercing_volley', GENGYAN: 'piercing_volley', TAKIGAWA: 'piercing_volley',
  DATE: 'piercing_volley', MADAI: 'piercing_volley', MALONG: 'piercing_volley', SHIMAZU_IEHISA: 'piercing_volley', ZONGZE: 'piercing_volley',
  // 🌊 怒濤伏波 (11)
  YISUNSIN: 'tidal_surge', GANNING: 'tidal_surge', MOURI_MOTO: 'tidal_surge', CAOBIN: 'tidal_surge',
  YUNGWAN: 'tidal_surge', TOUDO: 'tidal_surge', WAKIZAKA: 'tidal_surge',
  EULJI: 'tidal_surge', XIEXUAN: 'tidal_surge',
  // 🛡️ 金剛鐵壁 (20)
  WANGJIAN: 'aegis_command', YUEFEI: 'aegis_command', LIANPO: 'aegis_command', MENGTIAN: 'aegis_command',
  CHOIYOUNG: 'aegis_command', CAOREN: 'aegis_command', HOJO_UJIYASU: 'aegis_command', HONDA: 'aegis_command',
  DIANWEI: 'aegis_command', YUJIN: 'aegis_command', ZHOUTAI: 'aegis_command', KATOKIYOMASA: 'aegis_command',
  ZHOUYAFU: 'aegis_command', TORII: 'aegis_command', TOKUGAWA: 'aegis_command',
  WEI: 'aegis_command', ZHAOYUN: 'aegis_command', KIMYUSHIN: 'aegis_command',
  // 🌑 暗影奇襲 (10)
  DENGAI: 'shadow_ambush', LIJING: 'shadow_ambush', ZHANGHE: 'shadow_ambush', ZHANGLIAO: 'shadow_ambush', HATTORI: 'shadow_ambush', JIAXU: 'shadow_ambush',
  HANXIN: 'shadow_ambush', LUMENG: 'shadow_ambush', WEIYAN: 'shadow_ambush', FENGYI: 'shadow_ambush',
  SANADAMASA: 'shadow_ambush', SHIMAZU_YOSHIHISA: 'shadow_ambush'
};

function resolveSkillFx(id, cat, skill, effects, traits) {
  let fx = UNIT_SKILL_FX[id];
  if (!fx || !SKILL_FX_ARCHETYPES[fx]) {
    const labelText = `${skill?.name || ''} ${skill?.desc || ''}`;
    if (/[火焚焰砲霹靂爆焙]/.test(labelText)) fx = 'fire_storm';
    else if (/[雷電風]/.test(labelText)) fx = 'thunder_strike';
    else if (/[水江海流船潮]/.test(labelText)) fx = 'tidal_surge';
    else if ((effects && (effects.heal || effects.guard || effects.teamGuard)) || (traits || []).includes('APS')) fx = 'aegis_command';
    else if ((traits || []).includes('SUB') || (traits || []).includes('AMBUSH')) fx = 'shadow_ambush';
    else if (cat === 'support') fx = 'bagua_array';
    else if (cat === 'air_defense') fx = 'piercing_volley';
    else if (cat === 'naval') fx = 'tidal_surge';
    else fx = 'overlord_cleave';
  }
  const meta = SKILL_FX_ARCHETYPES[fx];
  return { fx, fxLabel: meta.label, fxIcon: meta.icon };
}

const TACTICAL_ROLE_OVERRIDES = {
  ZHANGLIAO: ['AMBUSH'],
  EULJI: ['AMBUSH']
};

const HISTORICAL_AUDIT = {
  ZHANGHE: {
    status: 'source-linked',
    note: '街亭斷水與用兵巧變有《三國志》卷十七所引記載；木門道為追擊中伏身亡。已調整為先登奇兵以貼合地形穿插與斷敵補給專長。',
    sources: ['https://en.wikipedia.org/wiki/Zhang_He']
  },
  YISUNSIN: {
    status: 'qualified',
    note: '鳴梁實戰十三艘與戰前奏報十二艘須區分；海峽潮流為戰術要素，不以鳴梁龜船或鐵甲覆頂作已證實事實。敵艦數量有來源差異。',
    sources: ['https://en.wikipedia.org/wiki/Battle_of_Myeongnyang']
  },
  TIANDAN: {
    status: 'source-linked',
    note: '即墨火牛陣屬陸上誘敵反擊；naval 槽是遊戲職能，不是史實水軍身分。',
    sources: ['https://en.wikipedia.org/wiki/Tian_Dan']
  },
  ZHANGLIAO: {
    status: 'source-linked',
    note: '逍遙津先攻與八百敢死士有《三國志·張遼傳》所引記載。',
    sources: ['https://en.wikipedia.org/wiki/Battle_of_Xiaoyao_Ford']
  },
  EULJI: {
    status: 'qualified',
    note: '誘敵深入與薩水追擊有史籍脈絡；放水／水壩故事未見同時代來源支持。',
    sources: ['https://en.wikipedia.org/wiki/Battle_of_Salsu']
  },
  HANXIN: {
    status: 'source-linked',
    note: '暗度陳倉、井陘背水與伏兵可連結《史記·淮陰侯列傳》；部分後世成語化敘事仍需區分。',
    sources: ['https://ctext.org/shiji/huai-yin-hou-lie-zhuan/zh']
  },
  SUNWU: {
    status: 'needs-review',
    note: '孫武生平與《孫子兵法》作者歸屬存在歷史研究爭議，不將傳統敘事當成已證實履歷。',
    sources: ['https://en.wikipedia.org/wiki/Sun_Tzu']
  },
  GWONYUL: {
    status: 'source-linked',
    note: '1593 年幸州大捷率朝鮮軍民以神機箭火車、弓弩與巨石重創進犯日軍，正史《朝鮮王朝實錄》記載明確。',
    sources: ['https://en.wikipedia.org/wiki/Gwon_Yul', 'https://en.wikipedia.org/wiki/Battle_of_Haengju']
  }
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
  const effects = UNIT_SKILL_EFFECTS[id];
  const skillFx = resolveSkillFx(id, cat, skill, effects, traits);
  return {
    id, name, cat, cost, v, tag, desc,
    traits: [...new Set([...(traits || []), ...(TACTICAL_ROLE_OVERRIDES[id] || [])])],
    roleFlags,
    historicalAudit: HISTORICAL_AUDIT[id] || { status: 'unverified', note: '', sources: [] },
    st, ew,
    hp: hp * 2, atk, def,
    skill: Object.assign({}, skill, {
      effects: effects || null,
      fx: skillFx.fx,
      fxLabel: skillFx.fxLabel,
      fxIcon: skillFx.fxIcon,
      desc: effects ? describeSkillEffects(skill, effects, (roleFlags || []).includes('STRATEGIST') && skill.phase === 'P1') : skill.desc
    }),
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
const DRONE_IDS = new Set(['TIANDAN', 'HUANGGAI', 'MURAKAMI', 'YUEJIN', 'MATSUNAGA']);
const RANGED_CAVALRY_IDS = new Set(['DATE', 'XIAHOUYUAN', 'MADAI']);

const SYNERGIES = [
  {
    id: 'cec',
    icon: '📜',
    name: '八陣神機網',
    desc: '頂尖智聖 (謀略≥50) ＋ 斷騎護將／遠程神射／弓騎突將：全軍謀略 +12、神射命中 +6%',
    check: units => units.some(u => (u.ew || 0) >= 50) && units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG') || RANGED_CAVALRY_IDS.has(u.id)),
    partial: units => {
      const hasEw = units.some(u => (u.ew || 0) >= 50);
      const hasAa = units.some(u => (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG') || RANGED_CAVALRY_IDS.has(u.id));
      if (hasEw && !hasAa) return '已備妥頂級軍師，再選【神射強弩、斷騎護將或弓騎突將】即可啟動：全軍謀略 +12、神射命中 +6%';
      if (!hasEw && hasAa) return '已備妥遠程箭陣／弓騎，再選【$5 頂級軍師 (謀略≥50)】即可啟動：全軍謀略 +12、神射命中 +6%';
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
  const isCecAa = (u.traits || []).includes('AEGIS') || (u.traits || []).includes('AA_LONG') || RANGED_CAVALRY_IDS.has(u.id);
  if (isCecEw) hints.push({ icon: '📜', name: '八陣神機網', hint: '搭配【斷騎護將／神射弩陣／弓騎突將】可啟動：全軍謀略+12、神射命中+6%' });
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
  { name: '八陣神機', note: '諸葛奇謀＋馬隆偏箱八陣合圍', ids: ['ZHANGLIAO', 'DIANWEI', 'MALONG', 'HUANGGAI', 'ZHUGELIANG'] },
  { name: '封狼居胥', note: '霍去病千里奔襲破敵', ids: ['HUO', 'XIAHOU_DUN', 'TAISHICI', 'GANNING', 'PANGTONG'] },
  { name: '殺神陷陣', note: '武安君白起與帝師劉伯溫合擊', ids: ['XIAHOUYUAN', 'BAIQI', 'GENGYAN', 'TIANDAN', 'LIUBOWEN'] },
  { name: '鳴梁伏波', note: '周瑜火攻與忠武公李舜臣水陸連環', ids: ['EULJI', 'CAOREN', 'GWONYUL', 'YISUNSIN', 'ZHOUYU'] },
  { name: '天下布武', note: '織田信長三段火器與戰國名將合擊', ids: ['YUKIMURA', 'SHIBATA', 'NOBUNAGA', 'HATTORI', 'HANBEI'] }
];

/* 暴露至全域物件以便跨模組與 Playwright 調用 */
if (typeof window !== 'undefined') {
  window.BUDGET = BUDGET;
  window.CATS = CATS;
  window.TRAITS = TRAITS;
  window.CAT_HINT = CAT_HINT;
  window.UNITS = UNITS;
  window.UNIT_SKILLS = UNIT_SKILLS;
  window.SKILL_FX_ARCHETYPES = SKILL_FX_ARCHETYPES;
  window.UNIT_SKILL_FX = UNIT_SKILL_FX;
  window.resolveSkillFx = resolveSkillFx;
  window.TACTICAL_ROLE_OVERRIDES = TACTICAL_ROLE_OVERRIDES;
  window.HISTORICAL_AUDIT = HISTORICAL_AUDIT;
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
    BUDGET, CATS, TRAITS, CAT_HINT, UNITS, UNIT_MAP, SYNERGIES, TEMPLATES, TACTICAL_ROLE_OVERRIDES, HISTORICAL_AUDIT,
    SKILL_FX_ARCHETYPES, UNIT_SKILL_FX, resolveSkillFx,
    getDeckSynergies, getUnitSynergyHints, getUnitRealismBadges,
    getUnitMasteryBadge, recordUnitMasteryFromBattle
  };
}