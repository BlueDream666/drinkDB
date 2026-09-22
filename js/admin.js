/* ============================================================
 *  饮库 DrinkDB —— 设计师后台
 *  ------------------------------------------------------------
 *  ⚠️ 本地版说明：这里用浏览器口令做门槛，只能挡「误入」，
 *     不是安全边界。上线公网前必须换成服务端鉴权（README 第三节）。
 * ============================================================ */
(function () {
  var CFG = window.DRINKDB_CONFIG;
  var $ = function (s) { return document.querySelector(s); };
  var editing = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function star(v) { return window.starHTML(Number(v) || 0); }

  /* ============================ 登录 ============================ */
  var LOCK_KEY = 'drinkdb.adminLockUntil';
  var MAX_TRIES = 5;          // 连续错 5 次
  var LOCK_MS = 60 * 1000;    // 锁一分钟

  function lockLeft() {
    var t = 0;
    try { t = parseInt(localStorage.getItem(LOCK_KEY) || '0', 10); } catch (e) {}
    return Math.max(0, t - Date.now());
  }
  function setLock() {
    try { localStorage.setItem(LOCK_KEY, String(Date.now() + LOCK_MS)); } catch (e) {}
  }

  function showGate() {
    $('#gate').style.display = '';
    $('#panel').style.display = 'none';
  }
  function showPanel() {
    $('#gate').style.display = 'none';
    $('#panel').style.display = '';
    $('#logoutBtn').style.display = '';
    renderAll();
  }

  /** 线上模式：口令交给服务器验；本地模式：比对本机摘要 */
  function guard() {
    if (window.DrinkUser && window.DrinkUser.online) {
      return window.DrinkUser.loginAdmin($('#pass').value);
    }
    return Promise.resolve(window.Store.login($('#pass').value));
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('#loginBtn'), inp = $('#pass');

    var left = lockLeft();
    if (left > 0) {
      $('#loginErr').textContent = '错太多次了，' + Math.ceil(left / 1000) + ' 秒后再试。';
      return;
    }

    var pass = inp.value;
    btn.disabled = true;
    // 加一点延迟，抬高暴力猜的成本
    setTimeout(function () {
      guard().then(function (ok) {
        btn.disabled = false;
        if (ok) {
          inp.value = '';
          $('#loginErr').textContent = '';
          showPanel();
          return;
        }
        var n = window.DrinkUser && window.DrinkUser.online
          ? (parseInt(localStorage.getItem('drinkdb.adminTries') || '0', 10) + 1)
          : window.Store.failCount();
        try { localStorage.setItem('drinkdb.adminTries', String(n)); } catch (err) {}
        if (n >= MAX_TRIES) {
          setLock();
          $('#loginErr').textContent = '错 ' + n + ' 次了，锁一分钟。';
        } else {
          $('#loginErr').textContent = '口令不对。（已错 ' + n + ' 次，满 ' + MAX_TRIES + ' 次锁一分钟）';
        }
        inp.value = '';
        inp.focus();
      });
    }, 600);
  });
  $('#logoutBtn').addEventListener('click', function () {
    window.Store.logout();
    if (window.DrinkUser && window.DrinkUser.logoutAdmin) window.DrinkUser.logoutAdmin();
    showGate();
  });

  /* ============================ 待审：评论与建议 ============================ */
  function renderUserQueue() {
    var box = $('#userQueue');
    if (!box) return;
    if (!window.DrinkUser || !window.DrinkUser.online) {
      box.innerHTML = '<p style="color:var(--muted)">'
        + '还没配后端，所以收不到网友的点赞和评论。<br>'
        + '配好后端（见 <code>worker/README.md</code>，全程网页操作十几分钟）这里就会出现待审的评论和建议。</p>';
      return;
    }
    box.innerHTML = '<p style="color:var(--muted)">正在拉取…</p>';
    window.DrinkUser.pending().then(function (d) {
      var c = d.comments || [], s = d.suggestions || [];
      var html = '';
      if (!c.length && !s.length) {
        html = '<p style="color:var(--muted)">没有待审的评论和建议。</p>';
      }
      if (c.length) {
        html += '<h3 class="lab-sub">待审评论 ' + c.length + ' 条</h3>';
        html += c.map(function (x) {
          return '<div class="item">'
            + '<div class="top"><span class="nm">' + esc(x.by) + '</span>'
            + '<span class="meta">' + esc(x.bev) + '</span>'
            + '<span class="tag wait">待审</span>'
            + '<span class="meta" style="margin-left:auto">' + esc(String(x.at).replace('T', ' ').slice(0, 16)) + '</span></div>'
            + '<div class="kv" style="color:var(--text)">' + esc(x.body) + '</div>'
            + '<div class="acts">'
            + '<button class="tb fill" data-umod="comment" data-id="' + x.dbId + '" data-ok="1">放行</button>'
            + '<button class="tb" data-umod="comment" data-id="' + x.dbId + '" data-ok="0">退回</button>'
            + '</div></div>';
        }).join('');
      }
      if (s.length) {
        html += '<h3 class="lab-sub">待处理建议 ' + s.length + ' 条</h3>';
        html += s.map(function (x) {
          return '<div class="item">'
            + '<div class="top"><span class="nm">' + esc(x.by) + '</span>'
            + '<span class="tag wait">待处理</span>'
            + '<span class="meta" style="margin-left:auto">' + esc(String(x.at).replace('T', ' ').slice(0, 16)) + '</span></div>'
            + '<div class="kv" style="color:var(--text)">' + esc(x.body) + '</div>'
            + '<div class="acts">'
            + '<button class="tb fill" data-umod="suggest" data-id="' + x.dbId + '" data-ok="1">已阅</button>'
            + '<button class="tb" data-umod="suggest" data-id="' + x.dbId + '" data-ok="0">归档</button>'
            + '</div></div>';
        }).join('');
      }
      box.innerHTML = html;
    }).catch(function (e) {
      box.innerHTML = '<p style="color:var(--bad)">拉取失败：' + esc(e.message)
        + '<br>检查一下 admin 口令对不对、Worker 是不是还在。</p>';
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-umod]');
    if (!b) return;
    b.disabled = true;
    window.DrinkUser.moderate(b.dataset.umod, b.dataset.id, b.dataset.ok === '1')
      .then(function () { toast('处理好了'); renderUserQueue(); })
      .catch(function (err) { b.disabled = false; toast('失败：' + err.message); });
  });

  /* ============================ 渲染 ============================ */
  function renderAll() {
    var st = window.Store.stats();
    $('#sPending').textContent = st.pending;
    $('#sApproved').textContent = st.approved;
    $('#sRejected').textContent = st.rejected;
    $('#sSeed').textContent = st.seed;
    $('#sTotal').textContent = st.seed + st.approved;
    renderQueue();
    renderApproved();
    renderRejected();
    renderUserQueue();
    var md = $('#modeLine');
    if (md) md.textContent = window.DrinkUser ? window.DrinkUser.modeName() : '—';
  }

  function kv(b) {
    var out = [];
    function add(k, v) { if (v !== '' && v !== null && v !== undefined) out.push('<span><span style="color:var(--faint)">' + k + '</span> ' + esc(v) + '</span>'); }
    add('哪一类', b.c);
    add('糖', b.sg === '' || b.sg === null || b.sg === undefined ? '' : b.sg + ' g/100ml');
    add('糖分几星', b.s);
    add('多甜', b.sw);
    add('代糖', b.sub);
    add('代糖后味', b.at);
    add('热量', b.kc ? b.kc + ' kcal' : '');
    add('气泡', b.cb);
    add('放一夜还剩', b.fd);
    add('冰过', { better: '更好喝', same: '冰不冰都行', worse: '反而差' }[b.ice]);
    add('酒精', b.abv ? b.abv + '%' : '');
    add('咖啡因', b.cf ? b.cf + 'mg' : '');
    add('容量', b.ml ? b.ml + 'ml' : '');
    add('包装', b.pk);
    add('价格', b.p ? '¥' + b.p : '');
    add('好不好买', b.pop);
    add('酸不酸', b.ph);
    return out.join('');
  }

  function flags(b) {
    var f = [];
    if (b.tea) f.push('含茶');
    if (b.dairy) f.push('含奶');
    if (b.hfcs) f.push('含果葡糖浆');
    return f.join(' · ');
  }

  function renderQueue() {
    var list = window.Store.pending();
    $('#queue').innerHTML = list.length ? list.map(function (r) {
      return '<div class="item">'
        + '<div class="top"><span class="nm">' + esc(r.n) + '</span>'
        + '<span class="meta">' + esc(r.b || '未填品牌') + ' · ' + esc(r.c || '其他') + '</span>'
        + '<span class="tag wait">等我审</span>'
        + '<span class="meta" style="margin-left:auto">提交于 ' + esc((r.submittedAt || '').replace('T', ' ').slice(0, 16))
        + (r.by ? ' · 由「' + esc(r.by) + '」提交' : '') + '</span></div>'
        + '<div class="kv">' + kv(r) + (flags(r) ? '<span>' + flags(r) + '</span>' : '') + '</div>'
        + (r.note ? '<div class="kv" style="color:var(--text)">备注：' + esc(r.note) + '</div>' : '')
        + '<div class="acts">'
        + '<button class="tb fill" data-approve="' + r.id + '">通过</button>'
        + '<button class="tb" data-reject="' + r.id + '">退回</button>'
        + '<button class="tb" data-edit="' + r.id + '">改一下再放行</button>'
        + '</div></div>';
    }).join('') : '<p style="color:var(--muted)">还没人提交。网友在前台点「＋ 补一款」之后就会冒到这里。</p>';
  }

  function renderApproved() {
    var list = window.Store.adapter.listApproved();
    $('#approved').innerHTML = list.length ? list.map(function (r) {
      return '<div class="item"><div class="top"><span class="nm">' + esc(r.n) + '</span>'
        + '<span class="meta">' + esc(r.b || '') + ' · ' + esc(r.c || '') + '</span>'
        + '<span class="tag live">放行了</span>'
        + '<span class="meta" style="margin-left:auto">通过于 ' + esc((r.reviewedAt || '').replace('T', ' ').slice(0, 16)) + '</span></div>'
        + '<div class="kv">' + kv(r) + '</div>'
        + '<div class="acts"><button class="tb" data-unapprove="' + r.id + '">从库里撤掉</button></div></div>';
    }).join('') : '<p style="color:var(--muted)">还没放行过网友提交。</p>';
  }

  function renderRejected() {
    var list = window.Store.adapter.listRejected();
    $('#rejected').innerHTML = list.length ? list.map(function (r) {
      return '<div class="item"><div class="top"><span class="nm">' + esc(r.n) + '</span>'
        + '<span class="tag nope">退回了</span>'
        + (r.reason ? '<span class="meta">原因：' + esc(r.reason) + '</span>' : '')
        + '<span class="meta" style="margin-left:auto">' + esc((r.reviewedAt || '').replace('T', ' ').slice(0, 16)) + '</span></div></div>';
    }).join('') : '<p style="color:var(--muted)">没退掉过东西。</p>';
  }

  /* ============================ 审核动作 ============================ */
  document.addEventListener('click', function (e) {
    var a = e.target.dataset || {};
    if (a.approve) {
      window.Store.approve(a.approve);
      toast('放行了，前台立刻能看到');
      renderAll();
    }
    if (a.reject) {
      var reason = prompt('驳回原因（可留空）：', '');
      if (reason === null) return;
      window.Store.reject(a.reject, reason);
      toast('退回去了');
      renderAll();
    }
    if (a.edit) {
      editing = window.Store.pending().filter(function (x) { return x.id === a.edit; })[0];
      if (!editing) return;
      fillEditor(editing);
      $('#editor').style.display = '';
      $('#editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (a.unapprove) {
      if (!confirm('把这条从库里撤掉？')) return;
      window.Store.adapter.removeApproved(a.unapprove);
      toast('撤掉了');
      renderAll();
    }
  });

  var FIELDS = ['n', 'b', 'by', 'c', 'sg', 's', 'sw', 'sub', 'at', 'kc', 'cb', 'fd', 'ice',
    'abv', 'cf', 'ml', 'pk', 'p', 'pop', 'ph', 'img', 'note'];

  function fillEditor(r) {
    FIELDS.forEach(function (k) { var el = $('#e_' + k); if (el) el.value = r[k] === undefined || r[k] === null ? '' : r[k]; });
    ['tea', 'dairy', 'hfcs'].forEach(function (k) { var el = $('#e_' + k); if (el) el.checked = !!r[k]; });
  }

  $('#editorForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!editing) return;
    var patch = {};
    FIELDS.forEach(function (k) { var el = $('#e_' + k); if (el) patch[k] = el.value; });
    ['tea', 'dairy', 'hfcs'].forEach(function (k) { var el = $('#e_' + k); if (el) patch[k] = el.checked ? 1 : 0; });
    if (!patch.n || !patch.n.trim()) { toast('名字总得填一个'); return; }
    window.Store.approve(editing.id, patch);
    editing = null;
    $('#editor').style.display = 'none';
    toast('按你改的放行了');
    renderAll();
  });
  $('#editorCancel').addEventListener('click', function () {
    editing = null; $('#editor').style.display = 'none';
  });

  /* ============================ 备份 / 还原 / 导出 ============================ */
  $('#backupBtn').addEventListener('click', function () {
    window.Exporter.toJSON({
      exportedAt: new Date().toISOString(),
      version: CFG.version,
      store: window.Store.dump(),
    }, 'drinkdb-backup');
    toast('备份存好了');
  });

  $('#exportDbBtn').addEventListener('click', function () {
    window.Exporter.toExcel(window.Store.all(), { title: '饮库 DrinkDB 全库（含已审核网友提交）', filename: '饮库DrinkDB-全库' });
    toast('全库表导好了');
  });

  $('#restoreFile').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        window.Store.restore(d.store || d);
        toast('备份读回来了');
        renderAll();
      } catch (err) { toast('文件解析失败：' + err.message); }
    };
    fr.readAsText(f);
    e.target.value = '';
  });

  $('#wipeBtn').addEventListener('click', function () {
    if (!confirm('把网友的提交和我的审核记录都清掉？我整理的 203 款底库不动。')) return;
    window.Store.restore({ pending: [], approved: [], rejected: [] });
    toast('清干净了');
    renderAll();
  });

  var tTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('up');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { t.classList.remove('up'); }, 2000);
  }

  /* ============================ 启动 ============================ */
  // 类别下拉（编辑表单用）
  $('#e_c').innerHTML = window.BEV_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');

  if (window.Store.isAdmin()) showPanel(); else showGate();

})();
