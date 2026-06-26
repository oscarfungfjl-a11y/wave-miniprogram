# 浪报小程序 — 架构设计文档

> **版本**: v1.0 | **日期**: 2026-06-25 | **作者**: WeChat Mini Program Developer

---

## 一、产品定位

**浪报** 是一款面向冲浪爱好者的微信小程序，核心价值是帮助用户**快速查看浪况预报**，并**基于用户偏好推荐每日最佳浪点**。

### 核心功能矩阵

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 个性化首页推荐 | 根据用户关注的浪点，推荐今日评分最高的浪点 | P0 |
| 浪点列表浏览 | 按区域/名称浏览所有浪点，查看实时浪况摘要 | P0 |
| 浪点详情 | 7天预报 + 小时级浪况 + 趋势分析 | P0 |
| 关注/收藏浪点 | 一键关注，构建个人浪点库 | P0 |
| 搜索浪点 | 按名称或地区搜索 | P1 |
| 微信分享 | 分享浪况到会话/朋友圈，社交裂变 | P1 |
| 订阅消息推送 | 每日推荐推送、浪况突变提醒 | P2 |
| 附近浪点推荐 | 基于地理位置推荐最近浪点 | P2 |

---

## 二、系统架构

```
┌──────────────────────────────────────────────────────┐
│              微信小程序客户端 (Mini Program)              │
│  WXML/WXSS/JS · TDesign UI · 微信登录 · 分享 · 订阅消息  │
│  首页推荐 | 浪点列表 | 浪况详情 | 我的关注 | 个人中心       │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS (wx.request)
┌──────────────────────▼───────────────────────────────┐
│              后端 API 服务 (FastAPI)                    │
│  JWT 认证 · 浪况查询 · 用户管理 · 推荐引擎 · 定时任务       │
└──────┬──────────────────────────────┬────────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼───────┐
│ PostgreSQL  │              │    Redis       │
│ 浪点·浪况   │              │  缓存·会话     │
│ 用户·关注   │              │  限流·排行榜   │
└──────┬──────┘              └────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│          定时数据采集 (Cron Job)               │
│  每日 2:00/10:00 · Open-Meteo Marine API     │
│  多浪点并行采集 → 结构化存储 → 评分计算        │
└─────────────────────────────────────────────┘
```

### 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| **前端** | 原生微信小程序 + TDesign | 原生性能最优、TDesign 提供企业级 UI 组件、包体积可控 |
| **后端** | Python FastAPI | 与现有 fetch_wave.py (Python) 技术栈一致，可直接复用数据采集逻辑 |
| **数据库** | PostgreSQL | 关系型数据（浪点、用户、关注关系）+ JSON 扩展灵活 |
| **缓存** | Redis | 推荐结果缓存、热门浪点排行、Token 黑名单 |
| **定时任务** | APScheduler | 轻量级进程内调度，适合中小规模；可平滑迁移至 Celery |
| **部署** | Docker + Nginx | 容器化部署，Nginx 反向代理 + HTTPS |

---

## 三、数据流

```
定时任务 (2:00/10:00)
  │
  ├── 1. 遍历所有活跃浪点
  ├── 2. 调用 Open-Meteo Marine API 获取 7 天预报
  ├── 3. 解析小时级数据 → 写入 wave_data 表 (upsert)
  ├── 4. 按天聚合 → 写入 daily_summaries 表 (upsert)
  ├── 5. 推荐引擎计算评分 → 更新 daily_summaries.rating_score
  └── 6. 清除 Redis 推荐缓存

用户请求 (首页)
  │
  ├── 1. 小程序发送请求 (带 JWT Token)
  ├── 2. 后端验证 Token，获取用户 ID
  ├── 3. 查询用户关注的浪点 ID 列表
  ├── 4. 从 daily_summaries 查询今日数据 (优先缓存)
  ├── 5. 按评分排序：关注浪点优先 → 补充热门浪点
  └── 6. 返回推荐列表 JSON
```

---

## 四、数据库 Schema

### ER 关系

```
spots (浪点)                users (用户)
  │ 1                        │ 1
  │                          │
  ├── wave_data (N)          ├── user_favorites (N)
  │   小时级浪况               │   关注关系
  │                          │
  └── daily_summaries (N)    └── refresh_tokens (N)
      每日摘要 + 评分              刷新令牌
```

### 核心表结构

**spots** — 浪点基础信息
| 字段 | 类型 | 说明 |
|------|------|------|
| spot_key | VARCHAR(100) | 唯一标识，如 `shuangyuewan-shizi` |
| name | VARCHAR(200) | 浪点名称 |
| region | VARCHAR(100) | 所属区域（用于分组筛选） |
| lat/lon | FLOAT | 经纬度 |
| cover_url | VARCHAR(500) | 封面图 URL |

**wave_data** — 小时级浪况（核心数据表）
| 字段 | 类型 | 说明 |
|------|------|------|
| spot_id | FK→spots | 浪点 ID |
| forecast_time | DATETIME | 预报时间点（东八区） |
| date_str | VARCHAR(10) | 日期 `YYYY-MM-DD`（索引加速） |
| wave_height_m | FLOAT | 有效波高 |
| swell_height_m | FLOAT | 涌浪高度 |
| swell_period_s | FLOAT | 涌浪周期 |
| wave_direction_cn | VARCHAR(10) | 波向（中文） |
| sea_temp_c | FLOAT | 海面温度 |

**daily_summaries** — 每日摘要 + 推荐评分
| 字段 | 类型 | 说明 |
|------|------|------|
| spot_id + date_str | UNIQUE | 联合唯一键 |
| rating_score | FLOAT | 综合评分 0-10 |
| rating_label | VARCHAR(20) | `excellent` / `good` / `fair` / `poor` |
| trend_7day | VARCHAR(500) | 7 天趋势中文描述 |

---

## 五、推荐引擎算法

### 多因子加权评分模型 (0-10分)

| 因子 | 权重 | 计算逻辑 |
|------|------|----------|
| **浪高适配** | 0-4分 | 最佳浪高 0.5-2.5m，以 1.5m 为中心高斯分布。太小能量不足，太大危险 |
| **涌浪周期** | 0-3分 | ≥10s 满分（长周期涌浪能量稳定），4-10s 线性映射，<4s 扣分 |
| **涌浪占比** | 0-2分 | 涌浪/(涌浪+风浪) ≥70% 满分。涌浪为主的浪质量更高 |
| **水温适配** | 0-1分 | 20-30°C 满分（舒适范围），15-20°C / 30-33°C 半分 |

### 排序策略

1. **个性化优先**：用户关注的浪点排在最前
2. **评分排序**：同组内按 `rating_score` 降序
3. **地理位置加权**（可选）：如果获取到用户位置，距离近的加权
4. **兜底策略**：新用户无关注时，展示全平台今日最高分浪点

### 评分标签映射

| 评分 | 标签 | 颜色 |
|------|------|------|
| ≥8.0 | 极佳 (excellent) | 绿色 `#1D9E75` |
| 6.0-7.9 | 良好 (good) | 浅绿 `#5DCAA5` |
| 4.0-5.9 | 一般 (fair) | 橙色 `#EF9F27` |
| <4.0 | 较差 (poor) | 灰色 `#D3D1C7` |

---

## 六、API 接口设计

### 接口总览

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/v1/auth/wechat-login` | 微信登录 | 否 |
| POST | `/v1/auth/refresh` | 刷新 Token | 否 (需 refresh_token) |
| GET | `/v1/auth/check` | 检查登录态 | 是 |
| GET | `/v1/recommendations` | 获取推荐浪点 | 可选 |
| GET | `/v1/spots` | 浪点列表 | 否 |
| GET | `/v1/spots/{id}` | 浪点详情+7天预报 | 否 |
| GET | `/v1/spots/search` | 搜索浪点 | 否 |
| GET | `/v1/user/favorites` | 获取收藏列表 | 是 |
| POST | `/v1/user/favorites` | 添加/取消收藏 | 是 |
| GET | `/v1/user/favorites/wave-data` | 收藏浪点浪况 | 是 |

### 关键接口示例

**推荐接口响应**:
```json
GET /v1/recommendations?lat=22.60&lon=114.84&limit=5

{
  "recommendations": [
    {
      "id": "shuangyuewan-shizi",
      "name": "惠州双月湾狮子岛",
      "region": "广东惠州",
      "wave_height_avg_m": 1.2,
      "swell_period_avg_s": 9.5,
      "sea_temp_avg_c": 25.0,
      "wave_direction": "东南",
      "rating_score": 7.8,
      "rating_label": "good",
      "trend_7day": "浪高基本平稳 (~1.2 m)；水温稳定 (~25°C)；最大浪高出现在 2026-06-27 (1.8 m)",
      "distance_km": 12.3
    }
  ],
  "has_more": true
}
```

---

## 七、小程序项目结构

```
miniprogram/
├── app.js                      # 全局生命周期、登录态管理
├── app.json                    # 页面路由、窗口配置、tabBar、全局组件注册
├── app.wxss                    # 全局样式、TDesign 主题覆写
├── project.config.json         # 项目配置（npm 构建等）
├── sitemap.json                # 微信搜索索引
│
├── pages/
│   ├── index/                  # 首页 — 今日推荐
│   │   ├── index.js            # 推荐逻辑、下拉刷新
│   │   ├── index.json          # 页面配置
│   │   ├── index.wxml          # 模板
│   │   └── index.wxss          # 样式
│   ├── spots/                  # 浪点列表
│   ├── detail/                 # 浪点详情（7天+小时预报）
│   ├── favorites/              # 我的关注
│   └── profile/                # 个人中心
│
├── components/
│   ├── spot-card/              # 浪点卡片（复用）
│   ├── wave-chart/             # 浪高可视化（后续迭代）
│   └── rating-badge/           # 评级标签
│
├── utils/
│   ├── request.js              # 统一网络请求（JWT 注入、401 自动刷新）
│   └── auth.js                 # 微信登录、Token 管理
│
└── services/
    └── wave.js                 # 浪况 API 封装
```

---

## 八、WeChat 平台配置清单

### 小程序后台设置

| 配置项 | 说明 |
|--------|------|
| **服务器域名** | `request` 合法域名: `https://api.wave-report.example.com` |
| **业务域名** | 如有关联 H5 页面需配置 |
| **订阅消息模板** | 申请「浪况日报推荐」「浪况突变提醒」等模板 |
| **隐私协议** | 填写用户隐私保护指引（必填） |
| **类目选择** | 工具 → 天气 / 体育 → 健身 |

### 审核注意事项

1. **数据来源声明**：在关于页面声明数据来源（Open-Meteo Marine API）及精度限制
2. **位置权限**：仅在用户主动触发「附近浪点」时请求，`scope.userLocation` 描述清晰
3. **订阅消息**：不要强制订阅，用户可自主选择
4. **分享文案**：分享图片和标题需要真实反映浪况，避免夸大
5. **无 UGC 内容**：如果后续添加用户评论功能，需接入 `msgSecCheck` 内容安全接口

---

## 九、性能优化策略

### 小程序端

| 策略 | 说明 |
|------|------|
| **懒加载** | `lazyCodeLoading: "requiredComponents"` 按需加载组件 |
| **分包** | 当功能增多时，将低频页面（如关于页）放入 subpackages |
| **setData 优化** | 只传变更数据，避免全量 setData；高频场景使用 WXS |
| **图片优化** | 使用 WebP 格式、CDN 加速、`lazy-load` 懒加载 |
| **骨架屏** | 首页和详情页使用 TDesign Skeleton 组件，提升感知性能 |

### 后端

| 策略 | 说明 |
|------|------|
| **预计算** | daily_summaries 表预计算每日摘要，避免实时聚合 |
| **Redis 缓存** | 推荐结果缓存 1 小时，热门浪点缓存 5 分钟 |
| **数据库索引** | `spot_id + date_str` 联合索引、`date_str` 单独索引 |
| **连接池** | PostgreSQL 连接池 10-20，匹配并发量 |
| **并行采集** | 多浪点并行调用 Open-Meteo API |

---

## 十、快速启动指南

### 1. 初始化浪点数据

在 `backend/app/services/wave_fetcher.py` 或独立的 seed 脚本中，添加浪点：

```python
# 参考 fetch_wave.py 中的 COASTS 配置
spots = [
    {"id": "shuangyuewan-shizi", "name": "惠州双月湾狮子岛", "lat": 22.60, "lon": 114.84},
    {"id": "dapeng-jinshawan", "name": "深圳大鹏金沙湾", "lat": 22.55, "lon": 114.50},
    # ... 更多浪点
]
```

### 2. 启动后端

```bash
cd backend
cp .env.example .env  # 编辑填入真实配置
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. 微信开发者工具

```bash
cd miniprogram
npm install
# 在微信开发者工具中: 工具 → 构建 npm
# 填入 AppID，即可预览
```

### 4. 域名配置

确保后端部署在 HTTPS 域名下，并在小程序后台 → 开发 → 服务器域名 中配置 `request` 合法域名。

---

## 十一、后续迭代路线图

| 阶段 | 内容 |
|------|------|
| **MVP (本期)** | 首页推荐、浪点列表、详情、关注收藏、搜索 |
| **V1.1** | 浪高趋势可视化图表 (ECharts)、附近浪点推荐 |
| **V1.2** | 订阅消息推送（每日推荐）、分享裂变追踪 |
| **V1.3** | 用户冲浪日记 / 打卡功能 |
| **V1.4** | 社区功能 — 浪况实拍分享 |
| **V2.0** | 小程序直播 — 浪点现场直播 |

---

## 十二、技术决策记录 (ADR)

### ADR-001: 选择 FastAPI 而非 Django

**决策**: 使用 FastAPI 作为后端框架

**理由**:
- 与 fetch_wave.py (Python) 一致的生态，代码复用率高
- 原生 async/await 支持，适合 IO 密集型的数据采集
- 自动 OpenAPI 文档生成，便于联调
- 轻量级，部署资源消耗小

### ADR-002: 预计算摘要而非实时聚合

**决策**: 每日摘要数据在采集时预计算并存储

**理由**:
- 首页推荐需要频繁查询，实时聚合 7×24 条小时数据的 DB 开销大
- 评分计算依赖摘要数据，预计算可缓存
- 数据更新频率低（每天2次），预计算是合理策略

### ADR-003: 原生小程序而非 Taro/uni-app

**决策**: 使用原生微信小程序框架

**理由**:
- 性能最优，包体积可控（主包 < 2MB）
- 直接使用最新微信 API 和 Skyline 渲染引擎
- MVP 阶段不需要跨平台，后续有需求再迁移
