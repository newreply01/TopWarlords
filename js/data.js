'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 (TopWarlords) — 資料層
   200 位日韓中純歷史名將 = 5 兵團 × 5 價位 × 8 款 A~H 型
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
  ["HUO", "霍去病", 'air', 5, 'A', "封狼居胥·千里奔襲", "西漢傳奇驃騎將軍，開創大兵團長途奔襲與穿插包抄，六出塞外殲匈奴數萬，勇冠三軍。", 90, 18, ["LR", "CAS"], ["STAMINA_DEEP"], 228, 132, 0],
  ["WEI", "衛青", 'air', 5, 'B', "車騎並進·七戰七捷", "西漢大將軍大司馬，首創武剛車結陣與奇兵繞後突擊，收復河套，正面硬撼匈奴單于主力。", 78, 26, ["LR", "EW"], ["STAMINA_DEEP"], 232, 122, 0],
  ["LUBU", "呂布", 'air', 5, 'C', "人中呂布·馬中赤兔", "三國第一飛將，善騎射長驅破陣，率陷陣並州鐵騎正面踐踏敵陣，無人能擋。", 76, 12, ["LR", "CAS"], ["HEAVY_AP"], 240, 136, 0.05],
  ["YUEYUN", "岳雲", 'air', 5, 'D', "背嵬重騎·突陣碎甲", "岳飛長子，岳家軍背嵬鐵騎先鋒，手持雙鐵椎重八十斤，每戰率先突擊踏碎敵陣。", 74, 16, ["LR", "TRUE_AT"], ["HEAVY_AP"], 224, 128, 0.08],
  ["LISHIMIN", "李世民", 'air', 5, 'E', "天策上將·玄甲衝陣", "唐太宗李世民，親率數千精選玄甲黑馬騎兵直撲敵軍大旗，虎牢關以小博大一舉定中原。", 82, 28, ["LR", "DEEP", "EW"], ["STAMINA_DEEP"], 220, 124, 0],
  ["YOSHITSUNE", "源義經", 'air', 5, 'F', "鵯越絕壁·戰神逆落", "日本源平合戰第一戰神，率騎兵由陡峭絕壁一躍而下奇襲平氏大營，戰術機動性冠絕戰史。", 88, 20, ["LR", "CAS"], ["STAMINA_DEEP"], 218, 130, 0],
  ["SHINGEN", "武田信玄", 'air', 5, 'G', "甲斐之虎·風林火山", "戰國第一騎兵大師，建立威震列島之赤備騎兵軍團，動如雷霆正面摧垮敵陣。", 80, 24, ["LR", "EW"], ["STAMINA_DEEP"], 226, 125, 0],
  ["GAISUWEN", "淵蓋蘇文", 'air', 5, 'H', "身佩五刀·高句麗雄霸", "高句麗末期莫離支統帥，勇武過人善騎戰，身配五把飛刀飛馳衝殺，威震東北亞。", 82, 18, ["LR", "CAS"], ["HEAVY_AP"], 226, 126, 0.05],
  ["ZHAOYUN", "趙雲", 'air', 4, 'A', "渾身是膽·七進七出", "蜀漢常山趙子龍，長坂坡單騎護主突破萬重重圍，漢水之戰大開營門空營退敵，百戰無傷。", 70, 18, ["LR", "CAS"], ["STAMINA_DEEP"], 202, 110, 0],
  ["MACHO", "馬超", 'air', 4, 'B', "錦馬超·西涼鐵騎突陣", "西涼名門之後，統帥善長矛重甲之涼州羌胡精騎，渭水之戰一度迫使曹操割鬚棄袍。", 60, 12, ["LR", "CAS"], [], 196, 114, 0],
  ["ZHANGLIAO", "張遼", 'air', 4, 'C', "逍遙津突襲·威震江東", "曹魏五子良將之首，親率八百壯士直衝十萬東吳中軍大旗，名震天下、江東小兒不敢夜啼。", 65, 16, ["LR", "TRUE_AT"], ["STAMINA_DEEP"], 194, 112, 0],
  ["LIXU", "李愬", 'air', 4, 'D', "雪夜入蔡州·奇襲生擒", "唐代奇襲名將，頂著風雪長途急行軍六十五里無聲入蔡州，奇襲生擒吳元濟平定淮西。", 78, 22, ["LR", "DEEP"], [], 188, 106, 0],
  ["CHENQINGZHI", "陳慶之", 'air', 4, 'E', "白袍神兵·名師莫敢前", "南梁名將，率七千白袍精騎深入敵境十四月，歷四十七戰拔三十二城，所向皆靡。", 80, 24, ["SEAD", "EW"], [], 184, 98, 0],
  ["KENSHIN", "上杉謙信", 'air', 4, 'F', "越後之龍·車懸奔流", "戰國軍神，以毘沙門天為旗，獨創「車懸之陣」由騎兵輪番交替衝陣，川中島直斬敵帥。", 66, 18, ["SAT", "CAS"], ["STAMINA_DEEP"], 198, 110, 0],
  ["YUKIMURA", "真田幸村", 'air', 4, 'G', "日本第一兵·直衝本陣", "戰國末期傳奇猛將，大阪夏之陣率赤備突擊三次直撞德川家康本陣大旗，英烈千古。", 68, 14, ["LR", "CAS"], ["STAMINA_DEEP"], 196, 112, 0],
  ["KIMYUSHIN", "金庾信", 'air', 4, 'H', "新羅太大角干·風火神騎", "新羅名將興武大王，率精銳騎兵連戰連捷擊破百濟與高句麗，完成三國統一之宏業。", 64, 20, ["LR", "EW"], ["STAMINA_DEEP"], 192, 108, 0],
  ["DENGAI", "鄧艾", 'air', 3, 'A', "涉險越嶺·陰平天降", "曹魏名將，裹氈自山崖滾下行無人之地七百里，神速奇兵直取成都滅蜀。", 58, 14, ["DEEP", "LR"], [], 148, 86, 0],
  ["XIAHOUYUAN", "夏侯淵", 'air', 3, 'B', "虎步關右·三日五百", "曹魏名將，善於極速奔襲調動部隊，「典軍校尉夏侯淵，三日五百，六日一千」。", 48, 10, ["CAS", "LR"], [], 156, 84, 0],
  ["GONGSUNDU", "公孫瓚", 'air', 3, 'C', "白馬義從·塞外破胡", "幽州霸主，親自挑選百步穿楊之騎射勇士組建「白馬義從」，追殺胡虜威震塞北。", 46, 12, ["LR", "TRUE_AT"], [], 146, 82, 0],
  ["XUETOU", "薛仁貴", 'air', 3, 'D', "將軍三箭·白衣馳突", "唐初名將，身穿白袍單騎突入萬軍所向披靡，天山陣前三箭連斃三名敵酋。", 50, 10, ["LR", "CAS"], [], 152, 85, 0],
  ["CHANGYUCHUN", "常遇春", 'air', 3, 'E', "摧鋒陷陣·百萬常勝", "明初開國大將，每戰必先親率銳騎衝鋒陷陣，自謂十萬大軍可橫行天下。", 42, 8, ["CAS"], [], 160, 88, 0],
  ["DATE", "伊達政宗", 'air', 3, 'F', "獨眼龍·騎鐵先驅", "奧羽霸主，創立裝備火繩槍與重甲之「騎馬鐵砲隊」，兼具機動性與毀滅齊射。", 44, 16, ["EW", "LR"], [], 142, 80, 0],
  ["KEIJI", "前田慶次", 'air', 3, 'G', "天下傾奇·朱槍突擊", "日本戰國第一浪人，武藝超凡，手持朱槍跨騎愛馬松風於敵陣中來去自如。", 46, 8, ["TRUE_AT"], [], 148, 86, 0],
  ["EULJI", "乙支文德", 'air', 3, 'H', "神算佯敗·薩水奇襲", "高句麗名將，以退為進示弱誘隋軍三十萬深入，於薩水截水突擊斬殺殆盡。", 52, 18, ["EW", "LR"], [], 144, 80, 0],
  ["CAOZHANG", "曹彰", 'air', 2, 'A', "黃鬚少俠·勇手格獸", "曹操之子，武勇過人曾親自手格猛獸，率驍騎深入塞外大破烏桓。", 32, 6, ["CAS"], [], 122, 68, 0],
  ["LINGTONG", "凌統", 'air', 2, 'B', "國士先鋒·親率死戰", "東吳名將，每戰皆身先士卒作為銳鋒，合肥之戰親率三百突騎捨命救孫權。", 30, 8, ["TRUE_AT"], [], 116, 66, 0],
  ["WENPING", "文聘", 'air', 2, 'C', "江夏鎮守·突騎襲壘", "曹魏名將，數十年鎮守江夏，曾於暴雨中隱蔽突擊大破關羽水陸之師。", 34, 8, ["LR"], [], 120, 68, 0],
  ["HULU", "斛律羨", 'air', 2, 'D', "幽州飛騎·馳射如神", "北齊重臣名將，長於騎射治軍威肅，修築防線以飛騎往來游擊。", 28, 6, ["CAS"], [], 118, 65, 0],
  ["YUWENTAI", "宇文泰", 'air', 2, 'E', "八柱國雄·沙苑銳騎", "西魏統帥，沙苑之戰以不滿萬人之精騎迎擊高歡二十萬大軍，背水突擊大勝。", 36, 14, ["EW", "LR"], [], 114, 66, 0],
  ["YAMAGATA", "山縣昌景", 'air', 2, 'F', "赤備猛將·長驅衝鋒", "武田四天王之首，身穿鮮紅鎧甲之赤備隊衝入敵陣，威名震懾織田德川聯軍。", 26, 6, ["CAS"], [], 124, 68, 0],
  ["TACHIBANA", "立花宗茂", 'air', 2, 'G', "西國無雙·勇猛無匹", "九州戰神，被豐臣秀吉譽為「西國無雙」，無論野戰突擊或固守皆勇烈超群。", 30, 8, ["TRUE_AT"], [], 118, 67, 0],
  ["ONDAL", "溫達", 'air', 2, 'H', "平岡將軍·突陣破周", "高句麗名將，出身寒微由駙馬崛起，野戰長驅突入後周大軍斬獲甚眾。", 28, 6, ["CAS", "TRUE_AT"], [], 126, 64, 0.05],
  ["PANGDE", "龐德", 'air', 1, 'A', "抬櫬出陣·白馬射關", "曹魏勇將，抬棺出征誓死死戰，樊城陣前一箭正中關羽前額。", 20, 0, ["CAS"], [], 92, 50, 0],
  ["QUYI", "麴義", 'air', 1, 'B', "先登弩騎·破白馬義", "袁紹帳下驍將，精通胡人戰法，以八百精兵正面打垮公孫瓚精銳白馬義從。", 16, 6, ["LR"], [], 94, 48, 0],
  ["CAOZHEN", "曹真", 'air', 1, 'C', "拒蜀名將·大破趙雲", "曹魏大司馬，箕谷之戰料敵機先擊敗趙雲疑兵，戰術機動沉穩。", 18, 4, ["CAS"], [], 90, 52, 0],
  ["CAOCHUN", "曹純", 'air', 1, 'D', "虎豹統帥·南皮長驅", "曹魏精銳「虎豹騎」統領，長坂坡一日一夜疾行三百里追擊劉備。", 22, 4, ["TRUE_AT"], [], 86, 48, 0],
  ["FUMA", "風魔小太郎", 'air', 1, 'E', "暗夜騎襲·風魔黑影", "相模北條氏麾下風魔忍者首領，善率小股輕騎夜襲敵軍大營放火斷糧。", 28, 4, ["CAS"], [], 84, 52, 0],
  ["OBATA", "飯富虎昌", 'air', 1, 'F', "赤備元祖·烈火陣亡", "武田宿將，最早創立「甲州赤備」傳統之勇猛將領，衝殺在前。", 14, 0, ["CAS"], [], 96, 46, 0.05],
  ["KOGURYOTIE", "高句麗鐵騎斥候", 'air', 1, 'G', "具裝鎧馬·前線游動", "高句麗著名人馬皆被厚重鐵甲之重鎧精騎，以極低代價提供前線突擊。", 12, 6, ["LR"], [], 92, 46, 0.08],
  ["BAEKJEO", "百濟驍騎偏師", 'air', 1, 'H', "輕裝游擊·側翼牽制", "百濟地方精銳輕騎，長於平原游擊奔馳，牽制敵軍主力陣腳。", 24, 0, ["CAS"], [], 88, 48, 0],
  ["BAIQI", "白起", 'armor', 5, 'A', "武安君·長平殲滅", "戰國四大名將之首，善打殲滅戰，伊闕斬首二十四萬、長平合圍坑趙軍四十五萬，攻無不克。", 10, 16, ["APS", "HEAVY"], ["STAMINA_DEEP"], 365, 122, 0.28],
  ["XIANGYU", "項羽", 'armor', 5, 'B', "霸王破釜·以一當百", "西楚霸王，千古無二之勇力，鉅鹿之戰破釜沉舟九戰九捷擊潰秦軍主力二十萬。", 12, 8, ["APS", "TRUE_AT"], ["HEAVY_AP"], 360, 132, 0.25],
  ["YUEFEI", "岳飛", 'armor', 5, 'C', "撼山易·撼岳家軍難", "南宋民族英雄，創建紀律森嚴之岳家軍，朱仙鎮以麻札刀大破金兀朮拐子馬鐵浮屠。", 10, 18, ["APS", "HEAVY", "EW"], ["STAMINA_DEEP"], 358, 120, 0.27],
  ["WANGJIAN", "王翦", 'armor', 5, 'D', "秦滅六國·穩若泰山", "秦代統帥，以沉穩堅壁著稱，率六十萬秦軍重步大陣相持整年，終滅強楚統一天下。", 8, 14, ["APS", "HEAVY"], ["STAMINA_DEEP"], 362, 116, 0.28],
  ["LIJING", "李靖", 'armor', 5, 'E', "衛國公·六花大陣", "大唐軍神，著《衛公兵法》，創制「六花陣」以步步為營之重步大陣千里的深入踏平東突厥。", 14, 22, ["APS", "HEAVY", "EW"], ["STAMINA_DEEP"], 350, 120, 0.26],
  ["HONDA", "本多忠勝", 'armor', 5, 'F', "戰國第一槍·五十七戰無傷", "德川四天王之首，一生經歷大小五十七次激烈合戰，未曾受過刀箭之傷，被譽為花實兼備之勇將。", 10, 10, ["APS", "HEAVY"], ["STAMINA_DEEP"], 364, 118, 0.27],
  ["SHIBATA", "柴田勝家", 'armor', 5, 'G', "破瓶柴田·萬夫莫當", "織田家首席猛將，圍城時砸碎飲水瓶背水一戰大破敵軍，重甲長槍衝鋒所向披靡。", 8, 8, ["APS", "TRUE_AT"], ["HEAVY_AP"], 352, 124, 0.25],
  ["YISEONGGYE", "李成桂", 'armor', 5, 'H', "開國太祖·荒山大捷", "朝鮮王朝開國太祖，高麗末期以重甲步卒與神準弓箭於荒山大捷全殲倭寇主力。", 12, 12, ["APS", "HEAVY"], ["STAMINA_DEEP"], 356, 122, 0.26],
  ["LIANPO", "廉頗", 'armor', 4, 'A', "負荊善守·長平堅壁", "戰國名將，築固若金湯之重壘固守三年拒強秦，老驥伏櫪志在千里。", 8, 8, ["HEAVY"], ["STAMINA_DEEP"], 298, 92, 0.28],
  ["MENGTIAN", "蒙恬", 'armor', 4, 'B', "中華第一勇·築長城禦胡", "秦代大將，率三十萬重步大軍北逐匈奴，收復河南地，修築萬里長城。", 10, 10, ["APS", "HEAVY"], [], 288, 94, 0.24],
  ["GUANYU", "關羽", 'armor', 4, 'C', "威震華夏·萬人敵重將", "漢末名將，水淹七軍擒于禁斬龐德威震華夏，白馬坡斬顏良解白馬之圍。", 12, 10, ["APS", "TRUE_AT"], ["HEAVY_AP"], 284, 98, 0.22],
  ["ZHANGFEI", "張飛", 'armor', 4, 'D', "據水斷橋·萬人敵猛張飛", "漢末勇將，長坂坡據水斷橋瞋目橫矛大喝退曹軍，葭萌關夜戰力挫張郃。", 10, 6, ["HEAVY", "TRUE_AT"], [], 290, 96, 0.24],
  ["GUOZIYI", "郭子儀", 'armor', 4, 'E', "再造唐室·單騎退吐蕃", "唐代名將，安史之亂率重步陣收復長安洛陽，單騎免胄入敵營以德服人。", 12, 16, ["HEAVY", "SPOT"], [], 286, 92, 0.23],
  ["XUDA", "徐達", 'armor', 4, 'F', "萬里長城·開國第一將", "明朝開國第一功臣，統率重甲步兵大陣北伐滅元，治軍嚴明算無遺策。", 10, 12, ["HEAVY", "SPOT"], [], 288, 95, 0.22],
  ["TACHIBANAD", "立花道雪", 'armor', 4, 'G', "雷神化身·斬雷鐵壁", "九州大名，傳說曾拔刀斬雷身患腿疾，坐轎指揮重甲步陣數十年未嘗一敗。", 8, 10, ["APS", "HEAVY"], [], 282, 96, 0.22],
  ["CHOIYOUNG", "崔瑩", 'armor', 4, 'H', "黃金如石·高麗柱石", "高麗末期名將，「視黃金如爛泥」，歷經百戰擊潰倭寇與紅巾軍，一生剛毅不屈。", 10, 8, ["HEAVY", "TRUE_AT"], [], 292, 94, 0.24],
  ["DIANWEI", "典韋", 'armor', 3, 'A', "古之惡來·重雙鐵戟", "曹操親隨猛將，勇力過人力抗大旗，宛城之戰手提雙鐵戟堵塞營門力戰至死。", 10, 0, ["HEAVY", "TRUE_AT"], ["HEAVY_AP"], 248, 84, 0.26],
  ["XUCHU", "許褚", 'armor', 3, 'B', "虎癡勇悍·倒拖雙牛", "曹魏宿衛名將，勇冠三軍倒拖雙牛，潼關之戰保護曹操渡河身中重箭不退。", 8, 0, ["HEAVY"], [], 252, 80, 0.27],
  ["GAOSHUN", "高順", 'armor', 3, 'C', "陷陣營·鎧甲精整每戰必破", "呂布帳下名將，治軍極嚴兵僅八百號稱「陷陣營」，鎧甲器具皆精鍊齊整，攻無不克。", 12, 6, ["TRUE_AT", "SPOT"], [], 242, 82, 0.2],
  ["QINSHUBAO", "秦叔寶", 'armor', 3, 'D', "雙鐧重裝·百萬軍中取將", "大唐門神，手使雙鐧重甲突入萬軍之中取敵將首級，身上歷經創傷無數。", 10, 0, ["HEAVY"], [], 246, 82, 0.25],
  ["YUCHIGONG", "尉遲恭", 'armor', 3, 'E', "奪槊陷陣·黑甲門神", "大唐大將，善於單騎奪敵長槊，玄武門護衛李世民立下奇功。", 12, 6, ["TRUE_AT"], [], 238, 84, 0.2],
  ["DIQING", "狄青", 'armor', 3, 'F', "面涅將軍·銅面浴血", "北宋名將，臉刺囚印披頭散髮戴青銅面具衝殺敵陣，夜襲崑崙關平定嶺南。", 14, 8, ["TRUE_AT", "SPOT"], [], 236, 82, 0.18],
  ["SHIMAZUY", "島津義弘", 'armor', 3, 'G', "鬼石曼子·重甲死戰", "薩摩軍神，關原之戰直面十萬東軍重重包圍，率重甲死士正面突破斬開生路。", 12, 0, ["HEAVY", "TRUE_AT"], [], 244, 82, 0.24],
  ["GYEBAEK", "階伯", 'armor', 3, 'H', "黃山伐決死·五千烈士", "百濟最後將領，以五千重步死士迎戰金庾信五萬新羅大軍，四戰四捷壯烈殉國。", 10, 0, ["HEAVY"], [], 250, 80, 0.26],
  ["MENGGONG", "孟珙", 'armor', 2, 'A', "機動防禦大師·襄陽抗蒙", "南宋軍事家，一人統轄襄陽與荊湖防線，重布步陣阻絕天下無敵之蒙古鐵騎。", 10, 6, ["HEAVY"], [], 208, 64, 0.22],
  ["YANGYE", "楊業", 'armor', 2, 'B', "金刀楊無敵·雁門破遼", "北宋名將，雁門關大捷斬遼國節度使，陳家谷身中數十箭力竭被俘不食而死。", 8, 0, ["HEAVY"], [], 214, 62, 0.23],
  ["CAOREN", "曹仁", 'armor', 2, 'C', "鐵壁天人·固守樊城", "曹魏第一防守大將，濡須與樊城數次面對絕境堅壁抗敵，被曹操譽為「天人之勇」。", 6, 0, ["HEAVY"], [], 216, 60, 0.25],
  ["ZHOUTAI", "周泰", 'armor', 2, 'D', "滿身傷疤·身如鐵石", "東吳猛將，宣城之戰以身代盾護衛孫權，身上傷口幾十處皮膚如刻畫。", 10, 0, ["HEAVY", "TRUE_AT"], [], 198, 66, 0.2],
  ["LANYU", "藍玉", 'armor', 2, 'E', "大將軍·捕魚兒海重裝", "明初名將，率重甲大軍冒風沙直搗捕魚兒海，大破北元王廷俘獲萬眾。", 12, 0, ["TRUE_AT"], [], 190, 68, 0.16],
  ["IINAOMASA", "井伊直政", 'armor', 2, 'F', "井伊赤鬼·赤備先鋒", "德川四天王之一，身披赤紅厚甲勇猛善戰，長篠與關原奮勇作戰負傷不退。", 14, 6, ["APS", "HEAVY"], [], 188, 65, 0.18],
  ["KATOKIYOMASA", "加藤清正", 'armor', 2, 'G', "賤岳七本槍·築城重將", "豐臣家猛將，朝鮮之役建立蔚山倭城抗明聯軍，手使片鎌槍防禦極堅。", 12, 0, ["HEAVY"], [], 204, 62, 0.22],
  ["JEONGMUNBU", "鄭文孚", 'armor', 2, 'H', "北關大捷·義兵鐵壁", "朝鮮名將，組織咸鏡道義兵建立重甲防線，連克加藤清正大軍收復失地。", 10, 0, ["HEAVY"], [], 202, 64, 0.21],
  ["YUJIN", "于禁", 'armor', 1, 'A', "毅重治軍·持節抗敵", "曹魏五子良將，行軍治軍最為威嚴沉穩，逢難必爭死守營陣。", 8, 0, ["HEAVY"], [], 168, 42, 0.22],
  ["LIDIAN", "李典", 'armor', 1, 'B', "長者好學·步陣拒敵", "曹魏名將，深明大義顧全大局，與張遼合力堅守合肥擊潰東吳。", 12, 4, ["SPOT"], [], 142, 46, 0.12],
  ["HAOMENG", "郝萌", 'armor', 1, 'C', "前沿甲士·肉盾肉搏", "呂布部將，麾下親隨甲士重甲齊全，擅於在前沿吸收衝擊。", 6, 0, ["HEAVY"], [], 174, 40, 0.24],
  ["BAIERBING", "白毦精兵隊", 'armor', 1, 'D', "西方上兵·蜀漢親衛", "陳到所率劉備親軍精銳，以白鳥之羽為飾，多次在絕境中擔任斷後鐵壁。", 14, 0, ["TRUE_AT"], [], 138, 52, 0.1],
  ["ONIKOJIMA", "鬼小島彌太郎", 'armor', 1, 'E', "大鎧猛者·鬼神力氣", "上杉謙信麾下勇士，力大如牛，每逢攻城皆以身頂盾撞破柵門。", 8, 0, ["HEAVY"], [], 170, 42, 0.23],
  ["KANISAIZO", "可兒才藏", 'armor', 1, 'F', "笹之才藏·插竹取首", "戰國著名槍手，每斬殺一名敵軍便在首級插上竹葉，斬將無數防守凶悍。", 16, 0, ["TRUE_AT"], [], 140, 48, 0.12],
  ["BYEOLMUBAN", "高麗別武班重卒", 'armor', 1, 'G', "尹瓘編軍·破胡重步", "高麗尹瓘為抗女真創立之專屬重裝步兵營，持長盾重斧克制騎兵。", 6, 0, ["HEAVY"], [], 172, 40, 0.23],
  ["GAPSABO", "朝鮮甲士重卒", 'armor', 1, 'H', "禁軍甲士·鐵葉戰袍", "朝鮮王朝正規世襲步軍，身披布面鐵葉甲，結成陣列以拒外侮。", 12, 0, ["TRUE_AT"], [], 144, 46, 0.14],
  ["LIGUANG", "李廣", 'air_defense', 5, 'A', "漢之飛將·射石沒羽", "西漢名將，射術通神，「林暗草驚風，將軍夜引弓；平明尋白羽，沒在石稜中」。", 16, 22, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 256, 132, 0.06],
  ["YANGYOUJI", "養由基", 'air_defense', 5, 'B', "百步穿楊·一矢斃命", "春秋楚國神射手，百步之外射楊柳葉百發百中，一箭能穿透七層重鎧。", 14, 20, ["AA_LONG"], ["PASSIVE_VOLLEY"], 252, 130, 0.08],
  ["QIJIGUANG", "戚繼光", 'air_defense', 5, 'C', "鴛鴦火陣·鳥銃遮天", "明代軍事巨擘，創鴛鴦陣、虎蹲砲與鳥銃交替輪射，大破東南倭寇威震薊北。", 12, 10, ["AA_LONG", "CIWS"], ["FORMATION_SHIELD"], 248, 122, 0.06],
  ["NOBUNAGA", "織田信長", 'air_defense', 5, 'D', "長篠三段·鐵砲破雷", "天下布武織田信長，長篠合戰集結三千火繩槍以三段輪射粉碎武田勝賴赤備騎兵。", 16, 24, ["AA_LONG", "EW"], ["FORMATION_SHIELD"], 244, 126, 0.06],
  ["YOICHI", "那須與一", 'air_defense', 5, 'E', "扇之的·神弓定浪", "日本源平名射手，屋島合戰波濤洶湧中一箭射中搖晃戰船上的紅底金箔紅扇。", 14, 26, ["APS", "AA_LONG"], ["PASSIVE_VOLLEY"], 254, 130, 0.06],
  ["JUMONG", "朱蒙", 'air_defense', 5, 'F', "東明神王·百發百中", "高句麗開國神王，因善射被尊稱「朱蒙」（善射者之意），騎射功夫通神。", 14, 18, ["AA_LONG"], ["PASSIVE_VOLLEY"], 250, 128, 0.06],
  ["GWONYUL", "權慄", 'air_defense', 5, 'G', "幸州大捷·神機破軍", "朝鮮都元帥，幸州山城戰役以神機箭、火車與灰石大破日本宇喜多秀家三萬大軍。", 16, 20, ["AA_LONG", "CIWS"], ["FORMATION_SHIELD"], 246, 126, 0.08],
  ["XUERENARROW", "薛仁貴射雕營", 'air_defense', 5, 'H', "三箭定天山·射雕破騎", "唐代神射禁衛軍，傳承薛禮「脫帽退敵、三箭平定天山」之威名，連鎖封鎖騎兵衝鋒。", 14, 22, ["AA_LONG", "CIWS"], ["PASSIVE_VOLLEY"], 252, 128, 0.06],
  ["HUANGZHONG", "黃忠", 'air_defense', 4, 'A', "老當益壯·定軍神弦", "蜀漢五虎上將，百步穿楊弦無虛發，定軍山策馬衝鋒陣斬曹魏主帥夏侯淵。", 14, 10, ["AA_LONG"], ["PASSIVE_VOLLEY"], 198, 104, 0],
  ["TAISHICI", "太史慈", 'air_defense', 4, 'B', "猿臂善射·搴旗斬將", "東吳名將，長於射術箭無虛發，城樓之上將反叛者之手一箭釘於城樓護木。", 12, 8, ["CIWS", "AA_LONG"], [], 204, 96, 0],
  ["HANSHIZHONG", "韓世忠", 'air_defense', 4, 'C', "克敵神弓·大破鐵浮", "南宋名將，創「克敵弓」射程達數百步可貫雙甲，大破金兵連環鐵騎。", 14, 10, ["AA_LONG"], [], 196, 102, 0],
  ["HAOZHAO", "郝昭", 'air_defense', 4, 'D', "陳倉箭石·拒諸葛二十萬", "曹魏名將，以千餘殘兵固守陳倉，以火箭連射燒毀諸葛亮雲梯衝車二十晝夜。", 12, 6, ["AA_LONG"], [], 202, 98, 0.1],
  ["AKECHI", "明智光秀", 'air_defense', 4, 'E', "鐵砲名手·本能寺雷火", "戰國智勇名將，精通鐵砲連射戰法，曾於浪人時期以一槍百步穿錢名揚天下。", 14, 12, ["SAT", "AA_LONG"], [], 198, 96, 0.06],
  ["SAIKA", "雜賀孫市", 'air_defense', 4, 'F', "紀伊鐵砲·八咫烏之王", "雜賀眾首領鈴木重秀，率鐵砲傭兵重創織田信長大軍，火器游擊戰之宗師。", 14, 12, ["CIWS", "AA_LONG"], [], 200, 98, 0.05],
  ["YANGMANCHUN", "楊萬春", 'air_defense', 4, 'G', "安市神弓·射退太宗", "高句麗安市城城主，堅守城池數月，據傳於城頭開硬弓射傷敵方先鋒。", 12, 8, ["CIWS", "AA_LONG"], [], 202, 96, 0.08],
  ["PARKJESANG", "朴齊上", 'air_defense', 4, 'H', "忠臣射聲·鎮衛海關", "新羅著名忠臣將領，精熟守禦與射術，誓死守護海關防線。", 14, 10, ["AA_LONG"], [], 196, 100, 0],
  ["ZHANGHE", "張郃", 'air_defense', 3, 'A', "木門伏射·巧變良將", "曹魏五子良將，擅於利用地形設伏，街亭一戰斷蜀軍水源大破馬謖。", 22, 14, ["AA_LONG", "CIWS"], [], 166, 86, 0.05],
  ["ZHANGXUN", "張巡", 'air_defense', 3, 'B', "睢陽堅守·以矢抗賊", "大唐忠烈，以數千守軍堅守睢陽擋叛軍十三萬，箭盡削竹為矢連環狙殺。", 20, 14, ["CIWS", "AA_LONG"], [], 162, 86, 0.06],
  ["YANYAN", "嚴顏", 'air_defense', 3, 'C', "巴郡老將·斷頭將軍", "益州老將，善引硬弓，「只有斷頭將軍，無降將軍也！」，威儀震懾張飛。", 12, 6, ["HEAVY"], [], 164, 86, 0.16],
  ["ZONGZE", "宗澤", 'air_defense', 3, 'D', "汴京連弩·過河名將", "南宋初年抗金名臣，重整東京汴京城防，築連弩箭樓二十餘座阻截金騎。", 14, 6, ["CIWS"], [], 158, 82, 0.08],
  ["INABA", "稻葉一鐵", 'air_defense', 3, 'E', "頑固鐵壁·美濃鐵砲隊", "美濃三人眾之首，性格剛毅如鐵，長篠之戰帶領鐵砲部隊封鎖陣線。", 16, 16, ["AA_LONG", "EW"], [], 158, 84, 0.05],
  ["SUZUKI", "鈴木重朝", 'air_defense', 3, 'F', "紀州狙擊·伏擊破敵", "雜賀眾勇將，善於在山林間埋伏射擊，曾於戰場遠程擊中敵方主將甲冑。", 18, 8, ["AA_LONG"], [], 160, 86, 0.04],
  ["CHOIMUSEON", "崔茂宣", 'air_defense', 3, 'G', "高麗火砲之父·鎮海轟雷", "高麗科學家兼將領，首次自製火藥，並創立走火砲與神機箭破除倭寇。", 18, 12, ["CIWS", "AA_LONG"], [], 162, 84, 0.06],
  ["SHINRIP", "申砬", 'air_defense', 3, 'H', "北邊神射·忠州背水", "朝鮮北邊猛將，曾以神準弓術威震北方女真，忠州彈琴台力戰不屈。", 16, 8, ["AA_LONG"], [], 164, 84, 0.05],
  ["LUSUARCH", "魯肅引弓", 'air_defense', 2, 'A', "敦厚武勇·單手貫盾", "東吳大都督年輕時武藝出眾，率眾南遷時親自張弓射穿追兵盾牌。", 12, 4, ["CIWS"], [], 128, 62, 0],
  ["WENCHOU", "文醜射聲", 'air_defense', 2, 'B', "冀州勁弩·延津射張", "袁紹麾下猛將，延津之戰以強弓連射擊退張遼、徐晃兩員曹營大將。", 14, 4, ["AA_LONG"], [], 126, 64, 0],
  ["CAOPICROSS", "曹丕親射組", 'air_defense', 2, 'C', "步射精嫻·連珠百發", "曹魏文帝善於騎射步射，平生精研弓術，曾於百步外連中飛燕。", 18, 8, ["CIWS"], [], 124, 68, 0],
  ["YUANCHONGHUAN", "袁崇煥紅夷砲組", 'air_defense', 2, 'D', "寧遠重砲·以銃制騎", "明末薊遼督師，於寧遠城牆架設西洋紅夷大砲，擊退後金八旗騎兵衝鋒。", 15, 8, ["AA_LONG"], [], 126, 66, 0.1],
  ["NAGASHINO", "長篠足輕鐵砲組", 'air_defense', 2, 'E', "竹束馬防·三段連響", "戰國足輕火槍隊，依託竹束與防馬柵排開，連續開火粉碎騎兵。", 22, 14, ["CIWS", "EW"], [], 126, 66, 0.08],
  ["TANEGASHIMA", "種子島火銃隊", 'air_defense', 2, 'F', "傳來初火·百步穿鎧", "種子島時堯仿製西洋火器組建之最初鐵砲隊，打破傳統冷兵器戰局。", 20, 10, ["CIWS"], [], 122, 66, 0.06],
  ["SINGIJEON", "朝鮮神機箭營", 'air_defense', 2, 'G', "百箭連發·火車震天", "朝鮮王朝劃時代連發火箭武器，推車搭載百枚帶炸藥火箭瞬間齊射。", 18, 8, ["CIWS"], [], 124, 66, 0.06],
  ["KIMSIMIN", "金時敏", 'air_defense', 2, 'H', "晉州守城·萬矢穿鎧", "朝鮮名將，第一次晉州城之戰率三千軍民以神準射術擊退兩萬敵軍。", 16, 6, ["AA_LONG"], [], 128, 62, 0.06],
  ["ZHUGELIAN", "諸葛連弩隊", 'air_defense', 1, 'A', "元戎十矢·連發神機", "諸葛亮發明之元戎連弩，一次可連續發射十支鐵矢，密集火網壓制突騎。", 36, 0, ["SPOT"], [], 94, 48, 0],
  ["SHENBI", "宋軍神臂弓營", 'air_defense', 1, 'B', "踏張神弩·遠貫重鎧", "宋朝步兵主力遠程重弩，以踏鐙拉開，射程四百步可直接貫穿重甲。", 32, 0, ["CIWS"], [], 102, 46, 0],
  ["SHESHENG", "漢朝射聲營", 'air_defense', 1, 'C', "聽聲辨位·盲射鎖魂", "漢朝北軍五校精銳射手，長於夜戰聽敵軍馬蹄聲響精準發矢射殺。", 28, 0, ["AA_LONG"], [], 90, 52, 0],
  ["CHUBEE", "楚國連珠弩手", 'air_defense', 1, 'D', "機巧連發·矢如飛蝗", "戰國楚國擅製機關強弩，陣列齊射箭雨如織封鎖道路。", 16, 0, ["CIWS"], [], 100, 48, 0.1],
  ["KUNITOMO", "國友村鍛銃隊", 'air_defense', 1, 'E', "鐵砲之里·散彈火網", "近江國友鍛造之民兵鐵砲組，以散彈近距離轟擊敵方騎兵前蹄。", 10, 0, ["CIWS"], [], 104, 50, 0.12],
  ["NEGORO", "根來眾僧兵槍手", 'air_defense', 1, 'F', "紀州鐵砲僧·神準狙射", "紀伊根來寺武裝僧兵，白天誦經夜練火槍，狙殺術名冠列島。", 24, 0, ["AA_LONG"], [], 92, 50, 0],
  ["KOGURYOBOW", "高句麗林地伏弩組", 'air_defense', 1, 'G', "密林偽裝·破甲伏殺", "依託險峻山林之高句麗獵戶弩手，專伏擊通過隘口之敵方騎兵。", 26, 0, ["SPOT"], [], 96, 46, 0.05],
  ["JUKRIM", "竹林民兵伏射組", 'air_defense', 1, 'H', "竹弓埋伏·近距疾射", "朝鮮半島民間義兵，以彈性極佳之竹弓在隘道兩側展開短距急射。", 22, 0, ["CIWS"], [], 98, 46, 0.06],
  ["ZHOUYU", "周瑜", 'naval', 5, 'A', "雅量江東·赤壁連環火", "東吳大都督，精研水戰與火攻奇策，赤壁之戰以少勝多一把大火焚盡曹軍樓船水寨。", 22, 26, ["AEGIS", "AA_LONG"], ["FORMATION_SHIELD"], 362, 132, 0.12],
  ["ZHENGCHENG", "鄭成功", 'naval', 5, 'B', "國姓爺·鐵人水陸克荷", "延平王鄭成功，統率龐大海上艦隊與重甲「鐵人軍」，橫渡海峽擊潰荷蘭艦隊收復台灣。", 24, 20, ["AEGIS", "ASW"], ["STAMINA_DEEP"], 368, 128, 0.12],
  ["SHILANG", "施琅", 'naval', 5, 'C', "靖海將軍·澎湖海決", "清初水師提督，深諳海潮風信，率三百艘巨艦於澎湖海戰大破明鄭水師主力。", 20, 18, ["AEGIS"], ["STAMINA_DEEP"], 370, 126, 0.1],
  ["YISUNSIN", "李舜臣", 'naval', 5, 'D', "忠武公·鳴梁神話龜船", "朝鮮海神，創制鐵甲覆頂之「龜甲船」，於鳴梁海峽以十二艘板屋船大破敵艦百餘艘。", 84, 16, ["SUB", "DEEP", "ASW"], ["STAMINA_DEEP"], 340, 130, 0.14],
  ["KUKI", "九鬼嘉隆", 'naval', 5, 'E', "海賊大名·鐵甲船破水", "織田家水軍統帥，建造外覆鐵皮以防箭火之巨型「鐵甲船」，第二次木津川口之戰大勝毛利水軍。", 20, 22, ["AEGIS", "SPOT"], ["STAMINA_DEEP"], 356, 126, 0.11],
  ["DENGAI_V", "鄧艾奇兵隊", 'naval', 5, 'F', "陰平天降·奇兵直搗", "曹魏奇兵部隊，涉險越過摩天嶺無人絕壁，神速出現在蜀漢腹地迫降成都。", 86, 18, ["SUB", "DEEP"], ["HEAVY_AP"], 332, 128, 0.1],
  ["SHIMAZU_V", "島津釣野伏組", 'naval', 5, 'G', "釣野伏·敵中突破先登", "薩摩軍團傳奇戰術，以小隊偽退誘敵深入伏擊圈，四面包夾全殲敵軍。", 52, 22, ["AMBUSH", "ASW"], ["STAMINA_DEEP"], 350, 128, 0.12],
  ["JANGPOGO", "張保皐", 'naval', 5, 'H', "清海鎮霸·東亞海王", "新羅海上霸主，於清海鎮築城建立海上貿易與強大海軍，肅清黃海海盜。", 22, 24, ["AEGIS", "ASW"], ["STAMINA_DEEP"], 354, 126, 0.11],
  ["LUMENG", "呂蒙", 'naval', 4, 'A', "白衣渡江·神速襲南郡", "東吳大都督，精妙偽裝商船「白衣渡江」無聲奪取烽火台，襲取荊州擒殺關羽。", 78, 16, ["SUB", "DEEP"], [], 274, 102, 0.1],
  ["GANNING", "甘寧", 'naval', 4, 'B', "百騎夜襲·錦帆鈴聲", "東吳猛將，頭插鳥羽腰繫銅鈴，濡須之戰親率百名死士夜襲曹操四十萬大營全身而退。", 48, 12, ["ASW", "AMBUSH"], ["STAMINA_DEEP"], 276, 104, 0.12],
  ["HUANGGAI", "黃蓋", 'naval', 4, 'C', "苦肉火船·赤壁烈焰", "東吳老將，行苦肉計駕十艘滿載膏油柴草之艨艟火船直撞曹軍連環巨艦。", 46, 10, ["AMBUSH", "SWARM"], [], 268, 106, 0.1],
  ["WANGJUN", "王濬", 'naval', 4, 'D', "樓船下蜀·千尋鐵鎖沉", "西晉名將，建造方百二十步容二千人之巨型樓船，順長江直下破鐵鎖滅吳。", 26, 10, ["ASW", "AEGIS"], [], 278, 96, 0.12],
  ["YANGSU", "楊素", 'naval', 4, 'E', "五牙巨艦·威平江南", "隋朝開國名將，監造五牙巨艦高達百餘尺，拍竿擊碎敵船平定南陳。", 25, 12, ["AEGIS", "EW"], [], 274, 98, 0.1],
  ["YOSHITSUN_V", "源義經屋島先鋒", 'naval', 4, 'F', "暴風渡海·急襲屋島", "源義經於狂風暴雨中僅以五艘戰船強渡阿波海峽，自後方直插平氏大營。", 76, 10, ["SUB", "AMBUSH"], ["STAMINA_DEEP"], 272, 102, 0.11],
  ["MURAKAMI", "村上武吉", 'naval', 4, 'G', "能島水軍·焙烙玉焚艦", "瀨戶內海霸主村上水軍統帥，善用陶罐投擲炸藥「焙烙玉」焚毀敵艦。", 48, 12, ["ASW", "AMBUSH"], [], 266, 100, 0.1],
  ["LEEOKGI", "李億祺", 'naval', 4, 'H', "全羅右水使·並肩禦侮", "朝鮮名將，李舜臣最親密之戰友，數度率艦隊協同作戰，最後血戰殉國。", 25, 10, ["ASW", "AEGIS"], [], 276, 96, 0.12],
  ["ZHANGLIAO_V", "張遼先登組", 'naval', 3, 'A', "披甲持戟·首登破城", "張遼年輕時身為先登隊長，屢次第一個登城斬將破陣。", 38, 8, ["AMBUSH", "ASW"], [], 224, 82, 0.12],
  ["HANSHIZHONG_V", "韓世忠水軍營", 'naval', 3, 'B', "黃天蕩阻擊·鐵索截江", "韓世忠率水軍於長江黃天蕩設伏，以少數海船困住金兀朮十萬大軍四十八天。", 36, 8, ["AEGIS"], [], 226, 78, 0.11],
  ["WEIYAN", "魏延", 'naval', 3, 'C', "子午奇略·勇略先登", "蜀漢猛將，長年鎮守漢中金湯不失，常請精兵五千出子午谷直撲長安。", 42, 6, ["AMBUSH"], [], 220, 84, 0.1],
  ["LIXU_V", "李愬蔡州夜襲隊", 'naval', 3, 'D', "風雪無聲·鵝鴨遮聲", "李愬率精兵經鵝鴨池藉喧鬧遮掩踏雪腳步，無聲突破重門直達敵主帥臥房。", 72, 8, ["SUB"], [], 212, 80, 0.1],
  ["MOURI_V", "毛利嚴島奇兵", 'naval', 3, 'E', "大雨嚴島·夜度奇襲", "毛利元就率全軍於暴雨之夜渡海登陸嚴島，拂曉直插陶晴賢兩萬大營。", 70, 10, ["SUB", "AMBUSH"], [], 214, 80, 0.1],
  ["HATTORI", "服部半藏", 'naval', 3, 'F', "鬼半藏·伊賀忍軍統領", "德川家康麾下伊賀忍者統領，擅於潛入、暗殺、情報蒐集與陣前開道。", 75, 12, ["SUB", "AMBUSH"], [], 208, 82, 0.1],
  ["JEONGJI", "鄭地", 'naval', 3, 'G', "鎮浦火砲·水師斬寇", "高麗水軍將領，於鎮浦海戰首創以艦載火砲轟碎倭寇五百餘艘戰船。", 30, 8, ["AEGIS", "ASW"], [], 228, 76, 0.1],
  ["GWAKJAEWOO", "郭再祐", 'naval', 3, 'H', "紅衣將軍·宜寧奇兵", "朝鮮宣祖年間抗倭義兵將領，身穿紅衣騎白馬神出鬼沒，游擊殲敵。", 68, 8, ["SUB", "AMBUSH"], [], 216, 78, 0.1],
  ["JIANGQIN", "蔣欽", 'naval', 2, 'A', "濡須遏浪·先登力戰", "東吳水軍名將，善使艨艟衝擊敵陣，濡須口抵禦曹操大軍功勳卓著。", 30, 6, ["ASW"], [], 190, 66, 0.12],
  ["DONGXI", "董襲", 'naval', 2, 'B', "濡須斷鎖·死守巨艦", "東吳猛將，濡須塢戰役夜遇暴風，堅守五層巨樓船拒絕避難力戰溺死。", 28, 6, ["ASW"], [], 192, 65, 0.12],
  ["DINGFENG", "丁奉", 'naval', 2, 'C', "雪中奮短兵·東興破敵", "東吳晚期名將，東興之戰率三千敢死隊頂風冒雪脫去兜鍪短兵突入魏軍。", 40, 8, ["AMBUSH"], [], 184, 70, 0.1],
  ["MENGCHONG", "水陸艨艟衝角隊", 'naval', 2, 'D', "生牛皮蒙衝·破浪撞擊", "東吳精銳突擊戰船，船身滿覆生牛皮開弩窗矛穴，高速衝撞敵方巨艦。", 26, 10, ["ASW", "CIWS"], [], 190, 68, 0.12],
  ["FUMASUB", "風魔忍軍水鬼組", 'naval', 2, 'E', "水遁暗殺·鑿穿舟底", "相模風魔眾精通水遁潛泳之忍者，暗夜潛入敵方船底鑿孔鑿漏。", 66, 0, ["SUB", "AMBUSH"], [], 172, 66, 0.08],
  ["KONISHI", "小西行長先遣軍", 'naval', 2, 'F', "一番隊先登·神速登陸", "侵朝先遣一番隊統帥，以極速水陸協同先登釜山，長驅直入。", 24, 8, ["AMBUSH", "ASW"], [], 188, 68, 0.1],
  ["PANOKSEON", "朝鮮板屋快艚隊", 'naval', 2, 'G', "多槳快船·靈活游動", "朝鮮沿海靈活機動之多槳小型板屋船組，專事斥候與狼群穿插。", 26, 6, ["ASW"], [], 186, 66, 0.1],
  ["KWONJUN", "權俊", 'naval', 2, 'H', "前鋒都事·截敵斷道", "李舜臣麾下第一戰將，歷次海戰均為前鋒，勇悍機敏戰功最著。", 24, 8, ["AMBUSH", "ASW"], [], 188, 68, 0.1],
  ["SHUIGUI", "水陸潛泳水鬼營", 'naval', 1, 'A', "水底無聲·龍骨鑿穿", "長江兩岸精選之浪裡死士，口銜短刀水底潛行鑿毀敵方重船龍骨。", 62, 0, ["SUB", "AMBUSH"], [], 112, 48, 0],
  ["XIANDENG", "先登跳蕩死士組", 'naval', 1, 'B', "短兵相接·首登奪旗", "大軍陣前挑選之敢死隊，不避矢石攀爬城雲直插敵陣。", 26, 0, ["CIWS"], [], 148, 48, 0.08],
  ["JINGKE", "荊軻", 'naval', 1, 'C', "風蕭蕭兮·圖窮匕見", "戰國著名刺客，受燕太子丹之託刺殺秦王，「風蕭蕭兮易水寒，壯士一去兮不復還」。", 48, 0, ["AMBUSH"], [], 124, 56, 0],
  ["ZHUANZHU", "專諸", 'naval', 1, 'D', "魚腸古劍·近身暗刺", "春秋刺客，將短劍藏於烤魚腹中，近身刺殺吳王僚，一擊必殺。", 60, 0, ["SUB", "AMBUSH"], [], 116, 50, 0],
  ["KUMANO", "熊野水軍輕快艇", 'naval', 1, 'E', "紀州小艇·狼群蜂擁", "紀伊半島沿海海民組建之輕快排船，十數艘蜂擁而上夾擊大船。", 48, 0, ["AMBUSH", "SWARM"], [], 128, 54, 0.06],
  ["KOGA_SUB", "甲賀暗夜突襲隊", 'naval', 1, 'F', "密林潛伏·毒刃夜襲", "甲賀五十三家忍者死士，擅長利用夜色掩護無聲割斷敵哨咽喉。", 64, 0, ["SUB", "AMBUSH"], [], 114, 48, 0],
  ["TAMNA", "耽羅水手義勇隊", 'naval', 1, 'G', "濟州健兒·弄潮搏殺", "濟州島善泅水之海民，在風浪中操輕舟投擲石塊與火把焚敵。", 42, 0, ["AMBUSH"], [], 126, 52, 0],
  ["MOKBAE", "義兵連環木筏火攻組", 'naval', 1, 'H', "浮木引火·順流焚營", "朝鮮民間義兵以粗木紮成大型火筏，順著水流撞擊敵軍糧道與船隊。", 46, 0, ["AMBUSH", "SWARM"], [], 128, 54, 0.06],
  ["ZHUGELIANG", "諸葛亮", 'support', 5, 'A', "臥龍智聖·八陣通神", "三國蜀漢丞相，千古智聖，隆中對三分天下，創八陣圖與諸葛連弩，神機妙算運籌決勝。", 12, 78, ["EW", "SPOT"], ["STRATEGIST", "FORMATION_SHIELD"], 224, 94, 0],
  ["HANXIN", "韓信", 'support', 5, 'B', "兵仙神算·十面埋伏", "漢初三傑之一，兵家四勢之兵形勢代表，「多多益善」，明修棧道暗度陳倉、十面埋伏垓下破楚。", 94, 24, ["DEEP", "TRUE_AT"], ["STAMINA_DEEP"], 198, 126, 0],
  ["ZHANGLIANG", "張良", 'support', 5, 'C', "運籌帷幄·決勝千里", "漢初三傑之謀聖，運籌策帷帳之中，決勝於千里之外，圯上敬履得《太公兵法》，佐劉邦定天下。", 10, 72, ["EW", "SPOT"], ["STRATEGIST"], 216, 88, 0],
  ["SIMAYI", "司馬懿", 'support', 5, 'D', "鷹視狼顧·深謀待時", "曹魏太傅，深沉有度深謀遠慮，熬死諸葛亮、平定遼東，為晉朝開國奠定基業。", 10, 70, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 218, 90, 0],
  ["LIUBOWEN", "劉伯溫", 'support', 5, 'E', "一統江山·神算軍師", "明代開國謀臣，「三分天下諸葛亮，一統江山劉伯溫」，鄱陽湖大戰規劃奇謀全殲陳友諒。", 12, 74, ["EW", "SPOT"], ["STRATEGIST"], 215, 90, 0],
  ["HANBEI", "竹中半兵衛", 'support', 5, 'F', "今孔明·十人奪城", "戰國天才軍師，僅帶十六名隨從便智奪固若金湯之稻葉山城，輔佐豐臣秀吉天下布武。", 14, 72, ["EW", "SPOT"], ["STRATEGIST"], 210, 92, 0],
  ["KANBEI", "黑田官兵衛", 'support', 5, 'G', "如水大謀·天下二兵衛", "戰國頂級軍略家，高松城水攻、中國大返還之總策劃者，智謀令豐臣秀吉亦為之忌憚。", 12, 75, ["EW", "SPOT"], ["STRATEGIST", "STAMINA_DEEP"], 216, 92, 0],
  ["GANGGAMCHAN", "姜邯贊", 'support', 5, 'H', "龜州大捷·以水代兵", "高麗名臣將領，興化鎮築壩蓄水突放水淹十萬契丹精騎，龜州大捷全殲契丹主力。", 10, 76, ["EW", "HEAVY"], ["STRATEGIST", "FORMATION_SHIELD"], 236, 84, 0.22],
  ["SUNBIN", "孫臏", 'support', 4, 'A', "圍魏救趙·馬陵道伏兵", "戰國兵家宗師，著《孫臏兵法》，桂陵之戰圍魏救趙、馬陵之戰減灶誘敵射殺龐涓。", 28, 12, ["SEAD", "ARTY"], ["STRATEGIST"], 164, 98, 0],
  ["WUQI", "吳起", 'support', 4, 'B', "吳子治軍·兼併無敵", "戰國兵法名家，與孫子並稱「孫吳」，治西河大戰七十六全勝六十四，魏武卒所向披靡。", 26, 14, ["EW", "SEAD"], ["STAMINA_DEEP"], 160, 94, 0],
  ["GUOJIA", "郭嘉", 'support', 4, 'C', "十勝十敗·鬼謀奇策", "曹操心腹謀士，「郭嘉不死，便無赤壁」，算準孫策之死，力主遠征烏桓白狼山大勝。", 46, 56, ["EW", "DEEP"], [], 154, 82, 0],
  ["XUNYU", "荀彧", 'support', 4, 'D', "王佐之才·深謀遠猷", "曹操首席戰略大師，深謀遠慮為曹操規劃統一北方大略，官渡之戰扼守後方力主相持。", 44, 52, ["EW", "SPOT"], [], 156, 80, 0],
  ["JIAXU", "賈詡", 'support', 4, 'E', "算無遺策·毒士洞察", "三國第一洞察軍師，宛城奇計重創曹操，潼關離間韓遂馬超，生平出謀劃策無一失手。", 46, 50, ["EW", "SEAD"], [], 152, 84, 0],
  ["LUXUN", "陸遜", 'support', 4, 'F', "火燒連營·夷陵破蜀", "東吳大都督，白面書生深藏不露，夷陵之戰後發制人，一把火燒連營七百里擊潰劉備。", 32, 12, ["TRUE_AT", "DEEP"], [], 150, 96, 0],
  ["MASASHIGE", "楠木正成", 'support', 4, 'G', "軍神大謀·千早城智守", "日本南北朝傳奇軍師，以數百人守千早城，用滾木巨石與熱水潑敵，挫敗十萬幕府大軍。", 30, 10, ["SEAD", "ARTY"], ["STAMINA_DEEP"], 158, 96, 0],
  ["SEOHUI", "徐熙", 'support', 4, 'H', "唇槍舌劍·不戰屈兵", "高麗著名外交謀略家，隻身赴契丹軍營從容折衝，不僅退契丹六萬大軍，更收復鴨綠江以南江東六州。", 44, 48, ["EW", "DEEP"], [], 152, 82, 0],
  ["PANGTONG", "龐統", 'support', 3, 'A', "鳳雛奇策·連環上策", "劉備軍師，與諸葛亮並稱「伏龍鳳雛」，入蜀大戰獻上中下三策，親臨戰陣指揮破敵。", 18, 12, ["ARTY", "HEAVY"], [], 144, 92, 0.18],
  ["FAZHENG", "法正", 'support', 3, 'B', "定軍奇畫·斬將夏侯", "劉備首席謀臣，曹操歎曰「吾收奸雄略盡，獨不得法正邪」，定軍山親自登高指揮陣斬夏侯淵。", 12, 10, ["ARTY", "SPOT"], [], 138, 86, 0.08],
  ["CHENGONG", "陳宮", 'support', 3, 'C', "剛直智計·下邳奇計", "東漢末年謀士，輔佐呂布數度擊破曹操，下邳之戰建議互為犄角可惜未被採納。", 18, 8, ["ARTY", "SEAD"], [], 130, 84, 0],
  ["WEIXIAOKUAN", "韋孝寬", 'support', 3, 'D', "玉璧守城·地道神算", "西魏名將，玉璧之戰高歡以七萬大軍地道攻城，孝寬火攻地道挫敗高歡，使高歡憤死。", 16, 12, ["ARTY", "SPOT"], ["FORMATION_SHIELD"], 136, 84, 0.1],
  ["SESSAI", "太原雪齋", 'support', 3, 'E', "今川黑衣宰相·三國同盟", "今川義元軍師與禪僧，外交促成甲相駿三國同盟，小豆坂之戰親自指揮大破織田信秀。", 14, 18, ["EW", "SPOT"], [], 132, 80, 0],
  ["SANADAMASA", "真田昌幸", 'support', 3, 'F', "表裏比興·上田鬼謀", "真田幸村之父，以極小之上田城兩度挫敗德川數萬大軍，連豐臣秀吉亦嘆其為「表裏比興之者」。", 16, 16, ["ARTY", "TRUE_AT"], [], 138, 86, 0.12],
  ["TAKAKAGE", "小早川隆景", 'support', 3, 'G', "毛利兩川·智慮深沉", "毛利元就三男，掌管毛利家智謀與水軍，文祿之役碧蹄館之戰大破明軍先鋒。", 16, 14, ["ARTY", "SPOT"], [], 134, 82, 0.08],
  ["JOHON", "趙憲", 'support', 3, 'H', "錦山忠烈·義兵軍師", "朝鮮儒者兼抗倭義兵將領，於錦山之戰以死明志，力拒小早川隆景主力。", 12, 10, ["ARTY", "HEAVY"], [], 140, 84, 0.14],
  ["LUSU", "魯肅", 'support', 2, 'A', "榻上大策·三分雄圖", "東吳戰略擘劃大師，早於諸葛亮提出天下二分／三分之榻上策，力促孫劉結盟。", 35, 20, ["ARTY"], [], 106, 52, 0],
  ["CHENGYU", "程昱", 'support', 2, 'B', "剛戾深謀·十面設伏", "曹操五大謀士之一，身形魁梧性剛戾，東阿保全三城，多次為大軍運籌糧餉設伏。", 40, 10, ["TRUE_AT"], [], 102, 64, 0],
  ["ZHUGUKE", "諸葛恪", 'support', 2, 'C', "東興大捷·乘雪大破", "諸葛瑾之子，東興之戰築大堤設防，雪天乘敵不備出奇兵大破魏軍七萬。", 36, 12, ["TRUE_AT"], [], 108, 58, 0],
  ["YUAN_STRAT", "袁崇煥督師中樞", 'support', 2, 'D', "五年平遼·寧遠指揮", "明末薊遼督師，指揮修築關寧錦防線，以重砲與步騎協調多次擊破八旗。", 42, 10, ["DEEP", "ARTY"], [], 104, 64, 0],
  ["NAOIE", "宇喜多直家", 'support', 2, 'E', "暗殺暗略·備前梟雄", "戰國著名謀略梟雄，善用暗殺、毒計與離間瓦解強鄰，擴展備前領地。", 52, 12, ["TRUE_AT"], [], 98, 68, 0],
  ["EKEI", "安國寺惠瓊", 'support', 2, 'F', "外交僧侶·精準斷命", "毛利家外交僧，早預言信長將身首異處而秀吉將奪天下，善謀周旋各國。", 46, 18, ["EW"], [], 100, 52, 0],
  ["KIMJONGSEO", "金宗瑞", 'support', 2, 'G', "大虎相公·拓地六鎮", "朝鮮世宗名臣將領，勇猛善斷號稱大虎，親赴北邊拓地設立六鎮，安定鴨綠江。", 36, 14, ["ARTY"], [], 106, 60, 0],
  ["RYUSEONGRYONG", "柳成龍", 'support', 2, 'H', "懲毖深思·調度全軍", "朝鮮領議政，著《懲毖錄》，在壬辰倭亂中舉薦李舜臣與權慄，調度中朝聯軍。", 42, 18, ["EW"], [], 102, 54, 0],
  ["TIANDAN", "田單", 'support', 1, 'A', "火牛奇陣·齊國破燕", "戰國齊名將，即墨守城以千餘頭牛角綁利刃尾繫浸油蘆葦衝入敵營，一舉收復七十餘城。", 55, 0, ["TRUE_AT", "SWARM"], [], 78, 42, 0],
  ["GUANDU_CAT", "官渡發石霹靂車", 'support', 1, 'B', "劉曄神算·巨石破樓", "曹操謀士劉曄發明之拋石機，官渡之戰拋擲巨石擊毀袁紹軍高聳望樓。", 32, 0, ["ARTY", "SPOT"], [], 98, 46, 0],
  ["XIAOSHI_SCOUT", "前鋒烽火斥候隊", 'support', 1, 'C', "狼煙四起·火控標定", "漢唐精選之快騎哨探，於高地立望樓燃狼煙，為中軍主力精準指引射角。", 42, 18, ["SPOT", "EW"], [], 88, 44, 0],
  ["CHENTANG", "陳湯", 'support', 1, 'D', "犯強漢者·假節出奇", "西漢名將，「明犯強漢者，雖遠必誅」，矯詔出奇兵大破北匈奴郅支單于。", 52, 6, ["SEAD"], [], 82, 50, 0],
  ["MASANOBU", "本多正信", 'support', 1, 'E', "德川智囊·佐渡守陰謀", "德川家康最信賴之首席參謀，善於暗中策劃幕府統治大計，深沉老辣。", 38, 26, ["EW", "SEAD"], [], 84, 42, 0],
  ["KOGA_SCOUT", "甲賀忍探情報組", 'support', 1, 'F', "密林潛聽·敵情盡收", "甲賀忍者斥候小隊，擅於偽裝農夫商賈潛入敵營偷竊陣圖與號令。", 50, 16, ["SPOT", "EW"], [], 86, 44, 0],
  ["KORYO_CAT", "高麗破甲拋石砲", 'support', 1, 'G', "巨石破壘·摧枯拉朽", "高麗防禦要塞配置之重型拋石機，投擲巨大石彈粉碎步陣。", 30, 0, ["ARTY"], [], 96, 46, 0],
  ["HOGAK_DRUM", "號角戰鼓激勵營", 'support', 1, 'H', "金鼓齊鳴·三軍奮勇", "古戰場前線軍樂營，敲擊震天戰鼓與吹響牛角長號，提振士氣標定方位。", 36, 20, ["EW"], [], 84, 44, 0],
];

const UNIT_META = {
  HUO: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢軍玄甲鐵騎 + 環首刀', sfx: 'blade_clash', img: 'assets/warlords/HUO.jpg?v=7.1.0' },
  WEI: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '武剛突騎大陣 + 漢劍', sfx: 'war_drum', img: 'assets/warlords/WEI.jpg?v=7.1.0' },
  LUBU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '方天畫戟 + 赤兔馬', sfx: 'blade_clash', img: 'assets/warlords/LUBU.jpg?v=7.1.0' },
  YUEYUN: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '雙鐵椎 + 背嵬重甲', sfx: 'blade_clash', img: 'assets/warlords/YUEYUN.jpg?v=7.1.0' },
  LISHIMIN: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '天策黑槊 + 玄甲良駒', sfx: 'war_drum', img: 'assets/warlords/LISHIMIN.jpg?v=7.1.0' },
  YOSHITSUNE: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '薄綠太刀 + 黑葦威鎧', sfx: 'blade_clash', img: 'assets/warlords/YOSHITSUNE.jpg?v=7.1.0' },
  SHINGEN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '軍配團扇 + 諏訪法性兜', sfx: 'war_drum', img: 'assets/warlords/SHINGEN.jpg?v=7.1.0' },
  GAISUWEN: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '五口寶刀 + 鐵騎長矛', sfx: 'blade_clash', img: 'assets/warlords/GAISUWEN.jpg?v=7.1.0' },
  ZHAOYUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青釭劍 + 亮銀龍膽槍', sfx: 'blade_clash', img: 'assets/warlords/ZHAOYUN.jpg?v=7.1.0' },
  MACHO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭湛金槍 + 白袍銀鎧', sfx: 'blade_clash', img: 'assets/warlords/MACHO.jpg?v=7.1.0' },
  ZHANGLIAO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '問天青龍雙戟 + 塞外駿馬', sfx: 'blade_clash', img: 'assets/warlords/ZHANGLIAO.jpg?v=7.1.0' },
  LIXU: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '唐橫刀 + 風雪踏蹄長矛', sfx: 'blade_clash', img: 'assets/warlords/LIXU.jpg?v=7.1.0' },
  CHENQINGZHI: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '白袍麾旗 + 輕騎快槍', sfx: 'strategy_gong', img: 'assets/warlords/CHENQINGZHI.jpg?v=7.1.0' },
  KENSHIN: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '順慶手太刀 + 毘字旗', sfx: 'war_drum', img: 'assets/warlords/KENSHIN.jpg?v=7.1.0' },
  YUKIMURA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '十文字槍 + 六文錢赤備', sfx: 'blade_clash', img: 'assets/warlords/YUKIMURA.jpg?v=7.1.0' },
  KIMYUSHIN: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '龍鳳環首刀 + 金花官服戰鎧', sfx: 'blade_clash', img: 'assets/warlords/KIMYUSHIN.jpg?v=7.1.0' },
  DENGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '登山步稍 + 奇襲輕甲', sfx: 'blade_clash', img: 'assets/warlords/DENGAI.jpg?v=7.1.0' },
  XIAHOUYUAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '精鋼長矛 + 快馬大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/XIAHOUYUAN.jpg?v=7.1.0' },
  GONGSUNDU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白馬長槊 + 雕花角弓', sfx: 'arrow_volley', img: 'assets/warlords/GONGSUNDU.jpg?v=7.1.0' },
  XUETOU: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '方天戟 + 震天弓', sfx: 'arrow_volley', img: 'assets/warlords/XUETOU.jpg?v=7.1.0' },
  CHANGYUCHUN: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '狼牙長槊 + 明光鐵鎧', sfx: 'blade_clash', img: 'assets/warlords/CHANGYUCHUN.jpg?v=7.1.0' },
  DATE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '黑漆弦月盔 + 騎鐵火繩槍', sfx: 'arrow_volley', img: 'assets/warlords/DATE.jpg?v=7.1.0' },
  KEIJI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱柄槍 + 南蠻具足', sfx: 'blade_clash', img: 'assets/warlords/KEIJI.jpg?v=7.1.0' },
  EULJI: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗環刀 + 輕步快騎', sfx: 'strategy_gong', img: 'assets/warlords/EULJI.jpg?v=7.1.0' },
  CAOZHANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '重鋼長矛 + 雕翎弓', sfx: 'blade_clash', img: 'assets/warlords/CAOZHANG.jpg?v=7.1.0' },
  LINGTONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '烈火大刀 + 隨身精短劍', sfx: 'blade_clash', img: 'assets/warlords/LINGTONG.jpg?v=7.1.0' },
  WENPING: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣花長斧 + 精鐵兜鍪', sfx: 'blade_clash', img: 'assets/warlords/WENPING.jpg?v=7.1.0' },
  HULU: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '角端長弓 + 馬槊', sfx: 'arrow_volley', img: 'assets/warlords/HULU.jpg?v=7.1.0' },
  YUWENTAI: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '金絲馬槊 + 柱國印綬', sfx: 'war_drum', img: 'assets/warlords/YUWENTAI.jpg?v=7.1.0' },
  YAMAGATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長柄槍 + 赤漆塗胴具足', sfx: 'blade_clash', img: 'assets/warlords/YAMAGATA.jpg?v=7.1.0' },
  TACHIBANA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '雷切脇差 + 栗色鎧甲', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANA.jpg?v=7.1.0' },
  ONDAL: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗重劍 + 大弓', sfx: 'blade_clash', img: 'assets/warlords/ONDAL.jpg?v=7.1.0' },
  PANGDE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭大刀 + 白馬重鐵鞍', sfx: 'blade_clash', img: 'assets/warlords/PANGDE.jpg?v=7.1.0' },
  QUYI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '先登強弩 + 衝鋒短盾', sfx: 'arrow_volley', img: 'assets/warlords/QUYI.jpg?v=7.1.0' },
  CAOZHEN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '百煉長刀 + 鐵鱗甲', sfx: 'blade_clash', img: 'assets/warlords/CAOZHEN.jpg?v=7.1.0' },
  CAOCHUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎豹精鋼槊 + 輕騎快鞍', sfx: 'blade_clash', img: 'assets/warlords/CAOCHUN.jpg?v=7.1.0' },
  FUMA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '忍者苦無 + 漆黑忍馬', sfx: 'blade_clash', img: 'assets/warlords/FUMA.jpg?v=7.1.0' },
  OBATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '大身槍 + 赤色大兜', sfx: 'blade_clash', img: 'assets/warlords/OBATA.jpg?v=7.1.0' },
  KOGURYOTIE: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '馬甲鐵矛 + 哨角', sfx: 'blade_clash', img: 'assets/warlords/KOGURYOTIE.jpg?v=7.1.0' },
  BAEKJEO: { flag: '🇰🇷', origin: '韓國 · 百濟', weapon: '百濟短刀 + 游擊角弓', sfx: 'blade_clash', img: 'assets/warlords/BAEKJEO.jpg?v=7.1.0' },
  BAIQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '武安君銅劍 + 戰國玄甲', sfx: 'war_drum', img: 'assets/warlords/BAIQI.jpg?v=7.1.0' },
  XIANGYU: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '霸王楚戟 + 烏騅馬鎧', sfx: 'blade_clash', img: 'assets/warlords/XIANGYU.jpg?v=7.1.0' },
  YUEFEI: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '瀝泉神槍 + 岳字白旄大旗', sfx: 'war_drum', img: 'assets/warlords/YUEFEI.jpg?v=7.1.0' },
  WANGJIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '大秦青銅長戈 + 重甲鐵盾', sfx: 'war_drum', img: 'assets/warlords/WANGJIAN.jpg?v=7.1.0' },
  LIJING: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '六花陣法旗 + 唐陌刀', sfx: 'strategy_gong', img: 'assets/warlords/LIJING.jpg?v=7.1.0' },
  HONDA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '蜻蛉切神槍 + 鹿角脇立兜', sfx: 'blade_clash', img: 'assets/warlords/HONDA.jpg?v=7.1.0' },
  SHIBATA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '瓶割刀 + 漆黑重甲具足', sfx: 'blade_clash', img: 'assets/warlords/SHIBATA.jpg?v=7.1.0' },
  YISEONGGYE: { flag: '🇰🇷', origin: '韓國 · 朝鮮/高麗', weapon: '太祖御用角弓 + 鐵環重甲', sfx: 'war_drum', img: 'assets/warlords/YISEONGGYE.jpg?v=7.1.0' },
  LIANPO: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '青銅重戟 + 戰國大盾', sfx: 'war_drum', img: 'assets/warlords/LIANPO.jpg?v=7.1.0' },
  MENGTIAN: { flag: '🇨🇳', origin: '中國 · 秦朝', weapon: '秦軍重弩 + 狼毫筆', sfx: 'war_drum', img: 'assets/warlords/MENGTIAN.jpg?v=7.1.0' },
  GUANYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '青龍偃月刀 + 美髯綠袍鎧', sfx: 'blade_clash', img: 'assets/warlords/GUANYU.jpg?v=7.1.0' },
  ZHANGFEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '丈八蛇矛 + 烏金鐵環甲', sfx: 'blade_clash', img: 'assets/warlords/ZHANGFEI.jpg?v=7.1.0' },
  GUOZIYI: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '唐儀刀 + 紫金戰鎧', sfx: 'strategy_gong', img: 'assets/warlords/GUOZIYI.jpg?v=7.1.0' },
  XUDA: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '明初長刀 + 魚鱗精鐵甲', sfx: 'war_drum', img: 'assets/warlords/XUDA.jpg?v=7.1.0' },
  TACHIBANAD: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名刀雷切 + 轎載鐵盾', sfx: 'blade_clash', img: 'assets/warlords/TACHIBANAD.jpg?v=7.1.0' },
  CHOIYOUNG: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗大刀 + 頭頂鐵胄', sfx: 'blade_clash', img: 'assets/warlords/CHOIYOUNG.jpg?v=7.1.0' },
  DIANWEI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '雙鐵戟 + 重裝近衛鎧', sfx: 'blade_clash', img: 'assets/warlords/DIANWEI.jpg?v=7.1.0' },
  XUCHU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '虎頭大金刀 + 粗鐵皮甲', sfx: 'blade_clash', img: 'assets/warlords/XUCHU.jpg?v=7.1.0' },
  GAOSHUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '陷陣大盾 + 破甲長矛', sfx: 'war_drum', img: 'assets/warlords/GAOSHUN.jpg?v=7.1.0' },
  QINSHUBAO: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '熟銅雙鐧 + 步戰明光甲', sfx: 'blade_clash', img: 'assets/warlords/QINSHUBAO.jpg?v=7.1.0' },
  YUCHIGONG: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '單雄丈二矛 + 烏金甲', sfx: 'blade_clash', img: 'assets/warlords/YUCHIGONG.jpg?v=7.1.0' },
  DIQING: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '青銅鬼臉面具 + 神機長刀', sfx: 'blade_clash', img: 'assets/warlords/DIQING.jpg?v=7.1.0' },
  SHIMAZUY: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '野太刀 + 黑漆塗二枚胴', sfx: 'blade_clash', img: 'assets/warlords/SHIMAZUY.jpg?v=7.1.0' },
  GYEBAEK: { flag: '🇰🇷', origin: '韓國 · 百濟', weapon: '百濟環首大刀 + 鐵鱗背心', sfx: 'blade_clash', img: 'assets/warlords/GYEBAEK.jpg?v=7.1.0' },
  MENGGONG: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '荊襄重步盾 + 鎢鋼長槍', sfx: 'war_drum', img: 'assets/warlords/MENGGONG.jpg?v=7.1.0' },
  YANGYE: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '九環金刀 + 雁門重甲', sfx: 'blade_clash', img: 'assets/warlords/YANGYE.jpg?v=7.1.0' },
  CAOREN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '重鋼大盾 + 短刃佩刀', sfx: 'war_drum', img: 'assets/warlords/CAOREN.jpg?v=7.1.0' },
  ZHOUTAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '截頭厚刃刀 + 肉盾鐵軀', sfx: 'blade_clash', img: 'assets/warlords/ZHOUTAI.jpg?v=7.1.0' },
  LANYU: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '明光三眼長矛 + 鎖子甲', sfx: 'blade_clash', img: 'assets/warlords/LANYU.jpg?v=7.1.0' },
  IINAOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '朱漆大槍 + 金箔天衝脇立', sfx: 'blade_clash', img: 'assets/warlords/IINAOMASA.jpg?v=7.1.0' },
  KATOKIYOMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '片鎌槍 + 長烏帽子形兜', sfx: 'blade_clash', img: 'assets/warlords/KATOKIYOMASA.jpg?v=7.1.0' },
  JEONGMUNBU: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '朝鮮長劍 + 義兵粗鐵盾', sfx: 'blade_clash', img: 'assets/warlords/JEONGMUNBU.jpg?v=7.1.0' },
  YUJIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵環長刀 + 堅木大盾', sfx: 'war_drum', img: 'assets/warlords/YUJIN.jpg?v=7.1.0' },
  LIDIAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '環首刀 + 督戰令旗', sfx: 'blade_clash', img: 'assets/warlords/LIDIAN.jpg?v=7.1.0' },
  HAOMENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵葉皮甲 + 鈍刃長斧', sfx: 'blade_clash', img: 'assets/warlords/HAOMENG.jpg?v=7.1.0' },
  BAIERBING: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白毦鐵矛 + 短刃佩劍', sfx: 'blade_clash', img: 'assets/warlords/BAIERBING.jpg?v=7.1.0' },
  ONIKOJIMA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '粗鐵金棒 + 古式大鎧', sfx: 'blade_clash', img: 'assets/warlords/ONIKOJIMA.jpg?v=7.1.0' },
  KANISAIZO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長槍 + 笹葉符號背旗', sfx: 'blade_clash', img: 'assets/warlords/KANISAIZO.jpg?v=7.1.0' },
  BYEOLMUBAN: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '重裝長盾 + 闊刃大斧', sfx: 'war_drum', img: 'assets/warlords/BYEOLMUBAN.jpg?v=7.1.0' },
  GAPSABO: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '布面甲 + 環刀大盾', sfx: 'blade_clash', img: 'assets/warlords/GAPSABO.jpg?v=7.1.0' },
  LIGUANG: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢家雕弓 + 白羽穿甲箭', sfx: 'arrow_volley', img: 'assets/warlords/LIGUANG.jpg?v=7.1.0' },
  YANGYOUJI: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '穿楊神弓 + 七札破甲箭', sfx: 'arrow_volley', img: 'assets/warlords/YANGYOUJI.jpg?v=7.1.0' },
  QIJIGUANG: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '虎蹲砲 + 鳥銃陣列', sfx: 'fire_attack', img: 'assets/warlords/QIJIGUANG.jpg?v=7.1.0' },
  NOBUNAGA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '南蠻鐵砲火銃 + 織田木瓜旗', sfx: 'arrow_volley', img: 'assets/warlords/NOBUNAGA.jpg?v=7.1.0' },
  YOICHI: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '滋野籐弓 + 白羽神箭', sfx: 'arrow_volley', img: 'assets/warlords/YOICHI.jpg?v=7.1.0' },
  JUMONG: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗神弓 + 鹿角箭', sfx: 'arrow_volley', img: 'assets/warlords/JUMONG.jpg?v=7.1.0' },
  GWONYUL: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '幸州火車 + 神機箭筒', sfx: 'fire_attack', img: 'assets/warlords/GWONYUL.jpg?v=7.1.0' },
  XUERENARROW: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '天山鵰翎破甲箭 + 唐代角弓', sfx: 'arrow_volley', img: 'assets/warlords/XUERENARROW.jpg?v=7.1.0' },
  HUANGZHONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鐵胎寶弓 + 鳳嘴刀', sfx: 'arrow_volley', img: 'assets/warlords/HUANGZHONG.jpg?v=7.1.0' },
  TAISHICI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂歌戟 + 穿甲大黃弓', sfx: 'arrow_volley', img: 'assets/warlords/TAISHICI.jpg?v=7.1.0' },
  HANSHIZHONG: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '克敵勁弩 + 倒馬長槍', sfx: 'arrow_volley', img: 'assets/warlords/HANSHIZHONG.jpg?v=7.1.0' },
  HAOZHAO: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '陳倉火箭 + 拒馬盾陣', sfx: 'arrow_volley', img: 'assets/warlords/HAOZHAO.jpg?v=7.1.0' },
  AKECHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '名銃備前鐵砲 + 桔梗紋旗', sfx: 'arrow_volley', img: 'assets/warlords/AKECHI.jpg?v=7.1.0' },
  SAIKA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '三連發火繩銃 + 八咫烏標記', sfx: 'arrow_volley', img: 'assets/warlords/SAIKA.jpg?v=7.1.0' },
  YANGMANCHUN: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '高句麗城防硬角弓 + 火弩', sfx: 'arrow_volley', img: 'assets/warlords/YANGMANCHUN.jpg?v=7.1.0' },
  PARKJESANG: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '新羅步戰弓 + 佩刀', sfx: 'arrow_volley', img: 'assets/warlords/PARKJESANG.jpg?v=7.1.0' },
  ZHANGHE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '巧變長弓 + 綠沉槍', sfx: 'arrow_volley', img: 'assets/warlords/ZHANGHE.jpg?v=7.1.0' },
  ZHANGXUN: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '草人借箭 + 睢陽斷竹箭', sfx: 'arrow_volley', img: 'assets/warlords/ZHANGXUN.jpg?v=7.1.0' },
  YANYAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '烏金硬木弓 + 寬刃長刀', sfx: 'arrow_volley', img: 'assets/warlords/YANYAN.jpg?v=7.1.0' },
  ZONGZE: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '連弩機樓 + 宣慰刀', sfx: 'arrow_volley', img: 'assets/warlords/ZONGZE.jpg?v=7.1.0' },
  INABA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '美濃鐵砲 + 堅固丸木盾', sfx: 'arrow_volley', img: 'assets/warlords/INABA.jpg?v=7.1.0' },
  SUZUKI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '狙擊用短火繩槍 + 芒草偽裝', sfx: 'arrow_volley', img: 'assets/warlords/SUZUKI.jpg?v=7.1.0' },
  CHOIMUSEON: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '走火火箭 + 鎮浦銅砲', sfx: 'fire_attack', img: 'assets/warlords/CHOIMUSEON.jpg?v=7.1.0' },
  SHINRIP: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '朝鮮長身角弓 + 鐵羽矢', sfx: 'arrow_volley', img: 'assets/warlords/SHINRIP.jpg?v=7.1.0' },
  LUSUARCH: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '三石硬弓 + 破甲箭', sfx: 'arrow_volley', img: 'assets/warlords/LUSUARCH.jpg?v=7.1.0' },
  WENCHOU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '冀州拓木弓 + 開山大刀', sfx: 'arrow_volley', img: 'assets/warlords/WENCHOU.jpg?v=7.1.0' },
  CAOPICROSS: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '文帝雕弓 + 金翎羽', sfx: 'arrow_volley', img: 'assets/warlords/CAOPICROSS.jpg?v=7.1.0' },
  YUANCHONGHUAN: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '紅夷大砲 + 火藥引信', sfx: 'fire_attack', img: 'assets/warlords/YUANCHONGHUAN.jpg?v=7.1.0' },
  NAGASHINO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '長篠足輕銃 + 防馬柵欄', sfx: 'arrow_volley', img: 'assets/warlords/NAGASHINO.jpg?v=7.1.0' },
  TANEGASHIMA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '種子島筒 + 火繩引藥', sfx: 'arrow_volley', img: 'assets/warlords/TANEGASHIMA.jpg?v=7.1.0' },
  SINGIJEON: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '文宗火車 + 神機箭槽', sfx: 'fire_attack', img: 'assets/warlords/SINGIJEON.jpg?v=7.1.0' },
  KIMSIMIN: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '晉州大弓 + 火藥砲管', sfx: 'arrow_volley', img: 'assets/warlords/KIMSIMIN.jpg?v=7.1.0' },
  ZHUGELIAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '諸葛元戎連弩 + 鐵矢匣', sfx: 'arrow_volley', img: 'assets/warlords/ZHUGELIAN.jpg?v=7.1.0' },
  SHENBI: { flag: '🇨🇳', origin: '中國 · 北宋', weapon: '神臂踏張弓 + 鐵鏃巨矢', sfx: 'arrow_volley', img: 'assets/warlords/SHENBI.jpg?v=7.1.0' },
  SHESHENG: { flag: '🇨🇳', origin: '中國 · 漢朝', weapon: '射聲官弓 + 暗夜鳴鑊', sfx: 'arrow_volley', img: 'assets/warlords/SHESHENG.jpg?v=7.1.0' },
  CHUBEE: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '楚地銅弩機 + 淬毒短矢', sfx: 'arrow_volley', img: 'assets/warlords/CHUBEE.jpg?v=7.1.0' },
  KUNITOMO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '國友鍛火繩銃 + 粗鉛彈丸', sfx: 'arrow_volley', img: 'assets/warlords/KUNITOMO.jpg?v=7.1.0' },
  NEGORO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '根來寺銃 + 僧兵袈裟', sfx: 'arrow_volley', img: 'assets/warlords/NEGORO.jpg?v=7.1.0' },
  KOGURYOBOW: { flag: '🇰🇷', origin: '韓國 · 高句麗', weapon: '山林角弓 + 鹿皮偽裝網', sfx: 'arrow_volley', img: 'assets/warlords/KOGURYOBOW.jpg?v=7.1.0' },
  JUKRIM: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '竹製獵弓 + 塗毒箭鏃', sfx: 'arrow_volley', img: 'assets/warlords/JUKRIM.jpg?v=7.1.0' },
  ZHOUYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '赤壁督軍劍 + 樓船令旗', sfx: 'fire_attack', img: 'assets/warlords/ZHOUYU.jpg?v=7.1.0' },
  ZHENGCHENG: { flag: '🇨🇳', origin: '中國 · 明末', weapon: '延平寶劍 + 鐵人軍魚鱗甲', sfx: 'blade_clash', img: 'assets/warlords/ZHENGCHENG.jpg?v=7.1.0' },
  SHILANG: { flag: '🇨🇳', origin: '中國 · 清朝', weapon: '靖海長刀 + 水師大纛旗', sfx: 'war_drum', img: 'assets/warlords/SHILANG.jpg?v=7.1.0' },
  YISUNSIN: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '忠武公三尺寶劍 + 龜甲船', sfx: 'fire_attack', img: 'assets/warlords/YISUNSIN.jpg?v=7.1.0' },
  KUKI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '海賊大太刀 + 安宅鐵甲船', sfx: 'war_drum', img: 'assets/warlords/KUKI.jpg?v=7.1.0' },
  DENGAI_V: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '陰平攀絕繩索 + 破陣短刃', sfx: 'blade_clash', img: 'assets/warlords/DENGAI_V.jpg?v=7.1.0' },
  SHIMAZU_V: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '示現流大刀 + 誘敵朱旗', sfx: 'blade_clash', img: 'assets/warlords/SHIMAZU_V.jpg?v=7.1.0' },
  JANGPOGO: { flag: '🇰🇷', origin: '韓國 · 新羅', weapon: '清海鎮寶刀 + 大海船樓舵', sfx: 'war_drum', img: 'assets/warlords/JANGPOGO.jpg?v=7.1.0' },
  LUMENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '白衣偽裝袍 + 吳地雙手劍', sfx: 'blade_clash', img: 'assets/warlords/LUMENG.jpg?v=7.1.0' },
  GANNING: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短戟飛刀 + 銅鈴錦帆', sfx: 'blade_clash', img: 'assets/warlords/GANNING.jpg?v=7.1.0' },
  HUANGGAI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '火攻燃引火箭 + 艨艟衝角', sfx: 'fire_attack', img: 'assets/warlords/HUANGGAI.jpg?v=7.1.0' },
  WANGJUN: { flag: '🇨🇳', origin: '中國 · 晉朝', weapon: '連環大樓船 + 破鎖巨斧', sfx: 'war_drum', img: 'assets/warlords/WANGJUN.jpg?v=7.1.0' },
  YANGSU: { flag: '🇨🇳', origin: '中國 · 隋朝', weapon: '五牙大艦拍竿 + 隋軍重劍', sfx: 'war_drum', img: 'assets/warlords/YANGSU.jpg?v=7.1.0' },
  YOSHITSUN_V: { flag: '🇯🇵', origin: '日本 · 源平', weapon: '騎馬薙刀 + 渡海戰楫', sfx: 'blade_clash', img: 'assets/warlords/YOSHITSUN_V.jpg?v=7.1.0' },
  MURAKAMI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '焙烙火玉 + 鯨船快櫓', sfx: 'fire_attack', img: 'assets/warlords/MURAKAMI.jpg?v=7.1.0' },
  LEEOKGI: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '板屋戰船長銃 + 右水使令牌', sfx: 'blade_clash', img: 'assets/warlords/LEEOKGI.jpg?v=7.1.0' },
  ZHANGLIAO_V: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '短柄短戟 + 先登皮索', sfx: 'blade_clash', img: 'assets/warlords/ZHANGLIAO_V.jpg?v=7.1.0' },
  HANSHIZHONG_V: { flag: '🇨🇳', origin: '中國 · 南宋', weapon: '鐵綯沉鎖 + 樓船快弩', sfx: 'war_drum', img: 'assets/warlords/HANSHIZHONG_V.jpg?v=7.1.0' },
  WEIYAN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '狂骨環刀 + 伏兵令旗', sfx: 'blade_clash', img: 'assets/warlords/WEIYAN.jpg?v=7.1.0' },
  LIXU_V: { flag: '🇨🇳', origin: '中國 · 唐朝', weapon: '鵝鴨羽偽裝 + 破鎖長匕', sfx: 'blade_clash', img: 'assets/warlords/LIXU_V.jpg?v=7.1.0' },
  MOURI_V: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '嚴島夜襲丸竹 + 薙刀', sfx: 'blade_clash', img: 'assets/warlords/MOURI_V.jpg?v=7.1.0' },
  HATTORI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '伊賀鎖鎌 + 漆黑忍衣', sfx: 'blade_clash', img: 'assets/warlords/HATTORI.jpg?v=7.1.0' },
  JEONGJI: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗火銃銅管 + 海上長矛', sfx: 'fire_attack', img: 'assets/warlords/JEONGJI.jpg?v=7.1.0' },
  GWAKJAEWOO: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '大紅戰袍 + 白木角弓', sfx: 'blade_clash', img: 'assets/warlords/GWAKJAEWOO.jpg?v=7.1.0' },
  JIANGQIN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '吳水師重矛 + 護手短刀', sfx: 'blade_clash', img: 'assets/warlords/JIANGQIN.jpg?v=7.1.0' },
  DONGXI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '斬索雙斧 + 樓船重甲', sfx: 'blade_clash', img: 'assets/warlords/DONGXI.jpg?v=7.1.0' },
  DINGFENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '雪夜白刃 + 短皮小盾', sfx: 'blade_clash', img: 'assets/warlords/DINGFENG.jpg?v=7.1.0' },
  MENGCHONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '生牛皮衝角 + 側舷長矛', sfx: 'war_drum', img: 'assets/warlords/MENGCHONG.jpg?v=7.1.0' },
  FUMASUB: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '水遁竹管 + 鑿木錐短忍刀', sfx: 'blade_clash', img: 'assets/warlords/FUMASUB.jpg?v=7.1.0' },
  KONISHI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '洋槍隊佩刀 + 登陸浮橋', sfx: 'blade_clash', img: 'assets/warlords/KONISHI.jpg?v=7.1.0' },
  PANOKSEON: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '多槳搖櫓 + 火矢投射筒', sfx: 'arrow_volley', img: 'assets/warlords/PANOKSEON.jpg?v=7.1.0' },
  KWONJUN: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '右水營官刀 + 板屋巨銃', sfx: 'blade_clash', img: 'assets/warlords/KWONJUN.jpg?v=7.1.0' },
  SHUIGUI: { flag: '🇨🇳', origin: '中國 · 歷代', weapon: '水鬼長匕 + 破木鑿槌', sfx: 'blade_clash', img: 'assets/warlords/SHUIGUI.jpg?v=7.1.0' },
  XIANDENG: { flag: '🇨🇳', origin: '中國 · 漢/唐', weapon: '跳蕩短刀 + 圓藤牌', sfx: 'blade_clash', img: 'assets/warlords/XIANDENG.jpg?v=7.1.0' },
  JINGKE: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '督亢地圖 + 徐夫人匕首', sfx: 'blade_clash', img: 'assets/warlords/JINGKE.jpg?v=7.1.0' },
  ZHUANZHU: { flag: '🇨🇳', origin: '中國 · 春秋', weapon: '魚腸短劍 + 獻魚銅盤', sfx: 'blade_clash', img: 'assets/warlords/ZHUANZHU.jpg?v=7.1.0' },
  KUMANO: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '熊野短槳 + 狼牙鉤矛', sfx: 'blade_clash', img: 'assets/warlords/KUMANO.jpg?v=7.1.0' },
  KOGA_SUB: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '甲賀手裏劍 + 忍杖匕首', sfx: 'blade_clash', img: 'assets/warlords/KOGA_SUB.jpg?v=7.1.0' },
  TAMNA: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '海民叉槍 + 沉石索', sfx: 'blade_clash', img: 'assets/warlords/TAMNA.jpg?v=7.1.0' },
  MOKBAE: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '松油火把 + 衝流連環木排', sfx: 'fire_attack', img: 'assets/warlords/MOKBAE.jpg?v=7.1.0' },
  ZHUGELIANG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '羽扇綸巾 + 諸葛八陣圖', sfx: 'strategy_gong', img: 'assets/warlords/ZHUGELIANG.jpg?v=7.1.0' },
  HANXIN: { flag: '🇨🇳', origin: '中國 · 楚漢', weapon: '兵仙令劍 + 十面埋伏陣', sfx: 'blade_clash', img: 'assets/warlords/HANXIN.jpg?v=7.1.0' },
  ZHANGLIANG: { flag: '🇨🇳', origin: '中國 · 漢朝', weapon: '太公兵法卷軸 + 漢印佩玉', sfx: 'strategy_gong', img: 'assets/warlords/ZHANGLIANG.jpg?v=7.1.0' },
  SIMAYI: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '宣帝佩劍 + 陣列令旗', sfx: 'strategy_gong', img: 'assets/warlords/SIMAYI.jpg?v=7.1.0' },
  LIUBOWEN: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '郁離子竹簡 + 太極籌算', sfx: 'strategy_gong', img: 'assets/warlords/LIUBOWEN.jpg?v=7.1.0' },
  HANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '竹中軍配 + 一之谷形兜', sfx: 'strategy_gong', img: 'assets/warlords/HANBEI.jpg?v=7.1.0' },
  KANBEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '合子形兜 + 水攻策圖卷', sfx: 'strategy_gong', img: 'assets/warlords/KANBEI.jpg?v=7.1.0' },
  GANGGAMCHAN: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗宰相笏板 + 水攻令旗', sfx: 'strategy_gong', img: 'assets/warlords/GANGGAMCHAN.jpg?v=7.1.0' },
  SUNBIN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '孫臏兵法木牘 + 獨輪戰車', sfx: 'strategy_gong', img: 'assets/warlords/SUNBIN.jpg?v=7.1.0' },
  WUQI: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '吳子兵書 + 魏武卒精矛', sfx: 'war_drum', img: 'assets/warlords/WUQI.jpg?v=7.1.0' },
  GUOJIA: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '十勝十敗論卷 + 謀士羽扇', sfx: 'strategy_gong', img: 'assets/warlords/GUOJIA.jpg?v=7.1.0' },
  XUNYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '王佐印信 + 荀氏家傳竹簡', sfx: 'strategy_gong', img: 'assets/warlords/XUNYU.jpg?v=7.1.0' },
  JIAXU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '離間策書 + 毒士算籌', sfx: 'strategy_gong', img: 'assets/warlords/JIAXU.jpg?v=7.1.0' },
  LUXUN: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '夷陵火計箭符 + 吳都督佩劍', sfx: 'fire_attack', img: 'assets/warlords/LUXUN.jpg?v=7.1.0' },
  MASASHIGE: { flag: '🇯🇵', origin: '日本 · 南北朝', weapon: '菊水紋旗 + 守城落石機巧', sfx: 'war_drum', img: 'assets/warlords/MASASHIGE.jpg?v=7.1.0' },
  SEOHUI: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗國書 + 談判舌鋒卷軸', sfx: 'strategy_gong', img: 'assets/warlords/SEOHUI.jpg?v=7.1.0' },
  PANGTONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '鳳雛連環策 + 青銅短劍', sfx: 'strategy_gong', img: 'assets/warlords/PANGTONG.jpg?v=7.1.0' },
  FAZHENG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '定軍指旗 + 蜀川圖誌', sfx: 'strategy_gong', img: 'assets/warlords/FAZHENG.jpg?v=7.1.0' },
  CHENGONG: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '下邳布防圖 + 智囊拂塵', sfx: 'strategy_gong', img: 'assets/warlords/CHENGONG.jpg?v=7.1.0' },
  WEIXIAOKUAN: { flag: '🇨🇳', origin: '中國 · 南北朝', weapon: '玉璧守備圖 + 掘地聽甕', sfx: 'strategy_gong', img: 'assets/warlords/WEIXIAOKUAN.jpg?v=7.1.0' },
  SESSAI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '臨濟宗念珠 + 三國同盟盟約', sfx: 'strategy_gong', img: 'assets/warlords/SESSAI.jpg?v=7.1.0' },
  SANADAMASA: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '上田城地圖 + 誘敵令旗', sfx: 'strategy_gong', img: 'assets/warlords/SANADAMASA.jpg?v=7.1.0' },
  TAKAKAGE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '毛利三箭令 + 陣羽織', sfx: 'war_drum', img: 'assets/warlords/TAKAKAGE.jpg?v=7.1.0' },
  JOHON: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '義兵檄文 + 忠烈令箭', sfx: 'blade_clash', img: 'assets/warlords/JOHON.jpg?v=7.1.0' },
  LUSU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '榻上策竹簡 + 結盟令劍', sfx: 'strategy_gong', img: 'assets/warlords/LUSU.jpg?v=7.1.0' },
  CHENGYU: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '十面埋伏符 + 籌糧算盤', sfx: 'strategy_gong', img: 'assets/warlords/CHENGYU.jpg?v=7.1.0' },
  ZHUGUKE: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '東興布防圖 + 破魏短戟', sfx: 'blade_clash', img: 'assets/warlords/ZHUGUKE.jpg?v=7.1.0' },
  YUAN_STRAT: { flag: '🇨🇳', origin: '中國 · 明朝', weapon: '尚方寶劍 + 關寧防禦圖', sfx: 'fire_attack', img: 'assets/warlords/YUAN_STRAT.jpg?v=7.1.0' },
  NAOIE: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '毒匕暗器 + 離間密函', sfx: 'blade_clash', img: 'assets/warlords/NAOIE.jpg?v=7.1.0' },
  EKEI: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '僧袍袈裟 + 各國密卷', sfx: 'strategy_gong', img: 'assets/warlords/EKEI.jpg?v=7.1.0' },
  KIMJONGSEO: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '大虎令箭 + 六鎮地界圖', sfx: 'war_drum', img: 'assets/warlords/KIMJONGSEO.jpg?v=7.1.0' },
  RYUSEONGRYONG: { flag: '🇰🇷', origin: '韓國 · 朝鮮', weapon: '懲毖錄手稿 + 宰相調度印', sfx: 'strategy_gong', img: 'assets/warlords/RYUSEONGRYONG.jpg?v=7.1.0' },
  TIANDAN: { flag: '🇨🇳', origin: '中國 · 戰國', weapon: '火牛蘆葦火把 + 衝角雙刃', sfx: 'fire_attack', img: 'assets/warlords/TIANDAN.jpg?v=7.1.0' },
  GUANDU_CAT: { flag: '🇨🇳', origin: '中國 · 三國', weapon: '官渡霹靂車 + 巨石砲彈', sfx: 'war_drum', img: 'assets/warlords/GUANDU_CAT.jpg?v=7.1.0' },
  XIAOSHI_SCOUT: { flag: '🇨🇳', origin: '中國 · 漢/唐', weapon: '狼煙烽火台 + 測距令旗', sfx: 'strategy_gong', img: 'assets/warlords/XIAOSHI_SCOUT.jpg?v=7.1.0' },
  CHENTANG: { flag: '🇨🇳', origin: '中國 · 西漢', weapon: '漢節虎符 + 西域長戈', sfx: 'blade_clash', img: 'assets/warlords/CHENTANG.jpg?v=7.1.0' },
  MASANOBU: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '佐渡守印信 + 密謀折扇', sfx: 'strategy_gong', img: 'assets/warlords/MASANOBU.jpg?v=7.1.0' },
  KOGA_SCOUT: { flag: '🇯🇵', origin: '日本 · 戰國', weapon: '忍具百寶囊 + 竊聽地筒', sfx: 'blade_clash', img: 'assets/warlords/KOGA_SCOUT.jpg?v=7.1.0' },
  KORYO_CAT: { flag: '🇰🇷', origin: '韓國 · 高麗', weapon: '高麗配重拋石機 + 砲石', sfx: 'war_drum', img: 'assets/warlords/KORYO_CAT.jpg?v=7.1.0' },
  HOGAK_DRUM: { flag: '🇰🇷', origin: '韓國 · 歷代', weapon: '三軍震天大鼓 + 銅製號角', sfx: 'war_drum', img: 'assets/warlords/HOGAK_DRUM.jpg?v=7.1.0' },
};

const UNITS = RAW_UNITS.map(r => {
  const [id, name, cat, cost, v, tag, desc, st, ew, traits, roleFlags, hp, atk, def] = r;
  const meta = UNIT_META[id] || {
    flag: '🇨🇳', origin: '東亞名將',
    weapon: '傳世名兵',
    sfx: 'blade_clash',
    img: ''
  };
  return {
    id, name, cat, cost, v, tag, desc, traits, roleFlags,
    st, ew,
    hp, atk, def,
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
const DRONE_IDS = new Set(['TIANDAN', 'GUANDU_CAT', 'XIAOSHI_SCOUT', 'CHENTANG', 'MASANOBU', 'KOGA_SCOUT', 'KORYO_CAT', 'HOGAK_DRUM', 'SHUIGUI', 'KUMANO', 'SINGIJEON']);

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
  { name: '八陣神機', note: '諸葛奇謀＋八陣合圍', ids: ['CAOZHANG', 'DIANWEI', 'ZHUGELIAN', 'SHUIGUI', 'ZHUGELIANG'] },
  { name: '封狼居胥', note: '霍去病千里奔襲破敵', ids: ['HUO', 'BYEOLMUBAN', 'SINGIJEON', 'HATTORI', 'PANGTONG'] },
  { name: '殺神陷陣', note: '武安君白起正面破陣', ids: ['DENGAI', 'BAIQI', 'CHOIMUSEON', 'JIANGQIN', 'ZHUGUKE'] },
  { name: '鳴梁伏波', note: '忠武公李舜臣水陸連環', ids: ['LINGTONG', 'KATOKIYOMASA', 'CHOIMUSEON', 'YISUNSIN', 'CHENGYU'] },
  { name: '天下布武', note: '織田信長三段火器齊射', ids: ['DATE', 'SHIMAZUY', 'NOBUNAGA', 'DINGFENG', 'LUSU'] }
];

/* 暴露至全域物件以便跨模組與 Playwright 調用 */
if (typeof window !== 'undefined') {
  window.BUDGET = BUDGET;
  window.CATS = CATS;
  window.TRAITS = TRAITS;
  window.CAT_HINT = CAT_HINT;
  window.UNITS = UNITS;
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
