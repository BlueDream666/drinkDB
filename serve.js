// 极简静态服务器：本地预览用（上线请用 GitHub Pages / Cloudflare Pages）
// 监听 0.0.0.0，所以同一个 WiFi 下的手机也能打开 —— 见启动时打印的局域网地址。
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8777);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.xls': 'application/vnd.ms-excel',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 ' + p); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('饮库本地预览已启动\n');
  console.log('  本机打开：  http://127.0.0.1:' + PORT + '/');
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach(name => {
    (nets[name] || []).forEach(n => {
      if (n.family === 'IPv4' && !n.internal) {
        console.log('  手机打开：  http://' + n.address + ':' + PORT + '/   （手机连同一个 WiFi）');
      }
    });
  });
  console.log('\n  后台 /admin.html      自测 /selftest.html');
  console.log('  Ctrl+C 停止');
});
