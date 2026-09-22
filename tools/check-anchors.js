// 检查前台/后台脚本里引用的每个 id，是否真的存在于对应的 HTML 里
const fs = require('fs');

function check(htmlFile, jsFiles) {
  const h = fs.readFileSync(htmlFile, 'utf8');
  const markup = h.replace(/<script[\s\S]*?<\/script>/g, '');
  const ids = new Set();
  jsFiles.forEach(f => {
    const js = fs.readFileSync(f, 'utf8');
    [...js.matchAll(/\$\(\s*'#([A-Za-z][-\w]*)'\s*\)/g)].forEach(m => ids.add(m[1]));
    [...js.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)].forEach(m => ids.add(m[1]));
    [...js.matchAll(/\bon\(\s*'#([A-Za-z][-\w]*)'/g)].forEach(m => ids.add(m[1]));
  });
  const miss = [...ids].filter(id => !new RegExp('id="' + id + '"').test(markup));
  console.log(htmlFile + '  ←  ' + jsFiles.join(', '));
  console.log('  引用 id ' + ids.size + ' 个：' + (miss.length ? '✗ 缺失 ' + miss.join(', ') : '✓ 全部存在'));
  return miss.length;
}

let bad = 0;
bad += check('index.html', ['js/app.js']);
bad += check('admin.html', ['js/admin.js']);
process.exit(bad ? 1 : 0);
