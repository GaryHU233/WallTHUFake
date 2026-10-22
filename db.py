"""SQLite 数据层：连接管理与表结构。"""
import sqlite3

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category      TEXT    NOT NULL,
    content       TEXT    NOT NULL,
    nickname      TEXT    NOT NULL DEFAULT '',
    is_anonymous  INTEGER NOT NULL DEFAULT 1,
    contact       TEXT    NOT NULL DEFAULT '',
    images        TEXT    NOT NULL DEFAULT '[]',
    status        TEXT    NOT NULL DEFAULT 'pending',
    reject_reason TEXT    NOT NULL DEFAULT '',
    pinned        INTEGER NOT NULL DEFAULT 0,
    like_count    INTEGER NOT NULL DEFAULT 0,
    view_count    INTEGER NOT NULL DEFAULT 0,
    ip            TEXT    NOT NULL DEFAULT '',
    visitor_id    TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL,
    approved_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_status  ON posts(status, id);
CREATE INDEX IF NOT EXISTS idx_posts_cat     ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_ip      ON posts(ip);

CREATE TABLE IF NOT EXISTS comments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id      INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content      TEXT    NOT NULL,
    nickname     TEXT    NOT NULL DEFAULT '',
    is_anonymous INTEGER NOT NULL DEFAULT 1,
    status       TEXT    NOT NULL DEFAULT 'visible',
    ip           TEXT    NOT NULL DEFAULT '',
    visitor_id   TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, id);
CREATE INDEX IF NOT EXISTS idx_comments_ip   ON comments(ip);

CREATE TABLE IF NOT EXISTS likes (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    ip      TEXT    NOT NULL,
    PRIMARY KEY (post_id, ip)
);

CREATE TABLE IF NOT EXISTS reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER,
    comment_id INTEGER,
    reason     TEXT    NOT NULL,
    detail     TEXT    NOT NULL DEFAULT '',
    ip         TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'open',
    created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS bans (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT    NOT NULL,
    reason     TEXT    NOT NULL DEFAULT '',
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL,
    expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bans_ip ON bans(ip);

CREATE TABLE IF NOT EXISTS appeals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER,
    contact    TEXT    NOT NULL DEFAULT '',
    content    TEXT    NOT NULL,
    ip         TEXT    NOT NULL DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'open',
    created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT    NOT NULL DEFAULT '',
    path       TEXT    NOT NULL DEFAULT '',
    day        TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag     TEXT    NOT NULL,
    PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

/* 昵称锁定：同一浏览器（visitor_id）30 天内使用同一个实名昵称 */
CREATE TABLE IF NOT EXISTS identities (
    thread   TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    set_at   TEXT NOT NULL
);

/* 私信：thread 为访客的 visitor_id，管理员与访客共用一条会话 */
CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    thread        TEXT    NOT NULL,
    sender        TEXT    NOT NULL,
    content       TEXT    NOT NULL,
    ip            TEXT    NOT NULL DEFAULT '',
    read_by_user  INTEGER NOT NULL DEFAULT 0,
    read_by_admin INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread, id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(sender, read_by_admin);
"""


def _migrate(db):
    """为旧数据库补充新增字段（CREATE TABLE IF NOT EXISTS 不会改动已有表）。"""
    for table in ("posts", "comments"):
        columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        if "visitor_id" not in columns:
            db.execute(
                f"ALTER TABLE {table} ADD COLUMN visitor_id TEXT NOT NULL DEFAULT ''"
            )
    db.execute("CREATE INDEX IF NOT EXISTS idx_posts_vid ON posts(visitor_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_comments_vid ON comments(visitor_id)")


def get_db():
    if "db" not in g:
        db = sqlite3.connect(
            current_app.config["DATABASE"],
            timeout=15,
            detect_types=sqlite3.PARSE_DECLTYPES,
        )
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        db.execute("PRAGMA journal_mode = WAL")
        db.execute("PRAGMA busy_timeout = 15000")
        g.db = db
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app):
    with app.app_context():
        db = get_db()
        db.executescript(SCHEMA)
        _migrate(db)
        db.commit()
    app.teardown_appcontext(close_db)
