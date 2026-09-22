// 数据自检：在 Node 里模拟 window/B，跑一遍全部数据分册
const fs = require('fs');
const path = require('path');

global.window = global;
const dir = path.join(__dirname, '..', 'js', 'data');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
  .sort((a, b) => (a === '_schema.js' ? -1 : b === '_schema.js' ? 1 : a.localeCompare(b)));
files.forEach(f => {
  const code = fs.readFileSync(path.join(dir, f), 'utf8');
  try { new Function(code)(); }
  catch (e) { console.log('✗ ' + f + ' -> ' + e.message); process.exitCode = 1; }
});

const BEV = global.BEV || [];
console.log('分册载入:', files.join(', '));
console.log('饮料总数:', BEV.length);

const cats = {};
BEV.forEach(b => { cats[b.c] = (cats[b.c] || 0) + 1; });
console.log('\n按大类:');
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k.padEnd(6), v));

// 字段完整性
const need = ['id', 'n', 'b', 'c', 's', 'sw', 'sub', 'cb', 'fd', 'ice', 'abv', 'cf', 'tea', 'dairy', 'ml', 'p', 'pop', 'note', 'brief'];
let miss = 0;
BEV.forEach(b => need.forEach(k => { if (b[k] === undefined) { console.log('  ✗ 缺字段', b.id, k); miss++; } }));
console.log('\n字段完整性:', miss === 0 ? '全部 ' + need.length + ' 个字段齐备 ✓' : miss + ' 处缺失');

// 逻辑自检
const bad = [];
BEV.forEach(b => {
  if (b.cb < 0 || b.cb > 5) bad.push(b.id + ' cb 越界');
  if (b.fd > b.cb) bad.push(b.id + ' 气泡留存 > 初始气泡');
  if (b.s < 0 || b.s > 5 || b.sw < 0 || b.sw > 5) bad.push(b.id + ' 星级越界');
  if (b.sg !== null && b.sg < 0) bad.push(b.id + ' 糖分为负');
  if (b.sg === 0 && b.s > 0 && !b.sub) bad.push(b.id + ' 零糖但无代糖却有糖分星级');
  if (!['better', 'same', 'worse'].includes(b.ice)) bad.push(b.id + ' ice 非法: ' + b.ice);
});
console.log('逻辑自检:', bad.length ? bad : '通过 ✓');

// 抽查
console.log('\n抽查（前 8 条）:');
BEV.slice(0, 8).forEach(b => console.log(`  ${b.n.padEnd(22)} 糖${b.sg === null ? '?' : b.sg}g 星${b.s} 甜${b.sw} 气${b.cb}/${b.fd} ${b.brief}`));

console.log('\n无碳酸 + 低糖(星<=1.5) + 甜度<=2 的候选:',
  BEV.filter(b => b.cb === 0 && b.s <= 1.5 && b.sw <= 2).length, '款');
