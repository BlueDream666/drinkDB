/* ============================================================
 *  饮库 —— 产品图抓取
 *  ------------------------------------------------------------
 *  用法（在 ds 目录下跑）：
 *      node tools/fetch-images.js                 抓全部（会跳过已经有的）
 *      node tools/fetch-images.js --limit 20      先抓 20 个看看效果
 *      node tools/fetch-images.js --only coke-classic,pepsi-classic
 *      node tools/fetch-images.js --redo          已存在的也重抓
 *      node tools/fetch-images.js --q "自定义搜索词"   （配 --only 用单条测试）
 *
 *  逻辑：拿「品牌 + 品名 + 容量」去 Bing 图片搜，挑一张能下下来的存到
 *  assets/img/<id>.<ext>，同时更新 assets/img/manifest.js。
 *  前端 js/art.js 会优先用这里的图，没有才退回自动生成的矢量图。
 *
 *  说明：搜到的多是天猫/京东官方旗舰店的商品图。本库是非商业的个人整理，
 *  但不是法律意见 —— 如果你要正式商用，请自行确认图片授权，或者把图删掉
 *  （删掉后自动回退成矢量图，页面不会坏）。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'assets', 'img');
const MANIFEST_JS = path.join(IMG_DIR, 'manifest.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def;
}
const LIMIT = parseInt(arg('limit', '0'), 10) || 0;
const ONLY = arg('only', '') ? String(arg('only', '')).split(',').map(s => s.trim()) : null;
const REDO = !!arg('redo', false);
const CUSTOM_Q = arg('q', '');
const CONCURRENCY = parseInt(arg('jobs', '3'), 10) || 3;

/* ---------- 读种子库 ---------- */
global.window = global;
const dataDir = path.join(ROOT, 'js', 'data');
fs.readdirSync(dataDir).filter(f => f.endsWith('.js'))
  .sort((a, b) => (a === '_schema.js' ? -1 : b === '_schema.js' ? 1 : a.localeCompare(b)))
  .forEach(f => new Function(fs.readFileSync(path.join(dataDir, f), 'utf8'))());
const BEV = global.BEV;

/* ---------- 工具 ---------- */
function req(url, opts, depth) {
  depth = depth || 0;
  return new Promise((res, rej) => {
    let u; try { u = new URL(url); } catch (e) { return rej(e); }
    const mod = u.protocol === 'http:' ? http : https;
    const r = mod.get(u, Object.assign({
      timeout: 20000, rejectUnauthorized: false,
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' },
    }, opts || {}), resp => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location && depth < 5) {
        resp.destroy();
        return res(req(new URL(resp.headers.location, u).href, opts, depth + 1));
      }
      const c = []; resp.on('data', x => c.push(x));
      resp.on('end', () => res({ status: resp.statusCode, buf: Buffer.concat(c), type: resp.headers['content-type'] || '' }));
    });
    r.on('timeout', () => { r.destroy(); rej(new Error('timeout')); });
    r.on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 该不该给这一条配图 ---------- */
function worthFetching(b) {
  // 泛称、玩梗、自制这类没有"官方产品图"的，直接跳过
  // 注意别把品牌名误伤（早先 /mix/ 把 mixue 蜜雪冰城也拦掉了）
  if (/generic|joke|selfbrew|homemade|apple-mix|self-sweetener/.test(b.id)) return false;
  if (/（泛指）|（玩梗）|（自制）|（自家烧）|（自己泡）|（提法杂）|（追问补楼）|（被点名排除）|（综合）|（未指明）/.test(b.n)) return false;
  if (/^—$/.test(b.b) || b.b === '—' || !b.b) return false;
  return true;
}

function queryFor(b) {
  if (CUSTOM_Q && ONLY && ONLY.length === 1) return CUSTOM_Q;
  // 去掉括号里的补充说明，只留主名
  const name = b.n.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  const brand = (b.b || '').replace(/（[^）]*）/g, '').split(' / ')[0].trim();
  const ml = b.ml ? ' ' + b.ml + 'ml' : '';
  // 品牌已经包含在名字里就不重复
  return (name.indexOf(brand) >= 0 || !brand ? name : brand + ' ' + name) + ml;
}

const BAD_HOST = /(wikimedia|wikipedia|pinimg|lookaside|fbcdn|zhimg|gstatic|google|youtube|tiktok|instagram)/i;
const OK_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

function pickCandidates(html) {
  const out = [];
  const re = /murl&quot;:&quot;(https?:[^&]+?)&quot;/g;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1].replace(/&amp;/g, '&');
    try { u = decodeURIComponent(u); } catch (e) {}
    if (!/^https?:/i.test(u)) continue;
    if (BAD_HOST.test(u)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(u)) continue;
    out.push(u);
  }
  // 电商 CDN 的图通常最接近官方商品图，优先
  const prefer = /(360buyimg|alicdn|taobaocdn|jd\.com|tmall|suning|yhd|vip\.com|official)/i;
  out.sort((a, b) => (prefer.test(b) ? 1 : 0) - (prefer.test(a) ? 1 : 0));
  return [...new Set(out)];
}

async function searchImages(q) {
  const url = 'https://cn.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=1';
  const r = await req(url);
  if (r.status !== 200) throw new Error('search http ' + r.status);
  return pickCandidates(r.buf.toString('utf8'));
}

const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function tryDownload(url) {
  const r = await req(url);
  if (r.status !== 200) throw new Error('http ' + r.status);
  const ext = EXT[(r.type || '').split(';')[0].trim().toLowerCase()];
  if (!ext) throw new Error('不是图片: ' + r.type);
  if (r.buf.length < 6000) throw new Error('太小 ' + r.buf.length);
  if (r.buf.length > 900000) throw new Error('太大 ' + Math.round(r.buf.length / 1024) + 'KB');
  return { buf: r.buf, ext };
}

/* ---------- manifest ---------- */
/** manifest.js 是给浏览器当脚本用的，这里也用同样的方式读，避免 JSON 严格性问题 */
function readManifestFile(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const win = {};
    new Function('window', fs.readFileSync(file, 'utf8'))(win);
    return win.IMG_MANIFEST || {};
  } catch (e) { return {}; }
}
function loadManifest() { return readManifestFile(MANIFEST_JS); }
function saveManifest(map) {
  const keys = Object.keys(map).sort();
  const body = keys.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(map[k])).join(',\n');
  fs.writeFileSync(MANIFEST_JS,
    '/* 自动生成，请勿手改。重新抓取：node tools/fetch-images.js\n'
    + '   手动补图：把图片存成 assets/img/<饮料id>.jpg，再跑一次本脚本即可收录。 */\n'
    + 'window.IMG_MANIFEST = {\n' + (body ? body + '\n' : '') + '};\n', 'utf8');
}

/* ---------- 主流程 ---------- */
(async () => {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
  const manifest = loadManifest();

  // 把 assets/img 里已存在的文件也纳入 manifest（方便手动补图）
  fs.readdirSync(IMG_DIR).forEach(f => {
    const m = f.match(/^([a-z0-9-]+)\.(jpe?g|png|webp)$/i);
    if (m) manifest[m[1]] = 'assets/img/' + f;
  });

  let targets = BEV.filter(worthFetching);
  if (ONLY) targets = BEV.filter(b => ONLY.indexOf(b.id) >= 0);
  if (!REDO) targets = targets.filter(b => !manifest[b.id]);
  if (LIMIT) targets = targets.slice(0, LIMIT);

  console.log('待抓取 ' + targets.length + ' 款（共 ' + BEV.length + ' 款，已配图 ' + Object.keys(manifest).length + ' 款）');
  if (!targets.length) { saveManifest(manifest); console.log('没有需要抓的了。'); return; }

  let ok = 0, fail = 0;
  const failures = [];

  async function one(b, i) {
    const q = queryFor(b);
    const tag = '[' + String(i + 1).padStart(3) + '/' + targets.length + '] ' + b.id;
    try {
      const cands = await searchImages(q);
      if (!cands.length) throw new Error('没搜到候选图');
      let last = '全部候选都下不动';
      for (const u of cands.slice(0, 6)) {
        try {
          const { buf, ext } = await tryDownload(u);
          const file = b.id + '.' + ext;
          fs.writeFileSync(path.join(IMG_DIR, file), buf);
          manifest[b.id] = 'assets/img/' + file;
          saveManifest(manifest);
          ok++;
          console.log(tag + '  ✓ ' + file + '  ' + Math.round(buf.length / 1024) + 'KB   « ' + q + ' »');
          return;
        } catch (e) { last = e.message; await sleep(200); }
      }
      throw new Error(last);
    } catch (e) {
      fail++;
      failures.push(b.id + '  (' + q + ')  ' + e.message);
      console.log(tag + '  ✗ ' + e.message);
    }
  }

  // 简单并发
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < targets.length) {
      const i = cursor++;
      await one(targets[i], i);
      done++;
      await sleep(900);   // 对搜索客气一点
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  saveManifest(manifest);
  console.log('\n完成：成功 ' + ok + '，失败 ' + fail + '，manifest 现有 ' + Object.keys(manifest).length + ' 款');
  if (failures.length) {
    console.log('\n失败清单（多是搜索没结果或图源拒绝下载，可重跑补）：');
    failures.slice(0, 40).forEach(f => console.log('  ' + f));
  }
})();
