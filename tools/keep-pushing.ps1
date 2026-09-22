# 反复尝试推送，直到成功（GitHub 国内时通时不通）
#
# 用法：
#     .\tools\keep-pushing.ps1             默认试 20 轮，每轮间隔 25 秒
#     .\tools\keep-pushing.ps1 -Rounds 40 -Wait 20

param(
  [string]$User = 'BlueDream666',
  [string]$Repo = 'drinkDB',
  [int]$Rounds = 20,
  [int]$Wait = 25
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$remote = "https://github.com/$User/$Repo.git"
$env:GIT_TERMINAL_PROMPT = '0'

if ((git remote) -contains 'origin') { git remote set-url origin $remote } else { git remote add origin $remote }

$local = (git rev-parse --verify HEAD).Substring(0, 7)
Write-Host "本地 HEAD = $local"
Write-Host "目标      = $remote"
Write-Host "开始重试，最多 $Rounds 轮，每轮间隔 $Wait 秒。Ctrl+C 可以停。"
Write-Host ""

for ($i = 1; $i -le $Rounds; $i++) {
  $stamp = (Get-Date).ToString('HH:mm:ss')
  Write-Host "[$stamp] 第 $i/$Rounds 轮…" -NoNewline

  # 先探一下再推，省得每次都等 3 分钟超时
  $probe = git ls-remote --heads origin 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    Write-Host " 网络没通" -ForegroundColor DarkGray
    if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
    continue
  }

  if ($probe -match [regex]::Escape($local)) {
    Write-Host " 远端已经是本地这个版本了，不用推。" -ForegroundColor Green
    exit 0
  }

  Write-Host " 网络通了，推送中…" -ForegroundColor Cyan
  $out = git push --force-with-lease -u origin main 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 推送成功！（第 $i 轮）" -ForegroundColor Green
    Write-Host "   等 1~2 分钟 Pages 构建，然后打开 https://$($User.ToLower()).github.io/$Repo/"
    exit 0
  }

  if ($out -match 'non-fast-forward|stale info') {
    Write-Host " lease 过期，改用普通 force 再试…" -ForegroundColor Yellow
    $out2 = git push --force -u origin main 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      Write-Host ""
      Write-Host "✅ 推送成功（force）" -ForegroundColor Green
      exit 0
    }
    $out = $out2
  }

  if ($out -match 'Authentication failed|Invalid username or token') {
    Write-Host ""
    Write-Host "❌ 认证失败。先清掉失效的旧凭据再跑：" -ForegroundColor Red
    Write-Host "   cmdkey /delete:LegacyGeneric:target=git:https://github.com" -ForegroundColor White
    exit 2
  }

  Write-Host " 推送中断，继续重试" -ForegroundColor DarkGray
  if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
}

Write-Host ""
Write-Host "试了 $Rounds 轮都没成功。可能得开代理：" -ForegroundColor Yellow
Write-Host "   git config --global http.proxy http://127.0.0.1:7890   # 端口换成你自己的"
exit 1
