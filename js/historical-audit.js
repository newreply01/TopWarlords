'use strict';
/* =====================================================
   頂尖對戰：15元名將聯合作戰 — 全軍 125 位名將史實出處與時代索引
   ERA 時代分類：qin_han (先秦兩漢) | three_kingdoms (三國兩晉)
                 tang_song_ming (唐宋明) | sengoku (日本戰國源平)
                 korea_dynasties (朝鮮半島三國高麗朝鮮)
   ===================================================== */
(function (root) {
  const HISTORICAL_AUDIT_FULL = {
  "HUO": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "《史記·衛將軍驃騎列傳》《漢書·霍去病傳》載其六出塞外、封狼居胥與千里穿插奇襲。",
    "sources": [
      "https://ctext.org/shiji/wei-jiang-jun-piao-qi-lie-zhuan/zh"
    ]
  },
  "WEI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "《史記·衛將軍驃騎列傳》載其七戰七捷、收復河南地與漠北之戰以武剛車結陣禦匈奴。",
    "sources": [
      "https://ctext.org/shiji/wei-jiang-jun-piao-qi-lie-zhuan/zh"
    ]
  },
  "LUBU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "《三國志·魏書·呂布傳》載其驍勇善騎射、「人中有呂布，馬中有赤兔」，虎牢、濮陽屢破敵軍。",
    "sources": [
      "https://en.wikipedia.org/wiki/L%C3%BC_Bu"
    ]
  },
  "YOSHITSUNE": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《吾妻鏡》《平家物語》所載一之谷、屋島與壇之浦之戰；高地奇襲具史源，演義神話部分需區分。",
    "sources": [
      "https://en.wikipedia.org/wiki/Minamoto_no_Yoshitsune"
    ]
  },
  "SHINGEN": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《甲陽軍鑑》及同時期武田文書所載川中島、三方原等戰事；軍制與赤備精騎影響深遠。",
    "sources": [
      "https://en.wikipedia.org/wiki/Takeda_Shingen"
    ]
  },
  "GAISUWEN": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《三國史記》《舊唐書·高麗傳》載其執掌高句麗莫離支軍政，屢抗唐軍與周邊諸部。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yeon_Gaesomun"
    ]
  },
  "ZHAOYUN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·趙雲傳》本傳及裴注《雲別傳》，載長坂護主、漢水空營退曹軍等實績。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zhao_Yun"
    ]
  },
  "MACHO": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·馬超傳》，載潼關渭南之戰統涼州精騎迫使曹操幾陷險境。",
    "sources": [
      "https://en.wikipedia.org/wiki/Ma_Chao"
    ]
  },
  "ZHANGLIAO": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "逍遙津先攻與八百敢死士有《三國志·張遼傳》所引記載。",
    "sources": [
      "https://ctext.org/text.pl?node=603715",
      "https://en.wikipedia.org/wiki/Battle_of_Xiaoyao_Ford"
    ]
  },
  "CHENQINGZHI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《梁書·陳慶之傳》，載率七千白袍北伐歷四十七戰克三十二城，入洛陽後終遭爾朱榮反撲。",
    "sources": [
      "https://en.wikipedia.org/wiki/Chen_Qingzhi"
    ]
  },
  "KENSHIN": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《上杉家御年譜》《甲陽軍鑑》，領越後兵連年征戰川中島、關東，奉毘沙門天軍旗。",
    "sources": [
      "https://en.wikipedia.org/wiki/Uesugi_Kenshin"
    ]
  },
  "YUKIMURA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《大坂陣山口休庵咄》及德川實紀所載大坂冬夏之陣，率赤備突入家康本陣名震一時。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sanada_Nobushige"
    ]
  },
  "KIMYUSHIN": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《三國史記·金庾信列傳》，統率新羅花郎與唐羅聯軍滅百濟、高句麗完成三韓統一。",
    "sources": [
      "https://en.wikipedia.org/wiki/Kim_Yushin"
    ]
  },
  "SUNCE": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·孫破虜討逆傳》，少將渡江平定江東數郡，奠定孫吳政權根基。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sun_Ce"
    ]
  },
  "GAOCHANGGONG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《北齊書·蘭陵武王傳》，邙山之戰戴面具率五百騎突入重圍解洛陽圍，軍中作〈蘭陵王入陣曲〉。",
    "sources": [
      "https://en.wikipedia.org/wiki/Gao_Changgong"
    ]
  },
  "XIAHOUYUAN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·夏侯淵傳》，善千里疾馳突襲平定關中涼州，後於定軍山陣亡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xiahou_Yuan"
    ]
  },
  "MADAI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·馬超傳》《諸葛亮傳》，任平北將軍隨軍北伐，受命追斬魏延。",
    "sources": [
      "https://en.wikipedia.org/wiki/Ma_Dai"
    ]
  },
  "DATE": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《貞山公治家記錄》，摺上原合戰確立奧州霸權，創立騎馬鐵砲隊並留名江戶藩政。",
    "sources": [
      "https://en.wikipedia.org/wiki/Date_Masamune"
    ]
  },
  "EULJI": {
    "era": "korea_dynasties",
    "status": "qualified",
    "note": "誘敵深入與薩水追擊有《三國史記》《隋書》脈絡；放水／水壩故事未見同時代來源支持。",
    "sources": [
      "https://en.wikipedia.org/wiki/Battle_of_Salsu"
    ]
  },
  "WANGSHUANG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·後主傳》《魏書》，陳倉之戰追擊撤退蜀軍斬殺謝雄、龔起，後中伏陣亡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Wang_Shuang"
    ]
  },
  "YAMAGATA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《甲陽軍鑑》《信長公記》，統領武田赤備精銳於長篠等役力戰殉陣。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yamagata_Masakage"
    ]
  },
  "TACHIBANA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見立花家文書與戰國九州史料，朝鮮之役碧蹄館立功，柳川城開城後復封大名。",
    "sources": [
      "https://en.wikipedia.org/wiki/Tachibana_Muneshige"
    ]
  },
  "ZHAOSHE": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·廉頗藺相如列傳》載閼與之戰，「狹路相逢勇者勝」疾馳捲旗破秦軍，受封馬服君。",
    "sources": [
      "https://ctext.org/shiji/lian-po-lin-xiang-ru-lie-zhuan/zh"
    ]
  },
  "PANGDE": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·龐德傳》，襄樊之戰誓死抗關羽、箭中關羽額頭，兵敗被擒不屈殉節。",
    "sources": [
      "https://en.wikipedia.org/wiki/Pang_De"
    ]
  },
  "MAEDATOSHI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》《加賀藩史料》，任織田赤母衣眾筆頭，賤岳立功並奠定加賀百萬石基礎。",
    "sources": [
      "https://en.wikipedia.org/wiki/Maeda_Toshiie"
    ]
  },
  "BAIQI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·白起王翦列傳》，伊闕斬首二十四萬、鄢郢拔城、長平合圍坑降趙卒，功高賜死杜郵。",
    "sources": [
      "https://ctext.org/shiji/bai-qi-wang-jian-lie-zhuan/zh"
    ]
  },
  "XIANGYU": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·項羽本紀》，鉅鹿破釜沉舟破秦軍主力，彭城三萬擊潰五十六萬漢聯軍，垓下自刎。",
    "sources": [
      "https://ctext.org/shiji/xiang-yu-ben-ji/zh"
    ]
  },
  "YUEFEI": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·岳飛傳》，治岳家軍「凍死不拆屋、餓死不擄掠」，郾城、潁昌大破金兀朮精騎。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yue_Fei"
    ]
  },
  "WANGJIAN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·白起王翦列傳》，平趙破燕，統大秦六十萬精兵堅壁相持滅楚國統一天下。",
    "sources": [
      "https://ctext.org/shiji/bai-qi-wang-jian-lie-zhuan/zh"
    ]
  },
  "HONDA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《德川實紀》《藩翰譜》，歷經姉川、三方原、長篠、小牧長久手等合戰，以重裝名槍蜻蛉切聞名。",
    "sources": [
      "https://en.wikipedia.org/wiki/Honda_Tadakatsu"
    ]
  },
  "SHIBATA": {
    "era": "sengoku",
    "status": "qualified",
    "note": "見《信長公記》，佐和山與北陸軍團主帥，瓶割城故事具戰國傳說色彩，賤岳敗後於北之庄自盡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Shibata_Katsuie"
    ]
  },
  "LIANPO": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·廉頗藺相如列傳》，率趙軍連克齊燕魏，長平前線築堅壘相持強秦三年不敗。",
    "sources": [
      "https://ctext.org/shiji/lian-po-lin-xiang-ru-lie-zhuan/zh"
    ]
  },
  "MENGTIAN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·蒙恬列傳》，率三十萬大軍北逐匈奴收復河南地，連接戰國邊牆成萬里長城。",
    "sources": [
      "https://ctext.org/shiji/meng-tian-lie-zhuan/zh"
    ]
  },
  "GUANYU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·關羽傳》，白馬斬顏良、襄樊水淹七軍擒于禁斬龐德，威震華夏。",
    "sources": [
      "https://en.wikipedia.org/wiki/Guan_Yu"
    ]
  },
  "ZHANGFEI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·張飛傳》，當陽據水斷橋喝退曹軍、義釋嚴顏、宕渠破張郃，並稱萬人敵。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zhang_Fei"
    ]
  },
  "HOJO_UJIYASU": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《北條五代記》等關東文書，河越夜戰大破上杉聯合軍、小田原籠城退上杉謙信與武田信玄。",
    "sources": [
      "https://en.wikipedia.org/wiki/H%C5%8Dj%C5%8D_Ujiyasu"
    ]
  },
  "XIAHOU_DUN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·夏侯惇傳》，長期任曹操前方統帥，中流矢傷目後仍堅守軍務。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xiahou_Dun"
    ]
  },
  "TACHIBANAD": {
    "era": "sengoku",
    "status": "qualified",
    "note": "見九州戰國史料，乘輿指揮大友軍堅守立花山城屢敗毛利與島津軍，「雷神」傳說見後世軍記。",
    "sources": [
      "https://en.wikipedia.org/wiki/Tachibana_D%C5%8Dsetsu"
    ]
  },
  "CHOIYOUNG": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《高麗史·崔瑩傳》，率高麗軍掃平紅巾軍與倭寇、鎮壓內亂，威名著於高麗末年。",
    "sources": [
      "https://en.wikipedia.org/wiki/Choe_Yeong"
    ]
  },
  "DIANWEI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·典韋傳》，善使雙鐵戟，宛城張繡反叛時獨守營門力戰至死護曹操突圍。",
    "sources": [
      "https://en.wikipedia.org/wiki/Dian_Wei"
    ]
  },
  "XUCHU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·許褚傳》，潼關渡河戰單手舉鞍蔽曹、威懾馬超於渭南。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xu_Chu"
    ]
  },
  "SHIMAZUY": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《關原合戰記》與薩摩藩史料，率島津兵以中央突破法自關原戰場突圍生還，名震戰國。",
    "sources": [
      "https://en.wikipedia.org/wiki/Shimazu_Yoshihiro"
    ]
  },
  "SUNJIAN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·孫破虜討逆傳》，討伐董卓屢敗華雄、呂布軍率先攻入洛陽修復漢陵。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sun_Jian"
    ]
  },
  "GYEBAEK": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《三國史記·階伯列傳》，黃山伐率五千決死士迎擊新羅五萬大軍，四戰四捷後力竭陣亡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Gyebaek"
    ]
  },
  "YANGYE": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·楊業傳》，代州雁門大破遼軍十餘萬，陳家谷遭友軍失期不救孤軍血戰殉國。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yang_Ye"
    ]
  },
  "CAOREN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·曹仁傳》，南郡抗周瑜、樊城洪水圍城死守數月不降，受讚為天人之勇。",
    "sources": [
      "https://en.wikipedia.org/wiki/Cao_Ren"
    ]
  },
  "ZHOUTAI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·周泰傳》，宣城以身護孫權身受十二創，濡須孫權命解衣指瘡賜御幘青縑傘蓋。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zhou_Tai"
    ]
  },
  "IINAOMASA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《井伊家傳記》《德川實紀》，承繼武田舊部組井伊赤備隊，於小牧長久手與關原立首功。",
    "sources": [
      "https://en.wikipedia.org/wiki/Ii_Naomasa"
    ]
  },
  "KATOKIYOMASA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《清正記》，賤岳七本槍出身，擅築熊本、蔚山名城並率重甲精銳死守蔚山籠城。",
    "sources": [
      "https://en.wikipedia.org/wiki/Kat%C5%8D_Kiyomasa"
    ]
  },
  "YUJIN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·于禁傳》，治軍最為嚴整毅重，宛城兵亂率先整軍禦敵，晚節因水淹七軍投降受譏。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yu_Jin"
    ]
  },
  "LIGUANG": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·李將軍列傳》，射術出神、夜射獵草石沒羽，匈奴畏稱「漢之飛將軍」數年不敢入塞。",
    "sources": [
      "https://ctext.org/shiji/li-jiang-jun-lie-zhuan/zh"
    ]
  },
  "YANGYOUJI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《左傳·成公十六年》《戰國策》，鄢陵之戰一矢穿七札，後人尊為春秋第一神射手。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yang_Youji"
    ]
  },
  "NOBUNAGA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見太田牛一《信長公記》，桶狹間奇襲、長篠設馬防柵與大量鐵砲輪射破武田騎軍，開創近世統一秩序。",
    "sources": [
      "https://en.wikipedia.org/wiki/Oda_Nobunaga"
    ]
  },
  "YOICHI": {
    "era": "sengoku",
    "status": "qualified",
    "note": "見《平家物語·屋島合戰》，屋島波濤間遠射折斷船頭金箔紅扇；屬軍記文學代表名場面。",
    "sources": [
      "https://en.wikipedia.org/wiki/Nasu_no_Yoichi"
    ]
  },
  "JUMONG": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《三國史記·高句麗本紀》及好太王碑，為高句麗建國始祖「東明聖王」，神射事蹟帶神話傳承。",
    "sources": [
      "https://en.wikipedia.org/wiki/Jumong"
    ]
  },
  "HUANGZHONG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·黃忠傳》，老而彌堅，定軍山登高推鋒一鼓擊斬魏大將夏侯淵。",
    "sources": [
      "https://en.wikipedia.org/wiki/Huang_Zhong"
    ]
  },
  "TAISHICI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·太史慈傳》，猿臂善射、城上飛矢貫叛徒之手，北海突圍、神亭單挑孫策。",
    "sources": [
      "https://en.wikipedia.org/wiki/Taishi_Ci"
    ]
  },
  "HANSHIZHONG": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·韓世忠傳》，黃天蕩扼守大江阻金軍四十八日，製「克敵弓」配神臂弩破金軍重騎。",
    "sources": [
      "https://en.wikipedia.org/wiki/Han_Shizhong"
    ]
  },
  "LIMU": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·廉頗藺相如列傳》，雁門破匈奴十餘萬騎使其十餘年不近邊，肥之戰、番吾之戰兩挫秦軍。",
    "sources": [
      "https://ctext.org/shiji/lian-po-lin-xiang-ru-lie-zhuan/zh"
    ]
  },
  "AKECHI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》《兼見卿記》，精熟火繩槍戰法與近畿軍政，1582 年發動本能寺之變。",
    "sources": [
      "https://en.wikipedia.org/wiki/Akechi_Mitsuhide"
    ]
  },
  "SAIKA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》石山合戰史料，統領紀伊雜賀眾精銳鐵砲傭兵屢屢重創織田大軍。",
    "sources": [
      "https://en.wikipedia.org/wiki/Saika_Magoichi"
    ]
  },
  "GWONYUL": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "1593 年幸州大捷率朝鮮軍民以神機箭火車、弓弩與巨石重創進犯日軍，正史《朝鮮王朝實錄》記載明確。",
    "sources": [
      "https://en.wikipedia.org/wiki/Gwon_Yul",
      "https://en.wikipedia.org/wiki/Battle_of_Haengju"
    ]
  },
  "HULUGUANG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《北齊書·斛律光傳》，善騎射號「落雕都督」，邙山大破北周大軍十萬，百戰無敗惜冤死讒言。",
    "sources": [
      "https://en.wikipedia.org/wiki/Hul%C3%BC_Guang"
    ]
  },
  "MALONG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《晉書·馬隆傳》，募勇士三千五百人造偏箱車八陣、配連弩長矛平定涼州禿髮樹機能之亂。",
    "sources": [
      "https://en.wikipedia.org/wiki/Ma_Long_(Jin_dynasty)"
    ]
  },
  "ZHOUYAFU": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·絳侯周勃世家》，細柳治軍連天子車駕亦須持節方可入營；平七國之亂大破吳楚聯軍。",
    "sources": [
      "https://ctext.org/shiji/jiang-hou-zhou-bo-shi-jia/zh"
    ]
  },
  "ZONGZE": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·宗澤傳》，靖康建炎間率義軍二十四戰連捷、築京師連弩箭樓，臨終三呼「過河」。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zong_Ze"
    ]
  },
  "TORII": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《德川實紀》，伏見城以千八百守軍配鐵砲弓弩血戰四萬西軍十餘日，護家康主力完成關原布局。",
    "sources": [
      "https://en.wikipedia.org/wiki/Torii_Mototada"
    ]
  },
  "CHOIMUSEON": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《高麗史·崔茂宣傳》，首研火藥製造並創置火桶都監，1380 年鎮浦海戰以艦砲焚毀五百餘艘倭船。",
    "sources": [
      "https://en.wikipedia.org/wiki/Choe_Mu-seon"
    ]
  },
  "GENGYAN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《後漢書·耿弇傳》，光武雲台名將，「有志者事竟成」圍城打援平定張步齊地四十六郡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Geng_Yan"
    ]
  },
  "YAMAMOTO": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《甲陽軍鑑》與市川家文書，武田晴信軍師精研築城與陣法，第四次川中島合戰獻策後力戰陣亡。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yamamoto_Kansuke"
    ]
  },
  "FENGYI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《後漢書·馮異傳》，大樹將軍謙退不伐，崤底設伏大破赤眉軍，平定關中三輔歸心。",
    "sources": [
      "https://en.wikipedia.org/wiki/Feng_Yi"
    ]
  },
  "ASAKURA_SOT": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《朝倉宗滴話記》，輔佐朝倉家征戰一揆並撰兵法錄，晚年率越前軍團實戰採用火繩銃。",
    "sources": [
      "https://en.wikipedia.org/wiki/Asakura_S%C5%8Dteki"
    ]
  },
  "MATSUNAGA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《多聞院日記》《信長公記》，擅長城市防禦與早期大量部署鐵砲炸藥戰術，信貴山城引爆自盡具話題性。",
    "sources": [
      "https://en.wikipedia.org/wiki/Matsunaga_Hisahide"
    ]
  },
  "SHIMAZU_IEHISA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《上井覺兼日記》，指揮島津氏經典「釣野伏」誘敵反殺戰術，於沖田畷以火砲連射破龍造寺隆信。",
    "sources": [
      "https://en.wikipedia.org/wiki/Shimazu_Iehisa"
    ]
  },
  "TAKIGAWA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》，擅長火繩槍調度與近江情報網，任關東管領並於各地戰線展現靈活進退。",
    "sources": [
      "https://en.wikipedia.org/wiki/Takigawa_Kazumasu"
    ]
  },
  "HONDA_TADATSUGU": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《德川實紀》《寬政重修諸家譜》，本多忠勝伯父，長篠合戰指揮德川家先鋒鐵砲足輕參戰。",
    "sources": [
      "https://ja.wikipedia.org/wiki/%E6%9C%AC%E5%A4%9A%E5%BF%A0%E6%AC%A1"
    ]
  },
  "ZHOUYU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·周瑜傳》，建安十三年赤壁之戰與劉備聯軍以火攻大破曹操水步大軍。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zhou_Yu"
    ]
  },
  "YISUNSIN": {
    "era": "korea_dynasties",
    "status": "qualified",
    "note": "鳴梁實戰十三艘與戰前奏報十二艘須區分；海峽潮流為戰術要素，不以鳴梁龜船或鐵甲覆頂作已證實事實。敵艦數量有來源差異。",
    "sources": [
      "https://en.wikipedia.org/wiki/Battle_of_Myeongnyang"
    ]
  },
  "KUKI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》，築鐵皮覆蓋「鐵甲船」於第二次木津川口海戰大勝毛利水軍，任織田與豐臣水軍柱石。",
    "sources": [
      "https://en.wikipedia.org/wiki/Kuki_Yoshitaka"
    ]
  },
  "LUXUN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·陸遜傳》，夷陵火燒連營破劉備、石亭大破曹休十萬，出將入相名列武廟。",
    "sources": [
      "https://en.wikipedia.org/wiki/Lu_Xun_(Eastern_Wu)"
    ]
  },
  "YUNGWAN": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《高麗史·尹瓘傳》，編練「別武班」特種水陸精銳北逐女真、築東北九城守邊。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yun_Gwan"
    ]
  },
  "LUMENG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·呂蒙傳》，白衣渡江精妙偽裝奇襲荊州、襲奪江陵烽火台擒殺關羽。",
    "sources": [
      "https://en.wikipedia.org/wiki/L%C3%BC_Meng"
    ]
  },
  "GANNING": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·甘寧傳》，率百騎銜枚夜襲曹營、「孟德有張遼，孤有甘興霸」之稱。",
    "sources": [
      "https://en.wikipedia.org/wiki/Gan_Ning"
    ]
  },
  "HUANGGAI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·黃蓋傳》，獻計詐降駕十艘蒙衝鬥艦滿載薪草膏油火燒赤壁曹營。",
    "sources": [
      "https://en.wikipedia.org/wiki/Huang_Gai"
    ]
  },
  "JIANGWEI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·姜維傳》，承諸葛亮兵法九伐中原，段谷、洮西皆有交鋒，終與鍾會計敗殉蜀。",
    "sources": [
      "https://en.wikipedia.org/wiki/Jiang_Wei"
    ]
  },
  "LIJING": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《舊唐書·李靖傳》《李衛公問對》，十日破蕭銑水軍、雪夜奔襲陰山滅東突厥，為大唐第一軍神。",
    "sources": [
      "https://en.wikipedia.org/wiki/Li_Jing_(general)"
    ]
  },
  "DENGAI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·鄧艾傳》，景元四年率兵偷渡陰平險道七百里奇襲江油綿竹滅蜀漢。",
    "sources": [
      "https://en.wikipedia.org/wiki/Deng_Ai"
    ]
  },
  "MURAKAMI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見瀬戸内海村上水軍文書，嚴島之戰率能島水軍以潮汐戰法與焙烙火彈助毛利元就覆滅陶晴賢水軍。",
    "sources": [
      "https://en.wikipedia.org/wiki/Murakami_Takeyoshi"
    ]
  },
  "XIEXUAN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《晉書·謝玄傳》，組建精銳北府兵，太元八年淝水之戰以八萬渡河反擊大破前秦八十萬大軍。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xie_Xuan"
    ]
  },
  "YUYUNWEN": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·虞允文傳》，紹興三十一年以參贊軍事書生之身於采石磯指揮水師霹靂砲破海陵王完顏亮渡江。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yu_Yunwen"
    ]
  },
  "WEIYAN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·魏延傳》，鎮守漢中十餘年重門設險，曾建議率精騎萬人自子午谷直取長安。",
    "sources": [
      "https://en.wikipedia.org/wiki/Wei_Yan"
    ]
  },
  "MOURI_MOTO": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見安藝毛利家文書，嚴島暴風雨夜以少勝多殲滅陶晴賢，制霸中國地方；「三矢之訓」流傳後世。",
    "sources": [
      "https://en.wikipedia.org/wiki/M%C5%8Dri_Motonari"
    ]
  },
  "HATTORI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《德川實紀》《寬政重修諸家譜》，神君伊賀越時統領伊賀武士兼忍軍護衛家康脫險，任伊賀同心統領。",
    "sources": [
      "https://en.wikipedia.org/wiki/Hattori_Hanz%C5%8D"
    ]
  },
  "JEONGJI": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《高麗史·鄭地傳》，高麗末年督造大型戰艦並配火砲於觀音浦、南海水戰連敗倭寇。",
    "sources": [
      "https://en.wikipedia.org/wiki/Jeong_Ji"
    ]
  },
  "YUEJIN": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·樂進傳》，五子良將之一，從征官渡、柳城、合肥每戰先登立功。",
    "sources": [
      "https://en.wikipedia.org/wiki/Yue_Jin"
    ]
  },
  "MENGHUO": {
    "era": "three_kingdoms",
    "status": "qualified",
    "note": "見《漢晉春秋》與《華陽國志》，南中渠帥聚各姓起兵，「七擒七縱」情節主要源自裴注引《漢晉春秋》。",
    "sources": [
      "https://en.wikipedia.org/wiki/Meng_Huo"
    ]
  },
  "XUHUANG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·徐晃傳》，漢水背水破敵、樊城長驅直入破關羽十重鹿角，曹操讚「有周亞夫之風」。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xu_Huang"
    ]
  },
  "WAKIZAKA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《太閤記》《關原合戰記》，賤岳七本槍出身，豐臣時期統率淡路水軍出征九州及朝鮮。",
    "sources": [
      "https://en.wikipedia.org/wiki/Wakizaka_Yasuharu"
    ]
  },
  "TOUDO": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《宗國史》，豐臣與德川兩代皆領水軍與築城重任，擅造宇和島、今治、津城等近代水城名堡。",
    "sources": [
      "https://en.wikipedia.org/wiki/T%C5%8Dd%C5%8D_Takatora"
    ]
  },
  "ZHANGHE": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "街亭斷水與用兵巧變有《三國志》卷十七所引記載；木門道為追擊中伏身亡。已調整為先登奇兵以貼合地形穿插與斷敵補給專長。",
    "sources": [
      "https://ctext.org/text.pl?node=603728",
      "https://en.wikipedia.org/wiki/Zhang_He"
    ]
  },
  "CAOBIN": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《宋史·曹彬傳》，統水步軍渡采石磯浮橋平定南唐金陵，「妄殺一人」之戒稱譽宋代仁將。",
    "sources": [
      "https://en.wikipedia.org/wiki/Cao_Bin"
    ]
  },
  "ZHUGELIANG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·諸葛亮傳》，隆中定策、治蜀南征北伐並推演八陣與連弩損益，忠貞智聖垂範千古。",
    "sources": [
      "https://en.wikipedia.org/wiki/Zhuge_Liang"
    ]
  },
  "HANXIN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "暗度陳倉、井陘背水與伏兵可連結《史記·淮陰侯列傳》；部分後世成語化敘事仍需區分。",
    "sources": [
      "https://ctext.org/shiji/huai-yin-hou-lie-zhuan/zh"
    ]
  },
  "ZHANGLIANG": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·留侯世家》，運籌帷幄之中決勝千里之外，佐劉邦定關中、鴻門排難、垓下合圍定漢鼎。",
    "sources": [
      "https://ctext.org/shiji/liu-hou-shi-jia/zh"
    ]
  },
  "SIMAYI": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《晉書·宣帝紀》，相持諸葛亮於五丈原、百日急行軍平遼東公孫淵，高平陵政變奠基晉室。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sima_Yi"
    ]
  },
  "TOYOTOMI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《信長公記》《太閤記》，備中高松水攻、山崎急行軍與小田原動員完成日本近代全國性軍事一統。",
    "sources": [
      "https://en.wikipedia.org/wiki/Toyotomi_Hideyoshi"
    ]
  },
  "CAOCAO": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·武帝紀》，官渡烏巢焚糧破袁紹、白狼山遠征烏桓，著《孫子略解》深通兵學。",
    "sources": [
      "https://en.wikipedia.org/wiki/Cao_Cao"
    ]
  },
  "HANBEI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《太閤記》《信長公記》，智奪稻葉山城後輔佐豐臣秀吉征討西國，與官兵衛並稱「兩兵衛」。",
    "sources": [
      "https://en.wikipedia.org/wiki/Takenaka_Hanbei"
    ]
  },
  "KANBEI": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《黑田家譜》，為秀吉策劃高松水攻、中國大返還與九州關原後九州動員之核心戰略總參。",
    "sources": [
      "https://en.wikipedia.org/wiki/Kuroda_Kanbei"
    ]
  },
  "KANGGAMCHAN": {
    "era": "korea_dynasties",
    "status": "source-linked",
    "note": "見《高麗史·姜邯贊傳》，1019 年龜州大捷以決堤水攻與伏兵殲滅契丹蕭排押大軍，位列三韓國公。",
    "sources": [
      "https://en.wikipedia.org/wiki/Gang_Gam-chan"
    ]
  },
  "SUNBIN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·孫子吳起列傳》與銀雀山漢簡《孫臏兵法》，創桂陵圍魏救趙、馬陵減灶誘殺龐涓。",
    "sources": [
      "https://ctext.org/shiji/sun-zi-wu-qi-lie-zhuan/zh"
    ]
  },
  "WUQI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·孫子吳起列傳》，治魏武卒拓土西河、在楚變法強兵，「與諸侯大戰七十六，全勝六十四」。",
    "sources": [
      "https://ctext.org/shiji/sun-zi-wu-qi-lie-zhuan/zh"
    ]
  },
  "GUOJIA": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·郭嘉傳》，獻十勝十敗論安軍心，準確預測孫策遇刺並力主遠征烏桓定柳城。",
    "sources": [
      "https://en.wikipedia.org/wiki/Guo_Jia"
    ]
  },
  "XUNYU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·荀彧傳》，舉才規劃迎奉天子並設計迎擊呂布、死守官渡後方大戰略。",
    "sources": [
      "https://en.wikipedia.org/wiki/Xun_Yu"
    ]
  },
  "JIAXU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·魏書·賈詡傳》，佐張繡兩挫曹操、潼關獻離間韓遂馬超策，算無遺策明哲保身。",
    "sources": [
      "https://en.wikipedia.org/wiki/Jia_Xu"
    ]
  },
  "SHIMAZU_YOSHIHISA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見薩摩《島津氏正統系譜》，統籌家臣兄弟耳川、沖田畷大戰席捲九州大部，終向秀吉和談保領國。",
    "sources": [
      "https://en.wikipedia.org/wiki/Shimazu_Yoshihisa"
    ]
  },
  "PANGTONG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·龐統傳》，與諸葛亮齊名「鳳雛」，入蜀獻上中下三策奪涪城，惜中流矢卒於雒城。",
    "sources": [
      "https://en.wikipedia.org/wiki/Pang_Tong"
    ]
  },
  "FAZHENG": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·蜀書·法正傳》，獻策奪益州、定軍山登高舉旗指揮黃忠斬夏侯淵定漢中。",
    "sources": [
      "https://en.wikipedia.org/wiki/Fa_Zheng"
    ]
  },
  "SANADAMASA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見真田文書與關原資料，第一次、第二次上田城以少兵挫敗德川數萬大軍，足智多謀稱「表裏比興」。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sanada_Masayuki"
    ]
  },
  "LUSU": {
    "era": "three_kingdoms",
    "status": "source-linked",
    "note": "見《三國志·吳書·魯肅傳》，建安五年即擬就「榻上策」鼎足江東，力排眾議促成孫劉赤壁破曹。",
    "sources": [
      "https://en.wikipedia.org/wiki/Lu_Su"
    ]
  },
  "TIANDAN": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "即墨火牛陣屬陸上誘敵反擊見《史記·田單列傳》；naval 槽是遊戲奇兵職能，不是史實水軍身分。",
    "sources": [
      "https://ctext.org/shiji/tian-dan-lie-zhuan/zh",
      "https://en.wikipedia.org/wiki/Tian_Dan"
    ]
  },
  "LIUBOWEN": {
    "era": "tang_song_ming",
    "status": "source-linked",
    "note": "見《明史·劉基傳》，佐朱元璋定先漢（陳友諒）後吳（張士誠）大略，參與大明開國諸謀議。",
    "sources": [
      "https://en.wikipedia.org/wiki/Liu_Ji_(Ming_dynasty)"
    ]
  },
  "SUNWU": {
    "era": "qin_han",
    "status": "needs-review",
    "note": "孫武生平與《孫子兵法》作者歸屬存在歷史研究爭議，不將傳統敘事當成已證實履歷。",
    "sources": [
      "https://en.wikipedia.org/wiki/Sun_Tzu"
    ]
  },
  "LEYI": {
    "era": "qin_han",
    "status": "source-linked",
    "note": "見《史記·樂毅列傳》，佩燕趙韓魏楚五國相印濟西破齊，連下七十餘城，受封昌國君。",
    "sources": [
      "https://ctext.org/shiji/le-yi-lie-zhuan/zh"
    ]
  },
  "TOKUGAWA": {
    "era": "sengoku",
    "status": "source-linked",
    "note": "見《德川實紀》，於三方原歷練忍耐、小牧與關原勝出、終至大坂之陣開創江戶二百六十年和平盛世。",
    "sources": [
      "https://en.wikipedia.org/wiki/Tokugawa_Ieyasu"
    ]
  }
};
  root.HISTORICAL_AUDIT_FULL = HISTORICAL_AUDIT_FULL;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HISTORICAL_AUDIT_FULL;
  }
})(typeof window !== 'undefined' ? window : globalThis);
