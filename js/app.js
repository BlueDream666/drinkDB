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
  var activePreset = null;   // 当前选中的场景预设 id
  var lastDrawnId = null;    // 最近抽签抽中的那款
  var view = 'browse';       // browse | compare | lab
  var labInited = {};
  var pendingView = null;    // 从网址里读到的视图，等 boot 完再切

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
  function activeCount() {
    var n = 0;
    ROWS.forEach(function (r) { n += pickedOf(r.key).n; });
    return n + (activePreset ? 1 : 0);
  }
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
    var preset = activePreset ? window.DrinkPresets.byId(activePreset) : null;
    return ALL.filter(function (b) {
      if (keyword && !hitKeyword(b)) return false;
      if (preset && !preset.test(b)) return false;
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

  /* ============================ 两排横滑 ============================
   * 之前是 JS 逐帧自动平移，卡片一多（两排合计 400 多个 <img>）就卡成幻灯片，
   * 手机上尤其明显。现在改回浏览器原生的横向滚动：不动就完全静止，
   * 划动交给 GPU，滚动惯性也是系统原生的手感，几乎不占 CPU。
   * ================================================================ */
  function renderRows(list) {
    var half = Math.ceil(list.length / 2);
    var size = isPhone() ? 62 : 78;
    function row(arr) {
      return '<div class="flowtrack">'
        + arr.map(function (x) { return cardHTML(x, size); }).join('')
        + '</div>';
    }
    var ra = $('#flowA'), rb = $('#flowB');
    var keepA = ra.scrollLeft, keepB = rb.scrollLeft;
    ra.innerHTML = row(list.slice(0, half));
    rb.innerHTML = row(list.slice(half));
    // 重新渲染后把滚动位置还原，别让人白滑
    ra.scrollLeft = keepA;
    rb.scrollLeft = keepB;
  }

  /* ============================ 渲染 ============================ */
  function render() {
    var list = results();
    var flow = isFlow();

    $('#count').textContent = list.length === ALL.length
      ? '全部 ' + ALL.length + ' 款'
      : list.length + ' / ' + ALL.length + ' 款';
    $('#modeTag').textContent = flow ? '左右划看' : '筛选结果';
    $('#modeTag').className = 'tag ' + (flow ? 'live' : 'wait');
    $('#fnum').textContent = activeCount();
    $('#fnum').setAttribute('data-n', activeCount());
    $('#clearBtn').style.display = flow ? 'none' : '';

    if (flow) {
      $('#flowZone').style.display = '';
      $('#gridZone').style.display = 'none';
      renderRows(list);
    } else {
      $('#flowZone').style.display = 'none';
      $('#gridZone').style.display = '';
      $('#gridZone').innerHTML = list.length
        ? list.map(function (b) { return cardHTML(b, isPhone() ? 62 : 78); }).join('')
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
    // 预设也算一个已选条件，显示在摘要条最前面
    var preset = activePreset ? window.DrinkPresets.byId(activePreset) : null;
    var head = preset
      ? '<button class="sm inc preset" type="button" data-clear-preset="1">预设：' + esc(preset.name) + ' ✕</button>'
      : '';
    el.innerHTML = head + out.map(function (x) {
      return '<button class="sm ' + (x.no ? 'exc' : 'inc') + '" type="button" data-k="' + x.k + '" data-i="' + x.i + '">'
        + (x.no ? '不要 ' : '') + esc(x.t) + ' ✕</button>';
    }).join('');
    var dh = $('#drawHint');
    if (dh) dh.textContent = (activePreset || anyFilter() || keyword) ? '' : '（没筛，就从全部里抽）';
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

    // 场景预设：不是属性，是「什么时候喝」，点一下自动配好条件
    var presets = window.DrinkPresets.list;
    html += '<div class="frow presetsrow"><div class="fk">预设</div><div class="fv">'
      + presets.map(function (p) {
        return '<button class="chip preset" type="button" data-preset="' + p.id + '"'
          + ' aria-pressed="false" title="' + esc(p.hint) + '">' + esc(p.name) + '</button>';
      }).join('')
      + '<button class="chip" type="button" id="qClear">全清掉</button>'
      + '</div></div>';

    // 随机抽签放在最后
    html += '<div class="frow drawrow"><div class="fk">抽签</div><div class="fv">'
      + '<button class="chip draw" type="button" id="drawBtn">从筛出来的里面抽一瓶</button>'
      + '<span class="fhint" id="drawHint" style="align-self:center"></span>'
      + '</div></div>';

    $('#filterRows').innerHTML = html;
  }

  function syncChips() {
    document.querySelectorAll('.chip[data-k]').forEach(function (c) {
      c.setAttribute('data-st', String(stateOf(c.dataset.k, +c.dataset.i)));
    });
    document.querySelectorAll('.chip[data-preset]').forEach(function (c) {
      var on = c.dataset.preset === activePreset;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.setAttribute('data-st', on ? '1' : '0');
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

    var cubes = window.DrinkPresets.sugarCubes(b);
    if (cubes > 0) {
      r('一瓶 =', '<b style="font-size:17px">' + cubes + ' 块方糖</b>　<span class="sub">'
        + window.DrinkPresets.sugarGrams(b) + ' g 糖 / 整瓶 ' + b.ml + 'ml</span>');
    }
    var place = window.DrinkPresets.origin(b);
    if (place) r('产地', place.province + ' ' + place.city);

    var liked = window.DrinkUser.liked(b.id);
    var likeN = window.DrinkUser.likeCount(b.id);
    var cmts = window.DrinkUser.visibleComments(b.id);
    var inCmp = window.DrinkCompare.ids().indexOf(b.id) >= 0;

    $('#detailTitle').textContent = b.n;
    $('#detailBody').innerHTML = '<div class="head">'
      + '<div>' + window.drinkArt(b, 96) + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<h2>' + esc(b.n) + '</h2>'
      + '<div class="sub">' + esc(b.b) + ' · ' + esc(b.c) + (b.en ? ' · ' + esc(b.en) : '') + '</div>'
      + '<div class="sub" style="margin-top:6px">' + esc(b.brief) + '</div>'
      + '<div class="dacts">'
      + '  <button class="likebtn' + (liked ? ' on' : '') + '" type="button" data-like="' + b.id + '">'
      + '    <span class="heart">' + (liked ? '♥' : '♡') + '</span> <b data-like-n="' + b.id + '">' + likeN + '</b> 人点了'
      + '  </button>'
      + '  <button class="tb" type="button" data-addcmp="' + b.id + '">' + (inCmp ? '已在对比里' : '加入对比') + '</button>'
      + '</div>'
      + '</div></div>'
      + '<dl>' + rows.join('') + '</dl>'
      + '<div class="cmtbox">'
      + '  <div class="cmthead">评论 <b>' + cmts.length + '</b> 条'
      + '    <span class="sub">' + window.DrinkUser.modeName() + '</span></div>'
      + '  <div class="cmtlist">'
      + (cmts.length ? cmts.map(function (c) {
        return '<div class="cmtitem"><div class="cmtmeta">' + esc(c.by) + ' · '
          + String(c.at || '').replace('T', ' ').slice(0, 16) + '</div>'
          + '<div class="cmtbody">' + esc(c.body) + '</div></div>';
      }).join('') : '<p class="sub" style="margin:6px 0">还没人说。你来说第一句？</p>')
      + '  </div>'
      + '  <div class="cmtform">'
      + '    <textarea data-cmt-body="' + b.id + '" rows="2" placeholder="喝过之后什么感觉？"></textarea>'
      + '    <input data-cmt-by="' + b.id + '" placeholder="怎么称呼（可留空）" maxlength="20">'
      + '    <button class="tb fill" type="button" data-cmt-send="' + b.id + '">发评论</button>'
      + '  </div>'
      + (window.DrinkUser.online ? '' : '<p class="fhint">现在是本地模式：点赞和评论只存在你这台设备上，'
        + '别人看不到。配上后端（见 worker/ 目录）就会变成大家共用的数据。</p>')
      + '</div>';
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
    if (q.preset && window.DrinkPresets.byId(q.preset)) activePreset = q.preset;
    if (q.view && ['browse', 'compare', 'lab'].indexOf(q.view) >= 0) pendingView = q.view;
    if (q.cmp) window.DrinkCompare.set(String(q.cmp).split(','));
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
    if (activePreset) parts.push('preset=' + activePreset);
    if (view !== 'browse') parts.push('view=' + view);
    var h = parts.length ? '#' + parts.join('&') : '#';
    if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } }
  }

  /* ============================ 动作 ============================ */
  function cycle(k, i) {
    var s = sel(k);
    s[i] = ((s[i] || OFF) + 1) % 3;
    syncChips(); render();
  }

  /** 点预设：配好条件。再点一次取消 */
  function togglePreset(id) {
    activePreset = (activePreset === id) ? null : id;
    var p = activePreset ? window.DrinkPresets.byId(activePreset) : null;
    syncChips(); render();
    if (p) toast('预设：' + p.name + '　' + p.hint);
  }

  function clearAll(say) {
    active = {}; keyword = ''; sortKey = 'default'; activePreset = null; lastDrawnId = null;
    var sb = $('#search'); if (sb) sb.value = '';
    var so = $('#sort'); if (so) so.value = 'default';
    var db = $('#drawBox'); if (db) db.style.display = 'none';
    syncChips(); render();
    if (say !== false) toast('条件都清掉了');
  }

  /* ============================ 随机抽签 ============================ */
  var drawTimer = null;
  function doDraw() {
    var list = results();
    var box = $('#drawBox'), btn = $('#drawBtn');
    if (!box) return;
    if (!list.length) { toast('筛出来是空的，先松一松条件'); return; }

    if (drawTimer) clearInterval(drawTimer);
    box.style.display = '';
    btn.disabled = true;

    var final = list[Math.floor(Math.random() * list.length)];
    var ticks = 0, total = 16 + Math.floor(Math.random() * 8);

    box.innerHTML = '<div class="drawcard rolling"><div class="drawlabel">正在抽…</div>'
      + '<div class="drawname" id="drawName">…</div></div>';

    drawTimer = setInterval(function () {
      ticks++;
      var r = list[Math.floor(Math.random() * list.length)];
      var nEl = $('#drawName');
      if (nEl) nEl.textContent = r.n;
      if (ticks < total) return;

      clearInterval(drawTimer); drawTimer = null;
      btn.disabled = false;
      lastDrawnId = final.id;
      box.innerHTML = '<div class="drawcard landed">'
        + '<div class="drawart">' + window.drinkArt(final, 84) + '</div>'
        + '<div class="drawinfo">'
        + '<div class="drawlabel">抽到了</div>'
        + '<div class="drawname">' + esc(final.n) + '</div>'
        + '<div class="drawsub">' + esc(final.b) + ' · ' + esc(final.c) + ' · ' + esc(final.brief) + '</div>'
        + '<div class="drawacts">'
        + '<button class="tb fill" type="button" data-draw-locate="' + final.id + '">在下面找到它</button>'
        + '<button class="tb" type="button" data-draw-open="' + final.id + '">看详情</button>'
        + '<button class="tb" type="button" data-draw-again="1">再抽一次</button>'
        + '</div></div></div>';

      // 同步在网格里高亮
      render();
      jumpTo(final.id);
    }, 65);
  }

  /** 在列表里把某款高亮并滚过去 */
  function jumpTo(id) {
    var el = document.querySelector('.card[data-id="' + id + '"]');
    if (!el) return;
    document.querySelectorAll('.card.drawn').forEach(function (c) { c.classList.remove('drawn'); });
    el.classList.add('drawn');
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
  }

  /* ============================ 视图切换 ============================ */
  function switchView(v) {
    view = v;
    ['browse', 'compare', 'lab'].forEach(function (k) {
      var el = document.getElementById('view-' + k);
      if (el) el.style.display = (k === v) ? '' : 'none';
    });
    document.querySelectorAll('.vt').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false');
    });
    try { sessionStorage.setItem('drinkdb.view', v); } catch (e) {}
    if (v === 'compare') renderCompare();
    if (v === 'lab') initLab();
    window.scrollTo(0, 0);
  }

  /* ============================ 对比 ============================ */
  function renderCompare() {
    var host = $('#cmpHost');
    if (!host) return;
    window.DrinkCompare.render(host, ALL);

    // 已选小标签
    var picked = $('#cmpPicked');
    var ids = window.DrinkCompare.ids();
    picked.innerHTML = ids.map(function (id) {
      var b = ALL.filter(function (x) { return x.id === id; })[0];
      if (!b) return '';
      return '<span class="cmp-pill">' + esc(b.n)
        + '<button type="button" data-cmp-remove="' + id + '" title="移出">✕</button></span>';
    }).join('') || '<span class="sub">还没选（最多 3 款）</span>';
  }

  function cmpSearch(kw) {
    var host = $('#cmpHits');
    kw = (kw || '').trim().toLowerCase();
    if (!kw) { host.innerHTML = ''; return; }
    var hits = ALL.filter(function (b) {
      return (b.n + ' ' + b.b + ' ' + b.c).toLowerCase().indexOf(kw) >= 0;
    }).slice(0, 8);
    host.innerHTML = hits.length ? hits.map(function (b) {
      var on = window.DrinkCompare.ids().indexOf(b.id) >= 0;
      return '<button class="cmp-hit' + (on ? ' on' : '') + '" type="button" data-cmp-add="' + b.id + '">'
        + esc(b.n) + '<em>' + esc(b.b) + '</em></button>';
    }).join('') : '<span class="sub">没找到</span>';
  }

  /* ============================ 创新区 ============================ */
  var labSlotApi = null;
  function initLab() {
    if (!labInited.slot) {
      labInited.slot = true;
      labSlotApi = window.DrinkLab.slot($('#labSlot'), ALL, {
        poolFn: function () { return results(); },
        onPick: function (b) {
          lastDrawnId = b.id;
          $('#labSlot').querySelector('.slot-name').textContent = b.n;
        },
      });
    } else if (labSlotApi) {
      labSlotApi.updateCount();
    }
    if (!labInited.map) {
      labInited.map = true;
      window.DrinkLab.map($('#labMap'), ALL, openDetail);
    }
    if (!labInited.cubes) {
      labInited.cubes = true;
      window.DrinkLab.cubes($('#labCubes'), ALL, openDetail);
    }
    if (!labInited.suggest) {
      labInited.suggest = true;
      window.DrinkLab.suggest($('#labSuggest'), function () {
        $('#statMode').textContent = window.DrinkUser.modeName();
      });
    }
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
    // 筛选按钮三态 + 预设 + 抽签
    $('#filterRows').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      if (c.id === 'qClear') return clearAll();
      if (c.id === 'drawBtn') return doDraw();
      if (c.dataset.preset) return togglePreset(c.dataset.preset);
      if (c.dataset.k !== undefined) cycle(c.dataset.k, +c.dataset.i);
    });

    // 摘要点掉
    on('#summary', 'click', function (e) {
      var b = e.target.closest('.sm');
      if (!b) return;
      if (b.dataset.clearPreset) { activePreset = null; syncChips(); render(); return; }
      var s = sel(b.dataset.k); s[b.dataset.i] = OFF;
      syncChips(); render();
    });

    // 抽签结果上的按钮
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset && t.dataset.drawAgain) return doDraw();
      if (t.dataset && t.dataset.drawLocate) return jumpTo(t.dataset.drawLocate);
      if (t.dataset && t.dataset.drawOpen) return openDetail(t.dataset.drawOpen);
    });

    // 视图切换
    document.querySelectorAll('.vt').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.dataset.view); });
    });

    // 对比区
    on('#cmpSearch', 'input', function (e) { cmpSearch(e.target.value); });
    on('#cmpClear', 'click', function () { window.DrinkCompare.clear(); renderCompare(); cmpSearch($('#cmpSearch').value); });
    document.addEventListener('click', function (e) {
      var t = e.target;
      var add = t.closest && t.closest('[data-cmp-add]');
      if (add) {
        window.DrinkCompare.add(add.dataset.cmpAdd);
        renderCompare(); cmpSearch($('#cmpSearch').value);
        return;
      }
      var rm = t.closest && t.closest('[data-cmp-remove]');
      if (rm) {
        window.DrinkCompare.remove(rm.dataset.cmpRemove);
        renderCompare(); cmpSearch($('#cmpSearch').value);
        return;
      }
      var set = t.closest && t.closest('[data-cmp-set]');
      if (set) {
        window.DrinkCompare.set(set.dataset.cmpSet.split(','));
        renderCompare();
        return;
      }
      var ac = t.closest && t.closest('[data-addcmp]');
      if (ac) {
        var id = ac.dataset.addcmp;
        if (window.DrinkCompare.ids().indexOf(id) >= 0) {
          window.DrinkCompare.remove(id);
          ac.textContent = '加入对比';
        } else {
          window.DrinkCompare.add(id);
          ac.textContent = '已在对比里';
          toast('加进对比了，切到「对比」看');
        }
        return;
      }
    });

    // 点赞
    document.addEventListener('click', function (e) {
      var lb = e.target.closest && e.target.closest('[data-like]');
      if (!lb) return;
      var id = lb.dataset.like;
      var res = window.DrinkUser.toggleLike(id);
      lb.classList.toggle('on', res.on);
      lb.querySelector('.heart').textContent = res.on ? '♥' : '♡';
      var n = lb.querySelector('[data-like-n]');
      if (n) n.textContent = res.n;
    });

    // 发评论
    document.addEventListener('click', function (e) {
      var sb = e.target.closest && e.target.closest('[data-cmt-send]');
      if (!sb) return;
      var id = sb.dataset.cmtSend;
      var bodyEl = document.querySelector('[data-cmt-body="' + id + '"]');
      var byEl = document.querySelector('[data-cmt-by="' + id + '"]');
      sb.disabled = true;
      window.DrinkUser.addComment(id, bodyEl.value, byEl.value).then(function () {
        sb.disabled = false;
        toast(window.DrinkUser.online ? '发出去了，等整理者放行' : '记下了（仅本机可见）');
        openDetail(id);
      }).catch(function (err) {
        sb.disabled = false;
        toast(err.message || '没发出去');
      });
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

  /* 给自测用的小接缝 */
  window.__drinkdb = {
    rows: function () { return [$('#flowA'), $('#flowB')]; },
    scrollOf: function () { return [$('#flowA').scrollLeft, $('#flowB').scrollLeft]; },
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
    ['#footAuthor', '#footAuthor2', '#footAuthor3'].forEach(function (sel3) {
      var e = $(sel3);
      if (e) e.textContent = CFG.author ? CFG.author + ' ' + (CFG.authorRole || '') : '';
    });
    var sig = document.querySelector('.logo .sig');
    if (sig) sig.textContent = ('by ' + (CFG.author || '')).trim();
    document.title = CFG.siteName + ' ' + CFG.siteNameEn + ' · ' + CFG.tagline;

    buildFilters();
    buildForm();
    bind();
    window.DrinkCompare.restore();
    readHash();
    syncChips();
    if (!window.Store.canLS) $('#lsWarn').style.display = '';

    // 互动数据：线上模式先拉一次；本地模式直接标出来
    set('#statMode', window.DrinkUser.modeName());
    window.DrinkUser.load().then(function () {
      set('#statMode', window.DrinkUser.modeName());
    });

    render();

    // 记住上次在哪个视图（网址里指定的优先）
    var v = pendingView;
    if (!v) { try { v = sessionStorage.getItem('drinkdb.view'); } catch (e) {} }
    if (v && v !== 'browse') switchView(v);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
