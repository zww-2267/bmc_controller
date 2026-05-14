import { useState, useMemo, useCallback } from 'react';
import { Card, Table, Button, Space, Input, Select, Empty, Spin, Popconfirm, Tag, Typography, App, theme } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRouterList } from '@shared/hooks/useRouterList';
import { useBMCList, useDeleteBMC } from '@shared/hooks/useBMCList';
import { useRootStore } from '@shared/stores/rootStore';
import BMCStatusBadge from '@shared/components/BMCStatusBadge';
import BMCAddForm from '../components/BMCAddForm';
import type { BMC, Router } from '@shared/types';
import TopBar from '../components/TopBar';

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

  const selectedRouter = useMemo(
    () => routers?.find((r) => r.id === selectedRouterId) || null,
    [routers, selectedRouterId]
  );

  const filteredBMCs = useMemo(() => {
    if (!bmcs) return [];
    let list = bmcs;
    if (searchText) list = list.filter((b) => b.ip.includes(searchText));
    if (statusFilter !== 'all') list = list.filter((b) => b.status === statusFilter);
    return list;
  }, [bmcs, searchText, statusFilter]);

  const handleDeleteBMC = useCallback(
    async (id: string) => {
      try {
        await deleteBMC.mutateAsync(id);
        message.success('BMC 已删除');
      } catch {
        message.error('删除失败');
      }
    },
    [deleteBMC, message]
  );

  const onlineCount = bmcs?.filter((b) => b.status === 'online').length ?? 0;
  const offlineCount = bmcs?.filter((b) => b.status === 'offline').length ?? 0;
  const warningCount = bmcs?.filter((b) => b.status === 'warning').length ?? 0;
  const errorCount = bmcs?.filter((b) => b.status === 'error').length ?? 0;
  const totalCount = bmcs?.length ?? 0;

  const columns: ColumnsType<BMC> = [
    {
      title: 'BMC IP', dataIndex: 'ip', key: 'ip',
      sorter: (a, b) => a.ip.localeCompare(b.ip),
      render: (ip: string) => <code style={{ fontFamily: 'monospace' }}>{ip}</code>,
    },
    { title: '管理员', dataIndex: 'username', key: 'username', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 280,
      sorter: (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(),
      render: (_: unknown, record: BMC) => <BMCStatusBadge status={record.status} lastSeen={record.lastSeen} />,
    },
    {
      title: '已运行时间', dataIndex: 'uptime', key: 'uptime', width: 140,
      sorter: (a, b) => a.uptime - b.uptime,
      render: (t: number, record: BMC) => (record.status === 'online' || record.status === 'warning') ? formatUptime(t) : '-',
    },
    {
      title: '操作', key: 'actions', width: 80,
      render: (_: unknown, record: BMC) => (
        <Popconfirm
          title="确认删除"
          description={`确定要删除 BMC ${record.ip} 吗？`}
          onConfirm={() => handleDeleteBMC(record.id)}
          okText="删除" cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="link" size="small" danger disabled={!isRoot} icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: router sidebar */}
        <div style={{
          width: 200, borderRight: `1px solid ${token.colorBorderSecondary}`,
          padding: 12, overflow: 'auto', flexShrink: 0,
        }}>
          <Text strong style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, display: 'block' }}>路由器列表</Text>
          {routersLoading ? <Spin /> : (routers || []).map((r: Router) => (
            <div key={r.id} onClick={() => setSelectedRouterId(r.id)} style={{
              padding: '8px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: selectedRouterId === r.id ? '#e6f4ff' : 'transparent',
              border: selectedRouterId === r.id ? '1px solid #1677ff' : '1px solid transparent',
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
              <br /><Text style={{ fontSize: 11, color: '#8c8c8c' }}>{r.location}</Text>
            </div>
          ))}
        </div>

        {/* Right: BMC table */}
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
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
                  <Input prefix={<SearchOutlined />} placeholder="搜索 IP" value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} style={{ width: 180 }} allowClear />
                  <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 100 }}
                    options={[
                      { label: '全部', value: 'all' }, { label: '在线', value: 'online' },
                      { label: '离线', value: 'offline' }, { label: '警告', value: 'warning' }, { label: '异常', value: 'error' },
                    ]} />
                  <Button type="primary" icon={<PlusOutlined />} disabled={!isRoot}
                    onClick={() => setAddDrawerOpen(true)}>添加 BMC</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => refetchBMCs()}>刷新</Button>
                </Space>
              }
            >
              <Table columns={columns} dataSource={filteredBMCs} rowKey="id" loading={bmcsLoading}
                pagination={{
                  pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                }}
                locale={{ emptyText: <Empty description="该路由器下暂无 BMC 设备" /> }}
              />
            </Card>
          ) : (
            <Card><Empty description="请选择一个路由器以查看其 BMC 设备列表" /></Card>
          )}
        </div>
      </div>
      <BMCAddForm open={addDrawerOpen} onClose={() => setAddDrawerOpen(false)} />
    </div>
  );
}
