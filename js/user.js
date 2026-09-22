/* ============================================================
   饮库 —— 用户数据层：点赞 / 评论 / 建议
   ------------------------------------------------------------
   两种运行模式，代码只写一遍：

     ① 本地模式（没配后端）
        · 点赞、评论、建议都只存在你自己这台设备的浏览器里
        · 页面上会明确标注「仅本机可见」，不会假装是全网数据
        · 适合自己先用着，也方便离线 / 单文件版

     ② 线上模式（js/config.js 里填了 apiBase）
        · 走 Cloudflare Worker，所有人都能看到同一份数据
        · 评论和建议默认进「待审」，等你在审核台放行

   切换只需要在 js/config.js 里填一个网址，前台代码一行都不用改。
   ============================================================ */
(function (global) {

  var NS = 'drinkdb.v1';
  var K_LIKES = NS + '.myLikes';      // 我点过赞的 id（用来做「点亮」状态和取消）
  var K_COMMENTS = NS + '.comments';  // 本地模式下的评论
  var K_SUGGESTS = NS + '.suggests';  // 本地模式下的建议
  var K_TOKEN = NS + '.adminToken';   // 线上模式下的管理口令

  function cfg() { return global.DRINKDB_CONFIG || {}; }
  function base() { return (cfg().apiBase || '').replace(/\/+$/, ''); }
  function online() { return !!base(); }

  /* ---------- 本地小工具 ---------- */
  var mem = {};
  var canLS = (function () {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; }
  })();
  function rawGet(k) { return canLS ? localStorage.getItem(k) : (mem[k] === undefined ? null : mem[k]); }
  function rawSet(k, v) { if (canLS) localStorage.setItem(k, v); else mem[k] = v; }
  function getJSON(k, def) {
    try { var s = rawGet(k); return s ? JSON.parse(s) : def; } catch (e) { return def; }
  }
  function setJSON(k, v) { rawSet(k, JSON.stringify(v)); }

  /* ---------- 远端请求 ---------- */
  function api(path, opt) {
    opt = opt || {};
    return fetch(base() + path, {
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined,
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ============================ 缓存 ============================ */
  // 线上模式下拉一次全量，之后本地增减，不用每点一次都请求
  var cache = { likes: {}, comments: {}, loaded: false, error: null };

  var User = {
    online: online,
    modeName: function () { return online() ? '云端同步' : '仅本机可见'; },
    canLS: canLS,

    /** 拉取一次全局数据（线上模式） */
    load: function () {
      if (!online()) { cache.loaded = true; return Promise.resolve(cache); }
      return api('/api/state').then(function (d) {
        cache.likes = d.likes || {};
        cache.comments = d.comments || {};
        cache.loaded = true;
        cache.error = null;
        return cache;
      }).catch(function (e) {
        cache.loaded = true;
        cache.error = e.message;
        return cache;
      });
    },

    /* ---------------- 点赞 ---------------- */
    liked: function (id) { return !!getJSON(K_LIKES, {})[id]; },
    likeCount: function (id) {
      if (online()) return cache.likes[id] || 0;
      return getJSON(NS + '.localLikes', {})[id] || 0;
    },

    toggleLike: function (id) {
      var mine = getJSON(K_LIKES, {});
      var on = !mine[id];
      mine[id] = on;
      setJSON(K_LIKES, mine);

      if (online()) {
        var cur = cache.likes[id] || 0;
        cache.likes[id] = Math.max(0, cur + (on ? 1 : -1));
        api('/api/like', { method: 'POST', body: { id: id, on: on } }).catch(function () {
          // 请求失败就回滚，别让界面骗人
          cache.likes[id] = cur;
          mine[id] = !on;
          setJSON(K_LIKES, mine);
        });
        return { on: on, n: cache.likes[id], pending: true };
      }

      var loc = getJSON(NS + '.localLikes', {});
      loc[id] = Math.max(0, (loc[id] || 0) + (on ? 1 : -1));
      setJSON(NS + '.localLikes', loc);
      return { on: on, n: loc[id], pending: false };
    },

    /* ---------------- 评论 ---------------- */
    comments: function (id) {
      if (online()) return (cache.comments[id] || []);
      return getJSON(K_COMMENTS, {})[id] || [];
    },

    addComment: function (id, body, by) {
      body = String(body || '').trim().slice(0, 300);
      if (!body) return Promise.reject(new Error('写两句再发吧'));
      var byName = String(by || '').trim().slice(0, 20) || '匿名';

      if (online()) {
        // 线上：进待审，等整理者放行
        var rec = { body: body, by: byName, at: new Date().toISOString(), status: 'pending' };
        return api('/api/comment', { method: 'POST', body: { id: id, body: body, by: byName } })
          .then(function () { return rec; });
      }

      // 本地模式：只有自己看得到，没必要再卡一道审核，直接算已通过
      var local = { body: body, by: byName, at: new Date().toISOString(), status: 'approved' };
      var all = getJSON(K_COMMENTS, {});
      all[id] = (all[id] || []).concat([local]);
      setJSON(K_COMMENTS, all);
      return Promise.resolve(local);
    },

    /** 管理端登录。线上模式把口令交给服务器验；本地模式比对本机摘要 */
    loginAdmin: function (token) {
      if (!online()) return Promise.resolve(false);
      return api('/api/login', { method: 'POST', body: { token: token } })
        .then(function (d) {
          if (d && d.ok) { rawSet(K_TOKEN, token); return true; }
          return false;
        })
        .catch(function () { return false; });
    },
    adminToken: function () { return rawGet(K_TOKEN) || ''; },
    isAdminOnline: function () { return online() && !!rawGet(K_TOKEN); },
    logoutAdmin: function () { rawSet(K_TOKEN, ''); },

    /** 管理端：待审的评论与建议 */
    pending: function () {
      if (!online()) return Promise.resolve({ comments: [], suggestions: [] });
      var tk = rawGet(K_TOKEN) || '';
      return fetch(base() + '/api/pending', { headers: { 'Authorization': 'Bearer ' + tk } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    },

    /** 管理端：放行 / 退回 */
    moderate: function (kind, dbId, ok) {
      if (!online()) return Promise.reject(new Error('没配后端'));
      var tk = rawGet(K_TOKEN) || '';
      return fetch(base() + '/api/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
        body: JSON.stringify({ kind: kind, dbId: dbId, ok: ok }),
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    },

    /** 前台只显示已通过的评论 */
    visibleComments: function (id) {
      return this.comments(id).filter(function (c) { return c.status !== 'pending' && c.status !== 'rejected'; });
    },

    /* ---------------- 建议 ---------------- */
    suggestions: function () {
      return getJSON(K_SUGGESTS, []);
    },
    addSuggestion: function (body, by) {
      body = String(body || '').trim().slice(0, 500);
      if (!body) return Promise.reject(new Error('写两句再发吧'));
      var rec = { body: body, by: String(by || '').trim().slice(0, 20) || '匿名', at: new Date().toISOString(), status: 'pending' };
      if (online()) {
        return api('/api/suggest', { method: 'POST', body: { body: rec.body, by: rec.by } }).then(function () { return rec; });
      }
      var all = getJSON(K_SUGGESTS, []);
      all.push(rec);
      setJSON(K_SUGGESTS, all);
      return Promise.resolve(rec);
    },

    /* ---------------- 统计 ---------------- */
    stats: function () {
      if (online()) {
        return {
          mode: '云端同步',
          likes: Object.keys(cache.likes).length,
          comments: Object.keys(cache.comments).reduce(function (s, k) { return s + cache.comments[k].length; }, 0),
        };
      }
      var l = getJSON(NS + '.localLikes', {});
      var c = getJSON(K_COMMENTS, {});
      return {
        mode: '仅本机可见',
        likes: Object.keys(l).length,
        comments: Object.keys(c).reduce(function (s, k) { return s + c[k].length; }, 0),
      };
    },

    clearLocal: function () {
      [K_LIKES, K_COMMENTS, K_SUGGESTS, NS + '.localLikes'].forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) {}
      });
    },
  };

  global.DrinkUser = User;

})(window);
