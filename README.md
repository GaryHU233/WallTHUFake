# WallTHU 校园墙

一个前后端一体的校园墙：匿名发帖、人工审核、评论互动、举报申诉、管理员后台。

- **前端**：原生 HTML / CSS / JavaScript，移动端优先，支持深色模式
- **后端**：Python 3 + Flask + SQLite（单进程部署，无需额外数据库）
- **图片**：上传后自动压缩、清除 EXIF 隐私信息
- **审核**：所有帖子先审后发，评论即时展示但可后台隐藏/删除

---

## 功能一览

### 学生端

| 功能 | 说明 |
| --- | --- |
| 首页信息流 | 分类标签、时间、匿名/实名、正文、配图、点赞、评论数、举报 |
| 排序 | 最新发布 / 热门（按点赞）/ 置顶公告 |
| 置顶区 | 管理员置顶的重要通知固定展示 |
| 发帖 | 悬浮按钮，分类、匿名开关、正文、多图（最多 9 张 / 每张 5MB）、联系方式、验证码 |
| 帖子详情 | 完整正文、图片画廊（点击放大）、点赞、复制、分享、举报 |
| 评论 | 支持匿名/实名、验证码、单条评论举报 |
| 搜索 | 顶部搜索框，按正文/昵称关键词搜索 |
| 标签 | 正文中的 `#标签` 自动聚合，独立热门标签页 |
| 附加页 | 墙规、关于我们、申诉、404 |
| 体验 | 深色模式、回到顶部、上一条/下一条、频率限制 |

### 管理端（`/admin`）

- 待审核 / 已通过 / 已驳回 帖子管理（驳回可写原因）
- 置顶设置
- 评论管理（隐藏 / 恢复 / 删除）
- 举报处理面板
- 申诉处理
- IP 封禁（永久或定期）
- 数据统计：今日/累计访问、独立访客、发帖量、评论数、近 7 天趋势

公开页面不提供管理入口，需直接访问 `/admin`。

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
- `data/admin_password` —— **管理后台初始密码**

查看管理员密码：

```bash
cat data/admin_password
```

也可以启动前设置环境变量覆盖：

```bash
export WALLTHU_ADMIN_PASSWORD='你的密码'
```

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
├── data/                # 数据库、密钥、管理员密码（已 gitignore）
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
    ├── css/style.css
    └── js/              # common / home / post / admin / ...
```

---

## 关键设计说明

**审核流程**：`posts.status` 为 `pending → approved / rejected / deleted`。前台只查询 `approved`；驳回记录原因，供申诉时核对。

**匿名与实名**：没有账号系统（免登录发帖）。选择「实名」时需填写一个昵称并公开展示；选择匿名则不展示任何身份信息。

**防刷与防滥用**：

- 发帖：同一 IP 5 分钟 1 条
- 评论：20 秒 1 条
- 举报：45 秒 1 次
- 申诉：5 分钟 1 次
- 所有发帖 / 评论 / 申诉均需图形验证码
- 管理后台登录连续失败 8 次锁定 10 分钟

**安全**：

- 所有 SQL 使用参数化查询；前台输出统一 HTML 转义
- 图片重新编码为 JPEG（最长边 1600px），移除 EXIF
- 上传仅接受图片，单张 ≤ 5MB，单次请求 ≤ 45MB
- 管理接口基于签名 Cookie 会话 + CSRF Token
- 设置 CSP、X-Content-Type-Options、X-Frame-Options 等安全头
- 默认未启用 HTTPS，正式对外建议加 Nginx/Caddy 证书

**已知限制**：

- 无账号体系，因此没有「我的发帖 / 我的评论」；点赞、频率限制按 IP 识别
- 评论为即时展示（后台可隐藏），若需要评论先审后发，可在 `app.py` 的 `api_create_comment` 中把 `status` 改为 `hidden` 并增加审核队列
- IP 封禁可能误伤同一出口网络下的其他用户

---

## 自定义

- **分类**：修改 `app.py` 顶部的 `CATEGORIES`，并同步修改 `public/js/common.js` 的 `CATEGORIES`（前端校验与展示）
- **墙规 / 关于 / 联系方式**：直接编辑 `public/rules.html`、`public/about.html`
- **配色**：`public/css/style.css` 顶部的 CSS 变量（`--brand` 等）
- **管理员密码**：修改 `data/admin_password` 后重启服务，或用环境变量覆盖

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
