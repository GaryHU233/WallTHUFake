# WallTHU 校园墙

一个前后端一体的校园墙：匿名发帖、即时展示、评论互动、私信墙主、举报申诉、管理员后台。

- **前端**：原生 HTML / CSS / JavaScript，移动端优先，支持深色模式，清华紫主题
- **后端**：Python 3 + Flask + SQLite（单进程部署，无需额外数据库）
- **图片**：上传后自动压缩、清除 EXIF 隐私信息
- **发布**：帖子与评论即时公开，管理员事后巡查并删除违规内容

---

## 功能一览

### 学生端

| 功能 | 说明 |
| --- | --- |
| 首页信息流 | 分类标签、时间、匿名/实名、正文、配图、点赞、评论数、举报 |
| 排序 | 最新发布 / 热门（按点赞）/ 置顶公告 |
| 置顶区 | 管理员置顶的重要通知固定展示 |
| 发帖 | 悬浮按钮，分类、匿名开关、正文、多图（最多 9 张 / 每张 5MB）、联系方式；提交后立即公开，两次发帖间隔 10 秒 |
| 活动通知 | 独立分类，仅管理员可发布 / 管理，普通访客不能选择该分类 |
| 实名昵称 | 可选匿名；填写昵称后 30 天内不可更改（按浏览器识别） |
| 帖子详情 | 完整正文、图片画廊（点击放大）、点赞、复制、分享、举报 |
| 评论 | 支持匿名/实名（同样 30 天昵称锁定）、即时展示、单条评论举报 |
| 私信墙主 | 任何访客都能直接私信「大管理员」，大管理员可回复所有发帖 / 评论过的访客（小管理员不参与私信） |
| 搜索 | 顶部搜索框，按正文/昵称关键词搜索 |
| 标签 | 正文中的 `#标签` 自动聚合，独立热门标签页 |
| 附加页 | 墙规、关于我们、申诉、404 |
| 体验 | 深色模式、回到顶部、上一条/下一条、频率限制 |

### 管理端（`/admin`）

- 分级账号：1 个大管理员 + 多个小管理员；大管理员可创建 / 删除小管理员
- 全部 / 已发布 / 已删除 帖子管理，可删除违规帖、恢复旧数据
- 发布活动通知（可置顶）
- 置顶设置
- 评论管理（隐藏 / 恢复 / 删除）
- 私信会话：仅大管理员可见，查看所有访客来信并直接回复；可从帖子 / 评论一键发起私信
- 举报处理面板
- 申诉处理
- IP 封禁（永久或定期）
- 数据统计：今日/累计访问、独立访客、发帖量、评论数、近 7 天趋势

公开页面不提供管理入口，需直接访问 `/admin`。

### 账号与权限

| 角色 | 说明 |
| --- | --- |
| 大管理员 | 拥有全部权限，含管理管理员账号、查看 / 回复私信、发布活动通知 |
| 小管理员 | 权限与大管理员一致（删帖、置顶、封禁、处理举报申诉、发布活动通知等），但不能管理管理员账号、不能查看私信 |

- 小管理员不能删除大管理员；大管理员可以删除小管理员。
- 「私信墙主」= 私信大管理员，小管理员不参与私信。

---

## 快速开始

```bash
# 1. 创建虚拟环境并安装依赖
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. 启动（开发）
.venv/bin/gunicorn -b 0.0.0.0:8000 -w 1 --threads 8 app:app
# 或
.venv/bin/python app.py
```

浏览器打开 `http://<服务器IP>:8000/`。

首次启动会自动创建：

- `data/wall.db` —— SQLite 数据库
- `data/secret_key` —— 会话密钥（请勿泄露）
- `admins` 表中的初始管理员账号（密码采用 PBKDF2 哈希存储）

初始管理员从 `data/admin_seed.json`（已 gitignore，不会提交进仓库）读取。部署前创建该文件：

```json
{
  "admins": [
    {"name": "大管理员", "password": "在这里填写密码", "is_super": true},
    {"name": "小管理员1", "password": "在这里填写密码", "is_super": false}
  ]
}
```

- `is_super: true` 为大管理员，其余为小管理员。
- 首次启动写入 `admins` 表后，即可由大管理员在「管理员」页增删小管理员、或删除旧账号重建来更换密码。
- 若部署时未提供种子文件，将自动生成一个大管理员随机密码（此后可进入后台创建小管理员）。

---

## 生产部署（systemd + 80 端口）

创建 `/etc/systemd/system/wallthu.service`：

```ini
[Unit]
Description=WallTHU Campus Wall
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/WallTHU
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/ubuntu/WallTHU/.venv/bin/gunicorn -b 0.0.0.0:80 -w 1 --threads 16 --timeout 60 --access-logfile - --error-logfile - app:app
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wallthu
sudo systemctl status wallthu
```

之后直接访问 `http://<服务器IP>/`。

> 若使用云服务器，请确认安全组 / 防火墙已放行对应端口。
>
> 如果前面有 Nginx 等反向代理，请设置 `WALLTHU_TRUST_PROXY=1`，否则所有用户会被识别为代理 IP，封禁与频率限制将不准确。

### 备份

定期备份 `data/` 和 `uploads/` 两个目录即可：

```bash
tar czf wallthu-backup-$(date +%F).tar.gz data uploads
```

---

## 目录结构

```
WallTHU/
├── app.py               # Flask 应用与全部 API
├── db.py                # SQLite 表结构与连接管理
├── requirements.txt
├── data/                # 数据库、密钥（已 gitignore）
├── uploads/             # 上传图片（已 gitignore）
├── logs/
└── public/
    ├── index.html       # 首页 / 信息流 / 发帖弹层
    ├── post.html        # 帖子详情
    ├── rules.html       # 墙规
    ├── about.html       # 关于我们
    ├── appeal.html      # 申诉
    ├── tags.html        # 热门标签
    ├── admin.html       # 管理后台
    ├── 404.html
    ├── favicon.png
    ├── img/             # logo.png（校徽）/ name.png（清华附中文字）
    ├── css/style.css
    └── js/              # common / home / post / admin / ...
```

---

## 关键设计说明

**发布流程**：新帖直接以 `approved` 状态公开，管理员在后台巡查，可将违规帖标记为 `deleted`（前台立即隐藏，数据保留可恢复）。`pending` / `rejected` 仅用于兼容早期数据。

**匿名与实名**：没有账号系统（免登录发帖）。匿名时不展示任何身份信息；选择实名时需填写昵称，昵称按浏览器访客标识 `wallthu_vid` 记录，首次填写后 30 天内锁定，防止冒名反复改名。

**访客身份与私信**：服务端为每个浏览器签发长期 `wallthu_vid` Cookie（HttpOnly、SameSite=Lax），用于昵称锁定与私信会话线程，而不是按 IP 区分——校园网 NAT 下多人共用出口 IP，按 IP 会把不同人的会话合并。私信内容仅访客本人与大管理员可见，小管理员不参与私信。

**防刷与防滥用**：

- 发帖：同一 IP 10 秒 1 条
- 评论：20 秒 1 条
- 私信：3 秒 1 条
- 举报：45 秒 1 次
- 申诉：5 分钟 1 次
- 发帖与评论不再需要图形验证码（申诉仍保留）
- 管理后台登录连续失败 8 次锁定 10 分钟

**安全**：

- 所有 SQL 使用参数化查询；前台输出统一 HTML 转义
- 图片重新编码为 JPEG（最长边 1600px），移除 EXIF
- 上传仅接受图片，单张 ≤ 5MB，单次请求 ≤ 45MB
- 管理接口基于签名 Cookie 会话 + CSRF Token
- 设置 CSP、X-Content-Type-Options、X-Frame-Options 等安全头
- 默认未启用 HTTPS，正式对外建议加 Nginx/Caddy 证书

**已知限制**：

- 无账号体系，因此没有「我的发帖 / 我的评论」；点赞与频率限制按 IP 识别
- 帖子与评论即时展示，依赖管理员事后巡查删除违规内容
- 昵称锁定与私信线程依赖浏览器 Cookie，清除 Cookie 或更换浏览器 / 设备后会被视为新访客
- IP 封禁可能误伤同一出口网络下的其他用户

---

## 自定义

- **分类**：修改 `app.py` 顶部的 `CATEGORIES`，并同步修改 `public/js/common.js` 的 `CATEGORIES`（前端校验与展示）
- **校徽 / 校名**：替换 `public/img/logo.png`（建议透明底方形）与 `public/img/name.png`（横向校名），页头校名默认链接到学校官网，可在 `public/js/common.js` 的 `initHeader` 中修改
- **墙规 / 关于 / 联系方式**：直接编辑 `public/rules.html`、`public/about.html`
- **配色**：`public/css/style.css` 顶部的 CSS 变量（`--brand` 等）
- **管理员账号**：初始账号见上文；后续由大管理员在「管理员」页创建 / 删除小管理员

---

## 开发

```bash
# 语法检查
.venv/bin/python -m py_compile app.py db.py

# 开发模式（改代码自动重启）
.venv/bin/pip install flask
FLASK_DEBUG=1 .venv/bin/python app.py
```

## 许可

仅供校内交流使用，请遵守学校相关规定与法律法规。
