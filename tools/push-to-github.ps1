# 一键推送到 GitHub
# 用法： .\tools\push-to-github.ps1 -Repo drinkdb
param(
  [string]$Repo = 'drinkdb',
  [string]$User = '',
  [string]$Message = '饮库 DrinkDB：饮料属性库 + 筛选前台 + 审核后台',
  [switch]$Private
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "==> 工作目录: $root" -ForegroundColor Cyan

# ---------- 1. 用户名 ----------
if (-not $User) {
  $User = (git config --global user.name) 2>$null
  if (-not $User) { $User = 'BlueDream666' }
}
Write-Host "==> GitHub 用户名: $User" -ForegroundColor Cyan

# ---------- 2. 先确认能不能连上 github.com ----------
Write-Host "==> 检查 github.com 连通性…" -ForegroundColor Cyan
$reachable = $false
try {
  $r = Invoke-WebRequest -Uri 'https://github.com' -Method Head -TimeoutSec 12 -UseBasicParsing
  $reachable = $true
  Write-Host "    OK (HTTP $($r.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "    连不上：$($_.Exception.Message)" -ForegroundColor Yellow
}
if (-not $reachable) {
  Write-Host ''
  Write-Host "github.com 连不上，git push 一定失败。" -ForegroundColor Red
  Write-Host "请先看 tools\README-推送.md 里的三个办法（开代理 / 用 SSH / 走浏览器上传）。" -ForegroundColor Yellow
  Write-Host ''
  $go = Read-Host "仍然继续初始化本地仓库？(y/N)"
  if ($go -ne 'y') { exit 1 }
}

# ---------- 3. 初始化仓库 ----------
if (-not (Test-Path '.git')) {
  Write-Host "==> git init" -ForegroundColor Cyan
  git init -b main | Out-Null
} else {
  Write-Host "==> 已有 .git，跳过初始化" -ForegroundColor Cyan
}

# ---------- 4. 提交 ----------
Write-Host "==> 暂存并提交" -ForegroundColor Cyan
git add -A
$staged = (git diff --cached --name-only | Measure-Object).Count
if ($staged -eq 0) {
  Write-Host "    没有变化需要提交" -ForegroundColor Yellow
} else {
  Write-Host "    将提交 $staged 个文件"
  git commit -m $Message | Out-Null
  Write-Host "    已提交" -ForegroundColor Green
}

# ---------- 5. 远端 ----------
$remote = "https://github.com/$User/$Repo.git"
$has = (git remote) 2>$null
if ($has -contains 'origin') {
  git remote set-url origin $remote
} else {
  git remote add origin $remote
}
Write-Host "==> 远端: $remote" -ForegroundColor Cyan

# ---------- 6. 提示创建仓库 ----------
Write-Host ''
Write-Host "接下来需要这个仓库在 GitHub 上已经存在（脚本没有你的 token，建不了）：" -ForegroundColor Yellow
Write-Host "    https://github.com/new" -ForegroundColor White
Write-Host "    仓库名填: $Repo    可见性: $(if ($Private) { 'Private' } else { 'Public' })    不要勾 Add a README" -ForegroundColor White
Write-Host ''
$go = Read-Host "建好了就按 y 推送 (y/N)"
if ($go -ne 'y') { Write-Host "已停在本地提交这一步。随时可以重新跑本脚本。" -ForegroundColor Cyan; exit 0 }

# ---------- 7. 推 ----------
Write-Host "==> git push -u origin main" -ForegroundColor Cyan
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host "推送失败。多半还是网络问题，看 tools\README-推送.md。" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host "推送成功。" -ForegroundColor Green
Write-Host "还要做一件事（只需做一次）：" -ForegroundColor Yellow
Write-Host "    打开 https://github.com/$User/$Repo/settings/pages" -ForegroundColor White
Write-Host "    Source 选 GitHub Actions" -ForegroundColor White
Write-Host ''
Write-Host "等一两分钟，网址就是： https://$User.github.io/$Repo/" -ForegroundColor Green
