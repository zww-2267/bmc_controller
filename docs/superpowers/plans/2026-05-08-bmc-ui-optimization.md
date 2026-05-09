# BMC Manager 前端 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 BMC Manager 前端的 4 个视觉缺陷 + 重设计传感器面板 + 统一全局过渡动画

**Architecture:** 分 5 个 Task 执行，每个 Task 独立可验证。修改集中在 `src/components/` 和 `src/pages/` 下 8 个文件 + 1 个 CSS 文件。纯前端变更，不涉及数据层。

**Tech Stack:** React 19 + TypeScript 6 + Ant Design 6

---

### Task 1: 侧边栏修复 + 全局动画统一

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: 修复 AppLayout Menu 选中态背景色**

在 `AppLayout.tsx` 中，给 Menu 添加样式覆盖，消除绿色偏色，Logo 图标显式设白色：

```tsx
// 修改 Menu 组件，添加 style prop：
<Menu
  theme="dark"
  mode="inline"
  selectedKeys={[selectedKey]}
  items={menuItems}
  onClick={({ key }) => navigate(key)}
  style={{
    backgroundColor: 'transparent',
  }}
/>
```

同时修改 Logo 图标确保白色：

```tsx
<CloudServerOutlined style={{ marginRight: collapsed ? 0 : 8, color: '#fff' }} />
```

- [ ] **Step 2: 在 index.css 添加 Menu 选中态背景覆盖**

```css
/* 修复暗色菜单选中态绿色偏色 */
.ant-menu-dark .ant-menu-item-selected {
  background-color: rgba(255, 255, 255, 0.12) !important;
}
```

- [ ] **Step 3: 在 index.css 添加全局过渡统一规则**

```css
/* 统一过渡动画，消除闪烁 */
.ant-card {
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.ant-card-hoverable:hover {
  box-shadow: none;
}

.ant-table-row {
  transition: background-color 0.15s ease;
}
```

- [ ] **Step 4: 验证**

启动 dev server：`cd bmc-manager && npm run dev`，确认：
- 侧边栏选中态为半透明白，无绿色区域
- 页面编译零错误

---

### Task 2: 传感器组件重写（SensorGauge → SensorValue）

**Files:**
- Rewrite: `src/components/SensorGauge.tsx`

- [ ] **Step 1: 重写 SensorGauge.tsx 为 SensorValue**

用文字型行布局替换圆形 Progress dashboard：

```tsx
interface Props {
  label: string;
  value: number | null;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export default function SensorValue({
  label,
  value,
  unit = '°C',
  warningThreshold = 80,
  criticalThreshold = 95,
}: Props) {
  const color =
    value === null
      ? '#d9d9d9'
      : value >= criticalThreshold
        ? '#ff4d4f'
        : value >= warningThreshold
          ? '#faad14'
          : '#52c41a';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <span style={{ fontSize: 12, color: '#8c8c8c' }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color,
          fontFamily: 'monospace',
        }}
      >
        {value !== null ? value : 'N/A'}
        {value !== null && (
          <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 1 }}>
            {' '}{unit}
          </span>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

运行 `cd bmc-manager && npx tsc --noEmit`，确认无类型错误。

---

### Task 3: 传感器面板适配

**Files:**
- Modify: `src/components/SensorGroup.tsx`
- Modify: `src/pages/BMCDetail.tsx`

- [ ] **Step 1: 重构 SensorGroup.tsx**

移除 grid 布局和 loading prop，改为列表渲染：

```tsx
import { Card, Empty } from 'antd';
import SensorValue from './SensorGauge';

interface SensorItem {
  label: string;
  value: number | null;
  unit?: string;
  max?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
}

interface Props {
  title: string;
  sensors: SensorItem[];
  extra?: React.ReactNode;
}

export default function SensorGroup({ title, sensors, extra }: Props) {
  const hasData = sensors.some((s) => s.value !== null);

  return (
    <Card
      title={title}
      size="small"
      extra={extra}
      style={{ height: '100%' }}
    >
      {!hasData ? (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {sensors.map((s) => (
            <SensorValue
              key={s.label}
              label={s.label}
              value={s.value}
              unit={s.unit}
              warningThreshold={s.warningThreshold}
              criticalThreshold={s.criticalThreshold}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: 更新 BMCDetail.tsx 的 import**

修改第一行 import：
```tsx
// 旧的 import（删除 SensorGauge import）不再需要
// 新的 import 只保留 SensorGroup（SensorValue 由 SensorGroup 内部使用）
// 确认 SensorGroup 的 import 路径正确即可：
import SensorGroup from '../components/SensorGroup';
```

BMCDetail 中的 `<SensorGroup loading={sensorsLoading}>` 需要移除 `loading` prop，改为外层 Spin 统一控制。找到所有 `<SensorGroup` 调用，移除 `loading={...}` 属性。

`Spin` 已在外层包裹，SensorGroup 内部不需要 loading 状态。

- [ ] **Step 3: 验证**

启动 `npm run dev`，进入 BMC 详情页 `/bmc/:bmcId`：
- 传感器以文字行显示（非圆形仪表盘）
- 数值颜色正确（绿/黄/红/灰）
- 无 Tooltip 浮动框
- 空数据组显示 Empty

---

### Task 4: 页面交互修复

**Files:**
- Modify: `src/components/BMCStatusBadge.tsx`
- Modify: `src/pages/RouterManagement.tsx`
- Modify: `src/components/BMCAddForm.tsx`

- [ ] **Step 1: 修复 BMCStatusBadge — 移除 Tooltip**

```tsx
import { Badge } from 'antd';
import type { BMCStatus } from '../types';

const statusConfig: Record<BMCStatus, { color: string; text: string }> = {
  online: { color: '#52c41a', text: '在线' },
  offline: { color: '#d9d9d9', text: '离线' },
  error: { color: '#ff4d4f', text: '异常' },
};

interface Props {
  status: BMCStatus;
  lastSeen?: string;
  showText?: boolean;
}

export default function BMCStatusBadge({ status, lastSeen, showText = true }: Props) {
  const cfg = statusConfig[status];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Badge
        status={status === 'error' ? 'error' : status === 'online' ? 'success' : 'default'}
        text={showText ? cfg.text : undefined}
        color={cfg.color}
      />
      {lastSeen && (
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>
          {new Date(lastSeen).toLocaleString('zh-CN')}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: 修复 RouterManagement — Card 选中态闪烁**

修改路由器 Card 部分（约第 178-194 行）：

```tsx
// 替换 selectedRouterId 的 borderColor 方案
// 旧：borderColor: selectedRouterId === router.id ? '#1677ff' : 'transparent'
// 新方案：

<Card
  size="small"
  hoverable={false}
  style={{
    border: '2px solid',
    borderColor: selectedRouterId === router.id ? '#1677ff' : token.colorBorderSecondary,
    boxShadow: selectedRouterId === router.id
      ? '0 0 0 2px rgba(22,119,255,0.15)'
      : 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
    outline: 'none',
  }}
  onClick={() => setSelectedRouterId(router.id)}
>
```

注意：需要在组件中获取 token：
```tsx
const { token } = theme.useToken();
```
（如果尚未导入 theme，添加：`import { ..., theme } from 'antd';` 并在组件内 `const { token } = theme.useToken();`）

- [ ] **Step 3: 修复 RouterManagement — BMC 表格 loading 优化**

Table 已经使用 `loading={bmcsLoading}`，确认无闪烁。移除多余的 Empty 状态的条件渲染，因为 Table 的 `loading` 已经处理。

- [ ] **Step 4: BMCAddForm — 无变动，仅验证**

检查 Drawer 表单无障碍问题。当前实现正确，无变更。

- [ ] **Step 5: 验证**

启动 dev server：
- 路由器卡片选中无闪烁、无布局抖动
- BMC 状态徽章无 Tooltip，时间小字显示
- 添加 BMC 表单正常

---

### Task 5: Dashboard 优化 + 最终回归

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Dashboard 统计卡片优化**

移除统计卡片不需要的 hover 效果（Ant Design Statistic 在 Card 中无 hoverable 问题，确认无需修改）。

- [ ] **Step 2: Dashboard 异常列表清理**

检查 `anomalyColumns` 中 `BMCStatusBadge` 调用，确认传入 `showText` 或无 Tooltip：

```tsx
// 约第 158 行，确认 BMCStatusBadge 使用正确：
render: (_: unknown, record: SensorSummary) => (
  <BMCStatusBadge status={record.status} />  // 不传 lastSeen，无 Tooltip
),
```

- [ ] **Step 3: 全页面回归验证**

启动 `npm run dev`，逐一检查：

| 页面 | 检查项 |
|------|--------|
| `/routers` | 侧边栏无绿色，路由器卡片选中无闪烁，BMC 表格正常 |
| `/bmc/:bmcId` | 传感器文字显示正确，颜色编码正确，无浮动框 |
| `/dashboard` | 统计卡片正常，趋势图正常，异常列表正常 |
| 全局 | 所有过渡平滑，无布局抖动，无 Tooltip 闪烁 |

---

### 最终质量门

- [ ] `npx tsc --noEmit` 零错误
- [ ] 3 个页面正常渲染
- [ ] 4 个已报告视觉缺陷全部修复
- [ ] 传感器新布局正确
- [ ] 无 Tooltip 闪烁
- [ ] 全局过渡统一平滑
