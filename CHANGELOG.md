# Changelog

## [Unreleased]

### Added
- 新增 `scripts/seed_data.py`，包含 16 个冲浪点种子数据
- 新增 `scripts/init_db.py`，支持建表
- 新增 `docker-compose.yml`，本地一键启动 PostgreSQL + Redis
- 新增 `backend/RUN.md`，完整后端启动指南

### Changed
- **评分体系重构**：从 100 分制改为 5 星评级制
  - 5★ 高推荐 ≥80 分 / 4★ 推荐 ≥63 分 / 3★ 一般 ≥45 分 / 2★ 较差 ≥25 分 / 1★ 不推荐 <25 分
  - 引擎 `huizhou-recommender.js` 新增 `scoreToStars()` / `starString()` / `STAR_LABELS`
  - 首页、详情页、规则页同步适配星级展示
- **首页卡片布局优化**（两次迭代）
  - 卡片头部徽章：只展示推荐等级文字（如"高推荐"），移除星标字符
  - 卡片 body：只展示大号星标，移除等级文字标签
  - 移除四维分项得分区域，直接展示实测数据（浪高范围 / 周期范围 / 潮高）
  - 卡片 body 结构精简为：大星星 → 实测数据 → 最佳时段
- **后端修复**
  - `deps.py`：`get_db` 重写为 yield 式 async session DI；`get_current_user` 正确查数据库
  - `main.py`：移除与 DI 冲突的 `db_session_middleware`
  - `scheduler.py`：复用 `database.py` 的 `async_session_factory`，修复引擎泄漏
  - 新增 `app/database.py` 统一数据库引擎和 DI

### Fixed
- 规则页声明的维度满分（浪向 30 / 浪高 30 / 周期 25）与实际代码最高分（28/28/23）不一致的问题，改为星级映射后彻底避免混淆

---

## [0.1.0] - 2026-06-25

### Added
- 小程序 MVP：双月湾浪点推荐首页（`pages/huizhou`）
- 浪点详情页（`pages/detail`）
- 评分规则说明页（`pages/rules`）
- 基于 Open-Meteo Marine API 的浪况数据采集（`wave-fetcher.js`）
- 四维加权推荐引擎（`huizhou-recommender.js`）
- FastAPI 后端骨架（`app/main.py`、`app/routes/`）
