# 浪报 — 冲浪浪点推荐小程序

「浪报」是一款为冲浪爱好者打造的微信小程序，覆盖广东双月湾沿海浪点的实时浪况查询与智能推荐。

## 功能特性

- **智能浪点推荐** — 五维加权打分模型（周期40 + 浪高30 + 风向10 + 潮汐10 + 浪向10），综合评估双月湾7个浪点
- **冲浪建议** — 今日冲浪建议按星级分组展示，相同分数浪点合并；未来7天最佳日期推荐（80分以上），点击可切换日期
- **日期筛选** — 快捷选项（今天/明天/周六/周日）+ 日历弹窗自由选择未来7天
- **逐时浪况** — 今日逐小时预报表格，展示浪高、周期、风向（离岸风/迎岸风/侧风）、风速、潮高、推荐评分
- **未来7天预报** — 未来每天的小时浪况数据 + 评分
- **浪点导航** — 详情页支持一键拉起第三方导航 App（高德/百度/腾讯地图），坐标自动转换
- **浪点列表** — 广东、海南 20 个浪点浏览与地区筛选
- **评分规则** — 透明展示打分体系与各浪点参数
- **半星评分** — 支持 1.0~5.0 共9档半星评级，CSS 图标实现
- **Liquid Glass UI** — 全站毛玻璃设计语言，iOS 风格 Tab Bar

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | 微信小程序原生框架 |
| UI 组件 | [TDesign Mini Program](https://tdesign.tencent.com/miniprogram/overview) |
| 浪况数据 | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) |
| 风况数据 | [Open-Meteo Weather API](https://open-meteo.com/en/docs) |
| 坐标转换 | WGS-84 ↔ GCJ-02 ↔ BD-09（`utils/coord.js`） |

## 项目结构

```
trae-wave-miniprogram/
├── miniprogram/               # 小程序前端
│   ├── app.js / .json / .wxss # 全局入口 & 样式
│   ├── pages/
│   │   ├── huizhou/           # 首页 — 双月湾浪点推荐
│   │   ├── spots/             # 浪点列表页
│   │   ├── detail/            # 浪况详情页
│   │   └── rules/             # 评分规则说明页
│   ├── components/            # 自定义组件
│   ├── custom-tab-bar/        # 自定义底部 TabBar（iOS 风格 + 阴影层）
│   ├── services/              # 业务逻辑
│   │   ├── wave-fetcher.js    # Open-Meteo API 调用（marine + weather 并行）
│   │   └── huizhou-recommender.js # 推荐引擎（五维打分 + 半星）
│   ├── utils/
│   │   └── coord.js           # 坐标系转换工具
│   └── data/
│       └── spots.js           # 浪点信息库（7个浪点 + 专属坐标）
└── backend/                   # 后端（辅助用）
    └── app/                   # FastAPI
```

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/oscarfungfjl-a11y/wave-miniprogram.git
cd trae-wave-miniprogram
```

### 2. 安装依赖

```bash
cd miniprogram
npm install
```

### 3. 构建 TDesign 组件

在微信开发者工具中：**工具 → 构建 npm**

### 4. 导入项目

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目根目录（含 `project.config.json`，已配置 `miniprogramRoot: "miniprogram/"`）
3. 填写 AppID（或选择测试号）
4. 开发阶段勾选 **不校验合法域名**

### 5. 运行

点击「编译」即可在模拟器中预览。

## 数据来源

浪况和风况数据来自 [Open-Meteo](https://open-meteo.com/) 免费开放的 API，无需注册或 API Key。

**Marine API** 获取的数据：
- 有效波高 (wave_height)
- 涌浪波高 (swell_wave_height)
- 涌浪周期 (swell_wave_period)
- 波向 (wave_direction)
- 海表面温度 (sea_surface_temperature)
- 海平面高度含潮汐 (sea_level_height_msl)

**Weather API** 获取的数据：
- 风速 (wind_speed_10m)
- 风向 (wind_direction_10m)

## 推荐引擎

双月湾浪点推荐基于五维加权百分制打分：

```
总分 = 涌浪周期 × 40% + 浪高匹配 × 30% + 风向适配 × 10% + 潮汐适配 × 10% + 浪向适配 × 10%
```

| 星级 | 等级 | 分值 |
|------|------|------|
| 5★ | 高推荐 | ≥80 |
| 4★ | 推荐 | ≥63 |
| 3★ | 一般 | ≥45 |
| 2★ | 较差 | ≥25 |
| 1★ | 不推荐 | <25 |

支持半星评级（1.0~5.0，共9档）。各维度采用线性插值算法（支持升序/降序/峰值模式），每个浪点有独立的参数配置。

### 支持的浪点

| 浪点 | 坐标 (lat, lon) | 特点 |
|------|-----------------|------|
| LOOP | 22.59, 114.905 | 东岸入门浪点 |
| 情人岛 | 22.64, 114.93 | 东岸进阶浪点 |
| 山海里 | 22.61, 114.91 | 东岸浪点 |
| 高洋尾 | 22.65, 114.94 | 东岸进阶浪点 |
| 万科一期 | 22.60, 114.89 | 西岸入门浪点 |
| 狮子岛 | 22.598, 114.842 | 东岸浪点 |
| 甜橙 | 22.61, 114.91 | 东岸入门-进阶浪点 |

## License

MIT
