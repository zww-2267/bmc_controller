import { useState } from 'react';
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
      message.error('账号或密码错误');
      return;
    }
    if (!bmcId) {
      message.error('请选择 BMC 设备');
      return;
    }
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
          <Select
            placeholder="选择路由器" style={{ width: '100%' }}
            value={routerId || undefined}
            onChange={(v) => { setRouterId(v); setBmcId(''); }}
            options={routers?.map((r) => ({ label: `${r.name} (${r.location})`, value: r.id }))}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>选择 BMC IP</div>
          <Select
            placeholder="选择 BMC IP" style={{ width: '100%' }}
            value={bmcId || undefined}
            onChange={setBmcId} disabled={!routerId}
            options={bmcs?.map((b) => ({ label: b.ip, value: b.id }))}
            showSearch optionFilterProp="label"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>管理员账号</div>
          <Input placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#8c8c8c' }}>管理员密码</div>
          <Input.Password
            placeholder="输入密码" value={password}
            onChange={(e) => setPassword(e.target.value)} onPressEnter={handleLogin}
          />
        </div>
        <Button type="primary" block onClick={handleLogin} size="large">登 录</Button>
      </Card>
    </div>
  );
}
