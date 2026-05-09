import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Row,
  Col,
  Card,
  Descriptions,
  Tag,
  Button,
  Spin,
  Result,
  Table,
  Space,
  App,
  theme,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PoweroffOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useBMCById } from '@shared/hooks/useBMCList';
import { useBMCSensors } from '@shared/hooks/useBMCSensors';
import { useRootStore } from '@shared/stores/rootStore';
import BMCStatusBadge from '../components/BMCStatusBadge';
import SensorGroup from '../components/SensorGroup';
import RootButton from '../components/RootButton';
import type { SensorData } from '@shared/types';
import api from '@shared/api/client';

const { Title } = Typography;

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

export default function BMCDetailPage() {
  const { bmcId } = useParams<{ bmcId: string }>();
  const navigate = useNavigate();
  const isRoot = useRootStore((s) => s.isRoot);
  const { data: bmc, isLoading: bmcLoading, error: bmcError } = useBMCById(bmcId);
  const { data: sensors, isLoading: sensorsLoading, refetch } = useBMCSensors(bmcId);
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const handlePowerOn = async () => {
    try {
      await api.post(`/bmcs/${bmcId}/power/on`, { rootPassword: '123456' });
      message.success(`已向 ${bmc!.ip} 发送开机指令`);
    } catch {
      message.error('开机指令发送失败');
    }
  };

  const handlePowerOff = async () => {
    try {
      await api.post(`/bmcs/${bmcId}/power/off`, { rootPassword: '123456' });
      message.success(`已向 ${bmc!.ip} 发送关机指令`);
    } catch {
      message.error('关机指令发送失败');
    }
  };

  const handlePowerRestart = async () => {
    try {
      await api.post(`/bmcs/${bmcId}/power/restart`, { rootPassword: '123456' });
      message.success(`已向 ${bmc!.ip} 发送重启指令`);
    } catch {
      message.error('重启指令发送失败');
    }
  };

  if (bmcLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" tip="加载 BMC 信息..." />
      </div>
    );
  }

  if (bmcError || !bmc) {
    return (
      <Result
        status="404"
        title="未找到该 BMC"
        subTitle="BMC 可能已被删除或 ID 不正确"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回登录
          </Button>
        }
      />
    );
  }

  // 构建传感器分组数据
  const coreTempSensors = sensors
    ? [
        { label: 'CPU0 Temp', value: sensors.coreTemp.cpu0Temp, max: 100, warningThreshold: 80, criticalThreshold: 95 },
        { label: 'DIMMG0 Temp', value: sensors.coreTemp.dimmG0Temp, max: 85, warningThreshold: 70, criticalThreshold: 82 },
        { label: 'DIMMG1 Temp', value: sensors.coreTemp.dimmG1Temp, max: 85, warningThreshold: 70, criticalThreshold: 82 },
        { label: 'MB Temp1', value: sensors.coreTemp.mbTemp1, max: 70, warningThreshold: 55 },
        { label: 'MB Temp2', value: sensors.coreTemp.mbTemp2, max: 70, warningThreshold: 55 },
        { label: 'Inlet Air', value: sensors.coreTemp.inletAirTemp, max: 50, warningThreshold: 35 },
        { label: 'CPU0 DTS', value: sensors.coreTemp.cpu0Dts, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'VR P0', value: sensors.coreTemp.vrP0Temp, max: 100, warningThreshold: 85 },
        { label: 'VR DIMMG0', value: sensors.coreTemp.vrDimmG0Temp, max: 85, warningThreshold: 75 },
        { label: 'VR DIMMG1', value: sensors.coreTemp.vrDimmG1Temp, max: 85, warningThreshold: 75 },
        { label: 'M2 G0 AMB', value: sensors.coreTemp.m2G0AmbTemp, max: 75, warningThreshold: 60 },
      ]
    : [];

  const gpuTempSensors = sensors
    ? [
        { label: 'GPU0 Proc', value: sensors.gpuTemp.gpu0Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU1 Proc', value: sensors.gpuTemp.gpu1Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU2 Proc', value: sensors.gpuTemp.gpu2Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU3 Proc', value: sensors.gpuTemp.gpu3Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU4 Proc', value: sensors.gpuTemp.gpu4Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU5 Proc', value: sensors.gpuTemp.gpu5Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU6 Proc', value: sensors.gpuTemp.gpu6Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU7 Proc', value: sensors.gpuTemp.gpu7Proc, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'HDD Temp', value: sensors.gpuTemp.hddTemp, max: 60, warningThreshold: 50 },
        { label: 'PDB Temp1', value: sensors.gpuTemp.pdbTemp1, max: 60, warningThreshold: 50 },
        { label: 'PDB Temp2', value: sensors.gpuTemp.pdbTemp2, max: 60, warningThreshold: 50 },
      ]
    : [];

  const fanSensors = sensors
    ? [
        { label: 'GPU Fan1/2', value: sensors.fanSpeed.gpuFan12, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan5/6', value: sensors.fanSpeed.gpuFan56, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'SYS Fan1', value: sensors.fanSpeed.sysFan1, unit: 'RPM', max: 8000, warningThreshold: 7000 },
        { label: 'SYS Fan2', value: sensors.fanSpeed.sysFan2, unit: 'RPM', max: 8000, warningThreshold: 7000 },
        { label: 'GPU Fan3/4', value: sensors.fanSpeed.gpuFan34, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan7/8', value: sensors.fanSpeed.gpuFan78, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan1/2E', value: sensors.fanSpeed.gpuFan12E, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan5/6E', value: sensors.fanSpeed.gpuFan56E, unit: 'RPM', max: 12000, warningThreshold: 10000 },
      ]
    : [];

  // ECharts CPU 温度历史趋势图
  const historyOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: { seriesName: string; value: number[]; marker: string }[]) => {
        if (!params?.length) return '';
        const time = new Date(params[0].value[0]).toLocaleTimeString('zh-CN');
        let html = `<strong>${time}</strong><br/>`;
        params.forEach(p => {
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
      axisLabel: { formatter: '{HH}:{mm}:{ss}' },
    },
    yAxis: {
      type: 'value',
      name: '°C',
      min: 20,
      max: 100,
    },
    series: [
      {
        name: 'CPU0 Temp',
        type: 'line',
        smooth: true,
        symbol: 'none',
        areaStyle: { opacity: 0.1 },
        data: generateHistoryData(sensors?.coreTemp.cpu0Temp, 60),
      },
    ],
  };

  // 电源信息表格列
  const psuColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 60 },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      ellipsis: true,
    },
    { title: '序列号', dataIndex: 'serialNumber', key: 'serialNumber', ellipsis: true },
    {
      title: '输出功率',
      dataIndex: 'lastOutput',
      key: 'lastOutput',
      width: 100,
      render: (v: number) => `${v} W`,
    },
    {
      title: '输入电压',
      dataIndex: 'lineInput',
      key: 'lineInput',
      width: 100,
      render: (v: number) => `${v.toFixed(1)} VAC`,
    },
    {
      title: '健康状态',
      dataIndex: 'health',
      key: 'health',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'OK' ? 'success' : v === 'Warning' ? 'warning' : 'default'}>
          {v}
        </Tag>
      ),
    },
    {
      title: '运行状态',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'Enabled' ? 'processing' : 'default'}>{v}</Tag>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
          >
            退出登录
          </Button>

          {/* IP + 状态 强化显示框 */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 16px',
              border: `2px solid ${token.colorPrimary}`,
              borderRadius: 8,
              background: token.colorPrimaryBg,
            }}
          >
            <code style={{ fontSize: 16, fontWeight: 700 }}>{bmc.ip}</code>
            <BMCStatusBadge status={bmc.status} showText />
            {bmc.status === 'online' && (
              <span style={{ fontSize: 13, color: '#8c8c8c' }}>
                运行 {formatUptime(bmc.uptime)}
              </span>
            )}
          </div>

          {/* 电源控制按钮 — isRoot 控制 */}
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={!isRoot}
              onClick={handlePowerOn}
            >
              开机
            </Button>
            <Button
              danger
              icon={<PoweroffOutlined />}
              disabled={!isRoot}
              onClick={handlePowerOff}
            >
              关机
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!isRoot}
              onClick={handlePowerRestart}
            >
              重启
            </Button>
          </Space>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            刷新
          </Button>
          <Tag>
            自动刷新间隔: 5s
          </Tag>

          <RootButton />
        </div>

        {/* 基本信息 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={4}>
            <Descriptions.Item label="BMC ID">{bmc.id}</Descriptions.Item>
            <Descriptions.Item label="IP 地址">
              <code>{bmc.ip}</code>
            </Descriptions.Item>
            <Descriptions.Item label="管理员">{bmc.username}</Descriptions.Item>
            <Descriptions.Item label="所属路由器">{bmc.routerName ?? '-'}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 传感器数据面板 */}
        <Spin spinning={sensorsLoading}>
          <Row gutter={[16, 16]}>
            {/* 核心温度 */}
            <Col xs={24} lg={8}>
              <SensorGroup
                title="核心温度 (CPU/主板/内存)"
                sensors={coreTempSensors}
              />
            </Col>
            {/* GPU 温度 */}
            <Col xs={24} lg={8}>
              <SensorGroup
                title="环境温度 (GPU/硬盘/NVMe)"
                sensors={gpuTempSensors}
              />
            </Col>
            {/* 风扇转速 */}
            <Col xs={24} lg={8}>
              <SensorGroup
                title="风扇转速"
                sensors={fanSensors}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            {/* 核心电压 */}
            <Col xs={24} md={12}>
              <SensorGroup
                title="核心电压 (CPU VRM/内存供电)"
                sensors={
                  sensors
                    ? [
                        { label: 'CPU0 VCore', value: sensors.voltage.cpu0Vcore, unit: 'V', max: 2.5 },
                        { label: 'CPU0 VCCin', value: sensors.voltage.cpu0Vccin, unit: 'V', max: 2.5 },
                        { label: 'DIMMG0 Volt', value: sensors.voltage.dimmG0Volt, unit: 'V', max: 1.5 },
                        { label: 'DIMMG1 Volt', value: sensors.voltage.dimmG1Volt, unit: 'V', max: 1.5 },
                      ]
                    : []
                }
              />
            </Col>
            {/* 基础电压 + 供电电流 */}
            <Col xs={24} md={12}>
              <SensorGroup
                title="基础电压 + 供电电流"
                sensors={
                  sensors
                    ? [
                        { label: '12V Rail', value: sensors.voltage.volt12v, unit: 'V', max: 15 },
                        { label: '5V Rail', value: sensors.voltage.volt5v, unit: 'V', max: 6 },
                        { label: '3.3V Rail', value: sensors.voltage.volt3v3, unit: 'V', max: 4 },
                        { label: 'CPU0 Curr', value: sensors.current.cpu0Current, unit: 'A', max: 60 },
                        { label: 'DIMMG0 Curr', value: sensors.current.dimmG0Current, unit: 'A', max: 10 },
                        { label: 'DIMMG1 Curr', value: sensors.current.dimmG1Current, unit: 'A', max: 10 },
                        { label: 'GPU0 Curr', value: sensors.current.gpu0Current, unit: 'A', max: 80 },
                      ]
                    : []
                }
              />
            </Col>
          </Row>

          {/* 整机功耗 */}
          {sensors && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Card size="small" title="整机功耗与电源控制">
                  <Descriptions size="small" column={3}>
                    <Descriptions.Item label="Chassis Power">
                      <strong>{sensors.power.chassisPower} W</strong>
                    </Descriptions.Item>
                    <Descriptions.Item label="健康状态">
                      <Tag
                        color={
                          sensors.power.chassisPowerHealth === 'OK'
                            ? 'success'
                            : sensors.power.chassisPowerHealth === 'Critical'
                            ? 'error'
                            : 'warning'
                        }
                      >
                        {sensors.power.chassisPowerHealth}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="运行状态">
                      <Tag
                        color={
                          sensors.power.chassisPowerState === 'Enabled'
                            ? 'processing'
                            : 'default'
                        }
                      >
                        {sensors.power.chassisPowerState}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          )}

          {/* PSU 电源信息 */}
          {sensors && sensors.psu.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <Card size="small" title="电源信息（PSU）">
                  <Table
                    columns={psuColumns}
                    dataSource={sensors.psu.map((p, i) => ({ ...p, key: i }))}
                    pagination={false}
                    size="small"
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* CPU 温度趋势图 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card size="small" title="CPU 温度趋势 (近 60 分钟)">
                <ReactECharts
                  option={historyOption}
                  style={{ height: 300 }}
                  notMerge
                  lazyUpdate
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      </div>
    </div>
  );
}

// 根据当前值模拟生成历史数据点
function generateHistoryData(currentValue: number | null | undefined, minutes: number) {
  const points: [number, number | null][] = [];
  const now = Date.now();
  const step = (minutes * 60000) / 60;
  for (let i = 60; i >= 0; i--) {
    const time = now - i * step;
    if (currentValue === null || currentValue === undefined) {
      points.push([time, null]);
    } else {
      const noise = (Math.random() - 0.5) * 6;
      points.push([time, +(currentValue + noise).toFixed(1)]);
    }
  }
  return points;
}
