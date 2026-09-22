/* ============================================================
 *  饮库 —— 本地 GitHub 代理（绕过 DNS 污染 / 换可用 IP）
 *  ------------------------------------------------------------
 *  背景：本机 DNS 把 github.com 解析到 20.205.243.166，那个 IP 连不上
 *  （443 直接超时）；换成 20.27.177.113 就正常。
 *
 *  这个脚本在本机起一个很小的 HTTP 代理：遇到 github.com 就改连好用的 IP，
 *  其余域名照常走系统解析。git 通过它就能正常推拉了。
 *
 *  用法：
 *      node tools/gh-proxy.js
 *      git config --local http.proxy http://127.0.0.1:8899
 *      （用完）git config --local --unset http.proxy
 *
 *  可用环境变量覆盖： PROXY_PORT=8899   GH_IP=20.27.177.113,140.82.112.3
 * ============================================================ */
const net = require('net');
const dns = require('dns');

const PORT = Number(process.env.PROXY_PORT || 8899);
const OVERRIDE = (process.env.GH_IP || '20.27.177.113,20.200.245.247,20.233.83.145,20.26.156.215').split(',').map(s => s.trim()).filter(Boolean);
const HOSTS_TO_FIX = ['github.com', 'www.github.com', 'api.github.com', 'codeload.github.com'];

let ipIndex = 0;
const ipStats = {};   // ip -> { try, ok, bytes }
OVERRIDE.forEach(ip => ipStats[ip] = { try: 0, ok: 0, bytes: 0 });

function pickIp() {
  const ip = OVERRIDE[ipIndex % OVERRIDE.length];
  ipIndex++;
  return ip;
}
const now = () => new Date().toTimeString().slice(0, 8);
function log(s) { process.stdout.write('[' + now() + '] ' + s + '\n'); }

let connSeq = 0;

const server = net.createServer(client => {
  const id = ++connSeq;
  let buf = Buffer.alloc(0);
  let done = false;
  let bytesUp = 0, bytesDown = 0;

  const fail = why => { log('#' + id + ' ✗ ' + why); client.destroy(); };

  const onData = chunk => {
    if (done) return;
    buf = Buffer.concat([buf, chunk]);
    const head = buf.toString('latin1');
    const end = head.indexOf('\r\n\r\n');
    if (end < 0) {
      if (buf.length > 65536) fail('请求头过大');
      return;
    }
    done = true;
    client.removeListener('data', onData);

    const first = head.split('\r\n')[0];
    const m = first.match(/^CONNECT\s+([^:\s]+):(\d+)/i);
    if (!m) {
      log('#' + id + ' 非 CONNECT 请求：' + first);
      client.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
      return;
    }

    const host = m[1], port = parseInt(m[2], 10);
    const fix = HOSTS_TO_FIX.indexOf(host) >= 0;
    const rest = buf.slice(end + 4);

    let attempt = 0;
    function connect(target, label) {
      attempt++;
      if (fix) ipStats[label] && ipStats[label].try++;
      log('#' + id + ' CONNECT ' + host + ':' + port + ' → ' + label + (rest.length ? '  (附带 ' + rest.length + ' 字节)' : ''));

      const up = net.connect({ host: target, port: port });
      let settled = false;

      up.setTimeout(300000, () => { log('#' + id + ' 上游 300 秒无响应，断开'); up.destroy(); });
      up.on('connect', () => {
        settled = true;
        if (fix) ipStats[label] && ipStats[label].ok++;
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (rest.length) { up.write(rest); bytesUp += rest.length; }
        client.pipe(up);
        up.pipe(client);
        client.on('data', c => { bytesUp += c.length; });
      });

      up.on('data', c => { bytesDown += c.length; });
      up.on('error', e => {
        const why = e.code || e.message;
        if (!settled && fix && attempt < 3) {
          log('#' + id + ' 上游 ' + label + ' 失败（' + why + '），换个 IP 再试');
          return connect(pickIp(), pickIp.__last || label);
        }
        fail('上游 ' + label + ' 出错：' + why);
      });
      up.on('close', () => {
        log('#' + id + ' 结束  上传 ' + fmt(bytesUp) + '  下载 ' + fmt(bytesDown));
        client.destroy();
      });
      client.on('close', () => up.destroy());
      client.on('error', () => up.destroy());
    }

    function fmt(n) {
      return n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
    }

    if (fix) {
      const ip = pickIp();
      connect(ip, ip);
    } else {
      dns.lookup(host, (e, addr) => {
        if (e) return fail('解析 ' + host + ' 失败：' + e.message);
        connect(addr, addr);
      });
    }
  };

  client.on('data', onData);
  client.on('error', () => {});
  client.setTimeout(600000, () => { log('#' + id + ' 客户端 10 分钟无活动，断开'); client.destroy(); });
});

server.listen(PORT, '127.0.0.1', () => {
  log('GitHub 代理已启动： http://127.0.0.1:' + PORT);
  log('这些域名会改连到： ' + OVERRIDE.join(', '));
  log('   ' + HOSTS_TO_FIX.join(', '));
  log('');
  log('让 git 走它： git config --local http.proxy http://127.0.0.1:' + PORT);
  log('用完取消：   git config --local --unset http.proxy');
  log('（保持这个窗口开着，Ctrl+C 停止）');
  log('');
});

process.on('SIGINT', () => {
  log('统计：');
  Object.keys(ipStats).forEach(ip => {
    const s = ipStats[ip];
    log('   ' + ip.padEnd(18) + ' 尝试 ' + s.try + ' 次，成功 ' + s.ok + ' 次');
  });
  process.exit(0);
});
