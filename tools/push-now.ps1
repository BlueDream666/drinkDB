# 一键把本地仓库推上 GitHub（覆盖远端）
#
# 用法：在 F:\饮料统计\ds 下打开 PowerShell，执行
#     .\tools\push-now.ps1
#
# ── 为什么需要「覆盖」？────────────────────────────────
# 你之前是在网页上一批一批传文件的，远端那条历史（12 个 "Add files via upload"）
# 和我们本地这条（9 个正经提交）是两条互不相干的线，直接推会被拒绝
# （non-fast-forward）。本地这条才是完整且最新的，所以用覆盖的方式推最干净。
#
# ── 为什么要重试？────────────────────────────────────
# 国内直连 github.com 的 443 端口时通时不通，实测经常 20 秒后超时。
# 这个脚本会自己多试几轮，通了一轮就推。

param(
  [string]$User = 'BlueDream666',
  [string]$Repo = 'drinkDB',
  [int]$Rounds = 6,
  [switch]$Force
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$remote = "https://github.com/$User/$Repo.git"

Write-Host ""
Write-Host "饮库 —— 推送到 GitHub" -ForegroundColor Cyan
Write-Host "  本地目录: $root"
Write-Host "  远端仓库: $remote"
Write-Host ""

function Try-Git([string[]]$gitArgs, [int]$timeoutSec = 60) {
  $env:GIT_TERMINAL_PROMPT = '0'
  $out = & git @gitArgs 2>&1 | Out-String
  return @{ ok = ($LASTEXITCODE -eq 0); out = $out }
}

# ---------- 1. 设置远端 ----------
Write-Host "[1/4] 设置远端地址…" -ForegroundColor Cyan
if ((git remote) -contains 'origin') { git remote set-url origin $remote } else { git remote add origin $remote }
Write-Host "      $(git remote get-url origin)" -ForegroundColor Green

# ---------- 2. 等网络 ----------
Write-Host ""
Write-Host "[2/4] 等 github.com 通…（最多试 $Rounds 轮，每轮 15 秒）" -ForegroundColor Cyan
$reachable = $false
for ($i = 1; $i -le $Rounds; $i++) {
  Write-Host "      第 $i 轮…" -NoNewline
  $ok = $false
  try {
    $r = Invoke-WebRequest -Uri 'https://github.com' -Method Head -TimeoutSec 12 -UseBasicParsing
    $ok = $true
  } catch { }
  if (-not $ok) {
    # HEAD 有时被挡，再用 git 自己试一次
    $t = Try-Git @('ls-remote', '--heads', 'origin')
    $ok = $t.ok
  }
  if ($ok) { Write-Host " 通了" -ForegroundColor Green; $reachable = $true; break }
  Write-Host " 没通" -ForegroundColor DarkGray
  if ($i -lt $Rounds) { Start-Sleep -Seconds 15 }
}

if (-not $reachable) {
  Write-Host ""
  Write-Host "github.com 一直连不上，先别推了。" -ForegroundColor Red
  Write-Host ""
  Write-Host "两个办法：" -ForegroundColor Yellow
  Write-Host "  ① 过一会儿再跑一次本脚本（国内直连就是时好时坏）"
  Write-Host "  ② 开代理，然后执行下面这行，再跑一次本脚本："
  Write-Host "     git config --global http.proxy http://127.0.0.1:7890    # 端口换成你自己的" -ForegroundColor White
  Write-Host ""
  Write-Host "  推完可以取消代理： git config --global --unset http.proxy" -ForegroundColor DarkGray
  exit 1
}

# ---------- 3. 看一眼差距 ----------
Write-Host ""
Write-Host "[3/4] 对比本地和远端…" -ForegroundColor Cyan
$t = Try-Git @('fetch', 'origin')
$remoteHead = (git rev-parse --verify origin/main 2>$null)
$localHead = (git rev-parse --verify HEAD 2>$null)
if ($remoteHead) {
  $behind = (git rev-list --count "HEAD..origin/main" 2>$null)
  $ahead = (git rev-list --count "origin/main..HEAD" 2>$null)
  Write-Host "      远端 main = $($remoteHead.Substring(0,7))"
  Write-Host "      本地 HEAD = $($localHead.Substring(0,7))"
  Write-Host "      本地领先 $ahead 个提交，落后 $behind 个提交"
  if ([int]$behind -gt 0) {
    Write-Host "      （落后是正常的：那几条是网页上传产生的，内容已被本地取代）" -ForegroundColor DarkGray
  }
} else {
  Write-Host "      远端还没有 main 分支（首次推送）"
}

# ---------- 4. 推 ----------
Write-Host ""
if ($Force) { $go = 'y' } else {
  Write-Host "即将执行： git push --force-with-lease -u origin main" -ForegroundColor Yellow
  Write-Host "效果：GitHub 上的仓库变得和本地一模一样。" -ForegroundColor Yellow
  Write-Host "      远端多出来的 assets/img（重复的 3MB）和根目录的 pages.yml 会被删掉，这是好事。"
  Write-Host ""
  $go = Read-Host "确认推送？(y/N)"
}
if ($go -ne 'y') { Write-Host "已取消，什么都没改。"; exit 0 }

Write-Host "[4/4] 推送中（可能要等十几秒）…" -ForegroundColor Cyan
$p = Try-Git @('push', '--force-with-lease', '-u', 'origin', 'main')
if ($p.ok) {
  Write-Host ""
  Write-Host "推送成功。" -ForegroundColor Green
} else {
  Write-Host $p.out -ForegroundColor DarkGray
  Write-Host "第一次没推上去，16 秒后重试一次…" -ForegroundColor Yellow
  Start-Sleep -Seconds 16
  $p = Try-Git @('push', '--force-with-lease', '-u', 'origin', 'main')
  if (-not $p.ok) {
    Write-Host $p.out -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "还是失败。按报错选一个：" -ForegroundColor Red
    Write-Host "  · 认证失败 / Invalid username or token → 先清掉失效的旧凭据：" -ForegroundColor Yellow
    Write-Host "      cmdkey /delete:LegacyGeneric:target=git:https://github.com" -ForegroundColor White
    Write-Host "    再跑一次本脚本，会弹出浏览器让你登录 GitHub。"
    Write-Host "  · non-fast-forward → 加 -Force 参数重跑： .\tools\push-now.ps1 -Force" -ForegroundColor Yellow
    Write-Host "  · 连不上 → 网络问题，过会儿再试，或者照上面开代理。" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "重试成功。" -ForegroundColor Green
}

Write-Host ""
Write-Host "接下来：" -ForegroundColor Cyan
Write-Host "  1. 等 1~2 分钟，GitHub Pages 会自动重新构建"
Write-Host "  2. 打开 https://$($User.ToLower()).github.io/$Repo/"
Write-Host "  3. 想确认进度就去 https://github.com/$User/$Repo/actions"
Write-Host ""
Write-Host "刷新后如果还是旧页面，强制刷新一下（电脑 Ctrl+F5，手机清一下缓存）。" -ForegroundColor DarkGray
