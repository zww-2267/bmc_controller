import { useState, useMemo } from 'react';
import { Card, Select, Input, Button, Descriptions, Tag, Empty, Space } from 'antd';
import { SearchOutlined, ExportOutlined } from '@ant-design/icons';
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
  const { data: bmcs } = useBMCList(selectedRouterId ?? null);

  const filteredBMCs = useMemo(() => {
    if (!bmcs || !searchIp) return [];
    return bmcs.filter((b) => b.ip.includes(searchIp));
  }, [bmcs, searchIp]);

  const selectedBMC = filteredBMCs.length === 1 ? filteredBMCs[0] : null;

  const jumpToDetail = (bmc: BMC) => {
    window.open(
      `http://localhost:5174/?bmcId=${encodeURIComponent(bmc.id)}&routerId=${encodeURIComponent(bmc.routerId)}`,
      '_blank'
    );
  };

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
            placeholder="输入 BMC IP" style={{ width: 200 }}
            value={searchIp} onChange={(e) => setSearchIp(e.target.value)}
          />
        </Space>

        {filteredBMCs.length > 1 && (
          <div>
            {filteredBMCs.map((b) => (
              <Card key={b.id} size="small" style={{ marginBottom: 8 }}>
                <Space>
                  <code>{b.ip}</code>
                  <BMCStatusTag status={b.status} />
                  <Button size="small" icon={<ExportOutlined />} onClick={() => jumpToDetail(b)}>
                    查看详情
                  </Button>
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
              <Descriptions.Item label="状态">
                <BMCStatusTag status={selectedBMC.status} />
              </Descriptions.Item>
              <Descriptions.Item label="已运行时间">
                {selectedBMC.status === 'online' ? formatUptime(selectedBMC.uptime) : '-'}
              </Descriptions.Item>
            </Descriptions>
            <Button
              type="primary" icon={<ExportOutlined />} style={{ marginTop: 12 }}
              onClick={() => jumpToDetail(selectedBMC)}
            >
              跳转到 BMC 详情
            </Button>
          </Card>
        )}

        {!selectedRouterId && !searchIp && (
          <Empty description="选择路由器并输入 IP 搜索 BMC 设备" />
        )}
      </Space>
    </Card>
  );
}
