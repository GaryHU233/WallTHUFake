"""WallTHU 校园墙 —— Flask 后端（前后端一体）。

运行：.venv/bin/gunicorn -b 0.0.0.0:8000 -w 1 --threads 16 app:app
"""
import io
import json
import math
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask, Response, abort, g, jsonify, request, send_from_directory, session,
)
from PIL import Image, UnidentifiedImageError
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db, init_db

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

CST = timezone(timedelta(hours=8))
CATEGORIES = ["表白捞人", "失物招领", "闲置交易", "求助问答", "树洞吐槽", "活动通知"]
SORTS = {"new", "hot", "pinned"}
REPORT_REASONS = ["辱骂/人身攻击", "广告/推广", "引战/挑事", "虚假信息", "泄露隐私", "色情/低俗", "其他"]

MAX_IMAGES = 9
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CONTENT_CHARS = 2000

PAGE_SIZE = 10
ADMIN_PAGE_SIZE = 20

# 两次发帖最小间隔（秒）
POST_INTERVAL = 10
# 实名昵称锁定天数
NICKNAME_LOCK_DAYS = 30
# 访客标识 Cookie（用于昵称锁定与私信会话，无需登录）
VID_COOKIE = "wallthu_vid"
VID_RE = re.compile(r"^[0-9a-f]{32}$")


# --------------------------------------------------------------------------
# 基础工具
# --------------------------------------------------------------------------
def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_cst() -> str:
    return datetime.now(CST).strftime("%Y-%m-%d")


def parse_utc(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def client_ip() -> str:
    """直连部署用 remote_addr；若前置了反向代理，可设 WALLTHU_TRUST_PROXY=1。"""
    if os.environ.get("WALLTHU_TRUST_PROXY") == "1":
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()[:45]
    return request.remote_addr or "0.0.0.0"


def visitor_id() -> str:
    """匿名访客标识：长期 Cookie，用于昵称锁定与私信会话。

    没有账号系统，同一浏览器即视为同一访客；换浏览器 / 清除 Cookie 会得到新标识。
    """
    if "vid" not in g:
        raw = request.cookies.get(VID_COOKIE, "")
        if VID_RE.match(raw or ""):
            g.vid = raw
            g.vid_new = False
        else:
            g.vid = secrets.token_hex(16)
            g.vid_new = True
    return g.vid


def read_or_create(path: Path, factory) -> str:
    if not path.exists():
        path.write_text(factory(), encoding="utf-8")
        path.chmod(0o600)
    return path.read_text(encoding="utf-8").strip()


def load_secret_key() -> str:
    return read_or_create(DATA_DIR / "secret_key", lambda: secrets.token_urlsafe(48))


ADMIN_SEED_FILE = DATA_DIR / "admin_seed.json"


def load_admin_seed() -> list[tuple[str, str, bool]]:
    """从 data/admin_seed.json 读取初始管理员（该文件已 gitignore，不进入仓库）。

    格式：{"admins": [{"name": "大管理员", "password": "...", "is_super": true}, ...]}
    """
    if not ADMIN_SEED_FILE.exists():
        return []
    try:
        raw = json.loads(ADMIN_SEED_FILE.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return []
    items = raw.get("admins", []) if isinstance(raw, dict) else []
    seeded: list[tuple[str, str, bool]] = []
    for item in items:
        if isinstance(item, dict) and item.get("name") and item.get("password"):
            seeded.append((str(item["name"]), str(item["password"]), bool(item.get("is_super"))))
    return seeded


def seed_admins(app) -> None:
    """首次启动时创建初始管理员；已存在则跳过。密码从种子文件读取，避免写入仓库。"""
    with app.app_context():
        db = get_db()
        count = db.execute("SELECT COUNT(*) AS n FROM admins").fetchone()["n"]
        if count != 0:
            return
        seeded = load_admin_seed()
        if not seeded:
            # 兜底：全新部署且无种子文件时，生成一个大管理员随机密码（可在后台再创建小管理员）
            seeded = [("大管理员", secrets.token_urlsafe(9), True)]
        for name, password, is_super in seeded:
            db.execute(
                "INSERT INTO admins (name, password_hash, is_super, created_at) "
                "VALUES (?, ?, ?, ?)",
                (name, generate_password_hash(password), int(is_super), now_utc()),
            )
        db.commit()


def json_body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


# --------------------------------------------------------------------------
# 应用初始化
# --------------------------------------------------------------------------
app = Flask(__name__, static_folder=None)
app.config.update(
    SECRET_KEY=load_secret_key(),
    DATABASE=str(DATA_DIR / "wall.db"),
    MAX_CONTENT_LENGTH=45 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
    SEND_FILE_MAX_AGE_DEFAULT=0,
)
init_db(app)
seed_admins(app)

_login_attempts: dict[str, list[float]] = {}
_login_lock = threading.Lock()


# --------------------------------------------------------------------------
# 通用校验
# --------------------------------------------------------------------------
def is_banned(ip: str) -> bool:
    row = get_db().execute(
        "SELECT 1 FROM bans WHERE ip = ? AND active = 1 "
        "AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?) LIMIT 1",
        (ip, now_utc()),
    ).fetchone()
    return row is not None


def rate_limit_remaining(table: str, ip: str, seconds: int) -> int:
    """返回还需等待的秒数，0 表示可以操作。table 仅来自内部常量。"""
    row = get_db().execute(
        f"SELECT created_at FROM {table} WHERE ip = ? ORDER BY id DESC LIMIT 1", (ip,)
    ).fetchone()
    if row is None:
        return 0
    elapsed = (datetime.now(timezone.utc) - parse_utc(row["created_at"])).total_seconds()
    remain = seconds - elapsed
    return max(0, int(remain + 0.999)) if remain > 0 else 0


def identity_state(vid: str) -> dict:
    """当前访客的实名昵称状态。"""
    row = get_db().execute(
        "SELECT nickname, set_at FROM identities WHERE thread = ?", (vid,)
    ).fetchone()
    if row is None:
        return {"nickname": "", "locked": False, "days_left": 0, "unlock_at": None}
    unlock = parse_utc(row["set_at"]) + timedelta(days=NICKNAME_LOCK_DAYS)
    left = (unlock - datetime.now(timezone.utc)).total_seconds()
    if left <= 0:
        return {
            "nickname": row["nickname"],
            "locked": False,
            "days_left": 0,
            "unlock_at": unlock.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    return {
        "nickname": row["nickname"],
        "locked": True,
        "days_left": max(1, math.ceil(left / 86400)),
        "unlock_at": unlock.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def enforce_nickname(vid: str, nickname: str):
    """检查 30 天昵称锁；返回 (最终昵称, 错误信息)。"""
    db = get_db()
    row = db.execute(
        "SELECT nickname, set_at FROM identities WHERE thread = ?", (vid,)
    ).fetchone()
    now = datetime.now(timezone.utc)
    if row is not None:
        unlock = parse_utc(row["set_at"]) + timedelta(days=NICKNAME_LOCK_DAYS)
        if now < unlock:
            if row["nickname"] != nickname:
                days = max(1, math.ceil((unlock - now).total_seconds() / 86400))
                return None, (
                    f"你的昵称已锁定为「{row['nickname']}」，{days} 天内不能修改"
                )
            return nickname, None
    db.execute(
        "INSERT INTO identities (thread, nickname, set_at) VALUES (?, ?, ?) "
        "ON CONFLICT(thread) DO UPDATE SET nickname = excluded.nickname, "
        "set_at = excluded.set_at",
        (vid, nickname, now_utc()),
    )
    db.commit()
    return nickname, None


def check_captcha(value: str) -> bool:
    code = session.pop("captcha", None)
    issued = session.pop("captcha_at", 0)
    if not code or not issued:
        return False
    if time.time() - issued > 10 * 60:
        return False
    if not value:
        return False
    return secrets.compare_digest(str(value).strip().upper(), code)


def clean_text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def parse_images(raw: str) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        return [x for x in data if isinstance(x, str)][:MAX_IMAGES]
    except (ValueError, TypeError):
        return []


# --------------------------------------------------------------------------
# 图片处理
# --------------------------------------------------------------------------
def process_uploads(files) -> list[str]:
    files = [f for f in files if f and f.filename]
    if len(files) > MAX_IMAGES:
        raise ValueError(f"最多上传 {MAX_IMAGES} 张图片")

    saved: list[str] = []
    try:
        for f in files:
            f.stream.seek(0, os.SEEK_END)
            size = f.stream.tell()
            f.stream.seek(0)
            if size > MAX_IMAGE_BYTES:
                raise ValueError("单张图片不能超过 5MB")
            if size == 0:
                continue
            try:
                probe = Image.open(io.BytesIO(f.read()))
                probe.verify()
                f.stream.seek(0)
                img = Image.open(io.BytesIO(f.read()))
                img.load()
            except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
                raise ValueError("仅支持 JPG / PNG / GIF / WebP 图片")

            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGBA")
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1])
                img = bg
            else:
                img = img.convert("RGB")

            img.thumbnail((1600, 1600), Image.LANCZOS)
            name = f"{uuid.uuid4().hex}.jpg"
            # 重新编码，顺带清除 EXIF 等隐私元数据
            img.save(UPLOAD_DIR / name, "JPEG", quality=85, optimize=True)
            saved.append(name)
    except Exception:
        for name in saved:
            (UPLOAD_DIR / name).unlink(missing_ok=True)
        raise
    return saved


def delete_upload_files(names: list[str]) -> None:
    for name in names:
        (UPLOAD_DIR / name).unlink(missing_ok=True)


TAG_RE = re.compile(r"#([^\s#，。！？、,.!?;；:：]{1,20})")


def extract_tags(content: str) -> list[str]:
    seen, tags = set(), []
    for tag in TAG_RE.findall(content):
        tag = tag.strip()
        if tag and tag not in seen:
            seen.add(tag)
            tags.append(tag)
    return tags[:10]


# --------------------------------------------------------------------------
# 序列化
# --------------------------------------------------------------------------
def serialize_post(row, detail: bool = False) -> dict:
    images = parse_images(row["images"])
    vid = row["visitor_id"] if "visitor_id" in row.keys() else ""
    data = {
        "id": row["id"],
        "category": row["category"],
        "content": row["content"],
        "is_anonymous": bool(row["is_anonymous"]),
        "nickname": "" if row["is_anonymous"] else row["nickname"],
        "images": [f"/uploads/{name}" for name in images],
        "pinned": bool(row["pinned"]),
        "like_count": row["like_count"],
        "view_count": row["view_count"],
        "comment_count": row["comment_count"] if "comment_count" in row.keys() else 0,
        "created_at": row["created_at"],
        "is_mine": bool(vid) and vid == visitor_id(),
    }
    if detail:
        data["contact"] = row["contact"]
        data["status"] = row["status"]
    return data


def serialize_comment(row) -> dict:
    vid = row["visitor_id"] if "visitor_id" in row.keys() else ""
    return {
        "id": row["id"],
        "parent_id": row["parent_id"] if "parent_id" in row.keys() else 0,
        "content": row["content"],
        "is_anonymous": bool(row["is_anonymous"]),
        "nickname": "" if row["is_anonymous"] else row["nickname"],
        "created_at": row["created_at"],
        "is_mine": bool(vid) and vid == visitor_id(),
    }


POST_SELECT = """
    SELECT p.*, (SELECT COUNT(*) FROM comments c
                 WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count
    FROM posts p
"""


# --------------------------------------------------------------------------
# 访问统计 / 安全响应头
# --------------------------------------------------------------------------
PAGE_PATHS = {"/", "/rules", "/about", "/appeal", "/tags", "/me", "/admin", "/admin/login"}


@app.before_request
def track_visit():
    visitor_id()  # 确保每个访客都有身份 Cookie
    if request.method == "GET" and request.path in PAGE_PATHS:
        try:
            db = get_db()
            db.execute(
                "INSERT INTO visits (ip, path, day, created_at) VALUES (?, ?, ?, ?)",
                (client_ip(), request.path, today_cst(), now_utc()),
            )
            db.commit()
        except Exception:
            pass


@app.after_request
def security_headers(resp: Response):
    if getattr(g, "vid_new", False) and getattr(g, "vid", ""):
        resp.set_cookie(
            VID_COOKIE,
            g.vid,
            max_age=365 * 24 * 3600,
            httponly=True,
            samesite="Lax",
        )
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: blob:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; "
        "connect-src 'self'; object-src 'none'; base-uri 'self'; "
        "form-action 'self'; frame-ancestors 'self'",
    )
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


# --------------------------------------------------------------------------
# 页面
# --------------------------------------------------------------------------
def page(name: str):
    resp = send_from_directory(PUBLIC_DIR, name)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/")
def index_page():
    return page("index.html")


@app.get("/post/<int:post_id>")
def post_page(post_id):
    return page("post.html")


@app.get("/rules")
def rules_page():
    return page("rules.html")


@app.get("/about")
def about_page():
    return page("about.html")


@app.get("/appeal")
def appeal_page():
    return page("appeal.html")


@app.get("/tags")
def tags_page():
    return page("tags.html")


@app.get("/me")
def me_page():
    return page("me.html")


@app.get("/admin")
def admin_page():
    return page("admin.html")


@app.get("/admin/login")
def admin_login_page():
    return page("admin.html")


@app.get("/css/<path:filename>")
def css_file(filename):
    return send_from_directory(PUBLIC_DIR / "css", filename)


@app.get("/js/<path:filename>")
def js_file(filename):
    return send_from_directory(PUBLIC_DIR / "js", filename)


@app.get("/img/<path:filename>")
def img_file(filename):
    return send_from_directory(PUBLIC_DIR / "img", filename)


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(PUBLIC_DIR, "favicon.png", mimetype="image/png")


@app.get("/favicon.png")
def favicon_png():
    return send_from_directory(PUBLIC_DIR, "favicon.png", mimetype="image/png")


@app.get("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /admin\n", mimetype="text/plain")


@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename, max_age=30 * 24 * 3600)


# --------------------------------------------------------------------------
# 公开 API
# --------------------------------------------------------------------------
@app.get("/api/captcha")
def api_captcha():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    code = "".join(secrets.choice(alphabet) for _ in range(4))
    session["captcha"] = code
    session["captcha_at"] = time.time()

    import random

    width, height = 130, 46
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="验证码">',
        '<rect width="100%" height="100%" rx="10" fill="#eef0f5"/>',
    ]
    for _ in range(5):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        parts.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
            f'stroke="rgba(120,130,160,.35)" stroke-width="1"/>'
        )
    for i, ch in enumerate(code):
        x = 14 + i * 29 + random.randint(-2, 2)
        y = 32 + random.randint(-3, 3)
        rot = random.randint(-16, 16)
        color = random.choice(["#4b5563", "#7c3aed", "#db2777", "#0f766e", "#b45309"])
        parts.append(
            f'<text x="{x}" y="{y}" font-family="ui-monospace,monospace" '
            f'font-size="26" font-weight="700" fill="{color}" '
            f'transform="rotate({rot} {x} {y})">{ch}</text>'
        )
    parts.append("</svg>")
    resp = Response("".join(parts), mimetype="image/svg+xml")
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/api/posts")
def api_posts():
    db = get_db()
    ip = client_ip()
    sort = request.args.get("sort", "new")
    if sort not in SORTS:
        sort = "new"
    category = request.args.get("category", "").strip()
    q = request.args.get("q", "").strip()[:50]
    tag = request.args.get("tag", "").strip()[:20]
    try:
        page_no = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page_no = 1

    where = ["p.status = 'approved'"]
    params: list = []
    if category and category != "全部":
        where.append("p.category = ?")
        params.append(category)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append("(p.content LIKE ? ESCAPE '\\' OR p.nickname LIKE ? ESCAPE '\\')")
        params.extend([f"%{escaped}%", f"%{escaped}%"])
    if tag:
        where.append("p.id IN (SELECT post_id FROM post_tags WHERE tag = ?)")
        params.append(tag)
    where_sql = " AND ".join(where)

    def fetch(extra_order: str, limit: int, offset: int, extra_where: str = ""):
        sql = (
            f"{POST_SELECT} WHERE {where_sql}{extra_where} "
            f"ORDER BY {extra_order} LIMIT ? OFFSET ?"
        )
        return db.execute(sql, [*params, limit, offset]).fetchall()

    pinned = []
    if sort != "pinned":
        pinned = fetch("p.pinned DESC, p.id DESC", 5, 0, " AND p.pinned = 1")

    if sort == "pinned":
        order = "p.pinned DESC, p.id DESC"
        count_sql = f"SELECT COUNT(*) AS n FROM posts p WHERE {where_sql} AND p.pinned = 1"
        rows = fetch(order, PAGE_SIZE, (page_no - 1) * PAGE_SIZE, " AND p.pinned = 1")
        total = db.execute(count_sql, params).fetchone()["n"]
    else:
        order = "p.like_count DESC, p.id DESC" if sort == "hot" else "p.id DESC"
        extra = " AND p.pinned = 0" if sort in ("new", "hot") else ""
        count_sql = f"SELECT COUNT(*) AS n FROM posts p WHERE {where_sql}{extra}"
        total = db.execute(count_sql, params).fetchone()["n"]
        rows = fetch(order, PAGE_SIZE, (page_no - 1) * PAGE_SIZE, extra)

    liked_ids = set()
    ids = [r["id"] for r in [*rows, *pinned]]
    if ids:
        placeholders = ",".join("?" * len(ids))
        liked_ids = {
            r["post_id"]
            for r in db.execute(
                f"SELECT post_id FROM likes WHERE ip = ? AND post_id IN ({placeholders})",
                [ip, *ids],
            ).fetchall()
        }

    posts = []
    for row in rows:
        item = serialize_post(row)
        item["liked"] = row["id"] in liked_ids
        posts.append(item)
    pinned_out = []
    for row in pinned:
        item = serialize_post(row)
        item["liked"] = row["id"] in liked_ids
        pinned_out.append(item)

    return jsonify(
        {
            "ok": True,
            "pinned": pinned_out,
            "posts": posts,
            "page": page_no,
            "total": total,
            "has_more": page_no * PAGE_SIZE < total,
        }
    )


@app.post("/api/posts")
def api_create_post():
    ip = client_ip()
    vid = visitor_id()
    if is_banned(ip):
        return error("该网络已被禁止发帖", 403)

    remain = rate_limit_remaining("posts", ip, POST_INTERVAL)
    if remain > 0:
        return error(f"发帖太频繁啦，请 {remain} 秒后再试", 429)

    category = clean_text(request.form.get("category"), 20)
    content = clean_text(request.form.get("content"), MAX_CONTENT_CHARS + 1)
    nickname = clean_text(request.form.get("nickname"), 20)
    contact = clean_text(request.form.get("contact"), 60)
    is_anonymous = request.form.get("is_anonymous", "1") not in ("0", "false", "False")

    if category not in CATEGORIES:
        return error("请选择有效的分类")
    if category == "活动通知" and not session.get("admin_id"):
        return error("活动通知仅管理员可发布", 403)
    if not content:
        return error("内容不能为空")
    if len(content) > MAX_CONTENT_CHARS:
        return error(f"内容不能超过 {MAX_CONTENT_CHARS} 字")
    if not is_anonymous and not nickname:
        return error("选择实名发布时，请填写一个昵称")

    files = request.files.getlist("images")
    try:
        images = process_uploads(files)
    except ValueError as exc:
        return error(str(exc))

    if not is_anonymous:
        nickname, nick_err = enforce_nickname(vid, nickname)
        if nick_err:
            return error(nick_err, 409)
    else:
        nickname = ""

    db = get_db()
    ts = now_utc()
    # 无需人工审核：发布即公开展示；管理员保留删除 / 置顶权限
    cur = db.execute(
        "INSERT INTO posts (category, content, nickname, is_anonymous, contact, "
        "images, status, ip, visitor_id, created_at, approved_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)",
        (
            category,
            content,
            nickname,
            int(is_anonymous),
            contact,
            json.dumps(images),
            ip,
            vid,
            ts,
            ts,
        ),
    )
    post_id = cur.lastrowid
    for tag in extract_tags(content):
        db.execute("INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)", (post_id, tag))
    db.commit()

    return jsonify(
        {
            "ok": True,
            "id": post_id,
            "message": "发布成功",
        }
    )


@app.get("/api/posts/<int:post_id>")
def api_post_detail(post_id):
    db = get_db()
    ip = client_ip()
    row = db.execute(
        f"{POST_SELECT} WHERE p.id = ? AND p.status = 'approved'", (post_id,)
    ).fetchone()
    if row is None:
        return error("帖子不存在或尚未通过审核", 404)

    viewed_key = f"viewed_{post_id}"
    if not session.get(viewed_key):
        db.execute("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", (post_id,))
        db.commit()
        session[viewed_key] = 1
        row = db.execute(
            f"{POST_SELECT} WHERE p.id = ? AND p.status = 'approved'", (post_id,)
        ).fetchone()

    prev_row = db.execute(
        "SELECT id FROM posts WHERE status = 'approved' AND id < ? ORDER BY id DESC LIMIT 1",
        (post_id,),
    ).fetchone()
    next_row = db.execute(
        "SELECT id FROM posts WHERE status = 'approved' AND id > ? ORDER BY id ASC LIMIT 1",
        (post_id,),
    ).fetchone()

    liked = db.execute(
        "SELECT 1 FROM likes WHERE post_id = ? AND ip = ?", (post_id, ip)
    ).fetchone()
    data = serialize_post(row, detail=True)
    data["liked"] = liked is not None
    data["prev_id"] = prev_row["id"] if prev_row else None
    data["next_id"] = next_row["id"] if next_row else None
    return jsonify({"ok": True, "post": data})


@app.post("/api/posts/<int:post_id>/like")
def api_like(post_id):
    db = get_db()
    ip = client_ip()
    row = db.execute(
        "SELECT id FROM posts WHERE id = ? AND status = 'approved'", (post_id,)
    ).fetchone()
    if row is None:
        return error("帖子不存在", 404)

    liked = db.execute(
        "SELECT 1 FROM likes WHERE post_id = ? AND ip = ?", (post_id, ip)
    ).fetchone()
    if liked:
        db.execute("DELETE FROM likes WHERE post_id = ? AND ip = ?", (post_id, ip))
        db.execute(
            "UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?", (post_id,)
        )
        liked_now = False
    else:
        db.execute("INSERT INTO likes (post_id, ip) VALUES (?, ?)", (post_id, ip))
        db.execute("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", (post_id,))
        liked_now = True
    db.commit()
    count = db.execute("SELECT like_count FROM posts WHERE id = ?", (post_id,)).fetchone()[
        "like_count"
    ]
    return jsonify({"ok": True, "liked": liked_now, "like_count": count})


@app.post("/api/posts/<int:post_id>/delete")
def api_delete_own_post(post_id):
    """发帖人可随时删除自己发布的帖子（软删除，前台隐藏）。"""
    vid = visitor_id()
    db = get_db()
    row = db.execute(
        "SELECT visitor_id FROM posts WHERE id = ?", (post_id,)
    ).fetchone()
    if row is None:
        return error("帖子不存在", 404)
    if row["visitor_id"] != vid:
        return error("只能删除自己发布的帖子", 403)
    db.execute(
        "UPDATE posts SET status = 'deleted', pinned = 0 WHERE id = ?", (post_id,)
    )
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/posts/<int:post_id>/comments")
def api_comments(post_id):
    db = get_db()
    post = db.execute(
        "SELECT 1 FROM posts WHERE id = ? AND status = 'approved'", (post_id,)
    ).fetchone()
    if post is None:
        return error("帖子不存在或尚未通过审核", 404)
    rows = db.execute(
        "SELECT * FROM comments WHERE post_id = ? AND status = 'visible' ORDER BY id ASC",
        (post_id,),
    ).fetchall()
    return jsonify({"ok": True, "comments": [serialize_comment(r) for r in rows]})


@app.post("/api/posts/<int:post_id>/comments")
def api_create_comment(post_id):
    ip = client_ip()
    vid = visitor_id()
    if is_banned(ip):
        return error("该网络已被禁止评论", 403)

    remain = rate_limit_remaining("comments", ip, 20)
    if remain > 0:
        return error(f"评论太频繁啦，请 {remain} 秒后再试", 429)

    data = json_body()
    content = clean_text(data.get("content"), 501)
    nickname = clean_text(data.get("nickname"), 20)
    is_anonymous = data.get("is_anonymous", True) not in (False, 0, "0", "false")

    try:
        parent_id = int(data.get("parent_id") or 0)
    except (TypeError, ValueError):
        parent_id = 0
    if parent_id < 0:
        parent_id = 0

    if not content:
        return error("评论不能为空")
    if len(content) > 500:
        return error("评论不能超过 500 字")
    if not is_anonymous and not nickname:
        return error("实名评论时请填写昵称")

    if not is_anonymous:
        nickname, nick_err = enforce_nickname(vid, nickname)
        if nick_err:
            return error(nick_err, 409)
    else:
        nickname = ""

    db = get_db()
    post = db.execute(
        "SELECT id FROM posts WHERE id = ? AND status = 'approved'", (post_id,)
    ).fetchone()
    if post is None:
        return error("帖子不存在", 404)

    if parent_id:
        parent = db.execute(
            "SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 'visible'",
            (parent_id, post_id),
        ).fetchone()
        if parent is None:
            return error("要回复的评论不存在", 404)

    cur = db.execute(
        "INSERT INTO comments (post_id, parent_id, content, nickname, is_anonymous, ip, "
        "visitor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (post_id, parent_id, content, nickname, int(is_anonymous), ip, vid, now_utc()),
    )
    db.commit()
    row = db.execute("SELECT * FROM comments WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"ok": True, "comment": serialize_comment(row)})


@app.post("/api/reports")
def api_report():
    ip = client_ip()
    remain = rate_limit_remaining("reports", ip, 45)
    if remain > 0:
        return error(f"举报太频繁啦，请 {remain} 秒后再试", 429)

    data = json_body()
    reason = clean_text(data.get("reason"), 30)
    detail = clean_text(data.get("detail"), 300)
    post_id = data.get("post_id")
    comment_id = data.get("comment_id")

    if reason not in REPORT_REASONS:
        return error("请选择举报理由")
    if not post_id and not comment_id:
        return error("举报对象无效")

    db = get_db()
    if comment_id:
        target = db.execute("SELECT post_id FROM comments WHERE id = ?", (int(comment_id),)).fetchone()
        if target is None:
            return error("评论不存在", 404)
        post_id = target["post_id"]
    elif post_id:
        if db.execute("SELECT 1 FROM posts WHERE id = ?", (int(post_id),)).fetchone() is None:
            return error("帖子不存在", 404)
    else:
        return error("举报对象无效")

    db.execute(
        "INSERT INTO reports (post_id, comment_id, reason, detail, ip, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            int(post_id) if post_id else None,
            int(comment_id) if comment_id else None,
            reason,
            detail,
            ip,
            now_utc(),
        ),
    )
    db.commit()
    return jsonify({"ok": True, "message": "举报已提交，管理员会尽快处理"})


@app.get("/api/tags")
def api_tags():
    db = get_db()
    rows = db.execute(
        "SELECT t.tag, COUNT(*) AS n FROM post_tags t "
        "JOIN posts p ON p.id = t.post_id AND p.status = 'approved' "
        "GROUP BY t.tag ORDER BY n DESC, t.tag ASC LIMIT 60"
    ).fetchall()
    return jsonify({"ok": True, "tags": [{"tag": r["tag"], "count": r["n"]} for r in rows]})


@app.post("/api/appeals")
def api_appeal():
    ip = client_ip()
    remain = rate_limit_remaining("appeals", ip, 300)
    if remain > 0:
        return error(f"提交太频繁啦，请 {remain} 秒后再试", 429)

    data = json_body()
    content = clean_text(data.get("content"), 1000)
    contact = clean_text(data.get("contact"), 60)
    captcha = data.get("captcha", "")
    post_id = data.get("post_id")
    try:
        post_id = int(post_id) if str(post_id or "").strip() else None
    except ValueError:
        return error("帖子编号格式不正确")

    if len(content) < 5:
        return error("请把申诉情况写清楚（至少 5 个字）")
    if not check_captcha(captcha):
        return error("验证码错误，请重试")

    db = get_db()
    db.execute(
        "INSERT INTO appeals (post_id, contact, content, ip, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (post_id, contact, content, ip, now_utc()),
    )
    db.commit()
    return jsonify({"ok": True, "message": "申诉已提交，请留意管理员回复"})


# --------------------------------------------------------------------------
# 访客身份 / 私信
# --------------------------------------------------------------------------
def serialize_message(row) -> dict:
    return {
        "id": row["id"],
        "sender": row["sender"],
        "content": row["content"],
        "created_at": row["created_at"],
    }


@app.get("/api/identity")
def api_identity():
    return jsonify({"ok": True, **identity_state(visitor_id())})


@app.get("/api/me")
def api_me():
    """「我的」页：我发的帖子、我发的评论、以及别人回复我评论的内容。"""
    vid = visitor_id()
    db = get_db()

    def scalar(sql, params):
        row = db.execute(sql, params).fetchone()
        return row[0] if row else 0

    stats = {
        "posts": scalar(
            "SELECT COUNT(*) FROM posts WHERE visitor_id = ? AND status != 'deleted'", (vid,)
        ),
        "comments": scalar(
            "SELECT COUNT(*) FROM comments WHERE visitor_id = ? AND status = 'visible'", (vid,)
        ),
        "replies": scalar(
            "SELECT COUNT(*) FROM comments c JOIN comments p ON p.id = c.parent_id "
            "WHERE p.visitor_id = ? AND c.visitor_id != ? AND c.status = 'visible'",
            (vid, vid),
        ),
    }

    posts = db.execute(
        f"{POST_SELECT} WHERE p.visitor_id = ? AND p.status != 'deleted' "
        f"ORDER BY p.id DESC LIMIT 200",
        (vid,),
    ).fetchall()

    my_comments = db.execute(
        "SELECT c.*, p.content AS post_content FROM comments c "
        "LEFT JOIN posts p ON p.id = c.post_id "
        "WHERE c.visitor_id = ? AND c.status = 'visible' "
        "ORDER BY c.id DESC LIMIT 200",
        (vid,),
    ).fetchall()

    replies = db.execute(
        "SELECT c.*, parent.content AS parent_content FROM comments c "
        "JOIN comments parent ON parent.id = c.parent_id "
        "WHERE parent.visitor_id = ? AND c.visitor_id != ? AND c.status = 'visible' "
        "ORDER BY c.id DESC LIMIT 200",
        (vid, vid),
    ).fetchall()

    return jsonify(
        {
            "ok": True,
            "stats": stats,
            "posts": [serialize_post(r) for r in posts],
            "comments": [
                {**serialize_comment(r), "post_id": r["post_id"], "post_content": (r["post_content"] or "")[:80]}
                for r in my_comments
            ],
            "replies": [
                {**serialize_comment(r), "parent_content": (r["parent_content"] or "")[:80]}
                for r in replies
            ],
        }
    )


@app.get("/api/messages")
def api_messages():
    vid = visitor_id()
    db = get_db()
    db.execute(
        "UPDATE messages SET read_by_user = 1 "
        "WHERE thread = ? AND sender = 'admin' AND read_by_user = 0",
        (vid,),
    )
    db.commit()
    rows = db.execute(
        "SELECT * FROM messages WHERE thread = ? ORDER BY id ASC LIMIT 500", (vid,)
    ).fetchall()
    return jsonify(
        {
            "ok": True,
            "messages": [serialize_message(r) for r in rows],
        }
    )


@app.get("/api/messages/unread")
def api_messages_unread():
    count = get_db().execute(
        "SELECT COUNT(*) AS n FROM messages WHERE thread = ? AND sender = 'admin' "
        "AND read_by_user = 0",
        (visitor_id(),),
    ).fetchone()["n"]
    return jsonify({"ok": True, "unread": count})


@app.post("/api/messages")
def api_send_message():
    ip = client_ip()
    vid = visitor_id()
    db = get_db()

    last = db.execute(
        "SELECT created_at FROM messages WHERE thread = ? AND sender = 'user' "
        "ORDER BY id DESC LIMIT 1",
        (vid,),
    ).fetchone()
    if last is not None:
        elapsed = (
            datetime.now(timezone.utc) - parse_utc(last["created_at"])
        ).total_seconds()
        if elapsed < 3:
            return error("发送太频繁啦，请几秒后再试", 429)

    content = clean_text(json_body().get("content"), 501)
    if not content:
        return error("消息不能为空")
    if len(content) > 500:
        return error("消息不能超过 500 字")

    cur = db.execute(
        "INSERT INTO messages (thread, sender, content, ip, read_by_user, "
        "read_by_admin, created_at) VALUES (?, 'user', ?, ?, 1, 0, ?)",
        (vid, content, ip, now_utc()),
    )
    db.commit()
    row = db.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"ok": True, "message": serialize_message(row)})


# --------------------------------------------------------------------------
# 管理员认证
# --------------------------------------------------------------------------
def _check_csrf():
    if request.method in ("GET", "HEAD"):
        return None
    token = request.headers.get("X-CSRF-Token") or request.form.get("csrf")
    if not token or not secrets.compare_digest(token, session.get("csrf", "")):
        return error("安全校验失败，请刷新页面重试", 403)
    return None


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_id"):
            return error("请先登录管理员账号", 401)
        csrf_err = _check_csrf()
        if csrf_err:
            return csrf_err
        return fn(*args, **kwargs)

    return wrapper


def super_admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_id"):
            return error("请先登录管理员账号", 401)
        if not session.get("is_super"):
            return error("仅大管理员可执行此操作", 403)
        csrf_err = _check_csrf()
        if csrf_err:
            return csrf_err
        return fn(*args, **kwargs)

    return wrapper


def login_blocked(ip: str) -> int:
    now = time.time()
    with _login_lock:
        attempts = [t for t in _login_attempts.get(ip, []) if now - t < 600]
        _login_attempts[ip] = attempts
        return max(0, 8 - len(attempts))


@app.post("/api/admin/login")
def admin_login():
    ip = client_ip()
    if login_blocked(ip) <= 0:
        return error("尝试次数过多，请 10 分钟后再试", 429)

    password = str(json_body().get("password", ""))
    if not password:
        return error("请输入密码", 401)

    db = get_db()
    matched = None
    for row in db.execute("SELECT * FROM admins ORDER BY is_super DESC, id ASC").fetchall():
        if check_password_hash(row["password_hash"], password):
            matched = row
            break
    if matched is None:
        with _login_lock:
            _login_attempts.setdefault(ip, []).append(time.time())
        return error("密码错误", 401)

    session.clear()
    session.permanent = True
    session["admin_id"] = matched["id"]
    session["admin_name"] = matched["name"]
    session["is_super"] = bool(matched["is_super"])
    session["csrf"] = secrets.token_urlsafe(32)
    with _login_lock:
        _login_attempts.pop(ip, None)
    return jsonify(
        {
            "ok": True,
            "csrf": session["csrf"],
            "name": matched["name"],
            "is_super": bool(matched["is_super"]),
        }
    )


@app.get("/api/admin/me")
def admin_me():
    if not session.get("admin_id"):
        return jsonify({"ok": True, "authenticated": False})
    return jsonify(
        {
            "ok": True,
            "authenticated": True,
            "csrf": session.get("csrf", ""),
            "name": session.get("admin_name", ""),
            "is_super": bool(session.get("is_super")),
        }
    )


@app.post("/api/admin/logout")
@admin_required
def admin_logout():
    session.clear()
    return jsonify({"ok": True})


# --------------------------------------------------------------------------
# 管理员账号管理（仅大管理员）
# --------------------------------------------------------------------------
@app.get("/api/admin/admins")
@super_admin_required
def admin_admins():
    db = get_db()
    rows = db.execute(
        "SELECT id, name, is_super, created_at FROM admins "
        "ORDER BY is_super DESC, id ASC"
    ).fetchall()
    me = session.get("admin_id")
    return jsonify(
        {
            "ok": True,
            "admins": [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "is_super": bool(r["is_super"]),
                    "created_at": r["created_at"],
                    "is_me": r["id"] == me,
                }
                for r in rows
            ],
        }
    )


@app.post("/api/admin/admins")
@super_admin_required
def admin_create_admin():
    data = json_body()
    name = clean_text(data.get("name"), 20)
    password = str(data.get("password", ""))
    if not name:
        return error("请填写管理员名称")
    if not password:
        return error("请填写密码")
    if len(password) < 4:
        return error("密码至少 4 位")

    db = get_db()
    if db.execute("SELECT 1 FROM admins WHERE name = ?", (name,)).fetchone():
        return error("该名称已存在")
    cur = db.execute(
        "INSERT INTO admins (name, password_hash, is_super, created_at) "
        "VALUES (?, ?, 0, ?)",
        (name, generate_password_hash(password), now_utc()),
    )
    db.commit()
    return jsonify({"ok": True, "id": cur.lastrowid})


@app.post("/api/admin/admins/<int:admin_id>/delete")
@super_admin_required
def admin_delete_admin(admin_id):
    db = get_db()
    target = db.execute("SELECT * FROM admins WHERE id = ?", (admin_id,)).fetchone()
    if target is None:
        return error("管理员不存在", 404)
    if target["is_super"]:
        return error("不能删除大管理员", 403)
    db.execute("DELETE FROM admins WHERE id = ?", (admin_id,))
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/admin/notices")
@admin_required
def admin_create_notice():
    content = clean_text(json_body().get("content"), MAX_CONTENT_CHARS + 1)
    pinned = bool(json_body().get("pinned"))
    if not content:
        return error("内容不能为空")
    if len(content) > MAX_CONTENT_CHARS:
        return error(f"内容不能超过 {MAX_CONTENT_CHARS} 字")

    db = get_db()
    ts = now_utc()
    admin_name = session.get("admin_name", "管理员")
    cur = db.execute(
        "INSERT INTO posts (category, content, nickname, is_anonymous, contact, "
        "images, status, ip, visitor_id, created_at, approved_at, pinned) "
        "VALUES ('活动通知', ?, ?, 0, '', '[]', 'approved', ?, '', ?, ?, ?)",
        (content, admin_name, client_ip(), ts, ts, int(pinned)),
    )
    post_id = cur.lastrowid
    for tag in extract_tags(content):
        db.execute("INSERT OR IGNORE INTO post_tags (post_id, tag) VALUES (?, ?)", (post_id, tag))
    db.commit()
    return jsonify({"ok": True, "id": post_id, "message": "活动通知已发布"})


# --------------------------------------------------------------------------
# 管理员 API
# --------------------------------------------------------------------------
@app.get("/api/admin/posts")
@admin_required
def admin_posts():
    db = get_db()
    status = request.args.get("status", "pending")
    if status not in ("pending", "approved", "rejected", "deleted", "all"):
        status = "pending"
    try:
        page_no = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page_no = 1
    q = request.args.get("q", "").strip()[:50]
    categories = request.args.get("category", "").strip()

    where, params = [], []
    if status != "all":
        where.append("p.status = ?")
        params.append(status)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        where.append("p.content LIKE ? ESCAPE '\\'")
        params.append(f"%{escaped}%")
    if categories:
        where.append("p.category = ?")
        params.append(categories)
    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    total = db.execute(f"SELECT COUNT(*) AS n FROM posts p{where_sql}", params).fetchone()["n"]
    rows = db.execute(
        f"{POST_SELECT}{where_sql} ORDER BY p.id DESC LIMIT ? OFFSET ?",
        [*params, ADMIN_PAGE_SIZE, (page_no - 1) * ADMIN_PAGE_SIZE],
    ).fetchall()

    posts = []
    for row in rows:
        item = serialize_post(row, detail=True)
        item.update(
            {
                "status": row["status"],
                "reject_reason": row["reject_reason"],
                "ip": row["ip"],
                "visitor_id": row["visitor_id"],
                "approved_at": row["approved_at"],
            }
        )
        posts.append(item)

    return jsonify(
        {
            "ok": True,
            "posts": posts,
            "page": page_no,
            "total": total,
            "has_more": page_no * ADMIN_PAGE_SIZE < total,
        }
    )


@app.post("/api/admin/posts/<int:post_id>/status")
@admin_required
def admin_post_status(post_id):
    data = json_body()
    status = data.get("status")
    if status not in ("approved", "rejected", "pending", "deleted"):
        return error("无效的状态")
    reason = clean_text(data.get("reason"), 200)

    db = get_db()
    row = db.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        return error("帖子不存在", 404)

    if status == "approved":
        db.execute(
            "UPDATE posts SET status = 'approved', reject_reason = '', "
            "approved_at = COALESCE(approved_at, ?) WHERE id = ?",
            (now_utc(), post_id),
        )
    elif status == "rejected":
        db.execute(
            "UPDATE posts SET status = 'rejected', reject_reason = ?, pinned = 0 WHERE id = ?",
            (reason, post_id),
        )
    else:
        db.execute("UPDATE posts SET status = ? WHERE id = ?", (status, post_id))
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/admin/posts/<int:post_id>/pin")
@admin_required
def admin_post_pin(post_id):
    pinned = bool(json_body().get("pinned"))
    db = get_db()
    row = db.execute("SELECT status FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        return error("帖子不存在", 404)
    if pinned and row["status"] != "approved":
        return error("只有已通过的帖子才能置顶")
    db.execute("UPDATE posts SET pinned = ? WHERE id = ?", (int(pinned), post_id))
    db.commit()
    return jsonify({"ok": True, "pinned": pinned})


@app.post("/api/admin/posts/<int:post_id>/delete")
@admin_required
def admin_post_delete(post_id):
    db = get_db()
    row = db.execute("SELECT id FROM posts WHERE id = ?", (post_id,)).fetchone()
    if row is None:
        return error("帖子不存在", 404)
    db.execute("UPDATE posts SET status = 'deleted', pinned = 0 WHERE id = ?", (post_id,))
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/comments")
@admin_required
def admin_comments():
    db = get_db()
    status = request.args.get("status", "visible")
    if status not in ("visible", "hidden", "all"):
        status = "visible"
    try:
        page_no = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page_no = 1

    where = "" if status == "all" else " WHERE c.status = ?"
    params = [] if status == "all" else [status]
    total = db.execute(f"SELECT COUNT(*) AS n FROM comments c{where}", params).fetchone()["n"]
    rows = db.execute(
        f"SELECT c.*, p.content AS post_content FROM comments c "
        f"LEFT JOIN posts p ON p.id = c.post_id{where} "
        f"ORDER BY c.id DESC LIMIT ? OFFSET ?",
        [*params, ADMIN_PAGE_SIZE, (page_no - 1) * ADMIN_PAGE_SIZE],
    ).fetchall()
    return jsonify(
        {
            "ok": True,
            "comments": [
                {
                    **serialize_comment(r),
                    "post_id": r["post_id"],
                    "post_content": (r["post_content"] or "")[:80],
                    "status": r["status"],
                    "ip": r["ip"],
                    "visitor_id": r["visitor_id"],
                }
                for r in rows
            ],
            "page": page_no,
            "total": total,
            "has_more": page_no * ADMIN_PAGE_SIZE < total,
        }
    )


@app.post("/api/admin/comments/<int:comment_id>/hide")
@admin_required
def admin_comment_hide(comment_id):
    hidden = bool(json_body().get("hidden"))
    db = get_db()
    if db.execute("SELECT 1 FROM comments WHERE id = ?", (comment_id,)).fetchone() is None:
        return error("评论不存在", 404)
    db.execute(
        "UPDATE comments SET status = ? WHERE id = ?",
        ("hidden" if hidden else "visible", comment_id),
    )
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/admin/comments/<int:comment_id>/delete")
@admin_required
def admin_comment_delete(comment_id):
    db = get_db()
    db.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/reports")
@admin_required
def admin_reports():
    db = get_db()
    status = request.args.get("status", "open")
    if status not in ("open", "resolved", "dismissed", "all"):
        status = "open"
    where = "" if status == "all" else " WHERE r.status = ?"
    params = [] if status == "all" else [status]
    rows = db.execute(
        f"SELECT r.*, p.content AS post_content, p.status AS post_status, "
        f"c.content AS comment_content, c.status AS comment_status "
        f"FROM reports r "
        f"LEFT JOIN posts p ON p.id = r.post_id "
        f"LEFT JOIN comments c ON c.id = r.comment_id"
        f"{where} ORDER BY r.id DESC LIMIT 200",
        params,
    ).fetchall()
    return jsonify(
        {
            "ok": True,
            "reports": [
                {
                    "id": r["id"],
                    "post_id": r["post_id"],
                    "comment_id": r["comment_id"],
                    "reason": r["reason"],
                    "detail": r["detail"],
                    "status": r["status"],
                    "created_at": r["created_at"],
                    "ip": r["ip"],
                    "post_content": (r["post_content"] or "")[:100],
                    "post_status": r["post_status"],
                    "comment_content": (r["comment_content"] or "")[:100],
                    "comment_status": r["comment_status"],
                }
                for r in rows
            ],
        }
    )


@app.post("/api/admin/reports/<int:report_id>")
@admin_required
def admin_report_action(report_id):
    action = json_body().get("action")
    if action not in ("resolve", "dismiss"):
        return error("无效的操作")
    db = get_db()
    if db.execute("SELECT 1 FROM reports WHERE id = ?", (report_id,)).fetchone() is None:
        return error("举报记录不存在", 404)
    db.execute(
        "UPDATE reports SET status = ? WHERE id = ?",
        ("resolved" if action == "resolve" else "dismissed", report_id),
    )
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/appeals")
@admin_required
def admin_appeals():
    db = get_db()
    status = request.args.get("status", "open")
    if status not in ("open", "resolved", "dismissed", "all"):
        status = "open"
    where = "" if status == "all" else " WHERE status = ?"
    params = [] if status == "all" else [status]
    rows = db.execute(
        f"SELECT * FROM appeals{where} ORDER BY id DESC LIMIT 200", params
    ).fetchall()
    return jsonify(
        {
            "ok": True,
            "appeals": [dict(r) for r in rows],
        }
    )


@app.post("/api/admin/appeals/<int:appeal_id>")
@admin_required
def admin_appeal_action(appeal_id):
    action = json_body().get("action")
    if action not in ("resolve", "dismiss"):
        return error("无效的操作")
    db = get_db()
    if db.execute("SELECT 1 FROM appeals WHERE id = ?", (appeal_id,)).fetchone() is None:
        return error("申诉记录不存在", 404)
    db.execute(
        "UPDATE appeals SET status = ? WHERE id = ?",
        ("resolved" if action == "resolve" else "dismissed", appeal_id),
    )
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/messages")
@super_admin_required
def admin_messages():
    db = get_db()
    rows = db.execute(
        "SELECT t.thread, t.last_id, t.unread, t.total, "
        "  (SELECT content    FROM messages WHERE id = t.last_id) AS last_content, "
        "  (SELECT sender     FROM messages WHERE id = t.last_id) AS last_sender, "
        "  (SELECT created_at FROM messages WHERE id = t.last_id) AS last_at, "
        "  (SELECT ip         FROM messages WHERE id = t.last_id) AS last_ip, "
        "  (SELECT nickname   FROM identities WHERE thread = t.thread) AS nickname, "
        "  (SELECT COUNT(*) FROM posts    WHERE visitor_id = t.thread) AS post_count, "
        "  (SELECT COUNT(*) FROM comments WHERE visitor_id = t.thread) AS comment_count "
        "FROM (SELECT thread, MAX(id) AS last_id, "
        "        SUM(CASE WHEN sender = 'user' AND read_by_admin = 0 "
        "                 THEN 1 ELSE 0 END) AS unread, "
        "        COUNT(*) AS total "
        "      FROM messages GROUP BY thread) t "
        "ORDER BY t.last_id DESC LIMIT 200"
    ).fetchall()

    threads = []
    for r in rows:
        threads.append(
            {
                "thread": r["thread"],
                "nickname": r["nickname"] or "",
                "label": r["nickname"] or f"匿名访客 · {r['thread'][-6:]}",
                "unread": r["unread"] or 0,
                "total": r["total"],
                "last_content": r["last_content"] or "",
                "last_sender": r["last_sender"],
                "last_at": r["last_at"],
                "last_ip": r["last_ip"] or "",
                "post_count": r["post_count"],
                "comment_count": r["comment_count"],
            }
        )
    return jsonify({"ok": True, "threads": threads})


@app.get("/api/admin/messages/<thread>")
@super_admin_required
def admin_thread(thread):
    if not VID_RE.match(thread):
        return error("会话不存在", 404)
    db = get_db()
    db.execute(
        "UPDATE messages SET read_by_admin = 1 "
        "WHERE thread = ? AND sender = 'user' AND read_by_admin = 0",
        (thread,),
    )
    db.commit()
    rows = db.execute(
        "SELECT * FROM messages WHERE thread = ? ORDER BY id ASC LIMIT 1000",
        (thread,),
    ).fetchall()
    nickname = db.execute(
        "SELECT nickname FROM identities WHERE thread = ?", (thread,)
    ).fetchone()
    return jsonify(
        {
            "ok": True,
            "thread": thread,
            "nickname": nickname["nickname"] if nickname else "",
            "messages": [serialize_message(r) for r in rows],
        }
    )


@app.post("/api/admin/messages/<thread>")
@super_admin_required
def admin_send_message(thread):
    if not VID_RE.match(thread):
        return error("会话不存在", 404)
    content = clean_text(json_body().get("content"), 1001)
    if not content:
        return error("消息不能为空")
    if len(content) > 1000:
        return error("消息不能超过 1000 字")

    db = get_db()
    known = db.execute(
        "SELECT 1 WHERE EXISTS(SELECT 1 FROM posts WHERE visitor_id = ?) "
        "OR EXISTS(SELECT 1 FROM comments WHERE visitor_id = ?) "
        "OR EXISTS(SELECT 1 FROM messages WHERE thread = ?) LIMIT 1",
        (thread, thread, thread),
    ).fetchone()
    if known is None:
        return error("找不到该访客，TA 需要先发帖或评论", 404)

    cur = db.execute(
        "INSERT INTO messages (thread, sender, content, ip, read_by_user, "
        "read_by_admin, created_at) VALUES (?, 'admin', ?, ?, 0, 1, ?)",
        (thread, content, client_ip(), now_utc()),
    )
    db.commit()
    row = db.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"ok": True, "message": serialize_message(row)})


@app.get("/api/admin/bans")
@admin_required
def admin_bans():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM bans WHERE active = 1 AND (expires_at IS NULL OR expires_at = '' "
        "OR expires_at > ?) ORDER BY id DESC LIMIT 200",
        (now_utc(),),
    ).fetchall()
    return jsonify({"ok": True, "bans": [dict(r) for r in rows]})


@app.post("/api/admin/bans")
@admin_required
def admin_ban_create():
    data = json_body()
    ip = clean_text(data.get("ip"), 45)
    reason = clean_text(data.get("reason"), 200)
    try:
        days = int(data.get("days") or 0)
    except (TypeError, ValueError):
        days = 0
    if not ip:
        return error("请填写要封禁的 IP")
    if is_banned(ip):
        return error("该 IP 已在封禁中")

    expires = None
    if days > 0:
        expires = (datetime.now(timezone.utc) + timedelta(days=days)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    db = get_db()
    db.execute(
        "INSERT INTO bans (ip, reason, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (ip, reason, now_utc(), expires),
    )
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/admin/bans/<int:ban_id>/remove")
@admin_required
def admin_ban_remove(ban_id):
    db = get_db()
    db.execute("UPDATE bans SET active = 0 WHERE id = ?", (ban_id,))
    db.commit()
    return jsonify({"ok": True})


@app.get("/api/admin/stats")
@admin_required
def admin_stats():
    db = get_db()

    def scalar(sql, params=()):
        row = db.execute(sql, params).fetchone()
        return row[0] if row else 0

    today = today_cst()
    stats = {
        "pending_posts": scalar("SELECT COUNT(*) FROM posts WHERE status = 'pending'"),
        "approved_posts": scalar("SELECT COUNT(*) FROM posts WHERE status = 'approved'"),
        "rejected_posts": scalar("SELECT COUNT(*) FROM posts WHERE status = 'rejected'"),
        "deleted_posts": scalar("SELECT COUNT(*) FROM posts WHERE status = 'deleted'"),
        "total_comments": scalar("SELECT COUNT(*) FROM comments WHERE status = 'visible'"),
        "open_reports": scalar("SELECT COUNT(*) FROM reports WHERE status = 'open'"),
        "open_appeals": scalar("SELECT COUNT(*) FROM appeals WHERE status = 'open'"),
        "unread_messages": scalar(
            "SELECT COUNT(*) FROM messages WHERE sender = 'user' AND read_by_admin = 0"
        ),
        "total_likes": scalar("SELECT COUNT(*) FROM likes"),
        "views_today": scalar("SELECT COUNT(*) FROM visits WHERE day = ?", (today,)),
        "uv_today": scalar(
            "SELECT COUNT(DISTINCT ip) FROM visits WHERE day = ?", (today,)
        ),
        "views_total": scalar("SELECT COUNT(*) FROM visits"),
        "bans": scalar(
            "SELECT COUNT(*) FROM bans WHERE active = 1 AND (expires_at IS NULL "
            "OR expires_at = '' OR expires_at > ?)",
            (now_utc(),),
        ),
    }
    days = []
    for offset in range(6, -1, -1):
        day = (datetime.now(CST) - timedelta(days=offset)).strftime("%Y-%m-%d")
        days.append(
            {
                "day": day,
                "posts": scalar(
                    "SELECT COUNT(*) FROM posts WHERE date(created_at, '+8 hours') = ?", (day,)
                ),
                "visits": scalar("SELECT COUNT(*) FROM visits WHERE day = ?", (day,)),
            }
        )
    stats["days"] = days
    return jsonify({"ok": True, "stats": stats})


# --------------------------------------------------------------------------
# 错误处理
# --------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return error("接口不存在", 404)
    return page("404.html"), 404


@app.errorhandler(413)
def too_large(_e):
    return error("上传内容过大（单次最多 45MB）", 413)


@app.errorhandler(500)
def server_error(_e):
    return error("服务器开小差了，请稍后再试", 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, threaded=True)
