/* ============================================================
 *  饮库 —— 设置审核台口令
 *  ------------------------------------------------------------
 *  仓库里**不会**出现口令明文，只写进「随机盐 + SHA-256 摘要」。
 *  别人看到源码也反推不出口令。
 *
 *  用法：
 *      node tools/set-password.js                交互式输入（推荐，输入时不回显）
 *      node tools/set-password.js 你的口令        直接传参（会留在命令历史里，不推荐）
 *
 *  改完记得把 js/config.js 传到 GitHub（或者用 GitHub Desktop 同步）。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'js', 'config.js');
const sha256Hex = require(path.join(ROOT, 'js', 'sha256.js'));

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const stdin = process.stdin;
    process.stdout.write(question);
    const onData = char => {
      const s = char.toString();
      if (s === '\n' || s === '\r' || s === '\u0004') {
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(buf);
      } else if (s === '\u0003') {
        process.exit(1);
      } else if (s === '\u007f' || s === '\b') {
        if (buf.length) { buf = buf.slice(0, -1); process.stdout.write('\b \b'); }
      } else {
        buf += s;
        process.stdout.write('*');
      }
    };
    let buf = '';
    stdin.on('data', onData);
  });
}

(async () => {
  let pass = process.argv[2];

  if (!pass) {
    pass = await askHidden('输入新口令（输入时不显示）：');
    if (!pass) { console.log('口令不能为空。'); process.exit(1); }
    const again = await askHidden('再输一遍确认：');
    if (pass !== again) { console.log('两次输入不一致，没有改动。'); process.exit(1); }
  }

  if (pass.length < 8) {
    console.log('提示：口令少于 8 位，容易被猜到。要不要再长一点？');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = sha256Hex(salt + '|' + pass);

  let src = fs.readFileSync(CONFIG, 'utf8');
  const before = src;

  src = src.replace(/adminSalt:\s*'[^']*'/, "adminSalt: '" + salt + "'");
  if (!/adminSalt:/.test(src)) {
    src = src.replace(/(\n\s*\/\* 仅本地版使用[\s\S]*?\*\/\n)/,
      "$1  adminSalt: '" + salt + "',\n");
  }
  src = src.replace(/adminHash:\s*'[^']*'/, "adminHash: '" + hash + "'");

  if (src === before) {
    console.log('没找到 adminSalt / adminHash 字段，请检查 js/config.js。');
    process.exit(1);
  }

  src = src.replace(/adminPasscode:\s*'[^']*',?\s*\n/, '');   // 清掉可能残留的明文
  // 清掉可能残留的明文口令（历史上用过）
  src = src.replace(/^.*adminPasscode.*$\n?/gm, '');

  fs.writeFileSync(CONFIG, src, 'utf8');

  console.log('\n已写入 js/config.js（只存摘要，不存明文）');
  console.log('  盐  : ' + salt);
  console.log('  摘要: ' + hash.slice(0, 24) + '…（共 ' + hash.length + ' 位）');
  console.log('\n下一步：把 js/config.js 传到 GitHub，审核台就用新口令了。');
  console.log('忘了口令就再跑一次本脚本重设。');
})();
