# BMC Manager 前端 UI 全面优化设计

## 目标

对 bmc-manager 前端进行系统性 UI 质量把关：修复已知视觉缺陷、优化交互体验、为对接真实后端做准备。

## 变更范围

| 文件 | 变更类型 | 内容 |
|------|----------|------|
| `src/components/AppLayout.tsx` | 修复 | 侧边栏 Menu 绿色偏色 |
| `src/components/SensorGauge.tsx` | 重写 | 圆形仪表盘 → 文字型 SensorValue |
| `src/components/SensorGroup.tsx` | 重构 | 适配新传感器组件 |
| `src/components/BMCStatusBadge.tsx` | 修复 | 移除 Tooltip，lastSeen 内联显示 |
| `src/components/BMCAddForm.tsx` | 优化 | 表单交互细节 |
| `src/pages/RouterManagement.tsx` | 修复 | Card 选中态闪烁、过渡动画 |
| `src/pages/BMCDetail.tsx` | 适配 | 新传感器组件，清理 Tooltip |
| `src/pages/Dashboard.tsx` | 优化 | 统计卡片、图表交互 |
| `src/index.css` | 补充 | 全局过渡统一、可访问性 |

不变更：`types/` `hooks/` `api/` `mocks/` `stores/`

## 根因分析

### 1. 侧边栏绿色区域
Ant Design 6 dark Menu 选中态背景与 Outlined 图标在暗色下叠加产生偏绿。修复：显式覆盖 `--ant-menu-item-selected-bg` 为 `rgba(255,255,255,0.12)`，图标强制蓝色。

### 2. 路由器选择闪烁
Card `borderWidth: 2` 在 `transparent` → `#1677ff` 切换时产生布局抖动和渲染闪烁，`hoverable` lift 动画叠加恶化。修复：改用固定边框 + `boxShadow` 高亮，关闭 `hoverable`。

### 3. 浮动框闪烁
SensorGauge 每个圆形仪表盘套 Tooltip，鼠标密集划过时多个 Tooltip 竞态触发。BMCStatusBadge 的 lastSeen Tooltip 同样问题。修复：移除所有冗余 Tooltip，信息直接展示。

### 4. 传感器圆形仪表盘
信息密度低，11 个仪表盘占满整行，难以快速扫读。修复：改为紧凑文字行布局（参数名左 + 数值右），保留阈值色彩编码。

### 5. 全局过渡动画
各组件 hover 效果不一致，部分使用 antd `hoverable`，部分无过渡。修复：`index.css` 统一 transition（0.15s-0.25s ease），禁用 lift 动画。

## 详细设计

### AppLayout.tsx
- Menu 添加 `--ant-menu-item-selected-bg` CSS 变量覆盖
- Logo 图标添加显式 `color: '#fff'`
- 侧边栏折叠按钮保留，无变更

### SensorGauge → SensorValue（重写）
```
┌──────────────────────────────────┐
│ label              value unit    │  ← 一行，flex justify-between
│ (12px #8c8c8c)     (14px bold   │
│                     monospace    │
│                     绿/黄/红色)   │
└──────────────────────────────────┘
```
- 无 Tooltip
- 色彩：< 80°C 绿色，80-95°C 黄色，≥ 95°C 红色，null 灰色 N/A

### SensorGroup（重构）
- 移除 `loading` prop，由父组件统一处理
- 移除 grid 布局，改为 Card 内直接渲染 SensorValue 列表
- 空数据：`<Empty />`
- 添加 `maxHeight: 400, overflow: auto`

### BMCDetail（适配）
- 所有 SensorGauge 调用改为 SensorValue
- 移除 PSU 表格 Tag 上的 Tooltip
- CPU 温度趋势 ECharts 保留不变

### RouterManagement（修复）
- Card：`hoverable={false}`，固定边框 `token.colorBorderSecondary`，选中态用 `boxShadow`
- BMC 表格 loading 使用 Table 内置 `loading` 属性
- BMC 状态徽章的 lastSeen Tooltip 移除

### BMCStatusBadge（修复）
- 移除 Tooltip 包裹
- lastSeen 以 11px 小字内联显示在 Badge 旁边

### Dashboard（优化）
- 统计卡片移除默认 hoverable
- 异常列表表格的 Tooltip 清理

### index.css（补充）
```css
.ant-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.ant-table-row { transition: background-color 0.15s ease; }
```

## 实施顺序

| Step | 内容 | 文件 |
|------|------|------|
| 1 | 侧边栏修复 + 全局动画 | AppLayout.tsx, index.css |
| 2 | 传感器组件重写 | SensorGauge.tsx → SensorValue |
| 3 | 传感器面板适配 | SensorGroup.tsx, BMCDetail.tsx |
| 4 | 页面交互修复 | RouterManagement.tsx, BMCStatusBadge.tsx, BMCAddForm.tsx |
| 5 | Dashboard 优化 + 最终检查 | Dashboard.tsx + 全部回归 |

每步完成后启动 `npm run dev` 验证无编译错误。

## 质量门

- [ ] 编译零错误
- [ ] 3 个页面正常渲染
- [ ] 侧边栏选中态无绿色
- [ ] 路由器卡片点击无闪烁
- [ ] 传感器区域无浮动框
- [ ] 传感器新布局正确显示
- [ ] 所有过渡平滑
