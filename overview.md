# 浪报小程序 — 开发状态报告

## 状态：✅ MVP 可用，后端可直接启动

共 **71 个文件**：小程序 46 个 + 后端 22 个 + 文档 3 个。

## 后端修复记录 (2026-06-26)

### 修复的严重问题

| 问题 | 修复 |
|------|------|
| `deps.py` 的 `get_db` 是空壳 | 重写为 yield 式的 async session DI |
| `deps.py` 的 `get_current_user` 不查数据库 | 现在正确解析 JWT → 查 DB → 返回 User 对象 |
| `main.py` 的 middleware 与 DI 冲突 | 移除 db_session_middleware，统一用 DI |
| `scheduler.py` 每次创建新引擎不清理 | 复用 database.py 的 async_session_factory |
| 缺少数据库初始化脚本 | 创建 `scripts/init_db.py` (建表) |
| 缺少种子数据 | 创建 `scripts/seed_data.py` (16个冲浪点) |
| 缺少本地开发环境 | 创建 `docker-compose.yml` (PG + Redis) |
| 缺少启动文档 | 创建 `backend/RUN.md` (7步启动指南) |

### 新增文件

```
backend/
├── app/database.py          # 统一数据库引擎 + get_db DI
├── scripts/init_db.py       # 建表脚本
├── scripts/seed_data.py     # 16个冲浪点种子数据
├── docker-compose.yml       # 本地 PG16 + Redis7
├── .gitignore               # Python/venv 标准忽略
└── RUN.md                   # 完整启动指南
```

## 后端一键启动

```bash
# 在 wave-app/backend/ 下：
cp .env.example .env          # 复制配置（默认值即可用）
docker-compose up -d           # 启动 PostgreSQL + Redis
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m scripts.init_db      # 建表
python -m scripts.seed_data    # 导入冲浪点
python -m app.main             # 启动 API (端口 8000)

# 验证
curl http://localhost:8000/v1/spots
curl -X POST http://localhost:8000/admin/fetch-now  # 手动触发浪况采集
```
