# 微信开发者工具调试指南

## 一、打开项目

```
1. 打开"微信开发者工具"
2. 点击 "+" 或 "导入项目"
3. 目录：选择 wave-app/miniprogram/
4. AppID：填入你的小程序 AppID（测试号也可以）
5. 项目名称：浪报
6. 点击"确定"
```

## 二、构建 npm（TDesign 组件库）

TDesign 需要通过 npm 安装：

```bash
# 在 miniprogram/ 目录下
cd wave-app/miniprogram
npm install
```

然后在开发者工具中：
```
菜单 → 工具 → 构建 npm → 确定
```

构建成功后，`miniprogram_npm/` 目录会出现。

## 三、启动后端

新开一个终端：

```bash
cd wave-app/backend
docker-compose up -d                   # 启动 PG + Redis
python -m scripts.init_db              # 建表
python -m scripts.seed_data            # 导入冲浪点
python -m app.main                     # 启动 API（端口 8000）

# 验证
curl http://localhost:8000/health
curl http://localhost:8000/v1/spots
```

## 四、配置接口地址

`utils/request.js` 中的 `BASE_URL` 已默认设为 `http://localhost:8000/v1`，模拟器调试直接可用。

**真机调试**时，需要改为电脑的局域网 IP：

```javascript
// utils/request.js
const BASE_URL = 'http://192.168.1.100:8000/v1';  // 改为你的电脑IP
```

查看电脑 IP：`ipconfig` (Windows) / `ifconfig` (Mac)

## 五、关闭域名校验（开发阶段必须）

模拟器调试：项目配置中 `urlCheck` 已设为 `false`。

真机调试：开发者工具右上角 → 详情 → 本地设置 → 勾选 **"不校验合法域名"**。

## 六、调试面板使用

### 模拟器

- 左侧是手机模拟器，可以切换不同机型
- 点击屏幕上的元素，右侧会高亮对应的 WXML 代码
- 支持触摸手势（滚动、长按等）

### 控制台 (Console)

- 查看 `console.log`、错误信息
- 过滤日志级别：All / Log / Warn / Error
- 代码中已添加关键路径的日志

### 网络 (Network)

- 查看所有 `wx.request` 请求
- 点击请求查看 Headers、Response
- 用于调试接口返回数据

### 调试器 (Sources)

- 在代码行号左侧点击设置断点
- 支持单步执行、变量查看
- 支持条件断点

### AppData

- 查看当前页面的 `data` 数据
- 可以直接修改 data 值，页面会实时更新
- 用于快速验证 UI 状态

### Storage

- 查看 `wx.setStorageSync` 存储的数据
- 可以手动清除缓存
- 调试登录 Token 时很有用

## 七、真机预览与调试

### 预览

```
开发者工具 → 顶部工具栏 → 预览 → 扫描二维码
```

手机和电脑需要在同一 Wi-Fi 下。

### 真机调试

```
开发者工具 → 顶部工具栏 → 真机调试 → 扫描二维码
```

真机调试可以：
- 看到真机上的 Console 输出
- 在真机上设置断点
- 查看真机的 Network 请求

## 八、常见问题

**Q: 页面空白 / 白屏**

- 检查是否已"构建 npm"（工具 → 构建 npm）
- 检查 Console 是否有报错

**Q: API 请求失败**

- 检查后端是否启动：`curl http://localhost:8000/health`
- 检查 `urlCheck: false` 是否生效
- 真机调试：检查手机和电脑是否在同一网络，BASE_URL 是否用了局域网 IP

**Q: TDesign 组件样式不对**

- 重新"构建 npm"（工具 → 构建 npm）
- 检查 `app.json` 中的 `usingComponents` 路径是否正确

**Q: 微信登录失败**

- 本地调试时 `WX_APPID` 为空是正常的
- 可以在登录失败后使用跳过登录的功能（浪况查询不需要登录）
- 要测试完整登录流程，需在 `.env` 中填入真实的 AppID 和 AppSecret

**Q: 模拟器布局和真机不一致**

- 模拟器默认是 iPhone 6/7/8（375px），切换到你的目标机型
- 使用 `wx.getSystemInfoSync()` 获取设备信息做响应式适配

## 九、推荐调试流程

```
1. 启动后端 → 验证 /health 接口
2. 手动拉取浪况: curl -X POST http://localhost:8000/admin/fetch-now
3. 验证数据: curl http://localhost:8000/v1/spots
4. 打开小程序开发者工具
5. 检查 Console → 确认无报错
6. 检查 Network → 确认接口返回数据
7. 检查 AppData → 确认数据已渲染到页面
8. 模拟器交互测试 → 点击、滚动、搜索
9. 真机预览 → 扫描二维码在手机上体验
```
