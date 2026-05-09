import { useState, useMemo } from 'react';
import { Card, Select, Input, Button, Descriptions, Tag, Empty, Space, Table } from 'antd';
import { SearchOutlined, ExportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useRouterList } from '@shared/hooks/useRouterList';
import { useBMCList } from '@shared/hooks/useBMCList';
import type { BMC } from '@shared/types';

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d > 0 ? `${d}天` : '', h > 0 ? `${h}时` : '', `${m}分`].filter(Boolean).join(' ');
}

function BMCStatusTag({ status }: { status: string }) {
  const map: Record<string, { color: string; text: string }> = {
    online: { color: 'success', text: '在线' },
    offline: { color: 'default', text: '离线' },
    error: { color: 'error', text: '异常' },
  };
  const cfg = map[status] || { color: 'default', text: status };
  return <Tag color={cfg.color}>{cfg.text}</Tag>;
}

export default function BMCQuery() {
  const { data: routers } = useRouterList();
  const [selectedRouterId, setSelectedRouterId] = useState<string>();
  const [searchIp, setSearchIp] = useState('');
  const { data: bmcs, isLoading } = useBMCList(selectedRouterId ?? null);

  const filteredBMCs = useMemo(() => {
    if (!bmcs) return [];
    if (!searchIp) return bmcs;
    return bmcs.filter((b) => b.ip.includes(searchIp));
  }, [bmcs, searchIp]);

  const jumpToDetail = (bmc: BMC) => {
    window.open(
      `http://localhost:5174/?bmcId=${encodeURIComponent(bmc.id)}&routerId=${encodeURIComponent(bmc.routerId)}`,
      '_blank'
    );
  };

  const columns: ColumnsType<BMC> = [
    {
      title: 'BMC IP', dataIndex: 'ip', key: 'ip', width: 160,
      render: (ip: string) => <code>{ip}</code>,
    },
    { title: '管理员', dataIndex: 'username', key: 'username', width: 100 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => <BMCStatusTag status={status} />,
    },
    {
      title: '已运行时间', dataIndex: 'uptime', key: 'uptime', width: 120,
      render: (t: number, record: BMC) => record.status === 'online' ? formatUptime(t) : '-',
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_: unknown, record: BMC) => (
        <Button size="small" icon={<ExportOutlined />} onClick={() => jumpToDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Card title={<><SearchOutlined /> BMC 设备查询</>}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          <Select
            placeholder="选择路由器" style={{ width: 200 }}
            value={selectedRouterId} onChange={setSelectedRouterId}
            options={routers?.map((r) => ({ label: r.name, value: r.id }))}
            allowClear
          />
          <Input
            placeholder="筛选 BMC IP" style={{ width: 200 }}
            value={searchIp} onChange={(e) => setSearchIp(e.target.value)}
            disabled={!selectedRouterId}
            allowClear
          />
        </Space>

        {!selectedRouterId ? (
          <Empty description="请选择路由器以查看 BMC 设备列表" />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredBMCs}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            locale={{ emptyText: <Empty description="无匹配的 BMC 设备" /> }}
          />
        )}
      </Space>
    </Card>
  );
}
