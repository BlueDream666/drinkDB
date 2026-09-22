-- 饮库 DrinkDB —— D1 数据库建表语句
-- 在 Cloudflare 后台的 D1 控制台里，把下面整段粘进去执行一次就行。

CREATE TABLE IF NOT EXISTS likes (
  bev_id TEXT PRIMARY KEY,
  n      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bev_id     TEXT    NOT NULL,
  body       TEXT    NOT NULL,
  by_name    TEXT,
  status     TEXT    NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_bev    ON comments(bev_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

CREATE TABLE IF NOT EXISTS suggestions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  body       TEXT    NOT NULL,
  by_name    TEXT,
  status     TEXT    NOT NULL DEFAULT 'pending',
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggests_status ON suggestions(status);
