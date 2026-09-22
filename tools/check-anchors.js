// 检查脚本里引用的 id / 选择器，是否真的存在（静态标记里，或者由 JS 动态生成）
const fs = require('fs');

function check(htmlFile, jsFiles) {
  const h = fs.readFileSync(htmlFile, 'utf8');
  const markup = h.replace(/<script[\s\S]*?<\/script>/g, '');
  const jsAll = jsFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

  const ids = new Set();
  jsFiles.forEach(f => {
    const js = fs.readFileSync(f, 'utf8');
    [...js.matchAll(/\$\(\s*'#([A-Za-z][-\w]*)'\s*\)/g)].forEach(m => ids.add(m[1]));
    [...js.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].forEach(m => ids.add(m[1]));
    [...js.matchAll(/\bon\(\s*'#([A-Za-z][-\w]*)'/g)].forEach(m => ids.add(m[1]));
  });

  const miss = [], dyn = [];
  ids.forEach(id => {
    if (new RegExp('id="' + id + '"').test(markup)) return;              // 静态标记里有
    if (new RegExp('id="' + id + '"').test(jsAll)) { dyn.push(id); return; }  // JS 动态生成的
    miss.push(id);
  });

  console.log(htmlFile + '  ←  ' + jsFiles.join(', '));
  console.log('  引用 id ' + ids.size + ' 个');
  if (dyn.length) console.log('  · 动态生成（JS 里创建的）: ' + dyn.join(', '));
  console.log(miss.length ? '  ✗ 找不到: ' + miss.join(', ') : '  ✓ 全部有出处');
  return miss.length;
}

let bad = 0;
bad += check('index.html', ['js/app.js', 'js/compare.js', 'js/lab.js', 'js/user.js', 'js/presets.js']);
bad += check('admin.html', ['js/admin.js']);
process.exit(bad ? 1 : 0);
