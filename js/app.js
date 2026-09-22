/* ============================================================
   饮库 DrinkDB —— 前台
   ------------------------------------------------------------
   · 没筛选时：两排缓缓平移，上排往左、下排往右（用 rAF 驱动，
     不走 CSS 动画，这样系统开了「减少动态效果」也照样会动）
   · 一筛选 / 搜索 / 排序：立刻切成静态网格
   · 筛选按钮三态：点一下=要，点两下=不要（红），点三下=取消
   · 同一行内：要的之间是「或」；不要的之间是「或」；两者再相减
   · 不同行之间：都得满足
   ============================================================ */
(function () {
  var CFG = window.DRINKDB_CONFIG;
  var ALL = [];
  var active = {};        // { 行key: { 序号: 0|1|2 } }
  var sortKey = 'default';
  var keyword = '';
  var flowPaused = false;      // 用户点了「暂停」
  var flowHover = false;       // 鼠标 / 手指正在这两排上面
  var marquees = [];
  var flowBase = { flowA: 0, flowB: 0 };   // 记住每排飘到哪了，重建时不回零

  var OFF = 0, WANT = 1, NOPE = 2;

  /* ============================ 筛选行 ============================ */
  var ROWS = [
    { key: 'c', label: '哪一类', dynamic: true },
    {
      key: 'sugar', label: '糖',
      opts: [
        ['一点糖都没有', function (b) { return b.sg === 0; }],
        ['糖很少', function (b) { return b.sg !== null && b.sg > 0 && b.sg <= 2.5; }],
        ['糖一般', function (b) { return b.sg !== null && b.sg > 2.5 && b.sg <= 6; }],
        ['糖挺多', function (b) { return b.sg !== null && b.sg > 6; }],
        ['放了代糖', function (b) { return b.hasSub; }],
        ['没放代糖', function (b) { return !b.hasSub; }],
        ['代糖不挂舌', function (b) { return !b.hasSub || b.at <= 1.5; }],
      ],
    },
    {
      key: 'sweet', label: '甜度',
      opts: [
        ['喝着不甜', function (b) { return b.sw <= 1.5; }],
        ['微甜', function (b) { return b.sw > 1.5 && b.sw <= 3; }],
        ['挺甜', function (b) { return b.sw > 3; }],
        ['甜，但没糖', function (b) { return b.sw >= 3 && (b.sg === 0 || b.sg === null || b.sg <= 1); }],
        ['有糖，却不甜', function (b) { return b.sg !== null && b.sg >= 6 && b.sw <= 2.5; }],
      ],
    },
    {
      key: 'carb', label: '气',
      opts: [
        ['没气', function (b) { return b.cb === 0; }],
        ['有气', function (b) { return b.cb > 0; }],
        ['气很冲', function (b) { return b.cb >= 4; }],
        ['放一夜还有气', function (b) { return b.cb > 0 && b.fd >= 2; }],
        ['放一夜就没气', function (b) { return b.cb > 0 && b.fd <= 1; }],
      ],
    },
    {
      key: 'ice', label: '冰镇',
      opts: [
        ['冰过更好喝', function (b) { return b.ice === 'better'; }],
        ['冰不冰都行', function (b) { return b.ice === 'same'; }],
        ['冰了反而差', function (b) { return b.ice === 'worse'; }],
      ],
    },
    {
      key: 'cf', label: '咖啡因',
      opts: [
        ['不带咖啡因', function (b) { return b.cf === 0; }],
        ['带咖啡因', function (b) { return b.cf > 0; }],
        ['咖啡因很猛', function (b) { return b.cf >= 50; }],
      ],
    },
    {
      key: 'tea', label: '茶',
      opts: [
        ['有茶', function (b) { return !!b.tea; }],
        ['没茶', function (b) { return !b.tea; }],
      ],
    },
    {
      key: 'dairy', label: '奶',
      opts: [
        ['有奶', function (b) { return !!b.dairy; }],
        ['没奶', function (b) { return !b.dairy; }],
        ['没加果葡糖浆', function (b) { return !b.hfcs; }],
      ],
    },
    {
      key: 'abv', label: '酒精',
      opts: [
        ['不含酒精', function (b) { return b.abv === 0; }],
        ['低度（5% 以内）', function (b) { return b.abv > 0 && b.abv <= 5; }],
        ['高度（5% 以上）', function (b) { return b.abv > 5; }],
      ],
    },
    {
      key: 'price', label: '价格',
      opts: [
        ['5 块以内', function (b) { return b.p !== null && b.p <= 5; }],
        ['5 到 12 块', function (b) { return b.p !== null && b.p > 5 && b.p <= 12; }],
        ['12 块以上', function (b) { return b.p !== null && b.p > 12; }],
      ],
    },
    {
      key: 'pop', label: '好买吗',
      opts: [
        ['到处都有', function (b) { return b.pop >= 4; }],
        ['不太好找', function (b) { return b.pop <= 2; }],
      ],
    },
  ];

  function rowOpts(row) {
    return row.dynamic
      ? window.BEV_CATS.map(function (c) { return [c, function (b) { return b.c === c; }]; })
      : row.opts;
  }

  /* ============================ 排序 ============================ */
  var SORTS = [
    ['default', '按门类排'],
    ['name', '按名字'],
    ['sugar-asc', '糖：少 → 多'],
    ['sugar-desc', '糖：多 → 少'],
    ['sweet-asc', '甜度：淡 → 甜'],
    ['sweet-desc', '甜度：甜 → 淡'],
    ['carb-desc', '气最冲的在前'],
    ['keep-desc', '最经放的在前'],
    ['price-asc', '便宜的先来'],
    ['price-desc', '贵的先来'],
    ['pop-desc', '最好买的在前'],
    ['cf-desc', '咖啡因高的在前'],
    ['abv-desc', '度数高的在前'],
    ['ml-desc', '大瓶的先来'],
  ];

  function cmp(a, b) {
    var A, B;
    switch (sortKey) {
      case 'name': return a.n.localeCompare(b.n, 'zh');
      case 'sugar-asc': A = a.sg === null ? 99 : a.sg; B = b.sg === null ? 99 : b.sg; return A - B;
      case 'sugar-desc': A = a.sg === null ? -1 : a.sg; B = b.sg === null ? -1 : b.sg; return B - A;
      case 'sweet-asc': return a.sw - b.sw;
      case 'sweet-desc': return b.sw - a.sw;
      case 'carb-desc': return b.cb - a.cb;
      case 'keep-desc': return b.fd - a.fd;
      case 'price-asc': A = a.p === null ? 1e9 : a.p; B = b.p === null ? 1e9 : b.p; return A - B;
      case 'price-desc': A = a.p === null ? -1 : a.p; B = b.p === null ? -1 : b.p; return B - A;
      case 'pop-desc': return b.pop - a.pop;
      case 'cf-desc': return b.cf - a.cf;
      case 'abv-desc': return b.abv - a.abv;
      case 'ml-desc': return b.ml - a.ml;
      default: return (a.catIndex - b.catIndex) || (b.pop - a.pop) || a.n.localeCompare(b.n, 'zh');
    }
  }

  /* ============================ 判定 ============================ */
  function sel(k) { return active[k] || (active[k] = {}); }
  function stateOf(k, i) { return active[k] ? (active[k][i] || OFF) : OFF; }

  function pickedOf(k) {
    var s = active[k], inc = [], exc = [];
    if (s) for (var i in s) { if (s[i] === WANT) inc.push(+i); else if (s[i] === NOPE) exc.push(+i); }
    return { inc: inc, exc: exc, n: inc.length + exc.length };
  }
  function activeCount() { var n = 0; ROWS.forEach(function (r) { n += pickedOf(r.key).n; }); return n; }
  function anyFilter() { return activeCount() > 0; }
  function isFlow() { return !anyFilter() && !keyword && sortKey === 'default'; }

  function matchRow(b, row) {
    var p = pickedOf(row.key);
    if (!p.n) return true;
    var opts = rowOpts(row);
    if (p.inc.length && !p.inc.some(function (i) { return opts[i][1](b); })) return false;
    if (p.exc.length && p.exc.some(function (i) { return opts[i][1](b); })) return false;
    return true;
  }

  function hitKeyword(b) {
    return (b.n + ' ' + b.b + ' ' + b.en + ' ' + b.c + ' ' + b.brief + ' ' + b.note)
      .toLowerCase().indexOf(keyword) >= 0;
  }

  function results() {
    return ALL.filter(function (b) {
      if (keyword && !hitKeyword(b)) return false;
      for (var i = 0; i < ROWS.length; i++) if (!matchRow(b, ROWS[i])) return false;
      return true;
    }).sort(cmp);
  }

  /* ============================ 小工具 ============================ */
  var $ = function (s) { return document.querySelector(s); };
  function on(s, ev, fn) { var e = $(s); if (e) e.addEventListener(ev, fn); return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var isPhone = function () { return window.innerWidth < 720; };

  /* ============================ 卡片 ============================ */
  function marks(b) {
    var m = '';
    m += b.cb === 0
      ? '<span class="mk flat">没气</span>'
      : '<span class="mk fizz">气 ' + b.cb + '/5</span>';
    if (b.sg === 0 && !b.hasSub) m += '<span class="mk flat">0 糖</span>';
    else if (b.sg !== null && b.sg >= 6) m += '<span class="mk sweet">糖 ' + b.sg + 'g</span>';
    if (b.hasSub) m += '<span class="mk sub">代糖</span>';
    if (b.abv > 0) m += '<span class="mk booze">' + b.abv + '% 酒</span>';
    if (b.cf > 0) m += '<span class="mk caff">咖啡因</span>';
    return m;
  }

  function cardHTML(b, size) {
    return '<button class="card" type="button" data-id="' + b.id + '" title="' + esc(b.n) + '">'
      + '<span class="art">' + window.drinkArt(b, size) + '</span>'
      + '<span class="nm">' + esc(b.n) + '</span>'
      + '<span class="br">' + esc(b.b) + '</span>'
      + '<span class="marks">' + marks(b) + '</span>'
      + '<span class="rows">'
      + '<span class="row"><span class="k">糖</span><span class="v">' + window.starHTML(b.s) + '</span></span>'
      + '<span class="row"><span class="k">甜</span><span class="v">' + window.starHTML(b.sw) + '</span></span>'
      + '<span class="row"><span class="k">气</span><span class="v">' + (b.cb ? window.starHTML(b.fd) : '<span style="color:var(--faint)">—</span>') + '</span></span>'
      + '</span></button>';
  }

  /* ============================ 流动 ============================ */
  function Marquee(rowEl, dir, startBase) {
    var track = rowEl.querySelector('.flowtrack');
    var width = 0, base = startBase || 0, dragX = 0;
    var self = this;
    this.row = rowEl;
    this.id = rowEl.id;

    this.measure = function () {
      // 读 scrollWidth 会强制重排，所以这里拿到的宽度一定是准的
      var w = track.scrollWidth;
      if (w > 0) { width = w / 2; self.paint(); }
    };
    this.paint = function () {
      if (!width) return;
      var p = ((base % width) + width) % width;
      // 往左走：位移从 0 到 -width；往右走：从 -width 回到 0。
      // 两者 p 都是递增的，只是映射方式不同 —— 别去改 speed 的正负，
      // 那样会把方向也一起反过来。
      var x = dir < 0 ? -p : (p - width);
      track.style.transform = 'translate3d(' + (x + dragX).toFixed(2) + 'px,0,0)';
      flowBase[self.id] = base;
    };
    /** 推进 ms 毫秒（advance 调它；自测也能直接调，不依赖帧率） */
    this.step = function (ms) {
      base += (CFG.flowSpeed || 30) * ms / 1000;
      self.paint();
    };
    this.setBase = function (v) { base = v || 0; self.paint(); };
    this.width = function () { return width; };
    this.offset = function () { var m = /translate3d\((-?[\d.]+)px/.exec(track.style.transform); return m ? +m[1] : null; };
    this.at = function () { return base; };

    function stopped() { return flowPaused || flowHover || dragX || document.hidden; }

    var lastTick = 0;
    function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

    /** 唯一的推进入口：不管是 rAF 还是定时器调它，
     *  都用「距上次推进的真实时间」算位移，所以两边同时触发也不会走两倍速。 */
    function advance() {
      var t = now();
      if (!lastTick) lastTick = t;
      var dt = Math.min(400, t - lastTick);
      lastTick = t;
      if (!stopped()) self.step(dt);
    }
    (function rafLoop() { advance(); requestAnimationFrame(rafLoop); })();
    // 兜底：省电模式、无头环境、某些内嵌浏览器会把 rAF 饿死，
    // 定时器照看同一套时间差，保证永远在飘。
    setInterval(advance, 120);

    // 手指 / 鼠标拖拽
    var sx = 0, down = false;
    rowEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; sx = e.clientX; rowEl.classList.add('grabbing');
    });
    rowEl.addEventListener('pointermove', function (e) {
      if (!down) return;
      dragX = e.clientX - sx;
      self.paint();
    });
    function up() {
      if (!down) return;
      down = false; rowEl.classList.remove('grabbing');
      base += -dragX; dragX = 0; self.paint();
    }
    rowEl.addEventListener('pointerup', up);
    rowEl.addEventListener('pointercancel', up);
    rowEl.addEventListener('pointerleave', up);
  }

  /** 鼠标/手指进到这两排里就把它们停住，方便看清和点开 */
  function bindFlowHold() {
    var zone = $('#flowZone');
    if (!zone || zone.dataset.holdBound) return;
    zone.dataset.holdBound = '1';
    zone.addEventListener('pointerenter', function () { flowHover = true; setFlowDot(); });
    zone.addEventListener('pointerleave', function () { flowHover = false; setFlowDot(); });
    zone.addEventListener('focusin', function () { flowHover = true; setFlowDot(); });
    zone.addEventListener('focusout', function () { flowHover = false; setFlowDot(); });
    // 手机上点一下就停住，再点空白处继续
    zone.addEventListener('touchstart', function () { flowHover = true; setFlowDot(); }, { passive: true });
    document.addEventListener('touchstart', function (e) {
      if (!zone.contains(e.target)) { flowHover = false; setFlowDot(); }
    }, { passive: true });
  }

  function setFlowDot() {
    var d = $('#flowDot');
    if (d) d.classList.toggle('paused', flowPaused || flowHover);
    var btn = $('#flowToggle');
    if (btn) btn.textContent = flowPaused ? '继续' : '暂停';
  }

  function renderFlow(list) {
    // 手机上少放一些，转起来更顺；桌面全放
    var cap = isPhone() ? 72 : list.length;
    var use = list.slice(0, cap);
    var a = use.filter(function (_, i) { return i % 2 === 0; });
    var b = use.filter(function (_, i) { return i % 2 === 1; });
    var size = isPhone() ? 54 : 76;
    function track(arr) {
      var one = arr.map(function (x) { return cardHTML(x, size); }).join('');
      return '<div class="flowtrack">' + one + one + '</div>';
    }
    var ra = $('#flowA'), rb = $('#flowB');
    ra.innerHTML = track(a);
    rb.innerHTML = track(b);
    // 带着上次飘到的位置重建，这样暂停/筛选切换都不会跳回开头
    marquees = [
      new Marquee(ra, -1, flowBase.flowA),
      new Marquee(rb, 1, flowBase.flowB),
    ];
    bindFlowHold();
    // 立刻量一次（同步拿到正确宽度），下一帧再量一次兜底
    marquees.forEach(function (m) { m.measure(); });
    requestAnimationFrame(function () { marquees.forEach(function (m) { m.measure(); }); });
    setFlowDot();
  }

  /* ============================ 渲染 ============================ */
  function render() {
    var list = results();
    var flow = isFlow();

    $('#count').textContent = list.length === ALL.length
      ? '全部 ' + ALL.length + ' 款'
      : list.length + ' / ' + ALL.length + ' 款';
    $('#modeTag').textContent = flow ? '轮播中' : '筛选结果';
    $('#modeTag').className = 'tag ' + (flow ? 'live' : 'wait');
    $('#fnum').textContent = activeCount();
    $('#fnum').setAttribute('data-n', activeCount());
    $('#clearBtn').style.display = flow ? 'none' : '';
    var ft = $('#flowToggle'), fd = $('#flowDot');
    if (ft) ft.style.display = flow ? '' : 'none';
    if (fd) fd.style.display = flow ? '' : 'none';

    if (flow) {
      $('#flowZone').style.display = '';
      $('#gridZone').style.display = 'none';
      renderFlow(list);
    } else {
      if (marquees.length) { marquees.forEach(function (m) { m.dead = true; }); marquees = []; }
      $('#flowZone').style.display = 'none';
      $('#gridZone').style.display = '';
      $('#gridZone').innerHTML = list.length
        ? list.map(function (b) { return cardHTML(b, isPhone() ? 54 : 76); }).join('')
        : '<div class="nothing">这些条件凑一块儿，一款都对不上。<br>去掉一两个再试试。</div>';
    }
    drawSummary();
    writeHash();
  }

  /* ============================ 已选条件摘要 ============================ */
  function drawSummary() {
    var out = [];
    ROWS.forEach(function (r) {
      var p = pickedOf(r.key), opts = rowOpts(r);
      p.inc.forEach(function (i) { out.push({ k: r.key, i: i, no: false, t: opts[i][0] }); });
      p.exc.forEach(function (i) { out.push({ k: r.key, i: i, no: true, t: opts[i][0] }); });
    });
    var el = $('#summary');
    if (!el) return;
    el.innerHTML = out.map(function (x) {
      return '<button class="sm ' + (x.no ? 'exc' : 'inc') + '" type="button" data-k="' + x.k + '" data-i="' + x.i + '">'
        + (x.no ? '不要 ' : '') + esc(x.t) + ' ✕</button>';
    }).join('');
  }

  /* ============================ 筛选面板 ============================ */
  function buildFilters() {
    var html = ROWS.map(function (r) {
      var opts = rowOpts(r);
      return '<div class="frow"><div class="fk">' + r.label + '</div><div class="fv">'
        + opts.map(function (o, i) {
          return '<button class="chip" type="button" data-k="' + r.key + '" data-i="' + i + '" data-st="0">' + esc(o[0]) + '</button>';
        }).join('') + '</div></div>';
    }).join('');

    html += '<div class="frow quick"><div class="fk">偷懒</div><div class="fv">'
      + '<button class="chip" type="button" id="qOk">糖少、没气</button>'
      + '<button class="chip" type="button" id="qZero">零糖还不带咖啡因</button>'
      + '<button class="chip" type="button" id="qIce">冰过更好喝</button>'
      + '<button class="chip" type="button" id="qClear">全清掉</button>'
      + '</div></div>';

    $('#filterRows').innerHTML = html;
  }

  function syncChips() {
    document.querySelectorAll('.chip[data-k]').forEach(function (c) {
      c.setAttribute('data-st', String(stateOf(c.dataset.k, +c.dataset.i)));
    });
  }

  /* ============================ 详情 ============================ */
  function openDetail(id) {
    var b = ALL.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var iceTxt = { better: '冰过更好喝', same: '冰不冰都行', worse: '冰了反而差' }[b.ice];
    function bar(v) { return '<span class="bar"><i style="width:' + (v / 5 * 100) + '%"></i></span> ' + v + ' / 5'; }
    var rows = [];
    function r(k, v) { if (v) rows.push('<dt>' + k + '</dt><dd>' + v + '</dd>'); }

    r('糖', (b.sg === null ? '未标注' : b.sg + ' g / 100ml') + '　' + window.starHTML(b.s) + ' / 5');
    r('甜', window.starHTML(b.sw) + ' / 5　<span class="sub">口感甜度，与含糖量未必同步</span>');
    r('代糖', b.hasSub ? esc(b.sub) + '（后味 ' + b.at + ' / 5）' : '未使用');
    r('热量', b.kc === null ? '' : b.kc + ' kcal / 100ml');
    r('碳酸', b.cb > 0 ? '有　气泡强度 ' + bar(b.cb) : '无');
    if (b.cb > 0) {
      r('开盖一夜', bar(b.fd) + '　<span class="sub">开封静置 24 小时后剩余气泡</span>');
      r('衰减幅度', bar(b.cb - b.fd) + '　<span class="sub">数值越大越不耐放</span>');
    }
    r('冰镇', iceTxt);
    if (b.abv > 0) r('酒精', b.abv + ' %vol');
    if (b.cf > 0) r('咖啡因', b.cf + ' mg / 100ml');
    r('茶 / 奶', (b.tea ? '含茶' : '不含茶') + '　' + (b.dairy ? '含奶' : '不含奶'));
    r('果葡糖浆', b.hfcs ? '含' : '不含');
    r('规格', esc(b.pk || (b.ml + ' ml')));
    r('参考价', b.p === null ? '' : '¥' + b.p + ' <span class="sub">常见零售价</span>');
    r('常见度', window.starHTML(b.pop) + ' / 5');
    r('酸感', window.starHTML(b.ph) + ' / 5');
    r('备注', esc(b.note));
    if (b.fromUser) r('来源', '网友提交，已收录');

    $('#detailBody').innerHTML = '<div class="head">'
      + '<div>' + window.drinkArt(b, 96) + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<h2>' + esc(b.n) + '</h2>'
      + '<div class="sub">' + esc(b.b) + ' · ' + esc(b.c) + (b.en ? ' · ' + esc(b.en) : '') + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(b.brief) + '</div>'
      + '</div></div>'
      + '<dl>' + rows.join('') + '</dl>';
    $('#detail').classList.add('on');
    document.body.style.overflow = 'hidden';
  }

  /* ============================ 提交表单 ============================ */
  function buildForm() {
    $('#submitBody').innerHTML = ''
      + '<fieldset><legend>先填这个</legend><div class="fgrid">'
      + '<div class="field req"><label>叫什么</label><input name="n" required placeholder="比如：某某牌白桃乌龙"></div>'
      + '<div class="field"><label>哪个牌子</label><input name="b" placeholder="不知道就空着"></div>'
      + '<div class="field"><label>你叫啥</label><input name="by" placeholder="想留就留"></div>'
      + '</div></fieldset>'
      + '<fieldset><legend>大概什么味道</legend><div class="fgrid">'
      + '<div class="field"><label>归哪一类</label><select name="c">'
      + window.BEV_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="field"><label>每 100ml 多少克糖</label><input name="sg" type="number" step="0.1" min="0" placeholder="没有就填 0"></div>'
      + '<div class="field"><label>糖分打几星（0–5，可半星）</label><input name="s" type="number" step="0.5" min="0" max="5" placeholder="3.5 也行"></div>'
      + '<div class="field"><label>喝着多甜（0–5，可半星）</label><input name="sw" type="number" step="0.5" min="0" max="5" placeholder="这跟糖分不是一回事"></div>'
      + '<div class="field"><label>放了什么代糖</label><input name="sub" placeholder="赤藓糖醇 / 三氯蔗糖 / 没放就空着"></div>'
      + '<div class="field"><label>代糖后味重不重（0–5）</label><input name="at" type="number" step="0.5" min="0" max="5"></div>'
      + '<div class="field"><label>每 100ml 多少大卡</label><input name="kc" type="number" step="0.1" min="0"></div>'
      + '</div></fieldset>'
      + '<fieldset><legend>气</legend><div class="fgrid">'
      + '<div class="field"><label>气泡强度（0 到 5，0 就是没气）</label><input name="cb" type="number" step="1" min="0" max="5"></div>'
      + '<div class="field"><label>开盖放一晚还剩多少气（0–5）</label><input name="fd" type="number" step="1" min="0" max="5"></div>'
      + '</div></fieldset>'
      + '<fieldset><legend>顺带一提</legend><div class="fgrid">'
      + '<div class="field"><label>冰过以后</label><select name="ice">'
      + '<option value="better">更好喝</option><option value="same">冰不冰都行</option><option value="worse">反而变差</option>'
      + '</select></div>'
      + '<div class="field"><label>酒精度 %vol</label><input name="abv" type="number" step="0.1" min="0"></div>'
      + '<div class="field"><label>咖啡因 mg/100ml</label><input name="cf" type="number" step="0.1" min="0"></div>'
      + '<div class="field"><label>一瓶多少 ml</label><input name="ml" type="number" step="1" min="0"></div>'
      + '<div class="field"><label>什么包装</label><input name="pk" placeholder="500ml 瓶 / 330ml 罐"></div>'
      + '<div class="field"><label>多少钱</label><input name="p" type="number" step="0.1" min="0"></div>'
      + '<div class="field"><label>好不好买（0–5）</label><input name="pop" type="number" step="0.5" min="0" max="5"></div>'
      + '<div class="field"><label>酸不酸（0–5）</label><input name="ph" type="number" step="0.5" min="0" max="5"></div>'
      + '<div class="field"><label>有图片就贴个网址</label><input name="img" placeholder="https://..."></div>'
      + '</div>'
      + '<div class="fgrid" style="margin-top:12px">'
      + '<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="tea"> 有茶</label>'
      + '<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="dairy"> 有奶</label>'
      + '<label class="field" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="hfcs"> 加了果葡糖浆</label>'
      + '</div>'
      + '<div class="field" style="margin-top:12px"><label>喝起来怎么样</label><textarea name="note" rows="3" placeholder="随手写两句就行，不用讲究"></textarea></div>'
      + '</div></fieldset>'
      + '<p class="hintline">除了名字，别的都能空着。提交完先进待审队列，我看到了就审。</p>';
  }

  /* ============================ 链接状态 ============================ */
  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    var q = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (q.f) {
      q.f.split(',').forEach(function (pair) {
        var no = pair.charAt(pair.length - 1) === '!';
        if (no) pair = pair.slice(0, -1);
        var p = pair.split(':');
        if (p.length === 2 && p[0] !== '') sel(p[0])[p[1]] = no ? NOPE : WANT;
      });
    }
    if (q.sort && SORTS.some(function (s) { return s[0] === q.sort; })) sortKey = q.sort;
    if (q.q) keyword = q.q.toLowerCase();
    if (q.pause === '1') flowPaused = true;
    var sb = $('#search'); if (sb && q.q) sb.value = q.q;
    var so = $('#sort'); if (so) so.value = sortKey;
  }

  function writeHash() {
    var f = [];
    ROWS.forEach(function (r) {
      var p = pickedOf(r.key);
      p.inc.forEach(function (i) { f.push(r.key + ':' + i); });
      p.exc.forEach(function (i) { f.push(r.key + ':' + i + '!'); });
    });
    var parts = [];
    if (f.length) parts.push('f=' + encodeURIComponent(f.join(',')));
    if (sortKey !== 'default') parts.push('sort=' + sortKey);
    if (keyword) parts.push('q=' + encodeURIComponent(keyword));
    var h = parts.length ? '#' + parts.join('&') : '#';
    if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } }
  }

  /* ============================ 动作 ============================ */
  function cycle(k, i) {
    var s = sel(k);
    s[i] = ((s[i] || OFF) + 1) % 3;
    syncChips(); render();
  }

  function applyQuick(pairs) {
    active = {}; keyword = ''; sortKey = 'default';
    var sb = $('#search'); if (sb) sb.value = '';
    var so = $('#sort'); if (so) so.value = 'default';
    pairs.forEach(function (p) { if (p[1] !== undefined) sel(p[0])[p[1]] = WANT; });
    syncChips(); render();
  }

  function clearAll(say) {
    active = {}; keyword = ''; sortKey = 'default';
    var sb = $('#search'); if (sb) sb.value = '';
    var so = $('#sort'); if (so) so.value = 'default';
    syncChips(); render();
    if (say !== false) toast('条件都清掉了');
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('up');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('up'); }, 2200);
  }

  /* ============================ 绑定 ============================ */
  function bind() {
    // 筛选按钮三态
    $('#filterRows').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      if (c.id === 'qOk') return applyQuick([['carb', 0], ['sugar', 0], ['sugar', 1]]);
      if (c.id === 'qZero') return applyQuick([['sugar', 0], ['cf', 0]]);
      if (c.id === 'qIce') return applyQuick([['ice', 0]]);
      if (c.id === 'qClear') return clearAll();
      if (c.dataset.k !== undefined) cycle(c.dataset.k, +c.dataset.i);
    });

    // 摘要点掉
    on('#summary', 'click', function (e) {
      var b = e.target.closest('.sm');
      if (!b) return;
      var s = sel(b.dataset.k); s[b.dataset.i] = OFF;
      syncChips(); render();
    });

    // 卡片 / 关闭
    document.addEventListener('click', function (e) {
      var card = e.target.closest('.card');
      if (card) return openDetail(card.dataset.id);
      if (e.target.closest('[data-close]')) return closeModals();
      if (e.target.classList.contains('modal')) return closeModals();
    });

    on('#search', 'input', function (e) { keyword = e.target.value.trim().toLowerCase(); render(); });

    var so = $('#sort');
    if (so) {
      so.innerHTML = SORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('');
      so.value = sortKey;
      so.addEventListener('change', function (e) { sortKey = e.target.value; render(); });
    }

    // 筛选面板展开 / 收起（手机默认收起）
    var panel = $('#filterPanel'), toggle = $('#filterToggle');
    function setOpen(open) {
      panel.classList.toggle('open', open);
      if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      try { sessionStorage.setItem('drinkdb.filterOpen', open ? '1' : '0'); } catch (err) {}
    }
    if (panel && toggle) {
      var saved = null;
      try { saved = sessionStorage.getItem('drinkdb.filterOpen'); } catch (err) {}
      setOpen(saved === null ? !isPhone() : saved === '1');
      toggle.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
    }

    // 流动暂停 / 继续（只切状态，不重建，否则会跳回开头）
    on('#flowToggle', 'click', function () {
      flowPaused = !flowPaused;
      setFlowDot();
      try { localStorage.setItem('drinkdb.flowPaused', flowPaused ? '1' : '0'); } catch (e) {}
    });

    on('#clearBtn', 'click', function () { clearAll(); });

    // 导出
    on('#expAll', 'click', function () {
      window.Exporter.toExcel(ALL, { title: '饮库 DrinkDB · 全部饮料', filename: '饮库-全库' });
      toast('全库 ' + ALL.length + ' 款，导好了');
    });
    on('#expXls', 'click', function () {
      var l = results();
      window.Exporter.toExcel(l, { title: '饮库 DrinkDB · 筛选结果', filename: '饮库-筛选结果' });
      toast(l.length + ' 款，导好了');
    });
    on('#expCsv', 'click', function () {
      var l = results();
      window.Exporter.toCSV(l, { filename: '饮库-筛选结果' });
      toast('CSV 好了，' + l.length + ' 款');
    });

    // 提交
    on('#openSubmit', 'click', function () { openModal('#submit'); });
    on('#submitForm', 'submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target), rec = {};
      fd.forEach(function (v, k) { rec[k] = v; });
      rec.tea = fd.get('tea') ? 1 : 0;
      rec.dairy = fd.get('dairy') ? 1 : 0;
      rec.hfcs = fd.get('hfcs') ? 1 : 0;
      if (!rec.n || !rec.n.trim()) { toast('名字总得填一个'); return; }
      window.Store.submit(rec);
      e.target.reset();
      closeModals();
      toast('「' + rec.n + '」收到了，等我审一下');
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { render(); }, 220);
    });
  }

  function openModal(sel2) { var m = $(sel2); if (m) m.classList.add('on'); document.body.style.overflow = 'hidden'; }
  function closeModals() {
    document.querySelectorAll('.modal.on').forEach(function (m) { m.classList.remove('on'); });
    document.body.style.overflow = '';
  }

  /* 给自测用的小接缝：可以手动把流动推进 N 毫秒，不受帧率影响。
     暂停（手动或鼠标停住）时同样不动 —— 和 advance() 的行为保持一致。 */
  window.__drinkdb = {
    flow: function () { return marquees; },
    stepFlow: function (ms) {
      if (flowPaused || flowHover) return;
      marquees.forEach(function (m) { m.step(ms); });
    },
    isPaused: function () { return flowPaused; },
    isHeld: function () { return flowHover; },
    hold: function (v) { flowHover = !!v; setFlowDot(); },
    state: function () { return active; },
  };

  /* ============================ 启动 ============================ */
  function boot() {
    ALL = window.Store.all();
    var st = window.Store.stats();
    function set(s, v) { var e = $(s); if (e) e.textContent = v; }
    set('#statAll', ALL.length);
    set('#statSeed', st.seed);
    set('#statApproved', st.approved);
    set('#statCats', window.BEV_CATS.length);
    set('#statStorage', st.storage);
    var fa = $('#footAuthor');
    if (fa) fa.textContent = CFG.author ? CFG.author + ' ' + (CFG.authorRole || '') : '';
    var sig = document.querySelector('.logo .sig');
    if (sig) sig.textContent = ('by ' + (CFG.author || '')).trim();
    document.title = CFG.siteName + ' ' + CFG.siteNameEn + ' · ' + CFG.tagline;

    buildFilters();
    buildForm();
    bind();
    readHash();
    syncChips();
    try { if (localStorage.getItem('drinkdb.flowPaused') === '1') flowPaused = true; } catch (e) {}
    setFlowDot();
    if (!window.Store.canLS) $('#lsWarn').style.display = '';
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
