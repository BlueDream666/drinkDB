# 用命令行部署 Worker（绕开 Cloudflare 网页界面的各种坑）
#
# 为什么推荐这条：
#   网页上「Deploy Hello World」那个代码框只是预览，改不了；
#   部署完还要再进编辑器替换代码、再去绑数据库、再去设密钥，
#   每一步的按钮位置 Cloudflare 还经常改。
#   命令行一次把这些都做完。
#
# 用法：在 F:\饮料统计\ds 下打开 PowerShell，执行
#     .\tools\deploy-worker.ps1
#
# 已经做好的部分（脚本不会重复做）：
#   · D1 数据库 drinkdb 已建好，ID 已写进 worker/wrangler.toml
#   · 三张表已建好
# 所以本脚本实际只做三件事：登录 → 部署 → 设口令。

param(
  [string]$Token = ''
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workerDir = Join-Path $root 'worker'
Set-Location $workerDir

function Pause-It($msg) {
  Write-Host ""
  Write-Host $msg -ForegroundColor Yellow
  Read-Host "按回车继续（想停下就关掉窗口）" | Out-Null
}

Write-Host ""
Write-Host "饮库 —— 部署 Cloudflare Worker（命令行）" -ForegroundColor Cyan
Write-Host "工作目录: $workerDir"
Write-Host ""
Write-Host "大概 3 分钟。第一次跑会下载 wrangler，慢一点正常。"
Write-Host ""

$nodeV = (node --version) 2>$null
if (-not $nodeV) {
  Write-Host "没找到 node。先去 https://nodejs.org 装一个 LTS 版。" -ForegroundColor Red
  exit 1
}
$toml = Join-Path $workerDir 'wrangler.toml'
$dbLine = ((Get-Content $toml -Raw) -split "`n" | Where-Object { $_ -match 'database_id' } | Select-Object -First 1)
Write-Host "Node $nodeV"
Write-Host "配置里的 $($dbLine.Trim())"
Write-Host ""

# ---------- 1. 登录 ----------
Write-Host "[1/3] 登录 Cloudflare" -ForegroundColor Cyan
Write-Host "      会弹出浏览器让你授权，点 Allow 就行。"
Write-Host "      如果没自动弹出，把命令行里打印的网址复制到浏览器打开。"
Pause-It "准备好了就继续"

npx --yes wrangler@latest whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "      还没登录，开始登录…" -ForegroundColor Yellow
  npx --yes wrangler@latest login
  npx --yes wrangler@latest whoami
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "      登录没成功，重跑本脚本再试。" -ForegroundColor Red
  exit 1
}

# ---------- 2. 部署 ----------
Write-Host ""
Write-Host "[2/3] 部署 Worker" -ForegroundColor Cyan
Pause-It "继续"
npx --yes wrangler@latest deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host "      部署失败。把上面的报错发给我。" -ForegroundColor Red
  exit 1
}

# ---------- 3. 管理员口令 ----------
Write-Host ""
Write-Host "[3/3] 设置管理员口令 ADMIN_TOKEN" -ForegroundColor Cyan
Write-Host "      这个口令只有你知道，存在 Cloudflare 上，不会进代码。"
Write-Host "      建议 20 位以上，字母数字符号混着来，别用别处用过的密码。"
Write-Host ""
if ($Token) {
  $Token | npx --yes wrangler@latest secret put ADMIN_TOKEN
} else {
  Write-Host "      接下来会让你输入。注意：输入时屏幕上不显示任何字符，这是正常的。" -ForegroundColor DarkGray
  npx --yes wrangler@latest secret put ADMIN_TOKEN
}

Write-Host ""
Write-Host "════════ 完成 ════════" -ForegroundColor Green
Write-Host ""
Write-Host "你的 Worker 网址（上面 deploy 输出里那行 https://...）：" -ForegroundColor Cyan
Write-Host "    https://drinkdb.bluedream666.workers.dev" -ForegroundColor White
Write-Host ""
Write-Host "验证：浏览器打开它，应该看到" -ForegroundColor Cyan
Write-Host '    {"ok":true,"service":"饮库 DrinkDB API",...}' -ForegroundColor White
Write-Host ""
Write-Host "然后把这个网址告诉我，我填进 js/config.js 再推上去。" -ForegroundColor Cyan
Write-Host ""
