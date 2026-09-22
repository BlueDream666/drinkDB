/* ============================================================
 *  饮库 DrinkDB —— 存储层
 *  ------------------------------------------------------------
 *  设计要点：把「数据从哪来、存到哪去」抽成一个适配器，
 *  本地版用 LocalAdapter（localStorage），上线后换成 RemoteAdapter
 *  （指向你自己的 API / Supabase），前台代码一行都不用改。
 *
 *  ┌─ 数据来源分层 ────────────────────────────────────────────┐
 *  │ 1. 种子库 js/data/*.js   —— 203 款，随代码走，是唯一真源    │
 *  │ 2. 已通过审核的用户提交   —— localStorage 里的 approved[]  │
 *  │ 3. 待审核的用户提交       —— localStorage 里的 pending[]   │
 *  └──────────────────────────────────────────────────────────┘
 *  前台展示 = 1 + 2；后台管理 = 3。
 * ============================================================ */
(function (global) {

  var NS = 'drinkdb.v1';
  var K_PENDING = NS + '.pending';
  var K_APPROVED = NS + '.approved';
  var K_REJECTED = NS + '.rejected';
  var K_SESSION = NS + '.admin';

  /* ---------- localStorage 可用性探测（file:// 下也可能被禁） ---------- */
  var memory = {};
  var canLS = (function () {
    try {
      var t = '__t';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  function raw(k, v) {
    if (canLS) {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) return localStorage.removeItem(k);
      return localStorage.setItem(k, v);
    }
    if (v === undefined) return memory[k] === undefined ? null : memory[k];
    if (v === null) { delete memory[k]; return; }
    memory[k] = v;
  }

  function getArr(k) {
    try { var s = raw(k); return s ? JSON.parse(s) : []; }
    catch (e) { return []; }
  }
  function setArr(k, a) { raw(k, JSON.stringify(a)); }

  function uid() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ============================ LocalAdapter ============================ */
  var LocalAdapter = {
    name: '浏览器本地',
    online: false,

    listPending: function () { return getArr(K_PENDING); },
    listApproved: function () { return getArr(K_APPROVED); },
    listRejected: function () { return getArr(K_REJECTED); },

    submit: function (rec) {
      var p = getArr(K_PENDING);
      rec.id = rec.id || uid();
      rec.submittedAt = new Date().toISOString();
      rec.status = 'pending';
      p.push(rec);
      setArr(K_PENDING, p);
      return rec;
    },

    /** 审核通过：pending -> approved（并写入正式饮料库） */
    approve: function (id, patch) {
      var p = getArr(K_PENDING), a = getArr(K_APPROVED);
      var i = p.findIndex(function (x) { return x.id === id; });
      if (i < 0) return null;
      var rec = Object.assign({}, p[i], patch || {}, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
      });
      p.splice(i, 1);
      a.push(rec);
      setArr(K_PENDING, p); setArr(K_APPROVED, a);
      return rec;
    },

    reject: function (id, reason) {
      var p = getArr(K_PENDING), r = getArr(K_REJECTED);
      var i = p.findIndex(function (x) { return x.id === id; });
      if (i < 0) return null;
      var rec = Object.assign({}, p[i], {
        status: 'rejected', reason: reason || '',
        reviewedAt: new Date().toISOString(),
      });
      p.splice(i, 1);
      r.push(rec);
      setArr(K_PENDING, p); setArr(K_REJECTED, r);
      return rec;
    },

    removeApproved: function (id) {
      var a = getArr(K_APPROVED).filter(function (x) { return x.id !== id; });
      setArr(K_APPROVED, a);
    },

    /* ---------- 管理员会话（本地版：口令比对，仅防误入，不是安全边界） ---------- */
    login: function (pass) {
      if (pass === global.ADMIN_PASSCODE) { raw(K_SESSION, '1'); return true; }
      return false;
    },
    logout: function () { raw(K_SESSION, null); },
    isLoggedIn: function () { return raw(K_SESSION) === '1'; },

    /* ---------- 备份 / 还原 ---------- */
    dump: function () {
      return {
        pending: getArr(K_PENDING),
        approved: getArr(K_APPROVED),
        rejected: getArr(K_REJECTED),
      };
    },
    restore: function (d) {
      if (!d) return;
      if (d.pending) setArr(K_PENDING, d.pending);
      if (d.approved) setArr(K_APPROVED, d.approved);
      if (d.rejected) setArr(K_REJECTED, d.rejected);
    },
  };

  /* ============================ RemoteAdapter（上线用，占位） ============================
   * 真正发布到网上时，把 Store.adapter 换成这个（或照着实现你自己的后端）。
   * 后端建议：Cloudflare Pages Functions + D1，或 Supabase（都免费）。
   *
   *   GET    /api/beverages           -> { approved: [...] }
   *   POST   /api/submissions         -> 提交（任何人）
   *   GET    /api/submissions         -> 待审列表（需要管理员 token）
   *   POST   /api/submissions/:id/approve | /reject  （需要管理员 token）
   * ==================================================================================== */
  var RemoteAdapter = {
    name: '服务器',
    online: true,
    base: '/api',
    token: null,           // 管理员登录后拿到的 JWT / session

    listPending: function () { return []; },   // 走 fetch，见 README
    listApproved: function () { return []; },
    listRejected: function () { return []; },
    submit: function (rec) {
      return fetch(this.base + '/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      }).then(function (r) { return r.json(); });
    },
  };

  /* ============================ Store 门面 ============================ */
  var Store = {
    adapter: LocalAdapter,
    canLS: canLS,

    /** 全部对外展示的饮料 = 种子库 + 已审核通过的用户提交 */
    all: function () {
      var seed = (global.BEV || []).slice();
      var extra = this.adapter.listApproved().map(function (r) {
        try { return global.normalizeSubmission(r); } catch (e) { return null; }
      }).filter(Boolean);
      return seed.concat(extra);
    },

    /** 单条：把用户提交（原始表单）转成饮料对象，与种子库同构 */
    normalize: function (r) {
      var o = {
        id: r.id, n: r.n, b: r.b || '网友提交', c: r.c || '其他',
        sg: numOrNull(r.sg), s: num(r.s), sw: num(r.sw),
        sub: r.sub || '', at: num(r.at),
        kc: numOrNull(r.kc),
        cb: num(r.cb), fd: num(r.fd),
        ice: r.ice || 'same', abv: num(r.abv), cf: num(r.cf),
        tea: r.tea ? 1 : 0, dairy: r.dairy ? 1 : 0, hfcs: r.hfcs ? 1 : 0,
        ml: num(r.ml) || 500, pk: r.pk || '', p: numOrNull(r.p), pop: num(r.pop) || 3,
        ph: num(r.ph), note: r.note || '', img: r.img || '',
        fromUser: true, submitter: r.by || '',
      };
      // 复用种子库的装配逻辑（派生字段），不写入种子库、不做 id 去重
      return global.buildBeverage(o);
    },

    pending: function () { return this.adapter.listPending(); },
    approve: function (id, patch) { return this.adapter.approve(id, patch); },
    reject: function (id, reason) { return this.adapter.reject(id, reason); },
    submit: function (rec) { return this.adapter.submit(rec); },
    isAdmin: function () { return this.adapter.isLoggedIn(); },
    login: function (p) { return this.adapter.login(p); },
    logout: function () { this.adapter.logout(); },
    dump: function () { return this.adapter.dump(); },
    restore: function (d) { return this.adapter.restore(d); },
    stats: function () {
      return {
        seed: (global.BEV || []).length,
        approved: this.adapter.listApproved().length,
        pending: this.adapter.listPending().length,
        rejected: this.adapter.listRejected().length,
        storage: this.adapter.name,
      };
    },
  };

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function numOrNull(v) { if (v === '' || v === null || v === undefined) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }

  global.Store = Store;
  global.normalizeSubmission = Store.normalize.bind(Store);

})(window);
