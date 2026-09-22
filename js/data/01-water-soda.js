/* 水 / 碳酸 —— 饮库数据分册 1 */
(function () {

  /* ============================ 水 ============================ */
  B({ id:'nfsq-natural', n:'农夫山泉（饮用天然水）', b:'农夫山泉', en:'Nongfu Spring', c:'水', sg:0, s:0, sw:0, ml:550, pk:'550ml 瓶', p:2, pop:5, ph:1, ice:'same', note:'红盖经典款，矿物质含量低，口感偏软。评论区里被写成「农夫三拳」「弄夫山泉」。' });
  B({ id:'nfsq-soda', n:'农夫山泉苏打天然水', b:'农夫山泉', c:'水', sg:0.4, s:0.5, sw:1, sub:'', kc:0, cb:2, fd:1, ml:500, pk:'500ml 瓶', p:5, pop:3, ph:3, ice:'better', note:'白桃/柠檬味，微甜带气。按用户口径本次统计归入矿泉水系。' });
  B({ id:'cestbon', n:'怡宝纯净水', b:'华润怡宝', en:'C\'estbon', c:'水', sg:0, s:0, sw:0, ml:555, pk:'555ml 瓶', p:2, pop:5, ph:1, ice:'same', note:'绿瓶纯净水，口感比矿泉水更「空」。评论区有人明确说「不要怡宝，不好喝」。' });
  B({ id:'wahaha-water', n:'娃哈哈纯净水', b:'娃哈哈', c:'水', sg:0, s:0, sw:0, ml:596, pk:'596ml 瓶', p:2, pop:5, ph:1, ice:'same', note:'王力宏代言时代的国民水。' });
  B({ id:'ganten', n:'百岁山矿泉水', b:'景田百岁山', c:'水', sg:0, s:0, sw:0, ml:570, pk:'570ml 瓶', p:3, pop:5, ph:1, ice:'same', note:'偏硅酸矿泉水，宣称「水中贵族」。' });
  B({ id:'evergrande-spring', n:'恒大冰泉', b:'恒大', c:'水', sg:0, s:0, sw:0, ml:500, pk:'500ml 瓶', p:3, pop:3, ph:1, ice:'same', note:'长白山深层矿泉水。' });
  B({ id:'kunlun-mountain', n:'昆仑山雪山矿泉水', b:'加多宝', c:'水', sg:0, s:0, sw:0, ml:510, pk:'510ml 瓶', p:5, pop:3, ph:1, ice:'same', note:'高海拔水源，价格偏高。' });
  B({ id:'ice-dew', n:'冰露', b:'可口可乐', c:'水', sg:0, s:0, sw:0, ml:550, pk:'550ml 瓶', p:1.5, pop:4, ph:1, ice:'same', note:'便宜量大，便利店最常见的低价水。' });
  B({ id:'coca-pure', n:'纯水乐', b:'可口可乐', c:'水', sg:0, s:0, sw:0, ml:550, pk:'550ml 瓶', p:2, pop:3, ph:1, ice:'same', note:'可口可乐旗下纯净水。' });
  B({ id:'master-kong-water', n:'康师傅饮用水', b:'康师傅', c:'水', sg:0, s:0, sw:0, ml:550, pk:'550ml 瓶', p:1.5, pop:4, ph:1, ice:'same', note:'日常办公桌上的常客。' });
  B({ id:'watsons-distilled', n:'屈臣氏蒸馏水', b:'屈臣氏', c:'水', sg:0, s:0, sw:0, ml:400, pk:'400ml 瓶', p:3, pop:3, ph:0, ice:'same', note:'真正意义上的「一氧化二氢」，评论区玩梗常客。' });
  B({ id:'liangbaikai', n:'凉白开', b:'今麦郎', c:'水', sg:0, s:0, sw:0, ml:500, pk:'500ml 瓶', p:2, pop:4, ph:1, ice:'same', note:'把「家裏烧开放凉的水」做成了瓶装商品。评论区高频答案。' });
  B({ id:'boiled-water', n:'白开水（自家烧）', b:'—', c:'水', sg:0, s:0, sw:0, ml:300, pk:'随便一个杯子', p:0, pop:5, ph:1, ice:'same', note:'评论区提及次数第一（27 次）。想加甜味就自己丢一颗冰糖。' });
  B({ id:'mineral-generic', n:'矿泉水（泛指）', b:'—', c:'水', sg:0, s:0, sw:0, ml:550, pk:'瓶装', p:2, pop:5, ph:1, ice:'same', note:'评论区 11 次直接回答「矿泉水」。「沃特」「一氧化二氢」「h20」都指这个。' });
  B({ id:'purified-generic', n:'纯净水（泛指）', b:'—', c:'水', sg:0, s:0, sw:0, ml:550, pk:'瓶装', p:2, pop:5, ph:1, ice:'same', note:'与矿泉水常被混为一谈，实际去掉了矿物质。' });
  B({ id:'distilled-generic', n:'蒸馏水（泛指）', b:'—', c:'水', sg:0, s:0, sw:0, ml:500, pk:'瓶装', p:3, pop:2, ph:0, ice:'same', note:'几乎只有 H₂O，口感最「空」。' });
  B({ id:'soda-generic', n:'苏打水（泛指）', b:'—', c:'水', sg:0, s:0, sw:0.5, sub:'', cb:1, fd:0, ml:410, pk:'410ml 瓶', p:3, pop:4, ph:3, ice:'better', note:'评论区 10 次提到，是本次统计最大的分歧点：有人强调「大多 0 糖」，也有人明确说「苏打气泡水无糖有气」。' });
  B({ id:'sparkling-generic', n:'气泡水（泛指）', b:'—', c:'水', sg:0, s:0, sw:0, sub:'', cb:4, fd:2, ml:500, pk:'500ml 瓶', p:5, pop:3, ph:4, ice:'better', note:'0 糖 0 卡，但气是真的。' });
  B({ id:'perrier', n:'巴黎水', b:'雀巢', en:'Perrier', c:'水', sg:0, s:0, sw:0, cb:5, fd:3, ml:330, pk:'330ml 玻璃瓶', p:12, pop:3, ph:5, ice:'better', note:'气泡极强，绿玻璃瓶是它的标志。' });
  B({ id:'sanpellegrino', n:'圣培露', b:'雀巢', en:'San Pellegrino', c:'水', sg:0, s:0, sw:0, cb:4, fd:2, ml:500, pk:'500ml 玻璃瓶', p:15, pop:2, ph:4, ice:'better', note:'意式天然气泡矿泉水，佐餐常见。' });
  B({ id:'watsons-soda', n:'屈臣氏苏打水', b:'屈臣氏', c:'水', sg:0, s:0, sw:0.5, cb:3, fd:1, ml:330, pk:'330ml 罐', p:5, pop:3, ph:4, ice:'better', note:'评论区有人推荐，也有人吐槽「就是有点难喝」。' });
  B({ id:'wahaha-soda', n:'娃哈哈苏打水', b:'娃哈哈', c:'水', sg:0, s:0, sw:1, cb:1, fd:0, ml:350, pk:'350ml 瓶', p:3, pop:3, ph:3, ice:'better', note:'微甜型苏打水，甜味来自代糖。' });
  B({ id:'yineng-soda', n:'依能苏打水', b:'依能', c:'水', sg:0, s:0, sw:1, cb:2, fd:1, ml:500, pk:'500ml 瓶', p:1.5, pop:2, ph:3, ice:'better', note:'评论区提到「八毛一瓶」，胜在便宜。' });
  B({ id:'wangwu-soda', n:'王屋苏打水', b:'王屋', c:'水', sg:0, s:0, sw:1.5, cb:2, fd:1, ml:500, pk:'500ml 瓶', p:4, pop:2, ph:3, ice:'better', note:'无糖微甜，有柠檬和蜜桃味。' });
  B({ id:'yiquan-soda', n:'怡泉无糖苏打水', b:'可口可乐', en:'Schweppes', c:'水', sg:0, s:0, sw:1, cb:3, fd:1, ml:330, pk:'330ml 罐', p:5, pop:3, ph:4, ice:'better', note:'评论区提到「叫什么怡泉无糖的那款」。' });
  B({ id:'guangxi-tianran', n:'百得利天然苏打水', b:'百得利', c:'水', sg:0, s:0, sw:0.5, cb:2, fd:1, ml:500, pk:'500ml 瓶', p:6, pop:1, ph:4, ice:'better', note:'天然含气水源地装瓶。' });

  /* ============================ 碳酸 ============================ */
  B({ id:'coke-classic', n:'可口可乐（经典）', b:'可口可乐', en:'Coca-Cola Classic', c:'碳酸', sg:10.6, s:4.5, sw:4.5, sub:'', kc:42, cb:5, fd:2, ml:330, pk:'330ml 罐 / 500ml 瓶', p:3.5, pop:5, ph:5, ice:'better', cf:10, hfcs:1, note:'甜度标杆，冰镇后甜感更利落。开盖放一天基本没气，糖还在。' });
  B({ id:'coke-zero', n:'零度可口可乐', b:'可口可乐', en:'Coca-Cola Zero', c:'碳酸', sg:0, s:0, sw:4, sub:'阿斯巴甜+安赛蜜', at:2, kc:0.3, cb:5, fd:2, ml:330, pk:'330ml 罐 / 500ml 瓶', p:3.5, pop:5, ph:5, ice:'better', cf:10, note:'评论区高频答案。0 糖、气足，但阿斯巴甜的后味有人受不了。' });
  B({ id:'coke-diet', n:'健怡可口可乐', b:'可口可乐', en:'Diet Coke', c:'碳酸', sg:0, s:0, sw:4, sub:'阿斯巴甜', at:2.5, kc:0.2, cb:5, fd:2, ml:330, pk:'330ml 罐', p:4, pop:2, ph:5, ice:'better', cf:12, note:'比零度更「薄」一点，国内铺货不如零度。' });
  B({ id:'pepsi-classic', n:'百事可乐（经典）', b:'百事', en:'Pepsi', c:'碳酸', sg:10.9, s:5, sw:5, kc:43, cb:5, fd:2, ml:500, pk:'500ml 瓶 / 330ml 罐', p:3.5, pop:5, ph:5, ice:'better', cf:10, hfcs:1, note:'比可口可乐更甜、更「冲」。' });
  B({ id:'pepsi-zero', n:'百事无糖可乐', b:'百事', en:'Pepsi Zero Sugar', c:'碳酸', sg:0, s:0, sw:4, sub:'阿斯巴甜+安赛蜜', at:2, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:4, ph:5, ice:'better', cf:11, note:'无糖版百事，气泡感比零度略强。' });
  B({ id:'sprite', n:'雪碧', b:'可口可乐', en:'Sprite', c:'碳酸', sg:10.1, s:4.5, sw:4.5, kc:41, cb:5, fd:2, ml:500, pk:'500ml 瓶 / 330ml 罐', p:3.5, pop:5, ph:5, ice:'better', hfcs:1, note:'柠檬味，无咖啡因。冰镇后清爽度提升明显。' });
  B({ id:'sprite-zero', n:'无糖雪碧', b:'可口可乐', en:'Sprite Zero', c:'碳酸', sg:0, s:0, sw:4, sub:'阿斯巴甜+安赛蜜', at:1.5, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:4, ph:5, ice:'better', note:'评论区有人说「拧开之后等一晚上」再喝。' });
  B({ id:'fanta-orange', n:'芬达橙味', b:'可口可乐', en:'Fanta Orange', c:'碳酸', sg:10.5, s:4.5, sw:5, kc:43, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:5, ph:5, ice:'better', hfcs:1, note:'橙味浓，甜度高。' });
  B({ id:'fanta-zero', n:'无糖芬达', b:'可口可乐', c:'碳酸', sg:0, s:0, sw:4, sub:'阿斯巴甜+安赛蜜', at:1.5, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:3, ph:5, ice:'better', note:'评论区出现 4 次，多人称「喝着跟有糖的没区别」「冷冻后一模一样」。' });
  B({ id:'sevenup', n:'七喜', b:'百事', en:'7Up', c:'碳酸', sg:10.2, s:4.5, sw:4.5, kc:41, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:4, ph:5, ice:'better', hfcs:1, note:'与雪碧同类，柠檬青柠味。' });
  B({ id:'mirinda', n:'美年达', b:'百事', en:'Mirinda', c:'碳酸', sg:10.4, s:4.5, sw:5, kc:42, cb:5, fd:2, ml:500, pk:'500ml 瓶', p:3.5, pop:4, ph:5, ice:'better', hfcs:1, note:'口味花色多，橙味最常见。' });
  B({ id:'genki-sparkling', n:'元气森林气泡水', b:'元气森林', c:'碳酸', sg:0, s:0, sw:3, sub:'赤藓糖醇', at:1, kc:0, cb:5, fd:3, ml:480, pk:'480ml 瓶', p:5.5, pop:5, ph:5, ice:'better', note:'评论区常被当「无糖」推荐（5 次）。确实 0 糖，但气一点没少。气泡比可乐细密、留存更久。' });
  B({ id:'genki-ice-tea-spark', n:'元气森林燃茶（气泡）', b:'元气森林', c:'碳酸', sg:0, s:0, sw:2.5, sub:'赤藓糖醇', at:1, cb:4, fd:2, ml:500, pk:'500ml 瓶', p:6, pop:3, ph:4, ice:'better', tea:1, note:'0 糖带气的茶，兼具两种特征。' });
  B({ id:'beibingyang', n:'北冰洋汽水', b:'北冰洋', c:'碳酸', sg:9.5, s:4.5, sw:4.5, kc:40, cb:5, fd:2, ml:248, pk:'248ml 玻璃瓶', p:6, pop:3, ph:5, ice:'better', note:'北京人的橘子汽水，玻璃瓶情怀加分。' });
  B({ id:'bingfeng', n:'冰峰汽水', b:'冰峰', c:'碳酸', sg:9.8, s:4.5, sw:4.5, kc:41, cb:5, fd:2, ml:200, pk:'200ml 玻璃瓶', p:4, pop:2, ph:5, ice:'better', note:'西安「三秦套餐」固定成员。' });
  B({ id:'dayao', n:'大窑嘉宾', b:'大窑', c:'碳酸', sg:8.5, s:4, sw:4, kc:36, cb:5, fd:2, ml:520, pk:'520ml 瓶', p:5, pop:4, ph:4, ice:'better', note:'内蒙古来的大瓶汽水，量大便宜，餐饮渠道强势。' });
  B({ id:'jianlibao', n:'健力宝（经典橙蜜）', b:'健力宝', c:'碳酸', sg:8.8, s:4, sw:4, kc:37, cb:4, fd:1.5, ml:560, pk:'560ml 瓶', p:4, pop:4, ph:4, ice:'better', note:'中国电解质饮料鼻祖，带气。评论区提到「健力宝气泡水」。' });
  B({ id:'asian-sarsae', n:'亚洲沙示', b:'亚洲汽水', c:'碳酸', sg:9.6, s:4.5, sw:4.5, kc:40, cb:5, fd:2, ml:330, pk:'330ml 罐', p:4, pop:2, ph:5, ice:'better', note:'广东人的「风油精味可乐」，两极分化严重。' });
  B({ id:'laoshan-snake', n:'崂山白花蛇草水', b:'青岛崂山', c:'碳酸', sg:0, s:0, sw:0.5, sub:'', cb:4, fd:2, ml:330, pk:'330ml 玻璃瓶', p:6, pop:2, ph:4, ice:'worse', caffeine:0, note:'传说中的黑暗料理，「草席泡水」味，含气。评论区唯一的猎奇提名。' });
  B({ id:'hans-xiaomuwu', n:'汉斯小木屋', b:'汉斯', c:'碳酸', sg:1, s:0.5, sw:2, sub:'', kc:5, cb:4, fd:1.5, ml:500, pk:'500ml 瓶', p:4, pop:3, ph:3, ice:'better', note:'评论区原话：「一瓶子 500ml 只有 5g 糖，你把气摇完得了」。' });
  B({ id:'dalian-soda', n:'大连汽水', b:'大连', c:'碳酸', sg:4, s:2, sw:3, kc:18, cb:4, fd:1, ml:500, pk:'500ml 瓶', p:4, pop:1, ph:4, ice:'better', note:'评论区说「基本上开盖之后就没什么气了」——气泡留存极差。' });
  B({ id:'sanlin-spark', n:'三麟气泡水', b:'三麟', c:'碳酸', sg:0, s:0, sw:2, sub:'赤藓糖醇', at:1, cb:5, fd:3, ml:500, pk:'500ml 瓶', p:5, pop:1, ph:5, ice:'better', note:'评论区评价「劲大，冷藏之后好喝」。' });
  B({ id:'hanks-soda', n:'汉口二厂汽水', b:'汉口二厂', c:'碳酸', sg:9, s:4, sw:4.5, kc:38, cb:5, fd:2, ml:275, pk:'275ml 玻璃瓶', p:8, pop:2, ph:5, ice:'better', note:'复古玻璃瓶，主打颜值与口味创新。' });
  B({ id:'starbucks-frapp', n:'星巴克星冰乐（瓶装）', b:'星巴克', c:'碳酸', sg:12, s:5, sw:5, sub:'', kc:52, cb:0, fd:0, ml:281, pk:'281ml 瓶', p:15, pop:3, ph:2, ice:'better', cf:20, dairy:1, note:'咖啡味奶饮，糖和热量都高（严格说不算碳酸，归此类因其人造饮品属性）。' });
  B({ id:'sweet-water-generic', n:'小甜水（泛指甜饮料）', b:'—', c:'碳酸', sg:10, s:4.5, sw:4.5, cb:3, fd:1, ml:500, pk:'瓶装', p:4, pop:4, ph:4, ice:'better', note:'网络用语，泛指一切甜味含糖饮料。出现在回复他人的帖子里。' });
  B({ id:'soda-maker-homemade', n:'柠檬酸 + 小苏打自配', b:'—', c:'碳酸', sg:0, s:0, sw:0, cb:3, fd:1, ml:300, pk:'自制', p:1, pop:1, ph:5, ice:'better', note:'评论区玩梗方案：自制碳酸水，完美避开了「没有气」这个要求。' });

})();
