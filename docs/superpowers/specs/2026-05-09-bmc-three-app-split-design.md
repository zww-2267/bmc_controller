# BMC Manager 三应用拆分 — 设计文档

## 目标

将单页 BMC Manager 拆分为 3 个独立应用，各可独立运行（调试）或打包（发布）。

## 架构

```
bmc-manager/
├── shared/                   # 共享层
│   ├── types/index.ts        # TypeScript 接口
│   ├── api/                  # Mock API 函数
│   ├── mocks/                # Mock 数据生成器
│   ├── hooks/                # React Query hooks
│   └── stores/               # Zustand stores
├── app-router-manager/       # App1: 路由器管理 (port 5173)
│   ├── src/pages/            # RouterManagerPage
│   ├── src/components/       # RootButton, RouterSidebar, BMCTable
│   ├── vite.config.ts
│   ├── index.html
│   └── src-tauri/
├── app-bmc-detail/           # App2: BMC 详情 (port 5174)
│   ├── src/pages/            # LoginPage, BMCDetailPage
│   ├── src/components/       # LoginForm, SensorPanel, PowerControl
│   ├── vite.config.ts
│   ├── index.html
│   └── src-tauri/
└── app-bmc-monitor/          # App3: BMC 监控与分析 (port 5175)
    ├── src/pages/            # MonitorPage
    ├── src/components/       # AnomalyPanel, LogImport, BMCQuery
    ├── vite.config.ts
    ├── index.html
    └── src-tauri/
```

## App1：路由器管理

### 路由
- `/` → RouterManagerPage（唯一页面）

### 布局
- 顶栏：标题 + Root 按钮（frontend-design 设计）
- 内容区：左侧路由器垂直列表 + 右侧 BMC 表

### Root 模式
- 顶栏 Root 按钮，密码 `123456`
- 解锁后会话持续有效
- 非 root：增删按钮 disabled（灰色）
- root 后：增删按钮正常

### 功能
- 点击路由器 → 右侧展示该路由 BMC 列表
- BMC 列表列：IP、管理员、状态、已运行时间、操作（增删）
- **IP 不可点击**（取消跳转详情逻辑）
- 搜索/筛选保留

### 与旧版差异
- 移除 AppLayout 侧边栏
- 移除 BMCDetail 跳转
- 新增 root 权限控制
- 双栏布局替代卡片网格

## App2：BMC 详情

### 路由
- `/` → LoginPage（未登录）
- `/bmc/:bmcId` → BMCDetailPage（已登录）

### 登录页
- 级联选择：路由器下拉 → BMC IP 下拉（联动过滤） → 管理员账号 → 密码
- 凭据：`admin` / `abc123..`
- 登录成功后跳转 `/bmc/:bmcId`

### 详情页
- 内部 UI 不变（传感器面板、PSU、CPU 趋势图）
- 头部：IP + 状态框 + 开关机按钮 + Root 按钮

### Root 模式
- 登录后默认非 root
- Root 按钮，密码 `123456`
- 解锁后开关机按钮可用

### 返回
- 关闭/退出时返回登录页

## App3：BMC 监控与分析

### 路由
- `/` → MonitorPage

### 布局
- 左侧导航：异常分析 | 日志分析 | BMC 查询
- 右侧：对应模块内容

### 异常分析模块
- 判定逻辑：hasError=true + 传感器数据综合判定
- 异常原因提取：
  - CPU 温度 > 80°C → "CPU0 温度过高: 92°C (阈值 80°C)"
  - GPU 温度 > 85°C → "GPU0 温度过高: 90°C (阈值 85°C)"
  - 风扇转速异常（过高/过低）
  - 电压异常（超出范围）
- 按严重度排序：Critical → Warning
- 列表展示：BMC IP | 路由器 | 异常原因 | 严重度 | 时间

### 日志分析模块
- CSV/JSON 文件导入按钮
- Mock 阶段生成示例日志数据
- 解析后展示：时间 | 级别 | 来源 | 消息
- 支持按时间/级别筛选

### BMC 查询模块
- 输入：路由器下拉 + IP 搜索
- 结果展示：BMC 基本信息
- 跳转按钮：`window.open('http://localhost:5174/?bmcId=xxx&routerId=xxx')`

## 共享层

| 目录 | 内容 | 变更 |
|------|------|------|
| `shared/types/` | BMC, Router, SensorData 等接口 | 不变 |
| `shared/api/` | client.ts, bmc.ts, routers.ts, sensors.ts | 不变 |
| `shared/mocks/` | bmc.ts, routers.ts, sensors.ts | 追加异常日志 mock |
| `shared/hooks/` | useBMCList, useBMCSensors, useRouterList, useSensorSummary | 不变 |
| `shared/stores/` | uiStore.ts（现有） | 新增 rootStore（root 状态管理） |

## 实施顺序

1. 创建共享层目录结构
2. 实现 App1（路由器管理）
3. 实现 App3（BMC 监控与分析）
4. 实现 App2（BMC 详情）
5. 配置多端口启动脚本
6. 最终回归验证
