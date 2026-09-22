/* ============================================================
   饮库 —— 场景预设
   ------------------------------------------------------------
   筛选行是「属性视角」：含糖量、气泡强度、咖啡因……
   预设是「生活视角」：配火锅、熬夜、明早要早起……

   每个预设就是一个判定函数，直接作用在饮料对象上。
   这样能表达筛选行表达不了的条件（比如酸感、地区、热量组）。
   ============================================================ */
(function (global) {

  // 大区划分，给「中国汽水地图」和地域预设用
  var REGION = {
    北京: '华北', 天津: '华北', 河北: '华北', 山西: '华北', 内蒙古: '华北',
    辽宁: '东北', 吉林: '东北', 黑龙江: '东北',
    上海: '华东', 江苏: '华东', 浙江: '华东', 安徽: '华东', 福建: '华东', 江西: '华东', 山东: '华东',
    河南: '华中', 湖北: '华中', 湖南: '华中',
    广东: '华南', 广西: '华南', 海南: '华南',
    重庆: '西南', 四川: '西南', 贵州: '西南', 云南: '西南', 西藏: '西南',
    陕西: '西北', 甘肃: '西北', 青海: '西北', 宁夏: '西北', 新疆: '西北',
    香港: '港澳台', 澳门: '港澳台', 台湾: '港澳台',
  };

  // 品牌 → 产地（只在做地图时用；拿不准的留空，不硬猜）
  var ORIGIN = {
    '北冰洋': ['北京', '北京'], '冰峰': ['陕西', '西安'], '大窑': ['内蒙古', '呼和浩特'],
    '亚洲汽水': ['广东', '广州'], '汉口二厂': ['湖北', '武汉'], '青岛崂山': ['山东', '青岛'],
    '大连': ['辽宁', '大连'], '健力宝': ['广东', '佛山'], '椰树': ['海南', '海口'],
    '维他': ['广东', '深圳'], '王老吉': ['广东', '广州'], '加多宝': ['广东', '东莞'],
    '华润雪花': ['北京', '北京'], '青岛啤酒': ['山东', '青岛'], '娃哈哈': ['浙江', '杭州'],
    '农夫山泉': ['浙江', '杭州'], '康师傅': ['天津', '天津'], '统一': ['上海', '上海'],
    '光明': ['上海', '上海'], '味全': ['浙江', '杭州'], '李子园': ['浙江', '金华'],
    '露露': ['河北', '承德'], '六个核桃': ['河北', '衡水'], '唯怡': ['四川', '成都'],
    '菊乐': ['四川', '成都'], '可可西里': ['青海', '西宁'], '三麟': ['福建', '厦门'],
    '冰露': ['河北', '石家庄'], '今麦郎': ['河北', '邢台'], '养元': ['河北', '衡水'],
    '达能': ['上海', '上海'], '三得利': ['上海', '上海'], '伊藤园': ['上海', '上海'],
    '大冢': ['天津', '天津'], '百事': ['上海', '上海'], '可口可乐': ['上海', '上海'],
    '红牛': ['海南', '海口'], '东鹏': ['广东', '深圳'], '喜之郎': ['广东', '深圳'],
    '香飘飘': ['浙江', '湖州'], '蒙牛': ['内蒙古', '呼和浩特'], '伊利': ['内蒙古', '呼和浩特'],
    '旺旺': ['上海', '上海'], '都乐': ['上海', '上海'], '承德露露': ['河北', '承德'],
    '屈臣氏': ['广东', '广州'], '华润怡宝': ['广东', '深圳'], '景田百岁山': ['广东', '深圳'],
    '元气森林': ['北京', '北京'], '达利': ['福建', '泉州'], '达利园': ['福建', '泉州'],
    '银鹭': ['福建', '厦门'], '汇源': ['北京', '北京'], '瑞幸': ['福建', '厦门'],
    '星巴克': ['上海', '上海'], '三顿半': ['湖南', '长沙'], '不二家': ['上海', '上海'],
    '梅见': ['重庆', '重庆'], '江小白': ['重庆', '重庆'], '劲牌': ['湖北', '黄石'],
    '红星': ['北京', '北京'], '茅台': ['贵州', '遵义'], '五粮液': ['四川', '宜宾'],
    '大正': ['上海', '上海'], '麒麟': ['广东', '珠海'], '让茶': ['安徽', '合肥'],
    '果子熟了': ['湖南', '长沙'], '天地壹号': ['广东', '江门'], '承德': ['河北', '承德'],
    '百得利': ['广西', '南宁'], '依能': ['福建', '厦门'], '王屋': ['河南', '济源'],
  };

  // 方糖按 4.5g 一块算（常见方糖规格）
  var CUBE_G = 4.5;

  function sugarCubes(b) {
    if (b.sg === null || !b.ml) return 0;
    return Math.round(b.sg * b.ml / 100 / CUBE_G * 10) / 10;
  }
  function sugarGrams(b) {
    if (b.sg === null || !b.ml) return 0;
    return Math.round(b.sg * b.ml / 100);
  }
  function origin(b) {
    var o = ORIGIN[b.b];
    if (o) return { province: o[0], city: o[1], region: REGION[o[0]] || '其他' };
    // 品牌名里带地名的也认一下
    var provinces = Object.keys(REGION);
    for (var i = 0; i < provinces.length; i++) {
      if (b.b.indexOf(provinces[i]) >= 0 || b.n.indexOf(provinces[i]) >= 0) {
        return { province: provinces[i], city: provinces[i], region: REGION[provinces[i]] };
      }
    }
    return null;
  }

  /* ============================ 预设 ============================ */
  var PRESETS = [
    {
      id: 'clean', name: '糖少、没气', hint: '最常被问的那个：几乎没糖 + 完全没气',
      test: function (b) { return b.cb === 0 && b.sg !== null && b.sg <= 2.5; },
    },
    {
      id: 'sweet-nosugar', name: '想甜，但不想吃糖', hint: '甜度 3 星以上，含糖几乎为 0',
      test: function (b) { return b.sw >= 3 && (b.sg === 0 || b.sg === null); },
    },
    {
      id: 'hotpot', name: '配火锅烧烤', hint: '无糖 + 酸感高，解腻那一口',
      test: function (b) { return b.abv === 0 && b.ph >= 4 && b.sg !== null && b.sg <= 5; },
    },
    {
      id: 'nightowl', name: '熬夜顶一下', hint: '带咖啡因，糖别太多',
      test: function (b) { return b.cf >= 20 && b.sg !== null && b.sg <= 6; },
    },
    {
      id: 'earlytomorrow', name: '明早要早起', hint: '不含咖啡因，喝了照样能睡',
      test: function (b) { return b.cf === 0; },
    },
    {
      id: 'afterworkout', name: '运动完', hint: '无碳酸 + 有点电解质',
      test: function (b) { return b.cb === 0 && (b.c === '运动' || b.c === '功能'); },
    },
    {
      id: 'hotday', name: '大热天', hint: '冰过明显更好喝的那些',
      test: function (b) { return b.ice === 'better'; },
    },
    {
      id: 'coldday', name: '冬天不想喝冰的', hint: '常温也行的，不用非得冰',
      test: function (b) { return b.ice === 'same'; },
    },
    {
      id: 'driving', name: '一会儿要开车', hint: '一滴酒精都不含',
      test: function (b) { return b.abv === 0; },
    },
    {
      id: 'kids', name: '给小朋友', hint: '不含咖啡因、不含酒精、糖也不多',
      test: function (b) { return b.cf === 0 && b.abv === 0 && b.sg !== null && b.sg <= 6; },
    },
    {
      id: 'lactose', name: '乳糖不耐', hint: '不含奶的那一类',
      test: function (b) { return !b.dairy; },
    },
    {
      id: 'nohfcs', name: '躲开果葡糖浆', hint: '配料表里没有高果糖玉米糖浆',
      test: function (b) { return !b.hfcs; },
    },
    {
      id: 'cheap', name: '十块钱以内', hint: '参考价不超过 12 块',
      test: function (b) { return b.p !== null && b.p <= 12; },
    },
    {
      id: 'everywhere', name: '楼下就得有', hint: '到处都买得到，不用特意找',
      test: function (b) { return b.pop >= 4; },
    },
    {
      id: 'fizz', name: '就要那口气', hint: '气泡强，而且开盖放一夜还有气',
      test: function (b) { return b.cb >= 4 && b.fd >= 2; },
    },
    {
      id: 'flat', name: '气放没了也能喝', hint: '开盖一夜就瘪，但你喜欢没气的',
      test: function (b) { return b.cb > 0 && b.fd <= 1; },
    },
    {
      id: 'local', name: '地方汽水', hint: '有明确产地的小众品牌，尝尝别处的味道',
      test: function (b) { return !!origin(b) && b.pop <= 3 && b.c === '碳酸'; },
    },
  ];

  global.DrinkPresets = {
    list: PRESETS,
    REGION: REGION,
    ORIGIN: ORIGIN,
    origin: origin,
    sugarCubes: sugarCubes,
    sugarGrams: sugarGrams,
    CUBE_G: CUBE_G,
    byId: function (id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; },
  };

})(window);
