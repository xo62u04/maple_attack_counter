function useAlchemy() {
  const { ref, computed } = Vue

  const ALCHEMY_RAW = String.raw`
秘藥
70	體力強化的秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	魔力強化的秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	祝福的秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	力量強化秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	敏捷 強化秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	智能強化秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	幸運強化秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級祝福的秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級敏捷強化秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級幸運強化秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級體力強化的秘藥	中級藥水空瓶 x1、柑橘種子精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級魔力強化的秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級力量 強化秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級智能 強化秘藥	中級藥水空瓶 x1、柑橘花精油 x3、中級物品結晶 x8、褐色魔法粉 x3
70	下級英雄的秘藥	中級藥水空瓶 x1、柑橘花精油 x3、下級物品結晶 x10、褐色魔法粉 x5
130	中級體力強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級祝福的秘藥	最高級藥水空瓶 x1、杜松的種子精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級敏捷強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級幸運強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級魔力強化秘藥	最高級藥水空瓶 x1、杜松花精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級力量強化秘藥	最高級藥水空瓶 x1、杜松花精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級智能強化秘藥	最高級藥水空瓶 x1、杜松花精油 x3、高級物品結晶 x8、紫色魔法粉 x3
130	中級英雄的秘藥	最高級藥水空瓶 x1、杜松花精油 x3、高級物品結晶 x10、紫色魔法粉 x5
130	中級集中秘藥	最高級藥水空瓶 x1、杜松花精油 x3、高級物品結晶 x10、紫色魔法粉 x5
90	上級體力強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級祝福的秘藥	最高級藥水空瓶 x1、杜松的種子精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級智能強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級幸運強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級魔力強化秘藥	最高級藥水空瓶 x1、杜松花精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級力量強化秘藥	最高級藥水空瓶 x1、杜松花精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級敏捷強化秘藥	最高級藥水空瓶 x1、杜松花精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級英雄的秘藥	最高級藥水空瓶 x1、杜松花精油 x5、高級物品結晶 x10、紫色魔法粉 x5
90	上級集中秘藥	最高級藥水空瓶 x1、杜松花精油 x5、高級物品結晶 x10、紫色魔法粉 x5
100	最上級體力強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級祝福的秘藥	最高級藥水空瓶 x1、杜松的種子精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級智能強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級幸運強化秘藥	最高級藥水空瓶 x1、杜松的種子精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級魔力強化秘藥	最高級藥水空瓶 x1、杜松花精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級力量強化秘藥	最高級藥水空瓶 x1、杜松花精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級敏捷強化秘藥	最高級藥水空瓶 x1、杜松花精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級英雄的秘藥	最高級藥水空瓶 x1、杜松花精油 x7、高級物品結晶 x10、紫色魔法粉 x5
100	最上級集中秘藥	最高級藥水空瓶 x1、杜松花精油 x7、高級物品結晶 x10、紫色魔法粉 x5
匠人	秘藥-BOSS殺手的秘藥	最高級藥水空瓶 x1、魔力結晶 x10、牛膝草花精油 x10、扭曲的時間精隨 x15、黃昏的精華 x3
匠人	大英雄的秘藥	最高級藥水空瓶 x1、魔力結晶 x10、牛膝草花精油 x10、扭曲的時間精隨 x15、黃昏的精華 x3
匠人	貫通的秘藥	最高級藥水空瓶 x1、魔力結晶 x10、牛膝草花精油 x10、扭曲的時間精隨 x15、黃昏的精華 x3
匠人	大祝福的秘藥	最高級藥水空瓶 x1、魔力結晶 x10、牛膝草花精油 x10、扭曲的時間精隨 x15、黃昏的精華 x3
名匠	高級BOSS殺手的秘藥	秘藥-BOSS殺手的秘藥 x1、牛膝草花精油 x10、上級咒文精隨 x1、鮮明黃昏的精華 x1
名匠	高級大英雄的秘藥	大英雄的秘藥 x1、牛膝草花精油 x10、上級咒文精隨 x1、鮮明黃昏的精華 x1
名匠	高級貫通的秘藥	貫通的秘藥 x1、牛膝草花精油 x10、上級咒文精隨 x1、鮮明黃昏的精華 x1
名匠	高級大祝福的秘藥	大祝福的秘藥 x1、牛膝草花精油 x10、上級咒文精隨 x1、鮮明黃昏的精華 x1
30	巨大藥水	中級藥水空瓶 x1、柑橘種子精油 x10、中級物品結晶 x10、褐色魔法粉 x5
70	高級 巨大藥水	最高級藥水空瓶 x1、杜松花精油 x10、高級物品結晶 x10、紫色魔法粉 x5
70	經驗累積的秘藥	最高級藥水空瓶 x1、杜松種子精油 x10、最高級物品結晶 x5、賢者之石 x2
70	獲得財物的秘藥	最高級藥水空瓶 x1、杜松種子精油 x10、最高級物品結晶 x3、賢者之石 x1
70	忍耐的秘藥	最高級藥水空瓶 x1、杜松種子精油 x10、最高級物品結晶 x3、賢者之石 x1
70	覺醒的秘藥	最高級藥水空瓶 x1、杜松種子精油 x2、最高級物品結晶 x2、紫色魔法粉 x5
70	無敵的秘藥	最高級藥水空瓶 x1、杜松種子精油 x3、最高級物品結晶 x2、紫色魔粉 x5
110	傳說中的英雄秘藥	最高級藥水空瓶 x1、杜松花精油 x10、最高級物品結晶 x5、賢者之石 x2
110	傳說中的祝福秘藥	最高級藥水空瓶 x1、杜松種子精油 x5、最高級物品結晶 x5、賢者之石 x2
110	傳說中的體力秘藥	最高級藥水空瓶 x1、杜松種子精油 x10、最高級物品結晶 x5、賢者之石 x2
110	傳說中的魔力秘藥	最高級藥水空瓶 x1、杜松花精油 x10、最高級物品結晶 x5、賢者之石 x2

變身藥水
30	綠色 嫩寶 變身藥水	綠寶殼 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	穆魯穆魯 變身藥水	穆魯穆魯的毛球 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	綠菇菇 變身藥水	綠菇菇傘 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	蝙蝠 變身藥水	蝙蝠翅膀 x10、中級藥水空瓶 x3、褐色魔法粉 x2
30	巡邏機器人 變身藥水	巡邏機器人的記憶晶片 x10、中級藥水空瓶 x3、褐色魔法粉 x2
30	大蛇王 變身藥水	大蛇王尾巴 x10、中級藥水空瓶 x3、褐色魔法粉 x2
30	猴子 變身藥水	猴子娃娃 x10、中級藥水空瓶 x3、褐色魔法粉 x2
30	特殊紅寶王 變身藥水	彩虹蝸牛殼 x3、中級藥水空瓶 x3、褐色魔法粉 x2
30	發條楓葉鼠 變身藥水	向日葵子 x10、中級藥水空瓶 x3、綠色魔法粉 x2
30	鼬鼠鬧鐘 變身藥水	小鬧鐘 x10、中級藥水空瓶 x3、綠色魔法粉 x2
30	積木泥人王 變身藥水	藍色玩具積木 x10、中級藥水空瓶 x3、綠色魔法粉 x2
30	小雪球 變身藥水	雪吉拉之皮 x10、中級藥水空瓶 x3、綠色魔法粉 x2
30	特殊仙人長老 變身藥水	仙人長老的刺。 x3、中級藥水空瓶 x3、綠色魔法粉 x2
30	企鵝王 變身藥水	企鵝王的嘴 x15、中級藥水空瓶 x3、黃色魔法粉 x2
30	土龍 變身藥水	暴龍的頭骨 x15、中級藥水空瓶 x3、黃色魔法粉 x2
30	黑格里芬 變身藥水	黑格里芬之尾 x15、中級藥水空瓶 x3、黃色魔法粉 x2
30	小虎 變身藥水	老虎腳印 x15、中級藥水空瓶 x3、黃色魔法粉 x2
30	特殊巨居蟹 變身藥水	巨居蟹的巨大夾子 x3、中級藥水空瓶 x3、黃色魔法粉 x2
30	三尾狐 變身藥水	三尾狐的尾巴 x15、高級藥水空瓶 x3、白色魔法粉 x2
30	勇猛石巨人 變身藥水	石球的石塊 x50、高級藥水空瓶 x3、白色魔法粉 x2
30	喵仙 變身藥水	貓咪娃娃 x15、高級藥水空瓶 x3、白色魔法粉 x2
30	貨運熊 變身藥水	貨運熊的貨運車 x15、高級藥水空瓶 x3、白色魔法粉 x2
30	特殊葛雷金剛 變身藥水	葛雷的手套 x3、高級藥水空瓶 x3、白色魔法粉 x2
30	豪豬 變身藥水	頂針 x20、高級藥水空瓶 x3、紅色魔法粉 x2
30	黑妖苗三兄弟 變身藥水	長頸瓶 x20、高級藥水空瓶 x3、紅色魔法粉 x2
30	拉坎 變身藥水	拉坎的安全帽 x20、高級藥水空瓶 x3、紅色魔法粉 x2
30	梅花鹿 變身藥水	斷裂的鹿角 x20、高級藥水空瓶 x3、紅色魔法粉 x2
30	特殊艾利傑 變身藥水	獨角獅硬角 x10、黑格里芬之尾 x10、高級藥水空瓶 x3、紅色魔法粉 x2
30	深山人蔘 變身藥水	深山人蔘 x25、高級藥水空瓶 x3、黑色魔法粉 x2
30	怨靈女巫 變身藥水	寒冰碎塊 x25、高級藥水空瓶 x3、黑色魔法粉 x2
30	萊西 變身藥水	萊西毛球 x25、高級藥水空瓶 x3、黑色魔法粉 x2
30	船員克魯 變身藥水	海賊的標示 x25、高級藥水空瓶 x3、黑色魔法粉 x2
30	特殊地獄巴洛古 變身藥水	盾牌防禦卷軸60% x2、雙手劍命中卷軸60% x1、高級藥水空瓶 x3、黑色魔法粉 x10
30	特貝爾芬變身藥水	特貝爾芬石塊 x25、最高級藥水空瓶 x3、黑色魔法粉 x2
30	百烈 變身藥水	百烈舵輪 x25、最高級藥水空瓶 x3、黑色魔法粉 x2
30	雪吉拉 變身藥水	雪吉拉之角 x25、最高級藥水空瓶 x3、黑色魔法粉 x2
30	伊魯薇達 變身藥水	伊魯薇達的雷射劍 x25、最高級藥水空瓶 x3、黑色魔法粉 x2
30	特殊獅鷲 變身藥水	格瑞芬多角 x3、最高級藥水空瓶 x3、黑色魔法粉 x2
30	藍菇菇 變身藥水	藍菇菇傘 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	古木妖 變身藥水	苗木 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	殭屍菇菇 變身藥水	道符 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	黑肥肥 變身藥水	黑肥肥尖牙 x5、下級藥水空瓶 x3、藍色魔法粉 x2
30	特殊凡雷恩 變身藥水	淨化的圖騰 x100、最高級藥水空瓶 x3、黑色魔法粉 x2
30	特殊拉圖斯 變身藥水	達克泰可 x3、最高級藥水空瓶 x3、黑色魔法粉 x2

恢復藥水跟藥丸
30	體力恢復藥水 1000	下級藥水空瓶 x50、墨角蘭種子精油 x3
30	體力恢復藥水 1500	下級藥水空瓶 x50、薰衣草種子精油 x3
30	體力恢復藥水 2000	下級藥水空瓶 x50、迷迭香種子精油 x3
30	體力恢復藥水 2500	中級藥水空瓶 x50、柑橘種子精油 x3
30	體力恢復藥水 3000	中級藥水空瓶 x50、香蜂草種子精油 x3
30	體力恢復藥水 3500	中級藥水空瓶 x50、茉莉花種子精油 x3
30	體力恢復藥水 4000	高級藥水空瓶 x50、茶樹種子精油 x3
30	體力恢復藥水 5000	高級藥水空瓶 x50、洋甘菊種子精油 x3
30	體力恢復藥水 6000	高級藥水空瓶 x50、廣藿香種子精油 x3
30	體力恢復藥水 7000	最高級藥水空瓶 x50、杜松的種子精油 x3
30	體力恢復藥丸1000	下級藥水凝固劑 x10、體力恢復藥水 1000 x50
30	體力恢復藥丸1500	下級藥水凝固劑 x10、體力恢復藥水 1500 x50
30	體力恢復藥丸2000	下級藥水凝固劑 x10、體力恢復藥水 2000 x50
30	體力恢復藥丸2500	中級藥水凝固劑 x10、體力恢復藥水 2500 x50
30	體力恢復藥丸3000	中級藥水凝固劑 x10、體力恢復藥水 3000 x50
30	體力恢復藥丸3500	中級藥水凝固劑 x10、體力恢復藥水 3500 x50
30	體力恢復藥丸4000	高級藥水凝固劑 x10、體力恢復藥水 4000 x50
30	體力恢復藥丸5000	高級藥水凝固劑 x10、體力恢復藥水 5000 x50
30	體力恢復藥丸6000	高級藥水凝固劑 x10、體力恢復藥水 6000 x50
30	體力恢復藥丸7000	最高級藥水凝固劑 x10、體力恢復藥水 7000 x50
30	魔力恢復藥水 1000	下級藥水空瓶 x50、墨角蘭花精油 x3
30	魔力恢復藥水 1500	下級藥水空瓶 x50、薰衣草花精油 x3
30	魔力恢復藥水 2000	下級藥水空瓶 x50、迷迭香花精油 x3
30	魔力恢復藥水 2500	中級藥水空瓶 x50、柑橘花精油 x3
30	魔力恢復藥水 3000	中級藥水空瓶 x50、香蜂草花精油 x3
30	魔力恢復藥水 3500	中級藥水空瓶 x50、茉莉花精油 x3
30	魔力恢復藥水 4000	高級藥水空瓶 x50、茶樹精油 x3
30	魔力恢復藥水 5000	高級藥水空瓶 x50、洋甘菊精油 x3
30	魔力恢復藥水 6000	高級藥水空瓶 x50、廣藿香精油 x3
30	魔力恢復藥水 7000	最高級藥水空瓶 x50、杜松花精油 x3
30	魔力恢復藥丸 1000	下級藥水凝固劑 x10、魔力恢復藥水 1000 x50
30	魔力恢復藥丸 1500	下級藥水凝固劑 x10、魔力恢復藥水 1500 x50
30	魔力恢復藥丸 2000	下級藥水凝固劑 x10、魔力恢復藥水 2000 x50
30	魔力恢復藥丸 2500	中級藥水凝固劑 x10、魔力恢復藥水 2500 x50
30	魔力恢復藥丸 3000	中級藥水凝固劑 x10、魔力恢復藥水 3000 x50
30	魔力恢復藥丸 3500	中級藥水凝固劑 x10、魔力恢復藥水 3500 x50
30	魔力恢復藥丸 4000	高級藥水凝固劑 x10、魔力恢復藥水 4000 x50
30	魔力恢復藥丸 5000	高級藥水凝固劑 x10、魔力恢復藥水 5000 x50
30	魔力恢復藥丸 6000	高級藥水凝固劑 x10、魔力恢復藥水 6000 x50
30	魔力恢復藥丸 7000	最高級藥水凝固劑 x10、魔力恢復藥水 7000 x50
30	特殊體力恢復藥水	最高級藥水空瓶 x50、牛膝草花精油 x1、杜松的種子精油 x3
30	特殊體力恢復藥丸	最高級藥水凝固劑 x10、特殊體力恢復藥水 x50
30	特殊魔力恢復藥水	最高級藥水空瓶 x50、牛膝草花精油 x1、杜松花精油 x3
30	特殊魔力恢復藥丸	最高級藥水凝固劑 x10、特殊魔力恢復藥水 x50

BUFF藥水跟藥丸
30	1階段力量的藥水	墨角蘭種子精油 x3、下級藥水空瓶 x5
40	2階段力量的藥水	薰衣草種子精油 x2、下級藥水空瓶 x5
50	3階段力量的藥水	迷迭香種子精油 x3、下級藥水空瓶 x5、藍色魔法粉 x3
60	4階段力量的藥水	柑橘種子精油 x3、中級藥水空瓶 x5、褐色魔法粉 x3
70	5階段力量的藥水	香蜂草種子精油 x3、中級藥水空瓶 x5、綠色魔法粉 x3
80	6階段力量的藥水	茉莉花種子精油 x3、中級藥水空瓶 x5、黃色魔法粉 x3
90	7階段力量的藥水	茶樹種子精油 x3、高級藥水空瓶 x5、白色魔法粉 x3
100	8階段力量的藥水	洋甘菊種子精油 x3、高級藥水空瓶 x5、紅色魔法粉 x3
110	9階段力量的藥水	廣藿香種子精油 x3、高級藥水空瓶 x5、黑色魔法粉 x3
120	10階段力量的藥水	杜松的種子精油 x3、最高級藥水空瓶 x5、黑色魔法粉 x3
30	提高 1階段力量的藥水	1階段力量的藥水 x5、蛋白石 x1
40	提高 2階段力量的藥水	2階段力量的藥水 x5、紫礦石 x1
50	提高 3階段力量的藥水	3階段力量的藥水 x5、鋼鐵 x1
60	提高 4階段力量的藥水	4階段力量的藥水 x5、朱礦石 x1
70	提高 5階段力量的藥水	5階段力量的藥水 x5、敏捷水晶 x1
80	提高 6階段力量的藥水	6階段力量的藥水 x5、黃金 x1
90	提高 7階段力量的藥水	7階段力量的藥水 x5、鑽石 x1
100	提高 8階段力量的藥水	8階段力量的藥水 x5、石榴石 x1
110	提高 9階段力量的藥水	9階段力量的藥水 x5、黑暗水晶 x1
120	提高 10階段力量的藥水	10階段力量的藥水 x5、智慧水晶 x1
30	1階段敏捷的藥水	墨角蘭花精油 x3、下級藥水空瓶 x5
40	2階段敏捷的藥水	薰衣草花精油 x2、下級藥水空瓶 x5
50	3階段敏捷的藥水	迷迭香花精油 x3、下級藥水空瓶 x5、藍色魔法粉 x3
60	4階段敏捷的藥水	柑橘花精油 x3、中級藥水空瓶 x5、褐色魔法粉 x3
70	5階段敏捷的藥水	香蜂草花精油 x3、中級藥水空瓶 x5、綠色魔法粉 x3
80	6階段敏捷的藥水	茉莉花精油 x3、中級藥水空瓶 x5、黃色魔法粉 x3
90	7階段敏捷的藥水	茶樹精油 x3、高級藥水空瓶 x5、白色魔法粉 x3
100	8階段敏捷的藥水	洋甘菊精油 x3、高級藥水空瓶 x5、紅色魔法粉 x3
110	9階段敏捷的藥水	廣藿香精油 x3、高級藥水空瓶 x5、黑色魔法粉 x3
120	10階段敏捷的藥水	杜松花精油 x3、最高級藥水空瓶 x5、黑色魔法粉 x3
30	提高 1階段敏捷的藥水	1階段敏捷的藥水 x5、銀 x1
40	提高 2階段敏捷的藥水	2階段敏捷的藥水 x5、紫水晶 x1
50	提高 3階段敏捷的藥水	3階段敏捷的藥水 x5、藍寶石 x1
60	提高 4階段敏捷的藥水	4階段敏捷的藥水 x5、青銅 x1
70	提高 5階段敏捷的藥水	5階段敏捷的藥水 x5、敏捷水晶 x1
80	提高 6階段敏捷的藥水	6階段敏捷的藥水 x5、黃晶 x1
90	提高 7階段敏捷的藥水	7階段敏捷的藥水 x5、海藍寶石 x1
100	提高 8階段敏捷的藥水	8階段敏捷的藥水 x5、力量水晶 x1
110	提高 9階段敏捷的藥水	9階段敏捷的藥水 x5、黑水晶 x1
120	提高 10階段敏捷的藥水	10階段敏捷的藥水 x5、鋰 x1
30	1階段智能的藥水	墨角蘭種子精油 x3、下級藥水空瓶 x5
40	2階段智能的藥水	薰衣草種子精油 x2、下級藥水空瓶 x5
50	3階段智能的藥水	迷迭香種子精油 x3、下級藥水空瓶 x5、藍色魔法粉 x3
60	4階段智能的藥水	柑橘種子精油 x3、中級藥水空瓶 x5、褐色魔法粉 x3
70	5階段智能的藥水	香蜂草種子精油 x3、中級藥水空瓶 x5、綠色魔法粉 x3
80	6階段智能的藥水	茉莉花種子精油 x3、中級藥水空瓶 x5、黃色魔法粉 x3
90	7階段智能的藥水	茶樹種子精油 x3、高級藥水空瓶 x5、白色魔法粉 x3
100	8階段智能的藥水	洋甘菊種子精油 x3、高級藥水空瓶 x5、紅色魔法粉 x3
110	9階段智能的藥水	廣藿香種子精油 x3、高級藥水空瓶 x5、黑色魔法粉 x3
120	10階段智能的藥水	杜松的種子精油 x3、最高級藥水空瓶 x5、黑色魔法粉 x3
30	提高 1階段智能的藥水	1階段智能的藥水 x5、蛋白石 x1
40	提高 2階段智能的藥水	2階段智能的藥水 x5、紫礦石 x1
50	提高 3階段智能的藥水	3階段智能的藥水 x5、鋼鐵 x1
60	提高 4階段智能的藥水	4階段智能的藥水 x5、朱礦石 x1
70	提高 5階段智能的藥水	5階段智能的藥水 x5、鋰礦石 x1
80	提高 6階段智能的藥水	6階段智能的藥水 x5、黃金 x1
90	提高 7階段智能的藥水	7階段智能的藥水 x5、鑽石 x1
100	提高 8階段智能的藥水	8階段智能的藥水 x5、石榴石 x1
110	提高 9階段智能的藥水	9階段智能的藥水 x5、黑暗水晶 x1
120	提高 10階段智能的藥水	10階段智能的藥水 x5、智慧水晶 x1
30	1階段幸運的藥水	墨角蘭花精油 x3、下級藥水空瓶 x5
40	2階段幸運的藥水	薰衣草花精油 x2、下級藥水空瓶 x5
50	3階段幸運的藥水	迷迭香花精油 x3、下級藥水空瓶 x5、藍色魔法粉 x3
60	4階段幸運的藥水	柑橘花精油 x3、中級藥水空瓶 x5、褐色魔法粉 x3
70	5階段幸運的藥水	香蜂草花精油 x3、中級藥水空瓶 x5、綠色魔法粉 x3
80	6階段幸運的藥水	茉莉花精油 x3、中級藥水空瓶 x5、黃色魔法粉 x3
90	7階段幸運的藥水	茶樹精油 x3、高級藥水空瓶 x5、白色魔法粉 x3
100	8階段幸運的藥水	洋甘菊精油 x3、高級藥水空瓶 x5、紅色魔法粉 x3
110	9階段幸運的藥水	廣藿香精油 x3、高級藥水空瓶 x5、黑色魔法粉 x3
120	10階段幸運的藥水	杜松花精油 x3、最高級藥水空瓶 x5、黑色魔法粉 x3
30	提高 1階段幸運的藥水	1階段幸運的藥水 x5、銀 x1
40	提高 2階段幸運的藥水	2階段幸運的藥水 x5、紫水晶 x1
50	提高 3階段幸運的藥水	3階段幸運的藥水 x5、藍寶石 x1
60	提高 4階段幸運的藥水	4階段幸運的藥水 x5、青銅 x1
70	提高 5階段幸運的藥水	5階段幸運的藥水 x5、祖母綠 x1
80	提高 6階段幸運的藥水	6階段幸運的藥水 x5、黃晶 x1
90	提高 7階段幸運的藥水	7階段幸運的藥水 x5、海藍寶石 x1
100	提高 8階段幸運的藥水	8階段幸運的藥水 x5、力量水晶 x1
110	提高 9階段幸運的藥水	9階段幸運的藥水 x5、黑水晶 x1
120	提高 10階段幸運的藥水	10階段幸運的藥水 x5、鋰 x1
30	1階段防禦的藥水	墨角蘭種子精油 x3、下級藥水空瓶 x25
40	2階段防禦的藥水	薰衣草種子精油 x3、下級藥水空瓶 x25
50	3階段防禦的藥水	迷迭香種子精油 x3、下級藥水空瓶 x25
60	4階段防禦的藥水	柑橘種子精油 x3、中級藥水空瓶 x25
70	5階段防禦的藥水	香蜂草種子精油 x3、中級藥水空瓶 x25
80	6階段防禦的藥水	茉莉花種子精油 x3、中級藥水空瓶 x25
90	7階段防禦的藥水	茶樹種子精油 x3、高級藥水空瓶 x25
100	8階段防禦的藥水	洋甘菊種子精油 x3、高級藥水空瓶 x25
110	9階段防禦的藥水	廣藿香種子精油 x3、高級藥水空瓶 x25
120	10階段防禦的藥水	杜松的種子精油 x3、最高級藥水空瓶 x25
30	提高 1階段防禦的藥水	1階段防禦的藥水 x25、蛋白石 x1
40	提高 2階段防禦的藥水	2階段防禦的藥水 x25、紫礦石 x1
50	提高 3階段防禦的藥水	3階段防禦的藥水 x25、鋼鐵 x1
60	提高 4階段防禦的藥水	4階段防禦的藥水 x25、朱礦石 x1
70	提高 5階段防禦的藥水	5階段防禦的藥水 x25、鋰礦石 x1
80	提高 6階段防禦的藥水	6階段防禦的藥水 x25、黃金 x1
90	提高 7階段防禦的藥水	7階段防禦的藥水 x25、鑽石 x1
100	提高 8階段防禦的藥水	8階段防禦的藥水 x25、石榴石 x1
110	提高 9階段防禦的藥水	9階段防禦的藥水 x25、黑暗水晶 x1
120	提高 10階段防禦的藥水	10階段防禦的藥水 x25、鋰 x1
30	1階段攻擊力的藥水	薰衣草花精油 x3、下級藥水空瓶 x3、下級物品結晶 x10
50	2階段攻擊力的藥水	柑橘花精油 x3、中級物品結晶 x10、中級藥水空瓶 x3、褐色魔法粉 x3
70	3階段攻擊力的藥水	茉莉花種子精油 x3、中級藥水空瓶 x3、中級物品結晶 x10、黃色魔法粉 x3
90	4階段攻擊力的藥水	洋甘菊種子精油 x3、高級物品結晶 x10、高級藥水空瓶 x3、紅色魔法粉 x3
110	5階段攻擊力的藥水	杜松花精油 x3、最高級物品結晶 x10、最高級藥水空瓶 x3、黑色魔法粉 x3
30	提高 1階段攻擊力的藥水	1階段攻擊力的藥水 x3、紫水晶 x2
50	提高 2階段攻擊力的藥水	2階段攻擊力的藥水 x3、青銅 x2
70	提高 3階段攻擊力的藥水	3階段攻擊力的藥水 x3、黃晶 x2
90	提高 4階段攻擊力的藥水	4階段攻擊力的藥水 x3、力量水晶 x2
110	提高 5階段攻擊力的藥水	5階段攻擊力的藥水 x3、幸運水晶 x2
30	1階段魔力的藥水	薰衣草種子精油 x3、下級藥水空瓶 x3、下級物品結晶 x10
50	2階段魔力的藥水	迷迭香花精油 x3、中級物品結晶 x10、中級藥水空瓶 x3、褐色魔法粉 x3
70	3階段魔力的藥水	茉莉花精油 x3、中級藥水空瓶 x3、中級物品結晶 x10、黃色魔法粉 x3
90	4階段魔力的藥水	洋甘菊精油 x3、高級物品結晶 x10、高級藥水空瓶 x3、紅色魔法粉 x3
110	5階段魔力的藥水	牛膝草花精油 x3、最高級物品結晶 x10、最高級藥水空瓶 x3、黑色魔法粉 x3
30	提高 1階段魔力的藥水	1階段魔力的藥水 x3、紫水晶 x2
50	提高 2階段魔力的藥水	2階段魔力的藥水 x3、青銅 x2
70	提高 3階段魔力的藥水	3階段魔力的藥水 x3、黃晶 x2
90	提高 4階段魔力的藥水	4階段魔力的藥水 x3、力量水晶 x2
110	提高 5階段魔力的藥水	5階段魔力的藥水 x3、幸運水晶 x2
30	1階段力量的藥丸	1階段力量的藥水 x5、下級藥水凝固劑 x5
40	2階段力量的藥丸	2階段力量的藥水 x5、下級藥水凝固劑 x5
50	3階段力量的藥丸	3階段力量的藥水 x5、下級藥水凝固劑 x5
60	4階段力量的藥丸	4階段力量的藥水 x5、中級藥水凝固劑 x5
70	5階段力量的藥丸	5階段力量的藥水 x5、中級藥水凝固劑 x5
80	6階段力量的藥丸	6階段力量的藥水 x5、中級藥水凝固劑 x5
90	7階段力量的藥丸	7階段力量的藥水 x5、高級藥水凝固劑 x5
100	8階段力量的藥丸	8階段力量的藥水 x5、高級藥水凝固劑 x5
110	9階段力量的藥丸	9階段力量的藥水 x5、高級藥水凝固劑 x5
120	10階段力量的藥丸	10階段力量的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段力量的藥丸	提高 1階段力量的藥水 x5、下級藥水凝固劑 x5
40	提高 2階段力量的藥丸	提高 2階段力量的藥水 x5、下級藥水凝固劑 x5
50	提高 3階段力量的藥丸	提高 3階段力量的藥水 x5、下級藥水凝固劑 x5
60	提高 4階段力量的藥丸	提高 4階段力量的藥水 x5、中級藥水凝固劑 x5
70	提高 5階段力量的藥丸	提高 5階段力量的藥水 x5、中級藥水凝固劑 x5
80	提高 6階段力量的藥丸	提高 6階段力量的藥水 x5、中級藥水凝固劑 x5
90	提高 7階段力量的藥丸	提高 7階段力量的藥水 x5、高級藥水凝固劑 x5
100	提高 8階段力量的藥丸	提高 8階段力量的藥水 x5、高級藥水凝固劑 x5
110	提高 9階段力量的藥丸	提高 9階段力量的藥水 x5、高級藥水凝固劑 x5
120	提高 10階段力量的藥丸	提高 10階段力量的藥水 x5、最高級藥水凝固劑 x5
30	1階段敏捷藥丸	1階段敏捷的藥水 x5、下級藥水凝固劑 x5
40	2階段敏捷藥丸	2階段敏捷的藥水 x5、下級藥水凝固劑 x5
50	3階段敏捷藥丸	3階段敏捷的藥水 x5、下級藥水凝固劑 x5
60	4階段敏捷藥丸	4階段敏捷的藥水 x5、中級藥水凝固劑 x5
70	5階段敏捷藥丸	5階段敏捷的藥水 x5、中級藥水凝固劑 x5
80	6階段敏捷藥丸	6階段敏捷的藥水 x5、中級藥水凝固劑 x5
90	7階段敏捷藥丸	7階段敏捷的藥水 x5、高級藥水凝固劑 x5
100	8階段敏捷藥丸	8階段敏捷的藥水 x5、高級藥水凝固劑 x5
110	9階段敏捷藥丸	9階段敏捷的藥水 x5、高級藥水凝固劑 x5
120	10階段敏捷藥丸	10階段敏捷的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段敏捷藥丸	提高 1階段敏捷的藥水 x5、下級藥水凝固劑 x5
40	提高 2階段敏捷藥丸	提高 2階段敏捷的藥水 x5、下級藥水凝固劑 x5
50	提高 3階段敏捷藥丸	提高 3階段敏捷的藥水 x5、下級藥水凝固劑 x5
60	提高 4階段敏捷藥丸	提高 4階段敏捷的藥水 x5、中級藥水凝固劑 x5
70	提高 5階段敏捷藥丸	提高 5階段敏捷的藥水 x5、中級藥水凝固劑 x5
80	提高 6階段敏捷藥丸	提高 6階段敏捷的藥水 x5、中級藥水凝固劑 x5
90	提高 7階段敏捷藥丸	提高 7階段敏捷的藥水 x5、高級藥水凝固劑 x5
100	提高 8階段敏捷藥丸	提高 8階段敏捷的藥水 x5、高級藥水凝固劑 x5
110	提高 9階段敏捷藥丸	提高 9階段敏捷的藥水 x5、高級藥水凝固劑 x5
120	提高 10階段敏捷藥丸	提高 10階段敏捷的藥水 x5、最高級藥水凝固劑 x5
30	1階段智能藥丸	1階段智能的藥水 x5、下級藥水凝固劑 x5
40	2階段智能藥丸	2階段智能的藥水 x5、下級藥水凝固劑 x5
50	3階段智能藥丸	3階段智能的藥水 x5、下級藥水凝固劑 x5
60	4階段智能藥丸	4階段智能的藥水 x5、中級藥水凝固劑 x5
70	5階段智能藥丸	5階段智能的藥水 x5、中級藥水凝固劑 x5
80	6階段智能藥丸	6階段智能的藥水 x5、中級藥水凝固劑 x5
90	7階段智能藥丸	7階段智能的藥水 x5、高級藥水凝固劑 x5
100	8階段智能藥丸	8階段智能的藥水 x5、高級藥水凝固劑 x5
110	9階段智能藥丸	9階段智能的藥水 x5、高級藥水凝固劑 x5
120	10階段智能藥丸	10階段智能的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段智能藥丸	提高 1階段智能的藥水 x5、下級藥水凝固劑 x5
40	提高 2階段智能藥丸	提高 2階段智能的藥水 x5、下級藥水凝固劑 x5
50	提高 3階段智能藥丸	提高 3階段智能的藥水 x5、下級藥水凝固劑 x5
60	提高 4階段智能藥丸	提高 4階段智能的藥水 x5、中級藥水凝固劑 x5
70	提高 5階段智能藥丸	提高 5階段智能的藥水 x5、中級藥水凝固劑 x5
80	提高 6階段智能藥丸	提高 6階段智能的藥水 x5、中級藥水凝固劑 x5
90	提高 7階段智能藥丸	提高 7階段智能的藥水 x5、高級藥水凝固劑 x5
100	提高 8階段智能藥丸	提高 8階段智能的藥水 x5、高級藥水凝固劑 x5
110	提高 9階段智能藥丸	提高 9階段智能的藥水 x5、高級藥水凝固劑 x5
120	提高 10階段智能藥丸	提高 10階段智能的藥水 x5、最高級藥水凝固劑 x5
30	1階段幸運藥丸	1階段幸運的藥水 x5、下級藥水凝固劑 x5
40	2階段幸運藥丸	2階段幸運的藥水 x5、下級藥水凝固劑 x5
50	3階段幸運藥丸	3階段幸運的藥水 x5、下級藥水凝固劑 x5
60	4階段幸運藥丸	4階段幸運的藥水 x5、中級藥水凝固劑 x5
70	5階段幸運藥丸	5階段幸運的藥水 x5、中級藥水凝固劑 x5
80	6階段幸運藥丸	6階段幸運的藥水 x5、中級藥水凝固劑 x5
90	7階段幸運藥丸	7階段幸運的藥水 x5、高級藥水凝固劑 x5
100	8階段幸運藥丸	8階段幸運的藥水 x5、高級藥水凝固劑 x5
110	9階段幸運藥丸	9階段幸運的藥水 x5、高級藥水凝固劑 x5
120	10階段幸運藥丸	10階段幸運的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段幸運藥丸	提高 1階段幸運的藥水 x5、下級藥水凝固劑 x5
40	提高 2階段幸運藥丸	提高 2階段幸運的藥水 x5、下級藥水凝固劑 x5
50	提高 3階段幸運藥丸	提高 3階段幸運的藥水 x5、下級藥水凝固劑 x5
60	提高 4階段幸運藥丸	提高 4階段幸運的藥水 x5、中級藥水凝固劑 x5
70	提高 5階段幸運藥丸	提高 5階段幸運的藥水 x5、中級藥水凝固劑 x5
80	提高 6階段幸運藥丸	提高 6階段幸運的藥水 x5、中級藥水凝固劑 x5
90	提高 7階段幸運藥丸	提高 7階段幸運的藥水 x5、高級藥水凝固劑 x5
100	提高 8階段幸運藥丸	提高 8階段幸運的藥水 x5、高級藥水凝固劑 x5
110	提高 9階段幸運藥丸	提高 9階段幸運的藥水 x5、高級藥水凝固劑 x5
120	提高 10階段幸運藥丸	提高 10階段幸運的藥水 x5、最高級藥水凝固劑 x5
30	1階段防禦藥丸	1階段防禦的藥水 x5、下級藥水凝固劑 x5
40	2階段防禦藥丸	2階段防禦的藥水 x5、下級藥水凝固劑 x5
50	3階段防禦藥丸	3階段防禦的藥水 x5、下級藥水凝固劑 x5
60	4階段防禦藥丸	4階段防禦的藥水 x5、中級藥水凝固劑 x5
70	5階段防禦藥丸	5階段防禦的藥水 x5、中級藥水凝固劑 x5
80	6階段防禦藥丸	6階段防禦的藥水 x5、中級藥水凝固劑 x5
90	7階段防禦藥丸	7階段防禦的藥水 x5、高級藥水凝固劑 x5
100	8階段防禦藥丸	8階段防禦的藥水 x5、高級藥水凝固劑 x5
110	9階段防禦藥丸	9階段防禦的藥水 x5、高級藥水凝固劑 x5
120	10階段防禦藥丸	10階段防禦的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段防禦藥丸	提高 1階段防禦的藥水 x5、下級藥水凝固劑 x5
40	提高 2階段防禦藥丸	提高 2階段防禦的藥水 x5、下級藥水凝固劑 x5
50	提高 3階段防禦藥丸	提高 3階段防禦的藥水 x5、下級藥水凝固劑 x5
60	提高 4階段防禦藥丸	提高 4階段防禦的藥水 x5、中級藥水凝固劑 x5
70	提高 5階段防禦藥丸	提高 5階段防禦的藥水 x5、中級藥水凝固劑 x5
80	提高 6階段防禦藥丸	提高 6階段防禦的藥水 x5、中級藥水凝固劑 x5
90	提高 7階段防禦藥丸	提高 7階段防禦的藥水 x5、高級藥水凝固劑 x5
100	提高 8階段防禦藥丸	提高 8階段防禦的藥水 x5、高級藥水凝固劑 x5
110	提高 9階段防禦藥丸	提高 9階段防禦的藥水 x5、高級藥水凝固劑 x5
120	提高 10階段防禦藥丸	提高 10階段防禦的藥水 x5、最高級藥水凝固劑 x5
30	1階段攻擊力藥丸	1階段攻擊力的藥水 x5、下級藥水凝固劑 x5
50	2階段攻擊力藥丸	2階段攻擊力的藥水 x5、中級藥水凝固劑 x5
70	3階段攻擊力藥丸	3階段攻擊力的藥水 x5、中級藥水凝固劑 x5
90	4階段攻擊力藥丸	4階段攻擊力的藥水 x5、高級藥水凝固劑 x5
110	5階段攻擊力藥丸	5階段攻擊力的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段攻擊力藥丸	提高 1階段攻擊力的藥水 x5、下級藥水凝固劑 x5
50	提高 2階段攻擊力藥丸	提高 2階段攻擊力的藥水 x5、中級藥水凝固劑 x5
70	提高 3階段攻擊力藥丸	提高 3階段攻擊力的藥水 x5、中級藥水凝固劑 x5
90	提高 4階段攻擊力藥丸	提高 4階段攻擊力的藥水 x5、高級藥水凝固劑 x5
110	提高 5階段攻擊力藥丸	提高 5階段攻擊力的藥水 x5、最高級藥水凝固劑 x5
30	1階段魔力藥丸	1階段魔力的藥水 x5、下級藥水凝固劑 x5
50	2階段魔力藥丸	2階段魔力的藥水 x5、中級藥水凝固劑 x5
70	3階段魔力藥丸	3階段魔力的藥水 x5、中級藥水凝固劑 x5
90	4階段魔力藥丸	4階段魔力的藥水 x5、高級藥水凝固劑 x5
110	5階段魔力藥丸	5階段魔力的藥水 x5、最高級藥水凝固劑 x5
30	提高 1階段魔力藥丸	提高 1階段魔力的藥水 x5、下級藥水凝固劑 x5
50	提高 2階段魔力藥丸	提高 2階段魔力的藥水 x5、中級藥水凝固劑 x5
70	提高 3階段魔力藥丸	提高 3階段魔力的藥水 x5、中級藥水凝固劑 x5
90	提高 4階段魔力藥丸	提高 4階段魔力的藥水 x5、高級藥水凝固劑 x5
110	提高 5階段魔力藥丸	提高 5階段魔力的藥水 x5、最高級藥水凝固劑 x5

分解機器
中級分解機	中級物品結晶 x10、薄荷花精油 x2、藍色魔法粉 x3
高級分解機	高級物品結晶 x10、牛膝草花精油 x2、黃色魔法粉 x3
下級分解機	下級物品結晶 x10、墨角蘭種子精油 x2、墨角蘭花精油 x2
方塊分解機	高級物品結晶 x10、牛膝草花精油 x2、黃色魔法粉 x3
卷軸分解機	最高級物品結晶 x20、牛膝草花精油 x5、下級咒文精隨 x10、魔力結晶 x10、黃色魔法粉 x8

背包
匠人	植物用的8格背包	廣藿香種子精油 x15、洋甘菊精油 x15、黃昏的精隨 x1、魔力結晶 x15
匠人	礦物用的8格背包	中級物品結晶 x15、廣藿香精油 x10、黃昏的精隨 x1、魔力結晶 x15
匠人	植物用的10格背包	植物用的8格背包 x1、廣藿香精油 x15、黃昏的精隨 x3、魔力結晶 x30
匠人	礦物用的10格背包	礦物用的8格背包 x1、高級物品結晶 x25、黃昏的精隨 x3、魔力結晶 x30
名匠	植物用的12格背包	植物用的10格背包 x1、牛膝草花精油 x10、鮮明黃昏的精華 x1、魔力結晶 x50
名匠	礦物用的12格背包	礦物用的10格背包 x1、最高級物品結晶 x10、鮮明黃昏的精華 x1、魔力結晶 x50
名匠	粉紅色硬幣錢包	賢者之石 x10、上級咒文精隨 x5、鮮明黃昏的精華 x1、魔力結晶 x50
`

  const categories = ['秘藥', '變身藥水', '恢復藥水跟藥丸', 'BUFF藥水跟藥丸', '分解機器', '背包']
  const categorySet = new Set(categories)
  const prices = ref({})
  const quantities = ref({})
  const searchText = ref('')
  const selectedCategory = ref('')
  const expandCraftables = ref(true)
  const importMessage = ref('')

  function cleanName(name) {
    return String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace('紫色魔粉', '紫色魔法粉')
      .replace(/^杜松種子精油$/, '杜松的種子精油')
  }

  function keyOf(name) {
    return cleanName(name).replace(/\s+/g, '')
  }

  function parseMaterial(part) {
    const m = String(part).trim().match(/^(.+?)\s*x\s*([0-9.]+)$/i)
    if (!m) return null
    return { name: cleanName(m[1]), qty: Number(m[2]) || 0 }
  }

  function isRecipeStart(line, category) {
    const parts = line.split(/\t+/).map(p => p.trim()).filter(Boolean)
    if (parts.length >= 3 && /^(\d+|匠人|名匠)$/.test(parts[0])) return true
    if (category === '分解機器' && parts.length >= 2 && !/\sx\s*\d+/i.test(parts[0])) return true
    return false
  }

  function parseRecipe(line, category, index) {
    const parts = line.split(/\t+/).map(p => p.trim()).filter(Boolean)
    let level = ''
    let name = ''
    let materialText = ''
    if (parts.length >= 3 && /^(\d+|匠人|名匠)$/.test(parts[0])) {
      level = parts[0]
      name = cleanName(parts[1])
      materialText = parts.slice(2).join('')
    } else if (category === '分解機器' && parts.length >= 2) {
      name = cleanName(parts[0])
      materialText = parts.slice(1).join('')
    }
    const materials = materialText.split('、').map(parseMaterial).filter(Boolean)
    return { id: `${category}-${index}`, category, level, name, materials }
  }

  function parseRecipes(raw) {
    const recipes = []
    let category = ''
    let buffer = ''
    let index = 0
    function flush() {
      if (!buffer) return
      const recipe = parseRecipe(buffer, category, index++)
      if (recipe.name && recipe.materials.length) recipes.push(recipe)
      buffer = ''
    }
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line === '鍊金術') continue
      if (categorySet.has(line)) {
        flush()
        category = line
        continue
      }
      if (isRecipeStart(line, category)) {
        flush()
        buffer = line
      } else if (buffer) {
        buffer += /x\s*\d+$/i.test(buffer) && /^.+?\s*x\s*\d+/i.test(line) ? `、${line}` : line
      }
    }
    flush()
    return recipes
  }

  const recipes = parseRecipes(ALCHEMY_RAW)
  const recipeByKey = new Map(recipes.map(r => [keyOf(r.name), r]))

  const filteredRecipes = computed(() => {
    const q = keyOf(searchText.value)
    return recipes.filter(r => {
      if (selectedCategory.value && r.category !== selectedCategory.value) return false
      if (!q) return true
      return keyOf(`${r.name} ${r.category} ${r.level}`).includes(q)
    })
  })

  function unitPrice(name) {
    const v = prices.value[cleanName(name)]
    return Number(v) || 0
  }

  function recipeCost(recipe, stack = new Set()) {
    if (!recipe || stack.has(keyOf(recipe.name))) return 0
    stack.add(keyOf(recipe.name))
    const total = recipe.materials.reduce((sum, mat) => {
      const child = recipeByKey.get(keyOf(mat.name))
      const cost = expandCraftables.value && child
        ? recipeCost(child, stack)
        : unitPrice(mat.name)
      return sum + cost * mat.qty
    }, 0)
    stack.delete(keyOf(recipe.name))
    return total
  }

  function addRecipe(name, delta) {
    const next = Math.max(0, (Number(quantities.value[name]) || 0) + delta)
    quantities.value[name] = next || undefined
  }

  function addMaterial(map, name, qty) {
    const displayName = cleanName(name)
    if (!map.has(displayName)) map.set(displayName, { name: displayName, qty: 0 })
    map.get(displayName).qty += qty
  }

  function materialRowsFromMap(map) {
    return Array.from(map.values())
      .map(row => ({
        ...row,
        price: unitPrice(row.name),
        subtotal: row.qty * unitPrice(row.name),
        isOil: /精油$/.test(row.name),
      }))
      .sort((a, b) => b.subtotal - a.subtotal || a.name.localeCompare(b.name, 'zh-Hant'))
  }

  function addRecipeMaterials(map, recipe, times, stack = new Set()) {
    if (!recipe || stack.has(keyOf(recipe.name))) return
    stack.add(keyOf(recipe.name))
    for (const mat of recipe.materials) {
      const child = recipeByKey.get(keyOf(mat.name))
      if (expandCraftables.value && child) addRecipeMaterials(map, child, times * mat.qty, stack)
      else addMaterial(map, mat.name, times * mat.qty)
    }
    stack.delete(keyOf(recipe.name))
  }

  const selectedRecipes = computed(() =>
    recipes
      .map(recipe => ({ recipe, qty: Number(quantities.value[recipe.name]) || 0 }))
      .filter(row => row.qty > 0)
  )

  const materialRows = computed(() => {
    const map = new Map()
    for (const row of selectedRecipes.value) addRecipeMaterials(map, row.recipe, row.qty)
    return materialRowsFromMap(map)
  })

  const categoryMaterialGroups = computed(() => {
    const groups = new Map()
    for (const row of selectedRecipes.value) {
      const category = row.recipe.category || '未分類'
      if (!groups.has(category)) {
        groups.set(category, {
          category,
          recipeCount: 0,
          craftQty: 0,
          map: new Map(),
        })
      }
      const group = groups.get(category)
      group.recipeCount += 1
      group.craftQty += row.qty
      addRecipeMaterials(group.map, row.recipe, row.qty)
    }
    return Array.from(groups.values())
      .map(group => {
        const materials = materialRowsFromMap(group.map)
        return {
          category: group.category,
          recipeCount: group.recipeCount,
          craftQty: group.craftQty,
          materials,
          totalCost: materials.reduce((sum, row) => sum + row.subtotal, 0),
        }
      })
      .sort((a, b) => b.totalCost - a.totalCost || a.category.localeCompare(b.category, 'zh-Hant'))
  })

  const totalCost = computed(() => materialRows.value.reduce((sum, row) => sum + row.subtotal, 0))

  function selectedRecipeCost(recipeName) {
    const recipe = recipeByKey.get(keyOf(recipeName))
    return recipeCost(recipe)
  }

  function formatQty(n) {
    return Number.isInteger(n) ? String(n) : Number(n).toFixed(2)
  }

  function formatCost(n) {
    const v = Number(n) || 0
    return Math.round(v).toLocaleString('zh-TW')
  }

  function clearQuantities() {
    quantities.value = {}
  }

  function clearPrices() {
    prices.value = {}
  }

  function exportState() {
    const payload = {
      type: 'maple_alchemy_cost_settings',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: getState(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maple_alchemy_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    importMessage.value = '已匯出鍊金價格與製作數'
    setTimeout(() => { importMessage.value = '' }, 2500)
  }

  function importStateFile(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        const state = data.state || data
        setState(state)
        importMessage.value = '已匯入鍊金價格與製作數'
      } catch {
        importMessage.value = '匯入失敗：JSON 格式不正確'
      }
      setTimeout(() => { importMessage.value = '' }, 3000)
    }
    reader.readAsText(file, 'utf-8')
    event.target.value = ''
  }

  function getState() {
    return {
      prices: JSON.parse(JSON.stringify(prices.value)),
      quantities: JSON.parse(JSON.stringify(quantities.value)),
      selectedCategory: selectedCategory.value,
      searchText: searchText.value,
      expandCraftables: expandCraftables.value,
    }
  }

  function setState(state) {
    if (!state) return
    prices.value = state.prices || {}
    quantities.value = state.quantities || {}
    selectedCategory.value = state.selectedCategory || ''
    searchText.value = state.searchText || ''
    expandCraftables.value = state.expandCraftables !== false
  }

  return {
    recipes,
    categories,
    prices,
    quantities,
    searchText,
    selectedCategory,
    expandCraftables,
    importMessage,
    filteredRecipes,
    selectedRecipes,
    materialRows,
    categoryMaterialGroups,
    totalCost,
    recipeCost,
    selectedRecipeCost,
    addRecipe,
    formatQty,
    formatCost,
    clearQuantities,
    clearPrices,
    exportState,
    importStateFile,
    getState,
    setState,
  }
}
