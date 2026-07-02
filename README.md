# 浪报 — 冲浪浪点推荐小程序

「浪报」是一款为冲浪爱好者打造的微信小程序，覆盖广东、海南沿海浪点的实时浪况查询与智能推荐。

## 功能特性

- **智能浪点推荐** — 四维打分模型（浪向30 + 浪高30 + 周期25 + 潮汐15），综合评估双月湾6个浪点
- **日期筛选** — 快捷选项（今天/明天/周六/周日）+ 日历弹窗自由选择未来7天
- **逐时浪况** — 今日逐小时预报表格，展示浪高、周期、浪向、潮高、推荐评分
- **未来7天预报** — 未来每天的小时浪况数据 + 评分
- **浪点列表** — 广东、海南 20 个浪点浏览与地区筛选
- **评分规则** — 透明展示打分体系与各浪点参数

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | 微信小程序原生框架 |
| UI 组件 | [TDesign Mini Program](https://tdesign.tencent.com/miniprogram/overview) |
| 浪况数据 | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) |

## 项目结构

```
wave-app/
├── miniprogram/               # 小程序前端
│   ├── app.js / .json / .wxss # 全局入口 & 样式
│   ├── pages/
│   │   ├── huizhou/           # 首页 — 双月湾浪点推荐
│   │   ├── spots/             # 浪点列表页
│   │   ├── detail/            # 浪况详情页
│   │   └── rules/             # 评分规则说明页
│   ├── components/            # 自定义组件
│   ├── custom-tab-bar/        # 自定义底部 TabBar
│   ├── services/              # 业务逻辑
│   │   ├── wave-fetcher.js    # Open-Meteo API 调用
│   │   └── huizhou-recommender.js # 推荐引擎（四维打分）
│   └── data/                  # 本地数据
│       └── spots.js           # 浪点信息库
└── backend/                   # 后端（辅助用）
    └── app/                   # FastAPI
```

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/oscarfungfjl-a11y/wave-miniprogram.git
cd wave-miniprogram
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
2. 导入 `miniprogram/` 目录
3. 填写 AppID（或选择测试号）
4. 开发阶段勾选 **不校验合法域名**

### 5. 运行

点击「编译」即可在模拟器中预览。

## 数据来源

浪况数据全部来自 [Open-Meteo](https://open-meteo.com/) 免费开放的 Marine API，无需注册或 API Key。

获取的数据包括：
- 有效波高 (wave_height)
- 涌浪周期 (swell_wave_period)
- 波向 (wave_direction)
- 海表面温度 (sea_surface_temperature)
- 海平面高度含潮汐 (sea_level_height_msl)

## 推荐引擎

双月湾浪点推荐基于四维加权百分制打分：

```
总分 = 浪向适配 × 30% + 浪高匹配 × 30% + 涌浪周期 × 25% + 潮汐适配 × 15%
```

| 挡位 | 分值 |
|------|------|
| 高推荐 | 80–100 |
| 中推荐 | 60–79 |
| 低推荐 | 0–59 |

各维度采用线性插值算法，每个浪点有独立的参数配置。

## License

MIT
