# 用命令行部署 Worker（比在网页上点更省事）
#
# 前提：你机器上已经有 Node.js（本项目的其它脚本都靠它，所以肯定有）
#
# 用法：在 F:\饮料统计\ds 下打开 PowerShell，执行
#     .\tools\deploy-worker.ps1
#
# 它会一步步问你，每步都停下来让你看清楚再继续。
# 中途任何一步失败都可以直接 Ctrl+C，然后重跑本脚本（已完成的步骤会自动跳过）。

param(
  [string]$DbName = 'drinkdb',
  [string]$Token = ''
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$workerDir = Join-Path $root 'worker'
Set-Location $workerDir

function Step($n, $text) {
  Write-Host ""
  Write-Host "──────── $n ────────" -ForegroundColor Cyan
  Write-Host $text
  Write-Host ""
}
function Pause-It($msg) {
  Write-Host ""
  Write-Host $msg -ForegroundColor Yellow
  Read-Host "按回车继续（想停下就关掉窗口）" | Out-Null
}

Write-Host ""
Write-Host "饮库 —— 部署 Cloudflare Worker" -ForegroundColor Cyan
Write-Host "工作目录: $workerDir"
Write-Host ""
Write-Host "整个过程大概 5 分钟。第一次跑会下载 wrangler（几十 MB），慢一点是正常的。"
Write-Host ""
Write-Host "不想做了随时 Ctrl+C，什么都不会坏 —— 网站本来就能正常用，"
Write-Host "这一步只是让点赞和评论从「只有自己看到」变成「所有人共享」。"
Write-Host ""
Read-Host "按回车开始" | Out-Null

# ---------- 0. 检查 node ----------
Write-Host ""
Write-Host "[0/5] 检查 Node.js…" -ForegroundColor Cyan
$nodeV = (node --version) 2>$null
if (-not $nodeV) {
  Write-Host "  没找到 node。先去 https://nodejs.org 装一个（选 LTS 版），再回来跑本脚本。" -ForegroundColor Red
  exit 1
}
Write-Host "  $nodeV" -ForegroundColor Green

# ---------- 1. 登录 ----------
Step "1/5" "登录 Cloudflare。会弹出一个浏览器窗口，点 Allow 授权就行。"
Write-Host "  如果浏览器没自动打开，看命令行里打印的那个网址，手动复制到浏览器打开。" -ForegroundColor DarkGray
Pause-It "准备好了就继续"
npx --yes wrangler@latest whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host "  还没登录，现在开始登录…" -ForegroundColor Yellow
  npx --yes wrangler@latest login
  npx --yes wrangler@latest whoami
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "  登录没成功。可以重跑本脚本再试。" -ForegroundColor Red
  exit 1
}

# ---------- 2. 建数据库 ----------
Step "2/5" "创建 D1 数据库「$DbName」"
Write-Host "  如果之前已经建过，这一步会提示已存在，直接用就行。"
Pause-It "继续"
$out = (npx --yes wrangler@latest d1 create $DbName 2>&1 | Out-String)
Write-Host $out

$dbId = $null
if ($out -match 'database_id"?\s*[:=]\s*"([0-9a-f-]{36})"') { $dbId = $Matches[1] }
elseif ($out -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $dbId = $Matches[1] }

if (-not $dbId) {
  Write-Host "  没从输出里认出 database_id。" -ForegroundColor Yellow
  Write-Host "  去 https://dash.cloudflare.com → Storage & databases → D1 找到 $DbName，" -ForegroundColor Yellow
  Write-Host "  把那串 ID 复制出来，粘到下面。" -ForegroundColor Yellow
  $dbId = Read-Host "  database_id"
}
if (-not $dbId) { Write-Host "  没有 ID 就没法继续。" -ForegroundColor Red; exit 1 }
Write-Host "  database_id = $dbId" -ForegroundColor Green

# 写进 wrangler.toml
$toml = Join-Path $workerDir 'wrangler.toml'
$t = Get-Content $toml -Raw -Encoding UTF8
$t = $t -replace 'database_id\s*=\s*"[^"]*"', "database_id = `"$dbId`""
Set-Content -Path $toml -Value $t -Encoding UTF8 -NoNewline
Write-Host "  已写入 worker/wrangler.toml" -ForegroundColor Green

# ---------- 3. 建表 ----------
Step "3/5" "在数据库里建表（likes / comments / suggestions）"
Pause-It "继续"
npx --yes wrangler@latest d1 execute $DbName --remote --file=schema.sql
if ($LASTEXITCODE -ne 0) {
  Write-Host "  建表失败。可以单独重跑： npx wrangler d1 execute $DbName --remote --file=schema.sql" -ForegroundColor Red
} else {
  Write-Host "  建表完成。验证一下：" -ForegroundColor Green
  npx --yes wrangler@latest d1 execute $DbName --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
}

# ---------- 4. 部署 ----------
Step "4/5" "部署 Worker"
Pause-It "继续"
npx --yes wrangler@latest deploy
if ($LASTEXITCODE -ne 0) { Write-Host "  部署失败，重跑本脚本再试。" -ForegroundColor Red; exit 1 }

# ---------- 5. 设置管理口令 ----------
Step "5/5" "设置管理员口令（ADMIN_TOKEN）"
Write-Host "  这个口令只有你知道，存在 Cloudflare 服务器上，不会进代码。" -ForegroundColor Yellow
Write-Host "  建议 20 位以上，字母数字符号混着来，别用你在别处用过的密码。"
Write-Host ""
Write-Host "  想自动化的话，也可以带参数跑： .\tools\deploy-worker.ps1 -Token 你的口令" -ForegroundColor DarkGray
Write-Host ""
if ($Token) {
  $Token | npx --yes wrangler@latest secret put ADMIN_TOKEN
} else {
  Write-Host "  接下来会提示你输入。注意：输入时屏幕上不会显示任何字符，这是正常的。" -ForegroundColor DarkGray
  npx --yes wrangler@latest secret put ADMIN_TOKEN
}

Write-Host ""
Write-Host "════════ 做完了 ════════" -ForegroundColor Green
Write-Host ""
Write-Host "你的 Worker 网址（上面 deploy 的输出里有）：" -ForegroundColor Cyan
Write-Host "    https://drinkdb-api.你的子域.workers.dev" -ForegroundColor White
Write-Host ""
Write-Host "最后一步：把它填进 js/config.js" -ForegroundColor Cyan
Write-Host "    apiBase: 'https://drinkdb-api.你的子域.workers.dev'," -ForegroundColor White
Write-Host ""
Write-Host "然后推一下代码，网站上的「互动数据」就会变成「云端同步」。" -ForegroundColor Cyan
Write-Host ""
