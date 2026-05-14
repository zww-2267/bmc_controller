import { useMemo } from 'react';
import { Card, Table, Tag, Typography, Spin, Empty } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useSensorSummary } from '@shared/hooks/useSensorSummary';
import type { SensorSummary } from '@shared/types';

const { Title } = Typography;

interface AnomalyItem {
  bmcId: string;
  bmcIp: string;
  routerName: string;
  severity: 'critical' | 'warning';
  reasons: string[];
  timestamp: string;
}

function analyzeAnomaly(s: SensorSummary): AnomalyItem | null {
  if (s.health.level === 'normal' && s.status !== 'error') return null;

  const reasons: string[] = [...s.health.reasons];
  let severity: 'critical' | 'warning' = 'warning';

  if (s.health.level === 'critical') severity = 'critical';
  if (s.status === 'error') {
    reasons.push('BMC 连接异常');
    severity = 'critical';
  }
  if (reasons.length === 0) {
    reasons.push('传感器数据异常');
  }

  return {
    bmcId: s.bmcId,
    bmcIp: s.bmcIp,
    routerName: s.routerName,
    severity,
    reasons,
    timestamp: s.timestamp,
  };
}

export default function AnomalyPanel() {
  const { data: summaries, isLoading } = useSensorSummary();
  const anomalies = useMemo(() => {
    if (!summaries) return [];
    return summaries
      .map(analyzeAnomaly)
      .filter(Boolean)
      .sort((a, b) => (a!.severity === 'critical' ? -1 : 1)) as AnomalyItem[];
  }, [summaries]);

  const columns = [
    {
      title: 'BMC IP', dataIndex: 'bmcIp', key: 'bmcIp', width: 150,
      render: (ip: string) => <code>{ip}</code>,
    },
    { title: '路由器', dataIndex: 'routerName', key: 'routerName', width: 120 },
    {
      title: '严重度', dataIndex: 'severity', key: 'severity', width: 80,
      render: (s: string) => (
        <Tag color={s === 'critical' ? 'error' : 'warning'}>
          {s === 'critical' ? '严重' : '警告'}
        </Tag>
      ),
    },
    {
      title: '异常原因', dataIndex: 'reasons', key: 'reasons',
      render: (reasons: string[]) =>
        reasons.map((r, i) => <div key={i} style={{ fontSize: 12, marginBottom: 2 }}>{r}</div>),
    },
    {
      title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  return (
    <Card title={<><WarningOutlined style={{ color: '#ff4d4f' }} /> 异常 BMC 分析</>}>
      {isLoading ? (
        <Spin />
      ) : anomalies.length === 0 ? (
        <Empty description="当前无异常设备" />
      ) : (
        <Table
          columns={columns} dataSource={anomalies} rowKey="bmcId"
          pagination={{ pageSize: 15 }} size="small"
        />
      )}
    </Card>
  );
}
