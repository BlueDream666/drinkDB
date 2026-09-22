# 给饮库加一个后端（Cloudflare Worker + D1）

> ## ⚠️ 先看这里：这一步是可选的
>
> **不做这个，你的网站也完全是好的。** 挑饮料、筛选、预设、对比、创新区、
> 导出 Excel、随机抽签——全都不依赖它。
>
> 数据库和 Worker 只为一件事服务：**让点赞和评论从「只有你自己看得到」
> 变成「所有访客共享」**。
>
> 现在的状态：点赞和评论能用，页面底部会标着「仅本机可见」。
> 做完下面这些，它会变成「云端同步」。
>
> 觉得麻烦就先放着，worker/ 这个文件夹放在那里不影响任何东西。


## 先说清楚：为什么需要它

现在这个站是**纯静态**的——一堆 html / js / 图片，放到 GitHub Pages 上就能看。
但有三件事纯静态做不到：

| 想做的事 | 为什么静态做不到 |
|---|---|
| **点赞并显示总赞数** | 没有地方存这个数字。存浏览器里，只有你自己看得到 |
| **评论** | 同上，而且别人的评论传不到你这里 |
| **实时给建议 / 审核** | 需要一个公共的、所有人都能读写的存储 |

**Cloudflare Worker 就是补上这块的**：它是运行在 Cloudflare 服务器上的一小段代码，
有自己的网址，能读写数据库。免费额度对个人项目绰绰有余。

> **这一整套全免费**：Workers 每天 10 万次请求，D1 数据库 5GB、每天 500 万行读。
> 你这个量级连零头都用不到，不需要绑信用卡。

---

## 一、注册 Cloudflare（5 分钟）

1. 打开 <https://dash.cloudflare.com/sign-up>
2. 填邮箱 + 密码 → 点 **Sign up**
3. 去邮箱点验证链接
4. 登录后进到控制台首页

> 你已经注册过了（截图里那个 `dash.cloudflare.com/.../home` 就是），直接往下走。

---

## 二、建一个 D1 数据库（2 分钟）

1. 左侧栏找 **Storage & databases**（存储和数据库）→ 点 **D1 SQL Database**
   （也可以直接在首页搜索框搜 `D1`）
2. 点 **Create database** / **Create**
3. **Database name** 填：

   ```
   drinkdb
   ```

4. 点 **Create**
5. 建好后进入这个数据库，点顶部的 **Console**（控制台）标签
6. 把 `worker/schema.sql` 里的**全部内容**粘进输入框，点 **Execute**

   > **⚠️ 这一步很多人会卡住**：D1 控制台粘贴时**会把换行吃掉**。
   > 而 SQL 里 `--` 开头的注释是「到本行结尾为止」——换行没了，注释就会把
   > 后面半句也一起吞掉，于是报 `incomplete input: SQLITE_ERROR`。
   >
   > 所以现在的 `schema.sql` 里**故意一条注释都不写**，每条语句压成一行。
   > 就算换行全丢了，靠分号也能正确切开。

7. **一次执行不完就一条一条来。** 按顺序把这六句分别粘进去、分别点 Execute：

   ```sql
   CREATE TABLE IF NOT EXISTS likes (bev_id TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
   ```

   ```sql
   CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, bev_id TEXT NOT NULL, body TEXT NOT NULL, by_name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
   ```

   ```sql
   CREATE INDEX IF NOT EXISTS idx_comments_bev ON comments(bev_id, status);
   ```

   ```sql
   CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
   ```

   ```sql
   CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL, by_name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
   ```

   ```sql
   CREATE INDEX IF NOT EXISTS idx_suggests_status ON suggestions(status);
   ```

8. **怎么确认成功了**：执行这句，返回三行就对：

   ```sql
   SELECT name FROM sqlite_master WHERE type='table';
   ```

   应该看到 `likes`、`comments`、`suggestions`。

> 已经建过的表再执行也不会报错（`IF NOT EXISTS`），可以放心重跑。
> 另外 D1 的 `AUTOINCREMENT` 必须写成 `INTEGER PRIMARY KEY AUTOINCREMENT`，中间不能加别的。

---

## 三、创建 Worker（5 分钟）

> Cloudflare 的界面文字改过好几版，新旧文档能查到不同说法。**下面按你实际会看到的界面写。**

1. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages>

2. 点右上角蓝色的 **Create application**

3. 这时会进到一个标题是 **Create an app → Make something new** 的页面，上面有几个选项：

   - Connect GitHub
   - Connect with GitLab
   - **Start with Hello World!**　← **点这个**
   - Select a template
   - Upload your static files

   页面最下面那行小字「Need to use the legacy Pages workflow? **Continue to Pages**」
   是给纯静态网站用的，我们不用管。

4. 点了 **Start with Hello World!** 之后会让你给 Worker 起名字，填：

   ```
   drinkdb-api
   ```

   再点 **Deploy**。等几秒，你会得到一个网址：

   ```
   https://drinkdb-api.你的子域.workers.dev
   ```

   **先把这行网址复制下来**，后面还要用。

5. 页面上有 **Edit code**（编辑代码）的入口。点进去，
   把编辑器里原来的示例代码**全选删掉**，换成 `worker/index.js` 的**全部内容**，
   点右上角 **Deploy** 保存。

6. 验证：浏览器打开你的 Worker 网址（结尾加个斜杠）：

   ```
   https://drinkdb-api.你的子域.workers.dev/
   ```

   看到 `{"ok":true,"service":"饮库 DrinkDB API",...}` 就成了。

### 如果网页上点不动，走命令行

你机器上已经有 Node.js，可以直接用官方的 `wrangler` 部署，**完全不用碰 Cloudflare 网页界面**：

```powershell
cd F:\饮料统计\ds
.	ools\deploy-worker.ps1
```

脚本会带你走完：登录 → 建数据库 → 建表 → 部署 → 设口令。
每步都停下来让你看清楚，失败了重跑（已完成的自动跳过）。
**它会自己把数据库 ID 写进 `worker/wrangler.toml`。**

> 想自己敲也行：
>
> ```powershell
> cd F:\饮料统计\ds\worker
> npx wrangler login
> npx wrangler d1 create drinkdb          # 记下输出的 database_id，填进 wrangler.toml
> npx wrangler d1 execute drinkdb --remote --file=schema.sql
> npx wrangler deploy
> npx wrangler secret put ADMIN_TOKEN     # 输入时不显示字符，是正常的
> ```
>
> 你数据库和表都建好了，所以第 2、3 条可以跳过。

---

## 四、把数据库接上（3 分钟）

1. 回到你的 Worker → **Settings**（设置）→ **Bindings**（绑定）
2. 点 **Add** → 选 **D1 database**
3. **Variable name** 必须填（一个字母都不能差）：

   ```
   DB
   ```

4. **D1 database** 选刚才建的 `drinkdb`
5. 点 **Save** / **Deploy** 让它生效

---

## 五、设置管理口令（2 分钟）

审核台要用一个口令来验明身份。这个口令**只存在 Cloudflare 服务器上**，
不写进任何代码，所以别人拿不到。

1. Worker → **Settings** → **Variables and Secrets**（变量和密钥）
2. 点 **Add** → 类型选 **Secret**（密钥，加了就不能再查看，只能覆盖）
3. **Name** 填：

   ```
   ADMIN_TOKEN
   ```

4. **Value** 填一个你自己定的长口令。建议 20 位以上、字母数字符号混着来。比如：

   ```
   yinku-9f3Kx7Qm2LpW8vTn
   ```

   > ⚠️ 别用你在别处用过的密码。这个口令等于你后台的钥匙。
   > 记在密码管理器里——Cloudflare 不给你看第二次。

5. **Save**

### 可选：加一层防刷（KV）

1. 左侧 **Storage & databases** → **KV** → **Create namespace**，名字填 `RATE`
2. 回到 Worker → **Settings** → **Bindings** → **Add** → **KV Namespace**
3. **Variable name** 填 `RATE`，选刚才建的命名空间
4. 保存

不配也能跑，只是少了「同一 IP 一分钟最多几次」的限制。

---

## 六、让前台用上它（1 分钟）

打开 `js/config.js`，把 `apiBase` 填成你的 Worker 网址（**结尾不要加斜杠**）：

```js
/* 上线后把这里改成你的后端地址；留空则用浏览器本地存储 */
apiBase: 'https://drinkdb-api.你的用户名.workers.dev',
```

保存，传到 GitHub。刷新网站——首页的「互动数据」会从
「仅本机可见」变成「云端同步」，点赞和评论就是所有人共享的了。

**想退回本地模式**：把 `apiBase` 改回 `''` 就行，其它什么都不用动。

---

## 七、后台怎么用

打开 `admin.html`：

- **没配后端时**：用 `node tools/set-password.js` 设的口令（本地校验）
- **配了后端时**：直接填第五步设的那个 `ADMIN_TOKEN`

登录后除了原有的「网友补充的饮料」，还会多出两块：

- **待审评论**：放行后才会出现在前台的详情页里
- **待审建议**：创新区「说点什么」提交的内容

---

## 接口一览（想自己扩展时看）

| 方法 | 路径 | 说明 | 要口令吗 |
|---|---|---|---|
| GET | `/api/state` | 全部点赞数 + 已通过的评论 | 否 |
| POST | `/api/like` | `{id, on}` 点赞 / 取消 | 否 |
| POST | `/api/comment` | `{id, body, by}` 发评论，进待审 | 否 |
| POST | `/api/suggest` | `{body, by}` 提建议，进待审 | 否 |
| POST | `/api/login` | `{token}` 校验口令 | 否 |
| GET | `/api/pending` | 待审的评论与建议 | **是** |
| POST | `/api/moderate` | `{kind, dbId, ok}` 放行 / 退回 | **是** |
| GET | `/api/stats` | 点赞数、评论数、待审数 | **是** |

要口令的接口，请求头里带 `Authorization: Bearer <你的 ADMIN_TOKEN>`。

---

## 常见问题

**Q：Worker 和 GitHub Pages 是两个网站吗？**
A：不是。GitHub Pages 放**网页**（看得见的部分），Worker 只放**接口**（存数据）。
用户只访问 Pages，浏览器在背后悄悄调 Worker。你不需要给 Worker 配域名。

**Q：数据库里存的是什么？能导出吗？**
A：`likes` 表是「哪款饮料被点了几个赞」；`comments` 是评论正文和审核状态；
`suggestions` 是建议。随时可以在 D1 控制台用 SQL 导出。

**Q：会不会被人刷赞？**
A：会。这个方案只做了基础频率限制。真要防刷得加
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)（免费的人机验证），
在 Worker 里加十几行就能接上。你这种小站，一般用不着。

**Q：免费额度用完了会怎样？**
A：不会突然收费。Cloudflare 会先限流，不会自动扣钱。真到这个量级，
说明站很火了，那时候再考虑付费也不迟。

**Q：以后想换成别家的后端呢？**
A：前台只认 `apiBase` 这一个配置和上面那张接口表。
任何能实现这几个接口的服务（Supabase、Vercel Functions、自己的服务器）都能替上来。

**Q：我不懂命令行，一定要装 wrangler 吗？**
A：不用。上面六步**全在网页上点**，一行命令都不用敲。
`wrangler.toml` 是给熟悉命令行的人准备的备选路线。
