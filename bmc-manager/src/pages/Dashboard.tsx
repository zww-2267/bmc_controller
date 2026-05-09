import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Typography,
  Alert,
  Button,
  Space,
  Select,
  Empty,
  Spin,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useSensorSummary, useCpuTempTrend } from '../hooks/useSensorSummary';
import { useRouterList } from '../hooks/useRouterList';
import BMCStatusBadge from '../components/BMCStatusBadge';
import type { SensorSummary } from '../types';

const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: summaries, isLoading: summaryLoading } = useSensorSummary();
  const { data: routers } = useRouterList();
  const [trendRouterFilter, setTrendRouterFilter] = useState<string>('all');

  // 获取所有在线 BMC 用于温度趋势
  const onlineBMCIds = useMemo(() => {
    if (!summaries) return [];
    const online = summaries.filter((s) => s.status === 'online' && s.cpu0Temp !== null);
    // 取前 10 台作为趋势图展示
    return online.slice(0, 10).map((s) => s.bmcId);
  }, [summaries]);

  const { data: cpuTrends } = useCpuTempTrend(onlineBMCIds);

  // 筛选后的趋势数据
  const filteredTrends = useMemo(() => {
    if (!cpuTrends) return [];
    if (trendRouterFilter === 'all') return cpuTrends;
    return cpuTrends.filter((t) => {
      const s = summaries?.find((sm) => sm.bmcId === t.bmcId);
      return s?.routerName === trendRouterFilter;
    });
  }, [cpuTrends, trendRouterFilter, summaries]);

  // 统计
  const stats = useMemo(() => {
    if (!summaries) return { total: 0, online: 0, offline: 0, error: 0, anomalous: 0 };
    return {
      total: summaries.length,
      online: summaries.filter((s) => s.status === 'online').length,
      offline: summaries.filter((s) => s.status === 'offline').length,
      error: summaries.filter((s) => s.status === 'error').length,
      anomalous: summaries.filter(
        (s) => s.hasError || (s.status === 'online' && s.cpu0Temp !== null && s.cpu0Temp > 85)
      ).length,
    };
  }, [summaries]);

  // 异常 BMC 列表
  const anomalousBMCs = useMemo(() => {
    if (!summaries) return [];
    return summaries
      .filter(
        (s) =>
          s.hasError ||
          s.status === 'error' ||
          (s.status === 'online' && s.cpu0Temp !== null && s.cpu0Temp > 80)
      )
      .slice(0, 20);
  }, [summaries]);

  // ECharts CPU 温度趋势
  const trendOption = useMemo(() => {
    if (!filteredTrends || filteredTrends.length === 0) return {};
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: { seriesName: string; value: number[]; marker: string }[]) => {
          if (!params?.length) return '';
          const time = new Date(params[0].value[0]).toLocaleTimeString('zh-CN');
          let html = `<strong>${time}</strong><br/>`;
          params.forEach((p) => {
            html += `${p.marker} ${p.seriesName}: ${p.value[1]?.toFixed(1) ?? 'N/A'} °C<br/>`;
          });
          return html;
        },
      },
      legend: {
        top: 5,
        type: 'scroll' as const,
      },
      grid: { top: 50, right: 20, bottom: 30, left: 50 },
      xAxis: {
        type: 'time',
        axisLabel: { formatter: '{HH}:{mm}' },
      },
      yAxis: {
        type: 'value',
        name: '°C',
        min: 20,
        max: 100,
      },
      series: filteredTrends.map((t, i) => ({
        name: t.bmcIp,
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: t.points.map((p) => [new Date(p.time).getTime(), p.value] as [number, number | null]),
        areaStyle: { opacity: 0.05 },
        lineStyle: {
          width: 1.5,
          color: [
            '#1677ff', '#52c41a', '#faad14', '#ff4d4f',
            '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16',
            '#2f54eb', '#a0d911',
          ][i % 10],
        },
      })),
    };
  }, [filteredTrends]);

  // 异常列表表格列
  const anomalyColumns = [
    {
      title: 'BMC IP',
      dataIndex: 'bmcIp',
      key: 'bmcIp',
      render: (ip: string, record: SensorSummary) => (
        <Button type="link" onClick={() => navigate(`/bmc/${record.bmcId}`)} style={{ padding: 0, fontFamily: 'monospace' }}>
          {ip}
        </Button>
      ),
    },
    {
      title: '所属路由器',
      dataIndex: 'routerName',
      key: 'routerName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (_: unknown, record: SensorSummary) => <BMCStatusBadge status={record.status} />,
    },
    {
      title: 'CPU 温度',
      dataIndex: 'cpu0Temp',
      key: 'cpu0Temp',
      width: 100,
      render: (v: number | null) =>
        v !== null ? (
          <Tag color={v > 85 ? 'error' : v > 75 ? 'warning' : 'success'}>{v} °C</Tag>
        ) : (
          <Tag color="default">N/A</Tag>
        ),
    },
    {
      title: '功耗',
      dataIndex: 'chassisPower',
      key: 'chassisPower',
      width: 80,
      render: (v: number) => `${v} W`,
    },
    {
      title: '异常标记',
      dataIndex: 'hasError',
      key: 'hasError',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="error">异常</Tag> : <Tag color="success">正常</Tag>,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <AlertOutlined style={{ marginRight: 8 }} />
        全局监控仪表盘
      </Title>

      {/* 告警横幅 */}
      {anomalousBMCs.length > 0 && (
        <Alert
          message={`发现 ${anomalousBMCs.length} 台 BMC 处于异常状态`}
          description="请检查下方异常 BMC 列表并及时处理，防止影响服务运行。"
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" danger onClick={() => {
              const el = document.getElementById('anomaly-table');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}>
              查看详情
            </Button>
          }
        />
      )}

      {/* 统计卡片 */}
      <Spin spinning={summaryLoading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="BMC 总数"
                value={stats.total}
                prefix={<CloudServerOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="在线"
                value={stats.online}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
                suffix={stats.total > 0 ? `(${((stats.online / stats.total) * 100).toFixed(0)}%)` : ''}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="离线"
                value={stats.offline}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#d9d9d9' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="异常"
                value={stats.error}
                prefix={<WarningOutlined />}
                valueStyle={{ color: stats.error > 0 ? '#ff4d4f' : '#52c41a' }}
                suffix={stats.anomalous > 0 ? `(含告警 ${stats.anomalous})` : ''}
              />
            </Card>
          </Col>
        </Row>

        {/* CPU 温度趋势图 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title="CPU 温度趋势 (在线 BMC Top 10)"
              extra={
                <Space>
                  <Select
                    value={trendRouterFilter}
                    onChange={setTrendRouterFilter}
                    style={{ width: 180 }}
                    options={[
                      { label: '全部路由器', value: 'all' },
                      ...(routers?.map((r) => ({ label: r.name, value: r.name })) || []),
                    ]}
                  />
                </Space>
              }
            >
              {filteredTrends.length > 0 ? (
                <ReactECharts option={trendOption} style={{ height: 350 }} notMerge lazyUpdate />
              ) : (
                <Empty description="暂无在线 BMC 温度数据" />
              )}
            </Card>
          </Col>
        </Row>

        {/* 异常 BMC 列表 */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              title="异常 BMC 列表"
              id="anomaly-table"
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {anomalousBMCs.length > 0
                    ? `显示 ${anomalousBMCs.length} 台异常设备`
                    : '当前无异常设备'}
                </Text>
              }
            >
              <Table
                columns={anomalyColumns}
                dataSource={anomalousBMCs}
                rowKey="bmcId"
                pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                locale={{ emptyText: <Empty description="暂无异常 BMC" /> }}
                onRow={(record) => ({
                  style: { cursor: 'pointer' },
                  onDoubleClick: () => navigate(`/bmc/${record.bmcId}`),
                })}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
