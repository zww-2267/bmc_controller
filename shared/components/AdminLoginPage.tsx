import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, App } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthStore } from '@shared/stores/authStore';

const { Title, Text } = Typography;

interface Props {
  appTitle?: string;
  appSubtitle?: string;
}

export default function AdminLoginPage({ appTitle = 'BMC 管理系统', appSubtitle = '管理员登录' }: Props) {
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = (values: { username: string; password: string }) => {
    setLoading(true);
    // 模拟短暂延迟增强体验
    setTimeout(() => {
      const ok = login(values.username, values.password);
      setLoading(false);
      if (ok) {
        navigate('/', { replace: true });
      } else {
        message.error('用户名或密码错误');
      }
    }, 400);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: 400,
          maxWidth: '100%',
          borderRadius: 12,
          boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
        }}
        styles={{ body: { padding: '40px 32px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <SafetyOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} style={{ marginBottom: 4 }}>
            {appTitle}
          </Title>
          <Text type="secondary">{appSubtitle}</Text>
        </div>

        <Form
          name="admin-login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
          initialValues={{ username: 'admin' }}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
