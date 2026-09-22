/* ============================================================
   饮库 —— 创新区
   ------------------------------------------------------------
   ① 今晚喝什么：老虎机式抽签，带滚动动画
   ② 中国汽水地图：按地理大区 / 省份归拢地方饮料
   ③ 方糖可视化：把含糖量换成一瓶几块方糖
   ④ 提建议：用户把想法丢给整理者
   ============================================================ */
(function (global) {

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function $(s, r) { return (r || document).querySelector(s); }

  /* ============================ ① 抽签机 ============================ */
  var spinTimer = null;

  function slot(host, all, opts) {
    opts = opts || {};
    var poolDefault = opts.pool || all;

    host.innerHTML = ''
      + '<div class="slot" id="slotBox">'
      + '  <div class="slot-window"><span class="slot-name" id="slotName">准备好就摇</span></div>'
      + '  <div class="slot-sub" id="slotSub">从当前的筛选结果里随机挑一瓶</div>'
      + '</div>'
      + '<div class="slot-acts">'
      + '  <button class="tb fill" type="button" id="slotGo">摇一瓶</button>'
      + '  <button class="tb" type="button" id="slotAgain" style="display:none">换一个</button>'
      + '  <span class="fhint" id="slotCount"></span>'
      + '</div>';

    function updateCount() {
      var pool = opts.poolFn ? opts.poolFn() : poolDefault;
      $('#slotCount', host).textContent = '候选 ' + pool.length + ' 瓶';
      return pool;
    }
    updateCount();
    host.__updateCount = updateCount;

    function spin() {
      var pool = opts.poolFn ? opts.poolFn() : poolDefault;
      if (!pool.length) {
        $('#slotName', host).textContent = '筛出来是空的';
        $('#slotSub', host).textContent = '先松一松筛选条件再摇';
        return;
      }
      if (spinTimer) clearInterval(spinTimer);

      var nameEl = $('#slotName', host), subEl = $('#slotSub', host);
      var box = $('#slotBox', host);
      box.classList.add('spinning');
      $('#slotGo', host).disabled = true;
      $('#slotAgain', host).style.display = 'none';

      var final = pool[Math.floor(Math.random() * pool.length)];
      var ticks = 0;
      var total = 22 + Math.floor(Math.random() * 8);

      spinTimer = setInterval(function () {
        ticks++;
        var r = pool[Math.floor(Math.random() * pool.length)];
        nameEl.textContent = r.n;
        subEl.textContent = r.b;
        if (ticks >= total) {
          clearInterval(spinTimer); spinTimer = null;
          box.classList.remove('spinning');
          box.classList.add('landed');
          setTimeout(function () { box.classList.remove('landed'); }, 900);
          nameEl.textContent = final.n;
          subEl.textContent = final.b + ' · ' + final.c + ' · ' + final.brief;
          $('#slotGo', host).disabled = false;
          $('#slotAgain', host).style.display = '';
          if (opts.onPick) opts.onPick(final);
        }
      }, 60);
    }

    $('#slotGo', host).addEventListener('click', spin);
    $('#slotAgain', host).addEventListener('click', spin);
    return { spin: spin, updateCount: updateCount };
  }

  /* ============================ ② 中国汽水地图 ============================ */
  var REGION_ORDER = ['华北', '东北', '华东', '华中', '华南', '西南', '西北', '港澳台'];

  function mapView(host, all, onOpen) {
    var groups = {};
    all.forEach(function (b) {
      var o = global.DrinkPresets.origin(b);
      if (!o) return;
      if (!groups[o.region]) groups[o.region] = {};
      if (!groups[o.region][o.province]) groups[o.region][o.province] = [];
      groups[o.region][o.province].push(b);
    });

    var total = Object.keys(groups).reduce(function (s, r) {
      return s + Object.keys(groups[r]).reduce(function (t, p) { return t + groups[r][p].length; }, 0);
    }, 0);

    var html = '<p class="fhint">按产地归拢了 <b>' + total + '</b> 款。'
      + '拿不准产地的没往里塞——硬猜不如空着。</p><div class="mapwrap">';

    REGION_ORDER.forEach(function (r) {
      if (!groups[r]) return;
      var provinces = Object.keys(groups[r]).sort();
      var n = provinces.reduce(function (t, p) { return t + groups[r][p].length; }, 0);
      html += '<section class="mapregion"><h3>' + r + '<em>' + n + ' 款</em></h3>';
      provinces.forEach(function (p) {
        html += '<div class="mapprov"><span class="provname">' + p + '</span><div class="provlist">';
        groups[r][p].forEach(function (b) {
          html += '<button class="mapchip" type="button" data-id="' + b.id + '">'
            + esc(b.n) + '<em>' + esc(b.b) + '</em></button>';
        });
        html += '</div></div>';
      });
      html += '</section>';
    });
    html += '</div>';

    host.innerHTML = html;
    host.querySelectorAll('.mapchip').forEach(function (el) {
      el.addEventListener('click', function () { if (onOpen) onOpen(el.dataset.id); });
    });
  }

  /* ============================ ③ 方糖可视化 ============================ */
  function cubeRow(b) {
    var n = global.DrinkPresets.sugarCubes(b);
    if (!n) return '';
    var full = Math.floor(n);
    var half = n - full >= 0.4;
    var icons = '';
    for (var i = 0; i < full && i < 24; i++) icons += '<i class="cube"></i>';
    if (half && full < 24) icons += '<i class="cube half"></i>';
    if (n > 24) icons += '<span class="cube-more">+更多</span>';
    return '<div class="cuberow" data-id="' + b.id + '">'
      + '<div class="cubename">' + esc(b.n) + '<em>' + esc(b.b) + ' · ' + b.ml + 'ml</em></div>'
      + '<div class="cubes">' + icons + '</div>'
      + '<div class="cubenum"><b>' + n + '</b> 块<em>' + global.DrinkPresets.sugarGrams(b) + ' g 糖</em></div>'
      + '</div>';
  }

  function cubes(host, all, onOpen) {
    var withSugar = all.filter(function (b) { return b.sg !== null && b.sg > 0 && b.ml; });
    var top = withSugar.slice().sort(function (a, b) {
      return global.DrinkPresets.sugarCubes(b) - global.DrinkPresets.sugarCubes(a);
    }).slice(0, 12);
    var zero = all.filter(function (b) { return b.sg === 0; }).length;

    host.innerHTML = ''
      + '<p class="fhint">按一块方糖 <b>' + global.DrinkPresets.CUBE_G + ' g</b> 折算，算的是<b>一整瓶</b>，不是每 100ml。'
      + '全库有 <b>' + zero + '</b> 款是真的一颗方糖都没有的。</p>'
      + '<div class="cubelist">' + top.map(cubeRow).join('') + '</div>'
      + '<p class="fhint">翻过来看：一瓶可乐的糖，抵得上十几块方糖。</p>';

    host.querySelectorAll('.cuberow').forEach(function (el) {
      el.addEventListener('click', function () { if (onOpen) onOpen(el.dataset.id); });
    });
  }

  /* ============================ ④ 提建议 ============================ */
  function suggestBox(host, onDone) {
    var msg = '';
    host.innerHTML = ''
      + '<p class="fhint">这里是「说点什么」的地方：想要什么功能、数据哪里不对、想加哪款饮料，都可以写。'
      + '内容会进到整理者的审核台。现在模式：<b id="sgMode">' + global.DrinkUser.modeName() + '</b></p>'
      + '<div class="field"><label>你想说的</label><textarea id="sgBody" rows="4" placeholder="比如：希望加个「按价格排序」的快捷入口；或者 某某牌柚茶 的数据不对"></textarea></div>'
      + '<div class="field" style="max-width:240px"><label>怎么称呼你（可留空）</label><input id="sgBy" placeholder="匿名也行"></div>'
      + '<div style="display:flex;gap:9px;align-items:center;margin-top:12px">'
      + '  <button class="tb fill" type="button" id="sgSend" style="height:36px;padding:0 16px">发出去</button>'
      + '  <span class="fhint" id="sgMsg">' + msg + '</span>'
      + '</div>'
      + '<div class="sglist" id="sgList"></div>';

    function refresh() {
      var list = global.DrinkUser.suggestions().slice().reverse();
      $('#sgList', host).innerHTML = list.length
        ? '<h3 class="lab-sub">我发过的</h3>' + list.map(function (s) {
          return '<div class="sgitem"><div class="sgtop">' + esc(s.by) + ' · '
            + String(s.at).replace('T', ' ').slice(0, 16)
            + '<span class="tag wait">待处理</span></div><div class="sgtext">' + esc(s.body) + '</div></div>';
        }).join('')
        : '';
    }
    refresh();

    $('#sgSend', host).addEventListener('click', function () {
      var body = $('#sgBody', host).value;
      var by = $('#sgBy', host).value;
      var btn = this;
      btn.disabled = true;
      global.DrinkUser.addSuggestion(body, by).then(function () {
        $('#sgBody', host).value = '';
        $('#sgMsg', host).textContent = '收到了，谢谢';
        refresh();
        btn.disabled = false;
        if (onDone) onDone();
      }).catch(function (e) {
        $('#sgMsg', host).textContent = e.message || '没发出去，再试一次';
        btn.disabled = false;
      });
    });
  }

  global.DrinkLab = {
    slot: slot,
    map: mapView,
    cubes: cubes,
    suggest: suggestBox,
    REGION_ORDER: REGION_ORDER,
  };

})(window);
