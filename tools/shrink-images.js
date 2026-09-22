/* ============================================================
 *  饮库 —— 把抓来的产品图压小
 *  ------------------------------------------------------------
 *  抓来的原图平均 158KB，直接放页面上手机吃不消（轮播那两排有 400 多个
 *  <img>）。这里借无头浏览器里的 canvas 把它们统一缩到长边 360px 的 JPEG，
 *  体积大概能降到十分之一。不依赖任何 npm 包。
 *
 *  用法：
 *      node tools/shrink-images.js                 压缩 img 里所有图
 *      node tools/shrink-images.js --max 520       改长边尺寸
 *      node tools/shrink-images.js --quality 0.88  改 JPEG 质量
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'img');

const argv = process.argv.slice(2);
function arg(n, d) { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; }
const MAX = parseInt(arg('max', '360'), 10);
const QUALITY = parseFloat(arg('quality', '0.82'));

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const BROWSER = EDGE_CANDIDATES.find(p => fs.existsSync(p));
if (!BROWSER) { console.error('没找到 Edge 或 Chrome，无法压缩。'); process.exit(1); }

const files = fs.readdirSync(IMG_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) { console.log('img 里没有图片。'); process.exit(0); }

const before = files.reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size, 0);
console.log('待压缩 ' + files.length + ' 张，共 ' + (before / 1048576).toFixed(1) + ' MB');

/* ---------- 生成压缩页 ---------- */
const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>shrink</title></head>
<body><pre id="out">working</pre>
<script>
var FILES = ${JSON.stringify(files)};
var MAX = ${MAX}, Q = ${QUALITY};
var out = {};
function loadOne(f) {
  return new Promise(function (res) {
    var im = new Image();
    im.onload = function () {
      try {
        var w = im.naturalWidth, h = im.naturalHeight;
        var k = Math.min(1, MAX / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var cx = cv.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch);   // PNG 透明底铺白
        cx.drawImage(im, 0, 0, cw, ch);
        out[f] = { data: cv.toDataURL('image/jpeg', Q), w: cw, h: ch, src: w + 'x' + h };
      } catch (e) { out[f] = { err: String(e && e.message) }; }
      res();
    };
    im.onerror = function () { out[f] = { err: 'decode fail' }; res(); };
    im.src = f;                      // 压缩页和图片在同一目录
  });
}
(async function () {
  var i = 0;
  async function worker() { while (i < FILES.length) { await loadOne(FILES[i++]); } }
  await Promise.all([worker(), worker(), worker(), worker()]);
  document.getElementById('out').textContent = 'SHRINKRESULT' + JSON.stringify(out);
})();
</script></body></html>`;

const tmpHtml = path.join(IMG_DIR, '_shrink.html');
fs.writeFileSync(tmpHtml, page, 'utf8');

/* ---------- 跑无头浏览器 ---------- */
const dirUrl = 'file:///' + IMG_DIR.replace(/\\/g, '/').replace(/ /g, '%20');
const profile = path.join(ROOT, '_shrinkprofile');
console.log('调用无头浏览器压缩中…');
let dump = '';
try {
  dump = execFileSync(BROWSER, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files',
    '--user-data-dir=' + profile, '--dump-dom', '--virtual-time-budget=180000',
    dirUrl + '/_shrink.html',
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 400, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  console.error('浏览器执行失败：' + e.message);
  process.exit(1);
}

const m = dump.match(/SHRINKRESULT(\{[\s\S]*?\})<\/pre>/);
if (!m) { console.error('没拿到压缩结果。'); process.exit(1); }
let result;
try { result = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')); }
catch (e) { console.error('解析结果失败：' + e.message); process.exit(1); }

/* ---------- 写回 ---------- */
let okN = 0, failN = 0, after = 0;
const rows = [];
const converted = {};          // 原文件名 -> 新文件名，只记成功的
Object.keys(result).forEach(f => {
  const r = result[f];
  if (r.err || !r.data) { failN++; rows.push([f, '失败 ' + (r.err || '?'), 0, 0]); return; }
  const buf = Buffer.from(r.data.split(',')[1], 'base64');
  const target = f.replace(/\.[^.]+$/, '.jpg');
  const oldSize = fs.statSync(path.join(IMG_DIR, f)).size;
  fs.writeFileSync(path.join(IMG_DIR, target), buf);
  if (target !== f) fs.unlinkSync(path.join(IMG_DIR, f));   // 原来不是 jpg 的删掉
  converted[f] = target;
  okN++;
  after += buf.length;
  rows.push([target, r.src + ' → ' + r.w + 'x' + r.h, oldSize, buf.length]);
});

rows.sort((a, b) => b[2] - a[2]);
rows.slice(0, 8).forEach(x => console.log('  ' + x[0].padEnd(30) + x[1].padEnd(22)
  + (x[2] / 1024).toFixed(0).padStart(5) + 'KB → ' + (x[3] / 1024).toFixed(0) + 'KB'));

// 清理 + 重建 manifest（只改真正转换成功的那些，失败的保持原样）
fs.unlinkSync(tmpHtml);
fs.rmSync(profile, { recursive: true, force: true });

const MANIFEST_JS = path.join(IMG_DIR, 'manifest.js');
const win = {};
if (fs.existsSync(MANIFEST_JS)) {
  try { new Function('window', fs.readFileSync(MANIFEST_JS, 'utf8'))(win); } catch (e) {}
}
const map = win.IMG_MANIFEST || {};
Object.keys(map).forEach(id => {
  const base = path.basename(map[id]);
  if (converted[base]) map[id] = '' + converted[base];
});
// 把目录里实际存在的图也登记上
fs.readdirSync(IMG_DIR).forEach(f => {
  const mm = f.match(/^([a-z0-9-]+)\.(jpe?g|png|webp)$/i);
  if (mm) map[mm[1]] = '' + f;
});
const keys = Object.keys(map).sort();
fs.writeFileSync(MANIFEST_JS,
  '/* 自动生成，请勿手改。抓取：node tools/fetch-images.js　压缩：node tools/shrink-images.js */\n'
  + 'window.IMG_MANIFEST = {\n'
  + keys.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(map[k])).join(',\n')
  + '\n};\n', 'utf8');

console.log('\n压缩完成：成功 ' + okN + '，失败 ' + failN);
console.log('总体积 ' + (before / 1048576).toFixed(1) + ' MB → ' + (after / 1048576).toFixed(1) + ' MB'
  + '（降到 ' + Math.round(after / before * 100) + '%）');
