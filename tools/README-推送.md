# 一键推送到 GitHub（Windows PowerShell）

这个脚本帮你把 `ds` 目录变成一个 git 仓库并推到 GitHub。

## 用法

在这个目录下打开 PowerShell，执行：

```powershell
.\tools\push-to-github.ps1 -Repo drinkdb
```

参数：

| 参数 | 说明 | 默认 |
|---|---|---|
| `-Repo` | 仓库名，会变成 `https://<你的用户名>.github.io/<仓库名>/` | `drinkdb` |
| `-User` | GitHub 用户名 | 从 git 配置里读，或 `BlueDream666` |
| `-Private` | 建私有仓库 | 公开 |

> ⚠️ 仓库名会出现在网址里。如果你想要 `https://bluedream666.github.io/drinkdb/`，
> 仓库名就填 `drinkdb`。如果你想要 `https://bluedream666.github.io/` 这种根网址，
> 仓库名必须填 `<用户名>.github.io`（每个账号只能有一个）。

## 如果推送失败：`Failed to connect to github.com`

这是国内网络的老问题，`github.com` 的 443 端口经常连不上（我在这台机器上测了 5 次，5 次都超时）。
脚本会检测到并给出提示。三个办法，任选一个：

1. **开代理**，然后告诉 git：
   ```powershell
   git config --global http.proxy http://127.0.0.1:7890   # 端口换成你自己的
   ```
   推完可以取消：`git config --global --unset http.proxy`

2. **改用 SSH**（22 端口有时能通）：
   ```powershell
   ssh-keygen -t ed25519 -C "2250415364@qq.com"
   # 把 ~/.ssh/id_ed25519.pub 的内容贴到 GitHub → Settings → SSH keys
   git remote set-url origin git@github.com:<用户名>/<仓库名>.git
   git push -u origin main
   ```

3. **完全不走命令行的办法**（推荐，最省事）：
   直接用浏览器操作 —— 见下面「不用命令行的做法」。

## 不用命令行的做法（浏览器里点几下）

1. 打开 <https://github.com/new>，仓库名填 `drinkdb`，选 Public，**不要**勾 "Add a README"，点 Create。
2. 在新仓库页面点 **uploading an existing file**。
3. 把 `ds` 文件夹里的这些**全都拖进去**（`assets` 文件夹比较大，可能要等一会儿）：
   `index.html`、`admin.html`、`selftest.html`、`css/`、`js/`、`assets/`、`.github/`
4. 点 **Commit changes**。
5. 进仓库 **Settings → Pages**，Source 选 **GitHub Actions**。
6. 等一两分钟，Actions 跑完，网址就是 `https://<你的用户名>.github.io/drinkdb/`。

> 第 5 步是关键：不选 GitHub Actions 的话，`.github/workflows/pages.yml` 不会生效。
