/* ============================================================
 *  饮库 DrinkDB —— 矢量饮料图生成器
 *  ------------------------------------------------------------
 *  根据大类画出「易拉罐 / 瓶 / 利乐砖 / 咖啡杯 / 奶茶杯 / 啤酒瓶」，
 *  配色由 类目基色 + id 哈希 决定，保证同一款饮料每次颜色一致。
 *  不依赖任何外部图片，离线可用、无版权问题。
 *  若数据里填了 img 字段（真实产品图 URL），前台会优先用真实图。
 * ============================================================ */
(function (global) {

  var SHAPES = {
    '水':     { s: 'bottle',     h: 200, sat: 42, lit: 74, cap: '#3c7fa6' },
    '碳酸':   { s: 'can',        h: 8,   sat: 58, lit: 54, cap: '#c9ccd1' },
    '无糖茶': { s: 'bottle',     h: 38,  sat: 34, lit: 46, cap: '#4a7c59' },
    '茶':     { s: 'bottle',     h: 26,  sat: 58, lit: 48, cap: '#b8892f' },
    '奶':     { s: 'carton',     h: 46,  sat: 22, lit: 94, cap: '#5b8fc9' },
    '乳饮':   { s: 'carton',     h: 38,  sat: 34, lit: 88, cap: '#e0a33a' },
    '咖啡':   { s: 'cup',        h: 24,  sat: 42, lit: 34, cap: '#3a2a1e' },
    '奶茶':   { s: 'bubble',     h: 30,  sat: 46, lit: 70, cap: '#c98f52' },
    '果汁':   { s: 'bottle',     h: 32,  sat: 72, lit: 56, cap: '#e08a2b' },
    '功能':   { s: 'bottle',     h: 208, sat: 58, lit: 48, cap: '#2f6b8f' },
    '运动':   { s: 'sportbottle', h: 192, sat: 52, lit: 50, cap: '#2f9fa6' },
    '酒':     { s: 'beerbottle', h: 36,  sat: 58, lit: 32, cap: '#8a6a2b' },
    '其他':   { s: 'cup',        h: 0,   sat: 6,  lit: 62, cap: '#888' },
  };

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function hsl(h, s, l) { return 'hsl(' + ((h % 360) + 360) % 360 + ',' + s + '%,' + l + '%)'; }

  /* ---------- 各形状 ---------- */
  var DRAW = {
    can: function (liq, cap, accent) {
      return ''
        + '<rect x="34" y="42" width="52" height="106" rx="9" fill="' + liq + '"/>'
        + '<ellipse cx="60" cy="148" rx="26" ry="6.5" fill="' + accent + '" opacity=".85"/>'
        + '<rect x="34" y="72" width="52" height="46" fill="' + accent + '" opacity=".9"/>'
        + '<ellipse cx="60" cy="42" rx="26" ry="6.5" fill="' + cap + '"/>'
        + '<ellipse cx="60" cy="40" rx="21" ry="4.5" fill="#fff" opacity=".55"/>'
        + '<rect x="43" y="50" width="7" height="90" rx="3.5" fill="#fff" opacity=".22"/>';
    },
    bottle: function (liq, cap, accent) {
      return ''
        + '<path d="M52 24h16v26c0 6 12 10 12 24v66a10 10 0 0 1-10 10H50a10 10 0 0 1-10-10V74c0-14 12-18 12-24z" fill="' + liq + '"/>'
        + '<path d="M40 92h40v40a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8z" fill="' + accent + '" opacity=".9"/>'
        + '<rect x="49" y="14" width="22" height="13" rx="4" fill="' + cap + '"/>'
        + '<rect x="46" y="80" width="6" height="70" rx="3" fill="#fff" opacity=".25"/>';
    },
    sportbottle: function (liq, cap, accent) {
      return ''
        + '<rect x="42" y="34" width="36" height="118" rx="13" fill="' + liq + '"/>'
        + '<rect x="42" y="70" width="36" height="46" fill="' + accent + '" opacity=".9"/>'
        + '<rect x="52" y="20" width="16" height="16" rx="4" fill="' + cap + '"/>'
        + '<path d="M42 62h36" stroke="#fff" stroke-width="2" opacity=".3"/>'
        + '<rect x="48" y="78" width="6" height="62" rx="3" fill="#fff" opacity=".25"/>';
    },
    carton: function (liq, cap, accent) {
      return ''
        + '<rect x="34" y="56" width="52" height="100" fill="' + liq + '" stroke="#00000018"/>'
        + '<path d="M34 56l26-16 26 16z" fill="' + cap + '"/>'
        + '<rect x="34" y="86" width="52" height="34" fill="' + accent + '" opacity=".85"/>'
        + '<rect x="42" y="60" width="5" height="92" fill="#fff" opacity=".35"/>';
    },
    cup: function (liq, cap, accent) {
      return ''
        + '<path d="M45 52h30l7 100a4 4 0 0 1-4 4.5H42a4 4 0 0 1-4-4.5z" fill="' + liq + '"/>'
        + '<path d="M45 84h30l3.5 50H41.5z" fill="' + accent + '" opacity=".85"/>'
        + '<rect x="41" y="40" width="38" height="13" rx="4" fill="' + cap + '"/>'
        + '<ellipse cx="60" cy="40" rx="19" ry="4" fill="#fff" opacity=".5"/>';
    },
    bubble: function (liq, cap, accent) {
      var pearls = '';
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
        pearls += '<circle cx="' + (46 + c * 9.5) + '" cy="' + (140 - r * 9) + '" r="4.2" fill="#3b2a20" opacity=".8"/>';
      }
      return ''
        + '<path d="M44 56h32l6.5 96a4 4 0 0 1-4 4.5H41.5a4 4 0 0 1-4-4.5z" fill="' + liq + '"/>'
        + '<path d="M44 92h30l4 60H40z" fill="' + accent + '" opacity=".55"/>'
        + pearls
        + '<path d="M40 56a20 16 0 0 1 40 0z" fill="' + cap + '" opacity=".9"/>'
        + '<rect x="52" y="26" width="16" height="9" rx="4" fill="' + cap + '"/>';
    },
    beerbottle: function (liq, cap, accent) {
      return ''
        + '<path d="M54 16h12v44c0 7 13 11 13 26v58a10 10 0 0 1-10 10H51a10 10 0 0 1-10-10V86c0-15 13-19 13-26z" fill="' + liq + '"/>'
        + '<rect x="41" y="96" width="38" height="40" fill="' + accent + '" opacity=".9"/>'
        + '<rect x="51" y="8" width="18" height="12" rx="3" fill="' + cap + '"/>'
        + '<rect x="47" y="84" width="6" height="66" rx="3" fill="#fff" opacity=".2"/>';
    },
  };

  /**
   * 生成一款饮料的图
   *   ① 数据里写了 img（线上图片地址）→ 用它
   *   ② assets/img/manifest.js 里登记了本地图 → 用它
   *   ③ 都没有 → 现场画一张矢量图
   * @param {object} b    饮料对象
   * @param {number} size 目标显示宽度(px)
   */
  global.drinkArt = function (b, size) {
    size = size || 96;
    var boxW = size, boxH = Math.round(size * 1.5);
    var local = (global.IMG_MANIFEST && global.IMG_MANIFEST[b.id]) || b.img || '';
    if (local) {
      return '<img class="art-img" src="' + local + '" alt="' + b.n + '" loading="lazy" '
        + 'width="' + boxW + '" height="' + boxH + '" '
        + 'style="width:' + boxW + 'px;height:' + boxH + 'px">';
    }
    var st = SHAPES[b.c] || SHAPES['其他'];
    var k = hash(b.id || b.n);
    var hue = st.h + (k % 22) - 11;
    var lit = Math.max(18, Math.min(92, st.lit + ((k >> 5) % 14) - 7));
    var sat = Math.max(4, Math.min(90, st.sat + ((k >> 9) % 12) - 6));

    // 有气就加气泡，含奶就偏白，代糖就降饱和
    var liquid = hsl(hue, b.dairy ? Math.max(10, sat - 18) : sat, b.dairy ? Math.min(96, lit + 26) : lit);
    var cap = st.cap;
    var accent = hsl(hue, Math.min(90, sat + 12), Math.max(20, lit - 20));

    var svg = DRAW[st.s](liquid, cap, accent);

    // 碳酸：杯壁小气泡
    if (b.cb > 0) {
      var n = Math.min(8, b.cb + 1);
      for (var i = 0; i < n; i++) {
        var kk = hash(b.id + 'bub' + i);
        svg += '<circle cx="' + (44 + kk % 32) + '" cy="' + (58 + (kk >> 7) % 82) + '" r="' + (1.5 + (kk >> 3) % 2) + '" fill="#fff" opacity=".55"/>';
      }
    }
    // 酒精：加个度数刻度点
    if (b.abv > 0) {
      svg += '<circle cx="88" cy="30" r="11" fill="' + accent + '"/>'
        + '<text x="88" y="34" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="#fff">' + Math.round(b.abv) + '</text>';
    }

    return '<svg class="art-svg" viewBox="0 0 120 180" width="' + size + '" height="' + Math.round(size * 1.5) + '" '
      + 'style="width:' + size + 'px;height:' + Math.round(size * 1.5) + 'px" role="img" '
      + 'aria-label="' + b.n + ' 示意图">'
      + '<ellipse cx="60" cy="166" rx="30" ry="6" fill="#000" opacity=".07"/>'
      + svg + '</svg>';
  };

  /* 星级渲染：0–5 星，支持半星 */
  global.starHTML = function (v, max) {
    max = max || 5;
    var out = '';
    for (var i = 1; i <= max; i++) {
      if (v >= i) out += '<i class="on">★</i>';
      else if (v >= i - 0.5) out += '<i class="half">★</i>';
      else out += '<i>☆</i>';
    }
    return '<span class="stars" aria-label="' + v + ' 星（满分 ' + max + '）">' + out + '</span>';
  };

})(window);
