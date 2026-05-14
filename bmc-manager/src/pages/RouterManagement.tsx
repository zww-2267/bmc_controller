import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Row,
  Col,
  Empty,
  Spin,
  Popconfirm,
  Tag,
  Typography,
  App,
  theme,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRouterList } from '../hooks/useRouterList';
import { useBMCList, useDeleteBMC } from '../hooks/useBMCList';
import BMCStatusBadge from '@shared/components/BMCStatusBadge';
import BMCAddForm from '../components/BMCAddForm';
import type { BMC, Router } from '../types';

const { Title, Text } = Typography;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}时`);
  if (m > 0 || parts.length === 0) parts.push(`${m}分`);
  return parts.join(' ');
}

export default function RouterManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { data: routers, isLoading: routersLoading } = useRouterList();
  const routerIdFromState = (location.state as { routerId?: string })?.routerId ?? null;
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(routerIdFromState);
  const { data: bmcs, isLoading: bmcsLoading, refetch: refetchBMCs } = useBMCList(selectedRouterId);
  const deleteBMC = useDeleteBMC();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { token } = theme.useToken();

  const selectedRouter = useMemo(
    () => routers?.find((r) => r.id === selectedRouterId) || null,
    [routers, selectedRouterId]
  );

  const filteredBMCs = useMemo(() => {
    if (!bmcs) return [];
    let list = bmcs;
    if (searchText) {
      list = list.filter((b) => b.ip.includes(searchText));
    }
    if (statusFilter !== 'all') {
      list = list.filter((b) => b.status === statusFilter);
    }
    return list;
  }, [bmcs, searchText, statusFilter]);

  const handleDeleteBMC = useCallback(
    async (id: string) => {
      await deleteBMC.mutateAsync(id);
      message.success('BMC 已删除');
    },
    [deleteBMC, message]
  );

  // 统计
  const onlineCount = bmcs?.filter((b) => b.status === 'online').length ?? 0;
  const offlineCount = bmcs?.filter((b) => b.status === 'offline').length ?? 0;
  const warningCount = bmcs?.filter((b) => b.status === 'warning').length ?? 0;
  const errorCount = bmcs?.filter((b) => b.status === 'error').length ?? 0;
  const totalCount = bmcs?.length ?? 0;

  const columns: ColumnsType<BMC> = [
    {
      title: 'BMC IP',
      dataIndex: 'ip',
      key: 'ip',
      sorter: (a, b) => a.ip.localeCompare(b.ip),
      render: (ip: string, record: BMC) => (
        <Button
          type="link"
          onClick={() => navigate(`/bmc/${record.id}`)}
          style={{ padding: 0, fontFamily: 'monospace' }}
        >
          {ip}
        </Button>
      ),
    },
    {
      title: '管理员',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 280,
      sorter: (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(),
      render: (_: unknown, record: BMC) => (
        <BMCStatusBadge status={record.status} lastSeen={record.lastSeen} />
      ),
    },
    {
      title: '已运行时间',
      dataIndex: 'uptime',
      key: 'uptime',
      width: 140,
      sorter: (a, b) => a.uptime - b.uptime,
      render: (t: number, record: BMC) =>
        (record.status === 'online' || record.status === 'warning') ? formatUptime(t) : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: BMC) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => navigate(`/bmc/${record.id}`)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 BMC ${record.ip} 吗？`}
            onConfirm={() => handleDeleteBMC(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 路由器选择区 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <Title level={4} style={{ margin: 0 }}>
            路由器管理
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddDrawerOpen(true)}
            style={{ marginLeft: 16 }}
          >
            添加 BMC
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetchBMCs()}
            style={{ marginLeft: 8 }}
          >
            刷新
          </Button>
        </div>

        {routersLoading ? (
          <Spin />
        ) : (
          <Row gutter={[12, 12]}>
            {(routers || []).map((router: Router) => (
              <Col key={router.id} xs={24} sm={12} md={8} lg={6}>
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
                  <Text strong>{router.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {router.location}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>

      {/* BMC 列表 */}
      {selectedRouterId ? (
        <Card
          title={
            <Space>
              <span>BMC 设备列表</span>
              <Tag color="blue">{selectedRouter?.name}</Tag>
              {totalCount > 0 && (
                <Space size={4} style={{ fontSize: 13, fontWeight: 400 }}>
                  <Tag color="success">在线 {onlineCount}</Tag>
                  <Tag color="default">离线 {offlineCount}</Tag>
                  <Tag color="warning">警告 {warningCount}</Tag>
                  <Tag color="error">异常 {errorCount}</Tag>
                </Space>
              )}
            </Space>
          }
          extra={
            <Space>
              <Input
                prefix={<SearchOutlined />}
                placeholder="搜索 IP"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 180 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 100 }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '在线', value: 'online' },
                  { label: '离线', value: 'offline' },
                  { label: '警告', value: 'warning' },
                  { label: '异常', value: 'error' },
                ]}
              />
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setAddDrawerOpen(true)}
              >
                添加 BMC
              </Button>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={filteredBMCs}
            rowKey="id"
            loading={bmcsLoading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            locale={{ emptyText: <Empty description="该路由器下暂无 BMC 设备" /> }}
            onRow={(record) => ({
              style: { cursor: 'pointer' },
              onDoubleClick: () => navigate(`/bmc/${record.id}`),
            })}
          />
        </Card>
      ) : (
        <Card>
          <Empty
            description={
              <span>
                请选择一个路由器以查看其 BMC 设备列表
                <br />
                <Text type="secondary">
                  或使用全局监控仪表盘查看所有设备状态
                </Text>
              </span>
            }
          >
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              前往监控仪表盘
            </Button>
          </Empty>
        </Card>
      )}

      {/* 添加 BMC 抽屉 */}
      <BMCAddForm
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
      />
    </div>
  );
}
