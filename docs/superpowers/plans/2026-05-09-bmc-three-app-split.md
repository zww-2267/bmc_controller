# BMC Manager 三应用拆分 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单页 bmc-manager 拆分为 3 个独立应用（路由器管理 / BMC 监控与分析 / BMC 详情）+ 共享层

**Architecture:** 3 个独立 Vite + React 应用，共享 `shared/` 目录（types/api/mocks/hooks），各运行在 5173/5174/5175 端口。可分别打包为 Tauri 桌面应用。

**Tech Stack:** React 19 + TypeScript 6 + Ant Design 6 + Vite 8 + Tauri 2.11

---

### Task 1: 共享层迁移

**Files:**
- Create: `shared/types/index.ts` (copy from `src/types/index.ts`)
- Create: `shared/api/client.ts` (copy from `src/api/client.ts`)
- Create: `shared/api/bmc.ts` (copy from `src/api/bmc.ts`)
- Create: `shared/api/routers.ts` (copy from `src/api/routers.ts`)
- Create: `shared/api/sensors.ts` (copy from `src/api/sensors.ts`)
- Create: `shared/mocks/bmc.ts` (copy from `src/mocks/bmc.ts`)
- Create: `shared/mocks/routers.ts` (copy from `src/mocks/routers.ts`)
- Create: `shared/mocks/sensors.ts` (copy from `src/mocks/sensors.ts`)
- Create: `shared/hooks/useBMCList.ts` (copy from `src/hooks/useBMCList.ts`)
- Create: `shared/hooks/useBMCSensors.ts` (copy from `src/hooks/useBMCSensors.ts`)
- Create: `shared/hooks/useRouterList.ts` (copy from `src/hooks/useRouterList.ts`)
- Create: `shared/hooks/useSensorSummary.ts` (copy from `src/hooks/useSensorSummary.ts`)
- Create: `shared/stores/rootStore.ts`

- [ ] **Step 1: 创建 shared/ 目录结构**

```bash
mkdir -p shared/{types,api,mocks,hooks,stores}
```

- [ ] **Step 2: 复制所有共享文件**

```bash
cp src/types/index.ts shared/types/index.ts
cp src/api/client.ts shared/api/client.ts
cp src/api/bmc.ts shared/api/bmc.ts
cp src/api/routers.ts shared/api/routers.ts
cp src/api/sensors.ts shared/api/sensors.ts
cp src/mocks/bmc.ts shared/mocks/bmc.ts
cp src/mocks/routers.ts shared/mocks/routers.ts
cp src/mocks/sensors.ts shared/mocks/sensors.ts
cp src/hooks/useBMCList.ts shared/hooks/useBMCList.ts
cp src/hooks/useBMCSensors.ts shared/hooks/useBMCSensors.ts
cp src/hooks/useRouterList.ts shared/hooks/useRouterList.ts
cp src/hooks/useSensorSummary.ts shared/hooks/useSensorSummary.ts
```

- [ ] **Step 3: 创建 rootStore（Zustand）**

`shared/stores/rootStore.ts`:
```typescript
import { create } from 'zustand';

interface RootState {
  isRoot: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const ROOT_PASSWORD = '123456';

export const useRootStore = create<RootState>((set) => ({
  isRoot: false,
  unlock: (password: string) => {
    if (password === ROOT_PASSWORD) {
      set({ isRoot: true });
      return true;
    }
    return false;
  },
  lock: () => set({ isRoot: false }),
}));
```

- [ ] **Step 4: 更新 shared/ 内部 import 路径**

所有 shared/ 文件内部的 import 从相对路径改为指向 shared/ 目录。检查并修正：

```bash
cd shared && grep -rn "from '.'" .
```

修正所有 import 为绝对或相对 `shared/` 路径：
- `import type { BMC } from '../types'` → `import type { BMC } from '@/shared/types'`
- 或使用相对路径 `../../shared/types`

实际上 Vite alias 的方式更简洁——每个应用的 vite.config.ts 会配置 `@shared` 别名。

- [ ] **Step 5: 编译验证**

每个应用完成后独立验证。

---

### Task 2: App1 — 路由器管理

**Files:**
- Create: `app-router-manager/package.json`
- Create: `app-router-manager/vite.config.ts`
- Create: `app-router-manager/index.html`
- Create: `app-router-manager/tsconfig.json`
- Create: `app-router-manager/src/main.tsx`
- Create: `app-router-manager/src/App.tsx`
- Create: `app-router-manager/src/index.css`
- Create: `app-router-manager/src/pages/RouterManagerPage.tsx`
- Create: `app-router-manager/src/components/TopBar.tsx`
- Create: `app-router-manager/src/components/RootButton.tsx`

- [ ] **Step 1: 创建 App1 目录和 package.json**

```bash
mkdir -p app-router-manager/src/{pages,components}
```

`app-router-manager/package.json`:
```json
{
  "name": "app-router-manager",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ant-design/icons": "^6.2.2",
    "@tanstack/react-query": "^5.100.9",
    "antd": "^6.3.7",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "zustand": "^5.0.13"
  }
}
```

- [ ] **Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
});
```

- [ ] **Step 3: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>路由器管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建 main.tsx + App.tsx**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

`src/App.tsx`:
```tsx
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import RouterManagerPage from './pages/RouterManagerPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
        <AntApp><RouterManagerPage /></AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: 创建 index.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
#root { height: 100%; }
.ant-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.ant-table-row { transition: background-color 0.15s ease; }
```

- [ ] **Step 6: 创建 TopBar 组件**

`src/components/TopBar.tsx`:
```tsx
import { useRootStore } from '@shared/stores/rootStore';
import RootButton from './RootButton';

export default function TopBar() {
  const isRoot = useRootStore((s) => s.isRoot);
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: '#001529', color: '#fff',
      borderBottom: '2px solid #1677ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>路由器管理</span>
        {isRoot && <span style={{ fontSize: 11, color: '#faad14', background: 'rgba(250,173,20,0.15)', padding: '2px 8px', borderRadius: 4 }}>ROOT</span>}
      </div>
      <RootButton />
    </div>
  );
}
```

- [ ] **Step 7: 创建 RootButton 组件**

`src/components/RootButton.tsx`:
```tsx
import { useState } from 'react';
import { Button, Input, Modal, App } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useRootStore } from '@shared/stores/rootStore';

export default function RootButton() {
  const { isRoot, unlock, lock } = useRootStore();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');

  const handleUnlock = () => {
    if (unlock(pwd)) { message.success('已进入 Root 模式'); setOpen(false); setPwd(''); }
    else message.error('密码错误');
  };

  return (
    <>
      {isRoot ? (
        <Button ghost icon={<LockOutlined />} onClick={lock}>退出 Root</Button>
      ) : (
        <Button ghost icon={<UnlockOutlined />} onClick={() => setOpen(true)}>Root</Button>
      )}
      <Modal title="Root 验证" open={open} onOk={handleUnlock} onCancel={() => { setOpen(false); setPwd(''); }}>
        <Input.Password placeholder="Root 密码" value={pwd} onChange={(e) => setPwd(e.target.value)} onPressEnter={handleUnlock} />
      </Modal>
    </>
  );
}
```

- [ ] **Step 8: 创建 RouterManagerPage**

`src/pages/RouterManagerPage.tsx` — 基于旧版 RouterManagement.tsx 简化：
- 移除路由跳转（去掉 IP 列 onClick 导航）
- 左侧：路由器垂直列表（Menu 组件，垂直排列）
- 右侧：BMC 表
- 增删按钮：`disabled={!isRoot}`
- 使用 `useRootStore` 获取 isRoot

关键代码结构：
```tsx
import { useState, useMemo } from 'react';
import { Card, Table, Button, Space, Input, Select, Empty, Spin, Tag, Typography, App } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRouterList } from '@shared/hooks/useRouterList';
import { useBMCList, useDeleteBMC } from '@shared/hooks/useBMCList';
import { useRootStore } from '@shared/stores/rootStore';
import BMCStatusBadge from '../components/BMCStatusBadge'; // 复制或引用
import BMCAddForm from '../components/BMCAddForm'; // 复制或引用
import type { BMC, Router } from '@shared/types';
import TopBar from '../components/TopBar';
import { theme } from 'antd';

const { Title, Text } = Typography;

export default function RouterManagerPage() {
  const isRoot = useRootStore((s) => s.isRoot);
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { data: routers, isLoading: routersLoading } = useRouterList();
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);
  const { data: bmcs, isLoading: bmcsLoading, refetch: refetchBMCs } = useBMCList(selectedRouterId);
  const deleteBMC = useDeleteBMC();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ... (filter logic, delete handler - same as old)

  // columns: remove the link-style IP, just show text
  const columns: ColumnsType<BMC> = [
    { title: 'BMC IP', dataIndex: 'ip', key: 'ip', sorter: (a, b) => a.ip.localeCompare(b.ip),
      render: (ip: string) => <code style={{ fontFamily: 'monospace' }}>{ip}</code> },
    { title: '管理员', dataIndex: 'username', key: 'username', width: 100 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 280,
      render: (_: unknown, record: BMC) => <BMCStatusBadge status={record.status} lastSeen={record.lastSeen} /> },
    { title: '已运行时间', dataIndex: 'uptime', key: 'uptime', width: 140,
      render: (t: number, record: BMC) => record.status === 'online' ? formatUptime(t) : '-' },
    { title: '操作', key: 'actions', width: 80,
      render: (_: unknown, record: BMC) => (
        <Popconfirm title="确认删除" onConfirm={() => handleDeleteBMC(record.id)}>
          <Button type="link" size="small" danger disabled={!isRoot} icon={<DeleteOutlined />} />
        </Popconfirm>
      )},
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: router list */}
        <div style={{ width: 200, borderRight: `1px solid ${token.colorBorderSecondary}`, padding: 12, overflow: 'auto' }}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, display: 'block' }}>路由器列表</Text>
          {routersLoading ? <Spin /> : (routers || []).map((r: Router) => (
            <div key={r.id} onClick={() => setSelectedRouterId(r.id)} style={{
              padding: '8px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: selectedRouterId === r.id ? '#e6f4ff' : 'transparent',
              border: selectedRouterId === r.id ? '1px solid #1677ff' : '1px solid transparent',
            }}>
              <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
              <br /><Text style={{ fontSize: 11, color: '#8c8c8c' }}>{r.location}</Text>
            </div>
          ))}
        </div>
        {/* Right: BMC table */}
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {/* same search/filter bar + Table as before */}
          <Card title={<Space><span>BMC 设备列表</span>{selectedRouterId && <Tag color="blue">{routers?.find(r => r.id === selectedRouterId)?.name}</Tag>}</Space>}
            extra={<Space>
              <Input prefix={<SearchOutlined />} placeholder="搜索 IP" value={searchText} onChange={...} style={{ width: 180 }} allowClear />
              <Select value={statusFilter} onChange={...} style={{ width: 100 }} options={[...]} />
              <Button type="primary" icon={<PlusOutlined />} disabled={!isRoot} onClick={() => setAddDrawerOpen(true)}>添加 BMC</Button>
            </Space>}>
            <Table columns={columns} dataSource={filteredBMCs} rowKey="id" loading={bmcsLoading} ... />
          </Card>
        </div>
      </div>
      <BMCAddForm open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 9: 复制 App1 需要的组件到本地**

```bash
cp bmc-manager/src/components/BMCStatusBadge.tsx app-router-manager/src/components/
cp bmc-manager/src/components/BMCAddForm.tsx app-router-manager/src/components/
```

并更新这些组件内的 import 路径指向 `@shared/...`。

- [ ] **Step 10: 安装依赖并验证编译**

```bash
cd app-router-manager && npm install && npx tsc --noEmit
```

- [ ] **Step 11: 运行 dev server 验证**

```bash
cd app-router-manager && npm run dev
# 访问 http://localhost:5173
# 验证: Root 按钮密码 123456，非 root 增删置灰
```

---

### Task 3: App3 — BMC 监控与分析

**Files:**
- Create: `app-bmc-monitor/package.json`
- Create: `app-bmc-monitor/vite.config.ts` (port 5175)
- Create: `app-bmc-monitor/index.html`
- Create: `app-bmc-monitor/src/main.tsx`, `App.tsx`, `index.css`
- Create: `app-bmc-monitor/src/pages/MonitorPage.tsx`
- Create: `app-bmc-monitor/src/components/AnomalyPanel.tsx`
- Create: `app-bmc-monitor/src/components/LogImport.tsx`
- Create: `app-bmc-monitor/src/components/BMCQuery.tsx`

- [ ] **Step 1: 创建 App3 目录结构和 package.json**

```bash
mkdir -p app-bmc-monitor/src/{pages,components}
```

package.json 同 Task 2 结构（name: `app-bmc-monitor`）。额外依赖 `dayjs`。

- [ ] **Step 2: 创建 vite.config.ts（port 5175）**

与 Task 2 相同，`server: { port: 5175 }`。

- [ ] **Step 3: 创建主布局 MonitorPage**

`src/pages/MonitorPage.tsx` — 左侧导航 + 右侧内容:

```tsx
import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { AlertOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import AnomalyPanel from '../components/AnomalyPanel';
import LogImport from '../components/LogImport';
import BMCQuery from '../components/BMCQuery';

const { Content } = Layout;

const navItems = [
  { key: 'anomaly', icon: <AlertOutlined />, label: '异常分析' },
  { key: 'log', icon: <FileTextOutlined />, label: '日志分析' },
  { key: 'query', icon: <SearchOutlined />, label: 'BMC 查询' },
];

export default function MonitorPage() {
  const [active, setActive] = useState('anomaly');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <div style={{
        width: 200, background: '#001529', color: '#fff',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '16px 24px', fontSize: 16, fontWeight: 700, letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          BMC 监控分析
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[active]}
          items={navItems} onClick={({ key }) => setActive(key)}
          style={{ flex: 1, borderRight: 0 }} />
      </div>
      <Content style={{ padding: 16, overflow: 'auto', background: '#f5f5f5' }}>
        {active === 'anomaly' && <AnomalyPanel />}
        {active === 'log' && <LogImport />}
        {active === 'query' && <BMCQuery />}
      </Content>
    </Layout>
  );
}
```

App.tsx 中直接渲染 `<MonitorPage />`，无路由。

- [ ] **Step 4: 创建 AnomalyPanel — 异常分析面板**

`src/components/AnomalyPanel.tsx`:
```tsx
import { useMemo } from 'react';
import { Card, Table, Tag, Typography, Spin, Empty } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useSensorSummary } from '@shared/hooks/useSensorSummary';
import type { SensorSummary } from '@shared/types';

const { Title } = Typography;

interface AnomalyItem {
  bmcId: string; bmcIp: string; routerName: string; severity: 'critical' | 'warning';
  reasons: string[]; timestamp: string;
}

function analyzeAnomaly(s: SensorSummary): AnomalyItem | null {
  if (!s.hasError && s.status !== 'error') return null;
  const reasons: string[] = [];
  let severity: 'critical' | 'warning' = 'warning';

  if (s.cpu0Temp !== null && s.cpu0Temp > 85) { reasons.push(`CPU0 温度过高: ${s.cpu0Temp}°C (阈值 85°C)`); severity = 'critical'; }
  else if (s.cpu0Temp !== null && s.cpu0Temp > 75) { reasons.push(`CPU0 温度偏高: ${s.cpu0Temp}°C (阈值 75°C)`); }
  if (s.inletAirTemp !== null && s.inletAirTemp > 35) reasons.push(`进风口温度过高: ${s.inletAirTemp}°C (阈值 35°C)`);
  if (s.chassisPower > 1000) reasons.push(`整机功耗过高: ${s.chassisPower}W`);
  if (s.status === 'error') { reasons.push('BMC 状态异常 (error)'); severity = 'critical'; }
  if (reasons.length === 0) reasons.push('传感器数据异常 (hasError)');

  return { bmcId: s.bmcId, bmcIp: s.bmcIp, routerName: s.routerName, severity, reasons, timestamp: s.timestamp };
}

export default function AnomalyPanel() {
  const { data: summaries, isLoading } = useSensorSummary();
  const anomalies = useMemo(() => {
    if (!summaries) return [];
    return summaries.map(analyzeAnomaly).filter(Boolean).sort((a, b) => a!.severity === 'critical' ? -1 : 1) as AnomalyItem[];
  }, [summaries]);

  const columns = [
    { title: 'BMC IP', dataIndex: 'bmcIp', key: 'bmcIp', width: 150,
      render: (ip: string) => <code>{ip}</code> },
    { title: '路由器', dataIndex: 'routerName', key: 'routerName', width: 120 },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 80,
      render: (s: string) => <Tag color={s === 'critical' ? 'error' : 'warning'}>{s === 'critical' ? '严重' : '警告'}</Tag> },
    { title: '异常原因', dataIndex: 'reasons', key: 'reasons',
      render: (reasons: string[]) => reasons.map((r, i) => <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>{r}</div>) },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN') },
  ];

  return (
    <Card title={<><WarningOutlined style={{ color: '#ff4d4f' }} /> 异常 BMC 分析</>}>
      {isLoading ? <Spin /> : anomalies.length === 0 ? <Empty description="当前无异常设备" />
        : <Table columns={columns} dataSource={anomalies} rowKey="bmcId" pagination={{ pageSize: 15 }} size="small" />}
    </Card>
  );
}
```

- [ ] **Step 5: 创建 LogImport — 日志导入分析**

`src/components/LogImport.tsx`:
```tsx
import { useState, useCallback } from 'react';
import { Card, Upload, Table, Tag, Select, Typography, Empty, Button, Space } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title, Text } = Typography;

interface LogEntry { time: string; level: string; source: string; message: string; }

// Mock 示例日志
const mockLogs: LogEntry[] = [
  { time: '2026-05-09 10:23:01', level: 'ERROR', source: 'CPU0', message: 'Temperature critical: 94°C exceeds threshold 85°C' },
  { time: '2026-05-09 10:22:58', level: 'WARN', source: 'FAN3', message: 'Fan speed abnormal: 8500 RPM > threshold 8000 RPM' },
  { time: '2026-05-09 10:22:45', level: 'INFO', source: 'PSU1', message: 'Power output stable: 450W' },
  { time: '2026-05-09 10:21:30', level: 'ERROR', source: 'GPU5', message: 'GPU temperature high: 91°C' },
  { time: '2026-05-09 10:20:15', level: 'WARN', source: 'DIMMG0', message: 'Voltage fluctuation: 1.45V > 1.35V expected' },
  { time: '2026-05-09 10:19:00', level: 'INFO', source: 'BMC', message: 'System boot completed, uptime: 3d 5h' },
];

export default function LogImport() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const uploadProps: UploadProps = {
    accept: '.csv,.json',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (file.name.endsWith('.csv')) {
            const lines = text.split('\n').filter(l => l.trim());
            const parsed: LogEntry[] = lines.slice(1).map(line => {
              const [time, level, source, ...msg] = line.split(',');
              return { time, level, source, message: msg.join(',').trim() };
            });
            setLogs(parsed);
          } else {
            setLogs(JSON.parse(text));
          }
        } catch { /* ignore parse errors */ }
      };
      reader.readAsText(file);
      return false;
    },
  };

  const filteredLogs = logs
    ? (levelFilter === 'all' ? logs : logs.filter(l => l.level === levelFilter))
    : null;

  const columns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: (l: string) => <Tag color={l === 'ERROR' ? 'error' : l === 'WARN' ? 'warning' : 'default'}>{l}</Tag> },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '消息', dataIndex: 'message', key: 'message' },
  ];

  return (
    <Card title={<><FileTextOutlined /> 日志分析</>}
      extra={<Space>
        <Button onClick={() => setLogs(mockLogs)}>加载示例日志</Button>
        <Upload {...uploadProps}><Button icon={<UploadOutlined />}>导入 CSV/JSON</Button></Upload>
        <Select value={levelFilter} onChange={setLevelFilter} style={{ width: 100 }}
          options={[{ label: '全部', value: 'all' }, { label: 'ERROR', value: 'ERROR' }, { label: 'WARN', value: 'WARN' }, { label: 'INFO', value: 'INFO' }]} />
      </Space>}>
      {!filteredLogs ? <Empty description="点击「加载示例日志」或导入 CSV/JSON 文件" />
        : <Table columns={columns} dataSource={filteredLogs} rowKey={(r, i) => `${r.time}-${i}`} pagination={{ pageSize: 20 }} size="small" />}
    </Card>
  );
}
```

- [ ] **Step 6: 创建 BMCQuery — BMC 查询模块**

`src/components/BMCQuery.tsx`:
```tsx
import { useState, useMemo } from 'react';
import { Card, Select, Input, Button, Descriptions, Tag, Empty, Space } from 'antd';
import { SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { useRouterList } from '@shared/hooks/useRouterList';
import { useBMCList } from '@shared/hooks/useBMCList';
import BMCStatusBadge from '../../../../bmc-manager/src/components/BMCStatusBadge'; // 需要复制到本地
import type { BMC } from '@shared/types';

export default function BMCQuery() {
  const { data: routers } = useRouterList();
  const [selectedRouterId, setSelectedRouterId] = useState<string>();
  const [searchIp, setSearchIp] = useState('');
  const { data: bmcs } = useBMCList(selectedRouterId || null);

  const filteredBMCs = useMemo(() => {
    if (!bmcs || !searchIp) return [];
    return bmcs.filter(b => b.ip.includes(searchIp));
  }, [bmcs, searchIp]);

  const selectedBMC = filteredBMCs.length === 1 ? filteredBMCs[0] : null;

  const jumpToDetail = (bmc: BMC) => {
    window.open(`http://localhost:5174/?bmcId=${bmc.id}&routerId=${bmc.routerId}`, '_blank');
  };

  return (
    <Card title={<><SearchOutlined /> BMC 设备查询</>}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <Select placeholder="选择路由器" style={{ width: 200 }}
            value={selectedRouterId} onChange={setSelectedRouterId}
            options={routers?.map(r => ({ label: r.name, value: r.id }))} allowClear />
          <Input placeholder="输入 BMC IP" style={{ width: 200 }}
            value={searchIp} onChange={e => setSearchIp(e.target.value)} />
        </Space>

        {filteredBMCs.length > 1 && (
          <div>
            {filteredBMCs.map(b => (
              <Card key={b.id} size="small" style={{ marginBottom: 8 }}>
                <Space>
                  <code>{b.ip}</code>
                  <BMCStatusBadge status={b.status} />
                  <Button size="small" icon={<ExportOutlined />} onClick={() => jumpToDetail(b)}>查看详情</Button>
                </Space>
              </Card>
            ))}
          </div>
        )}

        {selectedBMC && (
          <Card size="small" title="查询结果">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="IP">{selectedBMC.ip}</Descriptions.Item>
              <Descriptions.Item label="管理员">{selectedBMC.username}</Descriptions.Item>
              <Descriptions.Item label="路由器">{selectedBMC.routerName}</Descriptions.Item>
              <Descriptions.Item label="状态"><BMCStatusBadge status={selectedBMC.status} /></Descriptions.Item>
              <Descriptions.Item label="已运行时间">{selectedBMC.status === 'online' ? formatUptime(selectedBMC.uptime) : '-'}</Descriptions.Item>
            </Descriptions>
            <Button type="primary" icon={<ExportOutlined />} style={{ marginTop: 12 }} onClick={() => jumpToDetail(selectedBMC)}>
              跳转到 BMC 详情
            </Button>
          </Card>
        )}
      </Space>
    </Card>
  );
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d > 0 ? `${d}天` : '', h > 0 ? `${h}时` : '', `${m}分`].filter(Boolean).join(' ');
}
```

- [ ] **Step 7: 复制 BMCStatusBadge 到 App3**

```bash
cp bmc-manager/src/components/BMCStatusBadge.tsx app-bmc-monitor/src/components/
```

- [ ] **Step 8: 安装依赖并验证编译**

```bash
cd app-bmc-monitor && npm install && npx tsc --noEmit
```

---

### Task 4: App2 — BMC 详情

**Files:**
- Create: `app-bmc-detail/package.json`
- Create: `app-bmc-detail/vite.config.ts` (port 5174)
- Create: `app-bmc-detail/index.html`
- Create: `app-bmc-detail/src/main.tsx`, `App.tsx`, `index.css`
- Create: `app-bmc-detail/src/pages/LoginPage.tsx`
- Create: `app-bmc-detail/src/pages/BMCDetailPage.tsx` (基于现有 BMCDetail.tsx)
- Copy: `app-bmc-detail/src/components/` (SensorGroup, SensorGauge, BMCStatusBadge, RootButton)

- [ ] **Step 1: 创建 App2 目录和配置**

```bash
mkdir -p app-bmc-detail/src/{pages,components}
```

package.json / vite.config.ts (port 5174) / index.html / main.tsx — 与 Task 2 结构相同。

- [ ] **Step 2: 创建 LoginPage**

`src/pages/LoginPage.tsx`:
```tsx
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Select, Input, Button, Typography, App } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useRouterList } from '@shared/hooks/useRouterList';
import { useBMCList } from '@shared/hooks/useBMCList';

const { Title } = Typography;

const VALID_USER = 'admin';
const VALID_PASS = 'abc123..';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { data: routers } = useRouterList();
  const [routerId, setRouterId] = useState<string>(searchParams.get('routerId') || '');
  const [bmcId, setBmcId] = useState<string>(searchParams.get('bmcId') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { data: bmcs } = useBMCList(routerId || null);

  const handleLogin = () => {
    if (username !== VALID_USER || password !== VALID_PASS) {
      message.error('账号或密码错误'); return;
    }
    if (!bmcId) { message.error('请选择 BMC 设备'); return; }
    navigate(`/bmc/${bmcId}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LockOutlined style={{ fontSize: 48, color: '#1677ff' }} />
          <Title level={3}>BMC 详情登录</Title>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>选择路由器</div>
          <Select placeholder="选择路由器" style={{ width: '100%' }} value={routerId || undefined}
            onChange={(v) => { setRouterId(v); setBmcId(''); }}
            options={routers?.map(r => ({ label: `${r.name} (${r.location})`, value: r.id }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>选择 BMC IP</div>
          <Select placeholder="选择 BMC IP" style={{ width: '100%' }} value={bmcId || undefined}
            onChange={setBmcId} disabled={!routerId}
            options={bmcs?.map(b => ({ label: b.ip, value: b.id }))} showSearch optionFilterProp="label" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>管理员账号</div>
          <Input placeholder="admin" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>管理员密码</div>
          <Input.Password placeholder="输入密码" value={password} onChange={e => setPassword(e.target.value)} onPressEnter={handleLogin} />
        </div>
        <Button type="primary" block onClick={handleLogin} size="large">登 录</Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 创建 App.tsx（带路由）**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import LoginPage from './pages/LoginPage';
import BMCDetailPage from './pages/BMCDetailPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/bmc/:bmcId" element={<BMCDetailPage />} />
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: 创建 BMCDetailPage**

基于旧版 `BMCDetail.tsx`，但：
- 移除返回按钮（改为"退出登录"按钮，跳回 `/`）
- 新增 Root 按钮（复用 App1 的 RootButton 组件）
- 开关机按钮受 `useRootStore.isRoot` 控制

```tsx
// 关键差异：
// 1. import RootButton from '../components/RootButton';
// 2. import { useRootStore } from '@shared/stores/rootStore';
// 3. const isRoot = useRootStore((s) => s.isRoot);
// 4. 开关机按钮: disabled={!isRoot}
// 5. 退出按钮: navigate('/')
```

- [ ] **Step 5: 复制组件到 App2**

```bash
cp app-router-manager/src/components/RootButton.tsx app-bmc-detail/src/components/
cp bmc-manager/src/components/SensorGauge.tsx app-bmc-detail/src/components/
cp bmc-manager/src/components/SensorGroup.tsx app-bmc-detail/src/components/
cp bmc-manager/src/components/BMCStatusBadge.tsx app-bmc-detail/src/components/
```

- [ ] **Step 6: 安装依赖并验证**

```bash
cd app-bmc-detail && npm install && npx tsc --noEmit
```

---

### Task 5: 多端口启动 + 最终验证

**Files:**
- Create: `start-all.sh` (启动脚本)
- Create: `stop-all.sh` (停止脚本)

- [ ] **Step 1: 创建 start-all.sh**

```bash
#!/bin/bash
echo "Starting App1: 路由器管理 (port 5173)..."
cd app-router-manager && npm run dev &
echo "Starting App2: BMC 详情 (port 5174)..."
cd app-bmc-detail && npm run dev &
echo "Starting App3: BMC 监控与分析 (port 5175)..."
cd app-bmc-monitor && npm run dev &
echo "All three apps starting..."
echo "  App1: http://localhost:5173"
echo "  App2: http://localhost:5174"
echo "  App3: http://localhost:5175"
wait
```

- [ ] **Step 2: 逐个验证编译**

```bash
cd app-router-manager && npx tsc --noEmit
cd app-bmc-detail && npx tsc --noEmit
cd app-bmc-monitor && npx tsc --noEmit
```

- [ ] **Step 3: 最终功能回归**

| App | 验证项 |
|-----|--------|
| App1 (5173) | Root 密码 123456，路由列表→BMC 表，非 root 增删置灰，IP 不可点击 |
| App2 (5174) | 登录 admin/abc123..，级联选择，传感器面板，Root 解锁开关机 |
| App3 (5175) | 异常分析显示原因，加载示例日志，BMC 查询 → 跳转 App2 |

---

### 最终质量门

- [ ] 3 个应用 `npx tsc --noEmit` 零错误
- [ ] App1 dev server 正常渲染
- [ ] App2 dev server 正常渲染，登录流程正确
- [ ] App3 dev server 正常渲染，三模块切换正常
- [ ] App3 异常分析显示具体原因
- [ ] App3 查询模块可跳转 App2
- [ ] Git commit 并 push
