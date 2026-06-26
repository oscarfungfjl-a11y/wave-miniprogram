# 浪报后端 — 本地启动指南

## 前置条件

- **Python 3.11+**
- **Docker Desktop** (推荐，一键启动 PostgreSQL + Redis)
- 或手动安装 PostgreSQL 16 + Redis 7

---

## 第一步：启动基础设施

### 方式A：Docker（推荐，30秒启动）

```bash
cd backend
docker-compose up -d
```

这会启动：
- PostgreSQL 16 (端口 5432，用户 `wave`，密码 `wave123`，库 `wave_report`)
- Redis 7 (端口 6379)

### 方式B：手动安装

```bash
# macOS
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

# 创建数据库
createdb -U postgres wave_report
```

---

## 第二步：配置环境变量

```bash
cd backend
cp .env.example .env
```

`.env` 中的关键配置（本地默认值开箱即用）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql+asyncpg://wave:wave123@localhost:5432/wave_report` | 数据库连接 |
| `JWT_SECRET` | `change-me-in-production` | JWT 签名密钥（生产环境必须改） |
| `WX_APPID` | (空) | 微信小程序 AppID（本地可跳过） |
| `WX_SECRET` | (空) | 微信小程序 Secret |

> **注意**：`WX_APPID` / `WX_SECRET` 留空时，微信登录会失败，但其他接口（浪况查询、推荐）可正常调试。获取方式：微信公众平台 → 开发 → 开发管理 → 开发设置。

---

## 第三步：安装依赖

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装 Python 包
pip install -r requirements.txt
```

---

## 第四步：初始化数据库

```bash
# 创建所有表
python -m scripts.init_db

# 导入 16 个中国沿海冲浪点种子数据
python -m scripts.seed_data
```

预期输出：
```
[init_db] Creating all tables...
[init_db] Tables created successfully!

[OK]   惠州双月湾狮子岛 (广东惠州)
[OK]   深圳大鹏金沙湾 (广东深圳)
...
[seed_data] Done. Created: 16, Skipped: 0
```

---

## 第五步：启动 API 服务

```bash
cd backend
python -m app.main
```

或

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

看到以下日志表示启动成功：
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:app.main:Starting Wave Report API
INFO:app.tasks.scheduler:Scheduler started with daily tasks
```

---

## 第六步：验证

### 健康检查

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"Wave Report API"}

curl http://localhost:8000/ready
# {"status":"ok","database":"connected"}
```

### 调用浪点列表接口

```bash
curl http://localhost:8000/v1/spots | python -m json.tool
```

### 调用推荐接口

```bash
curl "http://localhost:8000/v1/recommendations?limit=5" | python -m json.tool
```

### 手动触发一次浪况采集（测试 Open-Meteo 连接）

```bash
curl -X POST http://localhost:8000/admin/fetch-now
```

---

## 第七步：接入微信小程序

1. 在小程序 `utils/request.js` 中修改 `BASE_URL`：
   ```javascript
   const BASE_URL = 'http://YOUR_IP:8000/v1';  // 本地开发
   // const BASE_URL = 'https://api.your-domain.com/v1';  // 生产
   ```

2. 微信开发者工具 → 详情 → 本地设置 → **不校验合法域名** 勾选

3. 真机预览：手机和电脑连同一 WiFi，使用电脑局域网 IP

---

## 接口总览

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|----------|
| `GET` | `/health` | 服务存活 | 否 |
| `GET` | `/ready` | 数据库就绪 | 否 |
| `POST` | `/v1/auth/wechat-login` | 微信登录 | 否 |
| `POST` | `/v1/auth/refresh` | 刷新 Token | 否 |
| `GET` | `/v1/auth/check` | 检查登录态 | 是 |
| `GET` | `/v1/recommendations?limit=10` | 今日推荐 | 可选 |
| `GET` | `/v1/spots?page=1&region=广东深圳` | 浪点列表 | 否 |
| `GET` | `/v1/spots/{spot_key}` | 浪点详情+7天预报 | 否 |
| `GET` | `/v1/spots/search?q=双月湾` | 搜索浪点 | 否 |
| `GET` | `/v1/user/favorites` | 我的收藏 | 是 |
| `POST` | `/v1/user/favorites` | 添加/取消收藏 | 是 |
| `GET` | `/v1/user/favorites/wave-data` | 收藏浪点浪况 | 是 |

---

## 常见问题

**Q: `ModuleNotFoundError: No module named 'app'`**

A: 确保在 `backend/` 目录下运行命令，`PYTHONPATH` 自动包含当前目录。

**Q: 数据库连接失败**

A: 检查 Docker 是否运行：`docker ps`。如果手动安装的 PostgreSQL，检查 `.env` 中的 `DATABASE_URL`。

**Q: 微信登录返回 400**

A: 本地调试时 `WX_APPID` 为空是正常的。可以先不登录，直接使用浪况查询等不需要登录的接口。

**Q: Open-Meteo API 调用超时**

A: Open-Meteo 可能在国内访问较慢（10-20秒）。采集任务设计为异步并行执行，不影响 API 响应速度。
