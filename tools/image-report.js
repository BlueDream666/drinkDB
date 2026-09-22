// 统计图片情况：总量、体积、还没图的条目
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = global;
const dataDir = path.join(ROOT, 'js', 'data');
fs.readdirSync(dataDir).filter(f => f.endsWith('.js'))
  .sort((a, b) => (a === '_schema.js' ? -1 : b === '_schema.js' ? 1 : a.localeCompare(b)))
  .forEach(f => new Function(fs.readFileSync(path.join(dataDir, f), 'utf8'))());

const manifest = (function () {
  const win = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets', 'img', 'manifest.js'), 'utf8'))(win);
  return win.IMG_MANIFEST || {};
})();

const IMG = path.join(ROOT, 'assets', 'img');
const files = fs.readdirSync(IMG).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
let total = 0;
const sizes = files.map(f => { const s = fs.statSync(path.join(IMG, f)).size; total += s; return { f, s }; });
sizes.sort((a, b) => b.s - a.s);

console.log('图片文件 ' + files.length + ' 张，合计 ' + (total / 1024 / 1024).toFixed(1) + ' MB');
console.log('平均 ' + Math.round(total / files.length / 1024) + ' KB，最大 ' + Math.round(sizes[0].s / 1024) + ' KB');
console.log('\n最大的 5 张：');
sizes.slice(0, 5).forEach(x => console.log('  ' + (x.s / 1024).toFixed(0).padStart(4) + ' KB  ' + x.f));

const noImg = global.BEV.filter(b => !manifest[b.id]);
console.log('\n还没有图的 ' + noImg.length + ' 款：');
noImg.forEach(b => console.log('  ' + b.id.padEnd(28) + b.n + '  「' + b.b + '」'));
