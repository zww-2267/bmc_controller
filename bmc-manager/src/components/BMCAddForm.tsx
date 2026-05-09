import { Drawer, Form, Input, Select, App, Button, Space } from 'antd';
import { useCreateBMC } from '../hooks/useBMCList';
import { useRouterList } from '../hooks/useRouterList';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BMCAddForm({ open, onClose }: Props) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const createBMC = useCreateBMC();
  const { data: routers } = useRouterList();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createBMC.mutateAsync(values);
      message.success('BMC 添加成功');
      form.resetFields();
      onClose();
    } catch {
      // validation error — Ant Form already shows messages
    }
  };

  return (
    <Drawer
      title="添加 BMC 设备"
      open={open}
      onClose={onClose}
      width={420}
      extra={
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          输入 BMC 的 IP 和管理员凭据
        </span>
      }
      footer={
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={createBMC.isPending} onClick={handleSubmit}>
            确认添加
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="ip"
          label="BMC IP 地址"
          rules={[
            { required: true, message: '请输入 IP 地址' },
            {
              pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
              message: 'IP 地址格式不正确',
            },
          ]}
        >
          <Input placeholder="例如 10.0.0.100" />
        </Form.Item>

        <Form.Item
          name="username"
          label="管理员账号"
          rules={[{ required: true, message: '请输入管理员账号' }]}
        >
          <Input placeholder="root 或 admin" />
        </Form.Item>

        <Form.Item
          name="password"
          label="管理员密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password placeholder="输入 BMC 管理密码" />
        </Form.Item>

        <Form.Item
          name="routerId"
          label="所属路由器"
          rules={[{ required: true, message: '请选择路由器' }]}
        >
          <Select
            placeholder="选择路由器"
            options={routers?.map((r) => ({
              label: `${r.name} (${r.location})`,
              value: r.id,
            }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
