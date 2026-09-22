# 反复尝试推送，直到成功
#
# 为什么需要这个：国内直连 github.com 时通时不通，而且经常不是「连不上」，
# 而是「连上了但传一半卡死」——git 自己不会超时，会一直挂着。
# 所以这个脚本给每次尝试加了硬超时，卡住就掐掉重来。
#
# 用法：
#     .\tools\keep-pushing.ps1                 默认 40 轮，每轮间隔 15 秒
#     .\tools\keep-pushing.ps1 -Rounds 100 -Wait 10 -TimeoutSec 150

param(
  [string]$User = 'BlueDream666',
  [string]$Repo = 'drinkDB',
  [int]$Rounds = 40,
  [int]$Wait = 15,
  [int]$TimeoutSec = 150
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$remote = "https://github.com/$User/$Repo.git"
$env:GIT_TERMINAL_PROMPT = '0'

if ((git remote) -contains 'origin') { git remote set-url origin $remote } else { git remote add origin $remote }

# 传输参数：慢到 1KB/s 超过 30 秒就自己断掉，别死等
git config http.lowSpeedLimit 1000
git config http.lowSpeedTime 30

$local = (git rev-parse --verify HEAD).Substring(0, 7)
Write-Host "本地 HEAD = $local"
Write-Host "目标      = $remote"
Write-Host "每轮最多等 $TimeoutSec 秒，卡住就掐掉重来。共 $Rounds 轮。"
Write-Host ""

$tmpOut = Join-Path $env:TEMP 'dpush_out.txt'
$tmpErr = Join-Path $env:TEMP 'dpush_err.txt'

function Run-Git-Timed([string[]]$gitArgs, [int]$sec) {
  Remove-Item $tmpOut, $tmpErr -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath 'git' -ArgumentList $gitArgs -NoNewWindow -PassThru `
       -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr
  $done = $p.WaitForExit($sec * 1000)
  if (-not $done) {
    try { $p.Kill() } catch {}
    Get-Process git, 'git-remote-https' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    return @{ ok = $false; timeout = $true; out = '' }
  }
  $out = ''
  if (Test-Path $tmpErr) { $out += (Get-Content $tmpErr -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $tmpOut) { $out += (Get-Content $tmpOut -Raw -ErrorAction SilentlyContinue) }
  return @{ ok = ($p.ExitCode -eq 0); timeout = $false; out = $out }
}

for ($i = 1; $i -le $Rounds; $i++) {
  $stamp = (Get-Date).ToString('HH:mm:ss')
  Write-Host "[$stamp] 第 $i/$Rounds 轮…" -NoNewline

  $probe = Run-Git-Timed @('ls-remote', '--heads', 'origin') 30
  if (-not $probe.ok) {
    Write-Host " 网络没通" -ForegroundColor DarkGray
    if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
    continue
  }

  Write-Host " 网络通了，推送中…" -ForegroundColor Cyan
  $r = Run-Git-Timed @('push', '--force-with-lease', '-u', 'origin', 'main') $TimeoutSec

  if ($r.ok) {
    Write-Host ""
    Write-Host "推送成功！（第 $i 轮）" -ForegroundColor Green
    Write-Host "等 1~2 分钟 Pages 构建，然后打开 https://$($User.ToLower()).github.io/$Repo/"
    exit 0
  }

  if ($r.timeout) {
    Write-Host " 卡住了，掐掉重来" -ForegroundColor DarkGray
    if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
    continue
  }

  if ($r.out -match 'non-fast-forward|stale info') {
    Write-Host " lease 过期，改用普通 force…" -ForegroundColor Yellow
    $r2 = Run-Git-Timed @('push', '--force', '-u', 'origin', 'main') $TimeoutSec
    if ($r2.ok) { Write-Host "推送成功（force）" -ForegroundColor Green; exit 0 }
    Write-Host " 还是不行" -ForegroundColor DarkGray
  }

  if ($r.out -match 'Authentication failed|Invalid username or token|could not read Username') {
    Write-Host ""
    Write-Host "认证失败。先清掉失效的旧凭据，再跑本脚本：" -ForegroundColor Red
    Write-Host "   cmdkey /delete:LegacyGeneric:target=git:https://github.com" -ForegroundColor White
    exit 2
  }

  Write-Host " 这次没成" -ForegroundColor DarkGray
  if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
}

Write-Host ""
Write-Host "试了 $Rounds 轮都没成功。" -ForegroundColor Yellow
Write-Host "多半是网络。开代理后跑这句，再重试：" -ForegroundColor Yellow
Write-Host "   git config --global http.proxy http://127.0.0.1:7890   # 端口换成你自己的"
exit 1
