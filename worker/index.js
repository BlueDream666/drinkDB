/* ============================================================
 *  饮库 DrinkDB —— Cloudflare Worker 后端
 *  ------------------------------------------------------------
 *  给静态站点补上「点赞 / 评论 / 建议 / 审核」这四件必须有服务器才
 *  做得成的事。用的是 Cloudflare 的免费额度：Workers + D1。
 *
 *  接口
 *    GET  /api/state                公开。返回全部点赞数 + 已通过审核的评论
 *    POST /api/like   {id,on}       点赞 / 取消
 *    POST /api/comment{id,body,by}  发评论（进待审）
 *    POST /api/suggest{body,by}     提建议（进待审）
 *    POST /api/login  {token}       校验管理口令
 *    GET  /api/pending              待审列表（要管理口令）
 *    POST /api/moderate{kind,dbId,ok} 放行 / 退回（要管理口令）
 *    GET  /api/stats                简单统计（要管理口令）
 *
 *  部署步骤见同目录 README.md
 * ============================================================ */

const MAX_BODY = 300;      // 评论最长
const MAX_SUGGEST = 800;   // 建议最长
const MAX_NAME = 24;

/* ---------- 小工具 ---------- */
function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(env)),
  });
}

function clean(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')   // 去掉控制字符
    .trim()
    .slice(0, max);
}

/** 简易频率限制：同一个 IP 一分钟最多 N 次写操作 */
async function rateLimited(req, env, limit) {
  if (!env.RATE || !env.RATE.put) return false;
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'rl:' + ip + ':' + Math.floor(Date.now() / 60000);
  const cur = parseInt((await env.RATE.get(key)) || '0', 10);
  if (cur >= (limit || 20)) return true;
  await env.RATE.put(key, String(cur + 1), { expirationTtl: 120 });
  return false;
}

function isAdmin(req, env) {
  const h = req.headers.get('Authorization') || '';
  const t = h.replace(/^Bearer\s+/i, '').trim();
  return !!t && !!env.ADMIN_TOKEN && t === env.ADMIN_TOKEN;
}

/* ---------- 各接口 ---------- */
async function getState(env) {
  const likes = await env.DB.prepare('SELECT bev_id, n FROM likes').all();
  const cmts = await env.DB.prepare(
    "SELECT id, bev_id, body, by_name, created_at FROM comments WHERE status = 'approved' ORDER BY id ASC LIMIT 3000"
  ).all();

  const likeMap = {};
  (likes.results || []).forEach(r => { if (r.n > 0) likeMap[r.bev_id] = r.n; });

  const cmtMap = {};
  (cmts.results || []).forEach(r => {
    if (!cmtMap[r.bev_id]) cmtMap[r.bev_id] = [];
    cmtMap[r.bev_id].push({
      dbId: r.id, body: r.body, by: r.by_name || '匿名',
      at: r.created_at, status: 'approved',
    });
  });

  return { likes: likeMap, comments: cmtMap };
}

async function doLike(env, body) {
  const id = clean(body.id, 64);
  if (!id) return json({ error: '缺少 id' }, 400, env);
  const on = !!body.on;

  // likes 表的 n 不允许为负
  if (on) {
    await env.DB.prepare(
      'INSERT INTO likes (bev_id, n) VALUES (?, 1) ON CONFLICT(bev_id) DO UPDATE SET n = n + 1'
    ).bind(id).run();
  } else {
    await env.DB.prepare(
      'UPDATE likes SET n = MAX(n - 1, 0) WHERE bev_id = ?'
    ).bind(id).run();
  }
  const row = await env.DB.prepare('SELECT n FROM likes WHERE bev_id = ?').bind(id).first();
  return json({ ok: true, n: row ? row.n : 0 }, 200, env);
}

async function doComment(env, body) {
  const id = clean(body.id, 64);
  const text = clean(body.body, MAX_BODY);
  const by = clean(body.by, MAX_NAME) || '匿名';
  if (!id) return json({ error: '缺少 id' }, 400, env);
  if (text.length < 2) return json({ error: '太短了' }, 400, env);

  await env.DB.prepare(
    "INSERT INTO comments (bev_id, body, by_name, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).bind(id, text, by, new Date().toISOString()).run();
  return json({ ok: true, pending: true }, 200, env);
}

async function doSuggest(env, body) {
  const text = clean(body.body, MAX_SUGGEST);
  const by = clean(body.by, MAX_NAME) || '匿名';
  if (text.length < 2) return json({ error: '太短了' }, 400, env);

  await env.DB.prepare(
    "INSERT INTO suggestions (body, by_name, status, created_at) VALUES (?, ?, 'pending', ?)"
  ).bind(text, by, new Date().toISOString()).run();
  return json({ ok: true, pending: true }, 200, env);
}

async function getPending(env) {
  const c = await env.DB.prepare(
    "SELECT id, bev_id, body, by_name, created_at FROM comments WHERE status = 'pending' ORDER BY id DESC LIMIT 200"
  ).all();
  const s = await env.DB.prepare(
    "SELECT id, body, by_name, created_at FROM suggestions WHERE status = 'pending' ORDER BY id DESC LIMIT 200"
  ).all();
  return json({
    comments: (c.results || []).map(r => ({ kind: 'comment', dbId: r.id, bev: r.bev_id, body: r.body, by: r.by_name, at: r.created_at })),
    suggestions: (s.results || []).map(r => ({ kind: 'suggest', dbId: r.id, body: r.body, by: r.by_name, at: r.created_at })),
  }, 200, env);
}

async function doModerate(env, body) {
  const kind = body.kind === 'suggest' ? 'suggest' : 'comment';
  const dbId = parseInt(body.dbId, 10);
  if (!dbId) return json({ error: '缺少 dbId' }, 400, env);
  const status = body.ok ? 'approved' : 'rejected';

  if (kind === 'comment') {
    await env.DB.prepare('UPDATE comments SET status = ? WHERE id = ?').bind(status, dbId).run();
  } else {
    await env.DB.prepare('UPDATE suggestions SET status = ? WHERE id = ?').bind(status, dbId).run();
  }
  return json({ ok: true, status: status }, 200, env);
}

async function getStats(env) {
  const a = await env.DB.prepare('SELECT COUNT(*) AS c FROM likes WHERE n > 0').first();
  const b = await env.DB.prepare("SELECT COUNT(*) AS c FROM comments WHERE status='approved'").first();
  const c = await env.DB.prepare("SELECT COUNT(*) AS c FROM comments WHERE status='pending'").first();
  const d = await env.DB.prepare("SELECT COUNT(*) AS c FROM suggestions WHERE status='pending'").first();
  return json({
    liked: a.c, comments: b.c, pendingComments: c.c, pendingSuggestions: d.c,
  }, 200, env);
}

/* ---------- 入口 ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });

    try {
      if (path === '/' || path === '/api') {
        return json({
          ok: true, service: '饮库 DrinkDB API',
          endpoints: ['/api/state', '/api/like', '/api/comment', '/api/suggest', '/api/login', '/api/pending', '/api/moderate', '/api/stats'],
        }, 200, env);
      }

      if (path === '/api/state' && req.method === 'GET') {
        return json(await getState(env), 200, env);
      }

      if (req.method !== 'POST' && (path === '/api/like' || path === '/api/comment' || path === '/api/suggest')) {
        return json({ error: '请用 POST' }, 405, env);
      }

      if (path === '/api/like') {
        if (await rateLimited(req, env, 120)) return json({ error: '点太快了，歇一下' }, 429, env);
        return doLike(env, await req.json().catch(() => ({})));
      }

      if (path === '/api/comment') {
        if (await rateLimited(req, env, 10)) return json({ error: '发太快了，歇一下' }, 429, env);
        return doComment(env, await req.json().catch(() => ({})));
      }

      if (path === '/api/suggest') {
        if (await rateLimited(req, env, 6)) return json({ error: '发太快了，歇一下' }, 429, env);
        return doSuggest(env, await req.json().catch(() => ({})));
      }

      if (path === '/api/login') {
        const body = await req.json().catch(() => ({}));
        const ok = !!env.ADMIN_TOKEN && clean(body.token, 200) === env.ADMIN_TOKEN;
        // 慢一点，别让人拿脚本猛试
        await new Promise(r => setTimeout(r, ok ? 0 : 700));
        return json({ ok: ok }, ok ? 200 : 401, env);
      }

      if (path === '/api/pending' && req.method === 'GET') {
        if (!isAdmin(req, env)) return json({ error: '没权限' }, 401, env);
        return getPending(env);
      }

      if (path === '/api/moderate') {
        if (!isAdmin(req, env)) return json({ error: '没权限' }, 401, env);
        return doModerate(env, await req.json().catch(() => ({})));
      }

      if (path === '/api/stats' && req.method === 'GET') {
        if (!isAdmin(req, env)) return json({ error: '没权限' }, 401, env);
        return getStats(env);
      }

      return json({ error: '没有这个接口' }, 404, env);

    } catch (e) {
      return json({ error: '服务器出错：' + (e && e.message ? e.message : '未知') }, 500, env);
    }
  },
};
