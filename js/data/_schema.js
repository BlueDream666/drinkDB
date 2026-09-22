/* ============================================================
 *  饮库 DrinkDB —— 数据字典与装配器
 *  ------------------------------------------------------------
 *  这是全站唯一的「真源」(source of truth)。
 *  每个饮料用短键对象描述，装配时补默认值并派生计算字段。
 *
 *  字段速查（短键 → 含义）
 *    id      唯一标识（英文小写-连字符）
 *    n       产品名（中文）
 *    b       品牌
 *    en      英文名 / 别名 / 常见叫法（数组或字符串）
 *    c       大类：水 碳酸 茶 无糖茶 奶 乳饮 咖啡 奶茶 果汁 功能 运动 酒 其他
 *    sg      糖  g/100ml（null = 未标注 / 未知）
 *    s       糖分星级 0–5（0.5 步进）——「含多少糖」
 *    sw      甜度星级 0–5（0.5 步进）——「喝起来多甜」，与含糖量不是一回事
 *    sub     代糖类型（'' = 无代糖）；如 赤藓糖醇 / 三氯蔗糖 / 阿斯巴甜 / 安赛蜜 / 甜菊糖苷 / 混合代糖
 *    at      代糖后味 0–5（0 无，5 明显挂舌）
 *    kc      热量 kcal/100ml
 *    cb      气泡强度 0–5（0 = 非碳酸）
 *    fd      放一天后剩余气泡 0–5（0 全跑光，5 几乎不衰减）—— 开盖/摇过之后的真实体验
 *    ice     'better' 冰镇更好喝 / 'same' 常温也行 / 'worse' 冰了反而差
 *    abv     酒精 %vol
 *    cf      咖啡因 mg/100ml
 *    tea     0/1 含茶
 *    dairy   0/1 含奶（含乳饮料、奶茶、拿铁等）
 *    hfcs    0/1 含果葡糖浆（高果糖玉米糖浆）
 *    ml      常规包装容量 ml
 *    pk      包装描述（'330ml 易拉罐' 等）
 *    p       参考零售价 ¥（便利店 / 电商常见价）
 *    pop     大众化程度 0–5（5 = 全国随处可见）
 *    ph      酸感 0–5（可选，碳酸与果汁普遍偏高）
 *    note    一句话点评 / 评论区里的说法
 *    img     可选：真实产品图 URL（留空则用自动生成的矢量图）
 * ============================================================ */

window.BEV = window.BEV || [];

(function () {
  var CAT_ORDER = ['水', '碳酸', '无糖茶', '茶', '奶', '乳饮', '咖啡', '奶茶', '果汁', '功能', '运动', '酒', '其他'];

  var DEFAULTS = {
    en: '', sg: null, s: 0, sw: 0, sub: '', at: 0, kc: null,
    cb: 0, fd: 0, ice: 'same', abv: 0, cf: 0,
    tea: 0, dairy: 0, hfcs: 0,
    ml: 500, pk: '', p: null, pop: 3, ph: 2, note: '', img: '',
    fromUser: false, submitter: '',
  };

  var seen = {};

  /** 装配器：只负责把短键对象补全 + 派生字段，不关心去重与入库 */
  window.buildBeverage = function (o) {
    var x = {};
    for (var k in DEFAULTS) x[k] = (o[k] === undefined ? DEFAULTS[k] : o[k]);
    x.id = o.id;
    x.n = o.n;
    x.b = o.b;
    x.c = o.c || '其他';

    // ---- 派生字段 ----
    x.noSugar = (x.sg === 0) || (x.sg === null && x.s === 0);        // 是否标称无糖
    x.hasSub = !!x.sub;                                              // 是否使用代糖
    x.hasCarb = x.cb > 0;                                            // 是否碳酸
    x.flatLoss = x.cb > 0 ? (x.cb - x.fd) : 0;                       // 开盖一天掉多少气
    x.catIndex = CAT_ORDER.indexOf(x.c);
    if (x.catIndex < 0) x.catIndex = CAT_ORDER.length;

    // 一句话小结（用于卡片副标题）
    var bits = [];
    if (x.hasCarb) bits.push('碳酸');
    if (x.hasSub) bits.push('代糖·' + x.sub);
    else if (x.sg === 0) bits.push('零糖');
    else if (x.sg !== null && x.sg <= 2.5) bits.push('低糖');
    else if (x.sg !== null && x.sg >= 8) bits.push('高糖');
    if (x.tea) bits.push('含茶');
    if (x.dairy) bits.push('含奶');
    if (x.cf > 0) bits.push('咖啡因 ' + x.cf + 'mg');
    if (x.abv > 0) bits.push('酒精 ' + x.abv + '%');
    x.brief = bits.join(' · ') || '普通饮料';
    return x;
  };

  /** 入库版：额外做 id 去重校验 */
  window.B = function (o) {
    if (!o || !o.id || !o.n) throw new Error('B() 需要 id 与 n：' + JSON.stringify(o));
    if (seen[o.id]) throw new Error('重复 id：' + o.id);
    seen[o.id] = 1;
    var x = window.buildBeverage(o);
    window.BEV.push(x);
    return x;
  };

  window.BEV_CATS = CAT_ORDER;
})();
