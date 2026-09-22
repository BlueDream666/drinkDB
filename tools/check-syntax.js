// 所有前端脚本的语法检查
const fs = require('fs');
const files = [
  'js/config.js', 'js/sha256.js', 'js/art.js', 'js/store.js', 'js/user.js',
  'js/presets.js', 'js/export.js', 'js/compare.js', 'js/lab.js', 'js/app.js', 'js/admin.js',
  'js/data/_schema.js', 'tools/build-single.js', 'tools/set-password.js',
];
let bad = 0;
files.forEach(f => {
  try { new Function(fs.readFileSync(f, 'utf8')); console.log('  ✓ ' + f); }
  catch (e) { bad++; console.log('  ✗ ' + f + '  ' + e.message); }
});
console.log(bad ? '\n' + bad + ' 个文件有语法错误' : '\n全部脚本语法 OK');
process.exit(bad ? 1 : 0);
