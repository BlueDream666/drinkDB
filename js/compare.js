/* ============================================================
   饮库 —— 饮料对比
   ------------------------------------------------------------
   最多选 3 款，一行一个属性横向比。
   每行会自动指出「谁更符合你的需求」，省得来回翻。
   ============================================================ */
(function (global) {

  var MAX = 3;
  var picked = [];                 // 存 id

  /* 比较规则：value 越小越好的字段（默认）、越大越好的字段 */
  var ROWS = [
    { k: 'c', label: '哪一类', fmt: function (b) { return b.c; } },
    { k: 'sg', label: '含糖 g/100ml', fmt: function (b) { return b.sg === null ? '未标注' : b.sg; }, lower: true },
    {
      k: 'cube', label: '一整瓶 = 几块方糖',
      fmt: function (b) {
        var n = global.DrinkPresets.sugarCubes(b);
        if (!n) return b.sg === 0 ? '0 块' : '未标注';
        return n + ' 块（' + global.DrinkPresets.sugarGrams(b) + ' g）';
      },
      lower: true,
      num: function (b) { return b.sg === null ? null : global.DrinkPresets.sugarCubes(b); },
    },
    { k: 's', label: '糖分星级', stars: true, lower: true },
    { k: 'sw', label: '甜度星级', stars: true, lower: true },
    { k: 'sub', label: '代糖', fmt: function (b) { return b.hasSub ? b.sub : '没用'; } },
    { k: 'cb', label: '气泡强度', stars: true, lower: true },
    { k: 'fd', label: '开盖一夜后剩的气', stars: true, higher: true },
    { k: 'ice', label: '冰镇', fmt: function (b) { return { better: '冰过更好喝', same: '冰不冰都行', worse: '冰了反而差' }[b.ice]; } },
    { k: 'cf', label: '咖啡因 mg/100ml', fmt: function (b) { return b.cf || '无'; }, lower: true },
    { k: 'abv', label: '酒精 %vol', fmt: function (b) { return b.abv || '无'; }, lower: true },
    { k: 'dairy', label: '奶', fmt: function (b) { return b.dairy ? '含奶' : '不含'; } },
    { k: 'tea', label: '茶', fmt: function (b) { return b.tea ? '含茶' : '不含'; } },
    { k: 'hfcs', label: '果葡糖浆', fmt: function (b) { return b.hfcs ? '含' : '不含'; }, lower: true },
    { k: 'ml', label: '一瓶多少 ml', fmt: function (b) { return b.ml + ' ml'; } },
    { k: 'p', label: '参考价', fmt: function (b) { return b.p === null ? '—' : '¥' + b.p; }, lower: true },
    { k: 'pop', label: '好不好买', stars: true, higher: true },
    { k: 'ph', label: '酸感', stars: true, higher: true },
  ];

  function star(v) { return global.starHTML(v) + ' <span class="sub">' + v + '</span>'; }

  /* ============================ 渲染 ============================ */
  function render(host, all) {
    var list = picked.map(function (id) {
      return all.filter(function (b) { return b.id === id; })[0];
    }).filter(Boolean);

    if (!list.length) {
      host.innerHTML = '<div class="cmp-empty">'
        + '<p>还没有选饮料。上面搜一款加进来，最多同时比 3 款。</p>'
        + '<div class="cmp-suggest">' + suggestHTML(all) + '</div>'
        + '</div>';
      return;
    }

    // 表头
    var head = '<tr><th class="cmp-rowhead"></th>'
      + list.map(function (b) {
        return '<th class="cmp-col"><div class="cmp-card">'
          + '<button class="cmp-x" type="button" data-cmp-remove="' + b.id + '" title="移出对比">✕</button>'
          + '<div class="cmp-art">' + global.drinkArt(b, 64) + '</div>'
          + '<div class="cmp-name">' + esc(b.n) + '</div>'
          + '<div class="cmp-brand">' + esc(b.b) + '</div>'
          + '</div></th>';
      }).join('') + '</tr>';

    // 数据行
    var body = ROWS.map(function (row) {
      // 先算出「可比数值」，用来判断这一行谁更好。
      // 注意必须按下标逐个算，不能拿值去 indexOf —— 值可能重复。
      var nums = list.map(function (b) {
        if (row.num) return row.num(b);
        var v = b[row.k];
        if (typeof v === 'number') return v;
        if (v === true) return 1;
        if (v === false) return 0;
        return null;
      });

      var best = -1;
      if (row.lower || row.higher) {
        var bb = null;
        nums.forEach(function (v) {
          if (v === null || v === undefined) return;
          if (bb === null || (row.higher ? v > bb : v < bb)) bb = v;
        });
        if (bb !== null) {
          var valid = nums.filter(function (v) { return v !== null && v !== undefined; });
          var allSame = valid.every(function (v) { return v === bb; });
          if (!allSame && valid.length > 1) best = nums.indexOf(bb);
        }
      }

      var tds = list.map(function (b, i) {
        var v = b[row.k];
        var text = row.stars ? star(typeof v === 'number' ? v : 0)
          : row.fmt ? esc(String(row.fmt(b)))
          : esc(String(v === true ? '是' : v === false ? '否' : v));
        return '<td class="cmp-cell' + (i === best ? ' best' : '') + '">' + text + '</td>';
      }).join('');

      return '<tr><th class="cmp-rowhead">' + row.label + '</th>' + tds + '</tr>';
    }).join('');

    host.innerHTML = '<table class="cmp-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
      + '<p class="fhint">带底色的一格是这一行里更符合「糖少、没气」那个方向的。'
      + '「开盖一夜后剩的气」和「好不好买」「酸感」是越多越好，其余越少越好。</p>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** 没选东西时给几个建议组合 */
  function suggestHTML(all) {
    var groups = [
      ['可乐之争', ['coke-classic', 'coke-zero', 'pepsi-zero']],
      ['茶饮三档', ['dongfangshuye-oil', 'suntory-oolong', 'wugy-iced-tea']],
      ['水也分三种', ['nfsq-natural', 'cestbon', 'watsons-distilled']],
      ['全是气泡', ['perrier', 'genki-sparkling', 'sprite-zero']],
      ['一瓶管饱', ['moutai', 'liqueur', 'baijiu-low']],
    ];
    return groups.map(function (g) {
      var ids = g[1].filter(function (id) { return all.some(function (b) { return b.id === id; }); });
      if (ids.length < 2) return '';
      return '<button class="chip" type="button" data-cmp-set="' + ids.join(',') + '">' + g[0] + '</button>';
    }).join('');
  }

  /* ============================ 对外 ============================ */
  global.DrinkCompare = {
    max: MAX,
    ids: function () { return picked.slice(); },
    add: function (id) {
      if (picked.indexOf(id) >= 0) return false;
      if (picked.length >= MAX) picked.shift();
      picked.push(id);
      save();
      return true;
    },
    remove: function (id) {
      picked = picked.filter(function (x) { return x !== id; });
      save();
    },
    set: function (ids) {
      picked = ids.slice(0, MAX);
      save();
    },
    clear: function () { picked = []; save(); },
    restore: function () {
      try { picked = JSON.parse(sessionStorage.getItem('drinkdb.cmp') || '[]').slice(0, MAX); } catch (e) { picked = []; }
    },
    render: render,
    ROWS: ROWS,
  };

  function save() {
    try { sessionStorage.setItem('drinkdb.cmp', JSON.stringify(picked)); } catch (e) {}
  }

})(window);
