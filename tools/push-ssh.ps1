# 用 SSH 推送到 GitHub（走 443 端口，绕开被重置的 HTTPS）
#
# 为什么换成 SSH：
#   实测 HTTPS 推送到一半会被重置（连接建立、拿到 refs、然后 pack 上传就被
#   掐断）。换成 SSH 走 443 端口（ssh.github.com:443）能连通。
#
# 用法：在 F:\饮料统计\ds 下打开 PowerShell，执行
#     .\tools\push-ssh.ps1
#
# 第一次跑会告诉你：去 GitHub 加一下公钥。加完再跑一次就成了。

param(
  [string]$User = 'BlueDream666',
  [string]$Repo = 'drinkDB',
  [int]$Rounds = 30,
  [int]$Wait = 12
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$remote = "git@github.com:$User/$Repo.git"
$pub = "$env:USERPROFILE\.ssh\id_ed25519_github.pub"

Write-Host ""
Write-Host "饮库 —— 用 SSH 推送" -ForegroundColor Cyan
Write-Host ""

# ---------- 0. 检查密钥 ----------
if (-not (Test-Path $pub)) {
  Write-Host "没找到 SSH 密钥： $pub" -ForegroundColor Red
  Write-Host "先生成一把："
  Write-Host "    ssh-keygen -t ed25519 -C `"drinkdb-push`" -f `"$env:USERPROFILE\.ssh\id_ed25519_github`"" -ForegroundColor White
  exit 1
}
$pubKey = (Get-Content $pub -Raw).Trim()

# ---------- 1. 测 SSH ----------
Write-Host "[1/3] 测试 SSH 连接（github.com 走 443）…" -ForegroundColor Cyan
$test = (ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -T git@github.com 2>&1 | Out-String)

if ($test -match 'successfully authenticated') {
  Write-Host "      认证通过" -ForegroundColor Green
} elseif ($test -match 'Permission denied \(publickey\)') {
  Write-Host "      通道通了，但公钥还没加到你的 GitHub 账号。" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  ┌─────────────────────────────────────────────────────────────┐"
  Write-Host "  │  去做这一步（一分钟）：                                     │"
  Write-Host "  │                                                             │"
  Write-Host "  │  1. 打开  https://github.com/settings/ssh/new               │"
  Write-Host "  │  2. Title 随便填，比如  drinkdb-push                        │"
  Write-Host "  │  3. Key 那一栏，把下面这一整行贴进去                         │"
  Write-Host "  │  4. 点 Add SSH key                                          │"
  Write-Host "  │  5. 回来再跑一次本脚本                                      │"
  Write-Host "  └─────────────────────────────────────────────────────────────┘"
  Write-Host ""
  Write-Host "  你的公钥（下面是完整一行，直接复制）：" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  $pubKey" -ForegroundColor White
  Write-Host ""
  Write-Host "  顺手帮你复制到剪贴板了。" -ForegroundColor DarkGray
  try { Set-Clipboard -Value $pubKey } catch {}
  Write-Host ""
  Write-Host "  想直接打开那个页面：" -ForegroundColor DarkGray
  Write-Host "      Start-Process 'https://github.com/settings/ssh/new'" -ForegroundColor White
  exit 1
} else {
  Write-Host "      SSH 没通，输出如下：" -ForegroundColor Red
  Write-Host $test
  Write-Host ""
  Write-Host "  检查一下 $env:USERPROFILE\.ssh\config 里有没有这段：" -ForegroundColor Yellow
  Write-Host "      Host github.com" -ForegroundColor White
  Write-Host "        HostName ssh.github.com" -ForegroundColor White
  Write-Host "        Port 443" -ForegroundColor White
  Write-Host "        User git" -ForegroundColor White
  Write-Host "        IdentityFile ~/.ssh/id_ed25519_github" -ForegroundColor White
  exit 1
}

# ---------- 2. 换远端 ----------
Write-Host "[2/3] 把远端改成 SSH…" -ForegroundColor Cyan
if ((git remote) -contains 'origin') { git remote set-url origin $remote } else { git remote add origin $remote }
git config --local --unset http.proxy 2>$null       # SSH 不需要 HTTP 代理
Write-Host "      $(git remote get-url origin)" -ForegroundColor Green

# ---------- 3. 推 ----------
Write-Host "[3/3] 推送…" -ForegroundColor Cyan
$env:GIT_TERMINAL_PROMPT = '0'
$tmpOut = Join-Path $env:TEMP 'dpush_out.txt'
$tmpErr = Join-Path $env:TEMP 'dpush_err.txt'

function Push-Once([string[]]$args2, [int]$sec) {
  Remove-Item $tmpOut, $tmpErr -ErrorAction SilentlyContinue
  $p = Start-Process -FilePath 'git' -ArgumentList $args2 -NoNewWindow -PassThru `
       -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr
  if (-not $p.WaitForExit($sec * 1000)) {
    try { $p.Kill() } catch {}
    Get-Process git, 'git-remote-https', ssh -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    return @{ ok = $false; timeout = $true; out = '' }
  }
  $o = ''
  if (Test-Path $tmpErr) { $o += (Get-Content $tmpErr -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $tmpOut) { $o += (Get-Content $tmpOut -Raw -ErrorAction SilentlyContinue) }
  return @{ ok = ($p.ExitCode -eq 0); timeout = $false; out = $o }
}

for ($i = 1; $i -le $Rounds; $i++) {
  $stamp = (Get-Date).ToString('HH:mm:ss')
  Write-Host "      [$stamp] 第 $i/$Rounds 次…" -NoNewline
  $r = Push-Once @('push', '--force-with-lease', '-u', 'origin', 'main') 180

  if ($r.ok) {
    Write-Host " 成功" -ForegroundColor Green
    Write-Host ""
    Write-Host "推送完成。" -ForegroundColor Green
    Write-Host "等 1~2 分钟 Pages 构建，然后打开：" -ForegroundColor Cyan
    Write-Host "    https://$($User.ToLower()).github.io/$Repo/"
    exit 0
  }
  if ($r.timeout) { Write-Host " 卡住，重来" -ForegroundColor DarkGray }
  elseif ($r.out -match 'non-fast-forward|stale info') {
    Write-Host " lease 过期，改 force…" -ForegroundColor Yellow
    $r2 = Push-Once @('push', '--force', '-u', 'origin', 'main') 180
    if ($r2.ok) { Write-Host "推送完成（force）" -ForegroundColor Green; exit 0 }
    Write-Host " 还是不行" -ForegroundColor DarkGray
  }
  else { Write-Host " 没成" -ForegroundColor DarkGray }
  if ($i -lt $Rounds) { Start-Sleep -Seconds $Wait }
}

Write-Host ""
Write-Host "试了 $Rounds 次都没成功。" -ForegroundColor Yellow
exit 1
