import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { AlertOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import AnomalyPanel from '../components/AnomalyPanel';
import LogImport from '../components/LogImport';
import BMCQuery from '../components/BMCQuery';

const { Sider, Content } = Layout;

const navItems = [
  { key: 'anomaly', icon: <AlertOutlined />, label: '异常分析' },
  { key: 'log', icon: <FileTextOutlined />, label: '日志分析' },
  { key: 'query', icon: <SearchOutlined />, label: 'BMC 查询' },
];

export default function MonitorPage() {
  const [active, setActive] = useState('anomaly');
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={200}
        style={{ background: '#001529', color: '#fff' }}
      >
        <div style={{
          padding: '16px 24px', fontSize: 16, fontWeight: 700, letterSpacing: 1,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          BMC 监控分析
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[active]}
          items={navItems} onClick={({ key }) => setActive(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Content style={{ padding: 16, overflow: 'auto', background: '#f5f5f5' }}>
        {active === 'anomaly' && <AnomalyPanel />}
        {active === 'log' && <LogImport />}
        {active === 'query' && <BMCQuery />}
      </Content>
    </Layout>
  );
}
