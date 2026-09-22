/* ============================================================
 *  饮库 —— 打包成「单文件版」
 *  ------------------------------------------------------------
 *  把 CSS、JS、203 款数据、153 张产品图全部塞进一个 html 里，
 *  双击就能用，不需要服务器、不需要联网、不需要其它文件。
 *
 *  用途：直接把这一份文件发给手机 / 发给朋友，就能正常打开。
 *  （普通版必须整个文件夹一起传，只发 index.html 会变成一篇纯文字。）
 *
 *  用法： node tools/build-single.js
 *  产物： 饮库-单文件版.html
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '饮库-单文件版.html');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

/* ---------- 1. CSS 内联 ---------- */
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, function (_, href) {
  return '<style>\n' + read(href) + '\n</style>';
});

/* ---------- 2. 图片清单：换成 base64 data URL ---------- */
const manifestSrc = read('img/manifest.js');
const win = {};
new Function('window', manifestSrc)(win);
const map = win.IMG_MANIFEST || {};

let imgTotal = 0, imgCount = 0;
const dataMap = {};
Object.keys(map).sort().forEach(id => {
  const file = path.join(ROOT, 'img', path.basename(map[id]));
  if (!fs.existsSync(file)) return;
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  dataMap[id] = 'data:' + mime + ';base64,' + buf.toString('base64');
  imgTotal += buf.length;
  imgCount++;
});
const manifestInline = 'window.IMG_MANIFEST = ' + JSON.stringify(dataMap) + ';';
console.log('内联图片 ' + imgCount + ' 张，原始 ' + (imgTotal / 1048576).toFixed(1) + ' MB');

/* ---------- 3. 所有外链脚本内联 ---------- */
let inlined = 0;
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (_, src) {
  if (src === 'img/manifest.js') { inlined++; return '<script>' + manifestInline + '</script>'; }
  if (!fs.existsSync(path.join(ROOT, src))) { console.log('  跳过（不存在）: ' + src); return ''; }
  inlined++;
  return '<script>\n/* === ' + src + ' === */\n' + read(src) + '\n</script>';
});
console.log('内联脚本 ' + inlined + ' 个');

/* ---------- 4. 单文件版专属提示 + 标题 ---------- */
html = html.replace('<body>', '<body>\n<!-- 单文件版：所有资源已内嵌，可直接单独发送 -->');
html = html.replace(/<title>[^<]*<\/title>/,
  '<title>饮库 DrinkDB · 200+ 款饮料，总有一瓶是你想喝的（单文件版）</title>');

/* 单文件版没有后台与自测，把链接去掉避免点了 404；提交功能保留（存本机） */
html = html.replace(/\s*<a class="tb" href="admin\.html">后台<\/a>/, '');
html = html.replace(/想补充条目，点上方「＋ 补一款」。经整理者审核后收录，并计入导出文件。/,
  '这一份是单文件版，所有内容和图片都在文件里，可以直接转发。');
html = html.replace(/<p>导 Excel 和 CSV 谁都能用[^<]*<\/p>/, '');

/* ---------- 5. 写盘 ---------- */
fs.writeFileSync(OUT, html, 'utf8');
const size = fs.statSync(OUT).size;
console.log('\n已生成：' + path.basename(OUT) + '   ' + (size / 1048576).toFixed(2) + ' MB');
console.log('双击即可打开；也可以直接发到手机或微信。');
