import { useParams, useNavigate } from 'react-router-dom';
import {
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
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PoweroffOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useBMCById } from '../hooks/useBMCList';
import { useBMCSensors } from '../hooks/useBMCSensors';
import BMCStatusBadge from '@shared/components/BMCStatusBadge';
import SensorGroup from '../components/SensorGroup';

export default function BMCDetail() {
  const { bmcId } = useParams<{ bmcId: string }>();
  const navigate = useNavigate();
  const { data: bmc, isLoading: bmcLoading, error: bmcError } = useBMCById(bmcId);
  const { data: sensors, isLoading: sensorsLoading, refetch } = useBMCSensors(bmcId);
  const { message } = App.useApp();

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
            返回路由器管理
          </Button>
        }
      />
    );
  }

  // 构建传感器分组数据
  const coreTempSensors = sensors
    ? [
        { label: 'CPU0 Temp', value: sensors.coreTemp.cpu0Temp.value, health: sensors.coreTemp.cpu0Temp.health, max: 100, warningThreshold: 80, criticalThreshold: 95 },
        { label: 'DIMMG0 Temp', value: sensors.coreTemp.dimmG0Temp.value, health: sensors.coreTemp.dimmG0Temp.health, max: 85, warningThreshold: 70, criticalThreshold: 82 },
        { label: 'DIMMG1 Temp', value: sensors.coreTemp.dimmG1Temp.value, health: sensors.coreTemp.dimmG1Temp.health, max: 85, warningThreshold: 70, criticalThreshold: 82 },
        { label: 'MB Temp1', value: sensors.coreTemp.mbTemp1.value, health: sensors.coreTemp.mbTemp1.health, max: 70, warningThreshold: 55 },
        { label: 'MB Temp2', value: sensors.coreTemp.mbTemp2.value, health: sensors.coreTemp.mbTemp2.health, max: 70, warningThreshold: 55 },
        { label: 'Inlet Air', value: sensors.coreTemp.inletAirTemp.value, health: sensors.coreTemp.inletAirTemp.health, max: 50, warningThreshold: 35 },
        { label: 'CPU0 DTS', value: sensors.coreTemp.cpu0Dts.value, health: sensors.coreTemp.cpu0Dts.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'VR P0', value: sensors.coreTemp.vrP0Temp.value, health: sensors.coreTemp.vrP0Temp.health, max: 100, warningThreshold: 85 },
        { label: 'VR DIMMG0', value: sensors.coreTemp.vrDimmG0Temp.value, health: sensors.coreTemp.vrDimmG0Temp.health, max: 85, warningThreshold: 75 },
        { label: 'VR DIMMG1', value: sensors.coreTemp.vrDimmG1Temp.value, health: sensors.coreTemp.vrDimmG1Temp.health, max: 85, warningThreshold: 75 },
        { label: 'M2 G0 AMB', value: sensors.coreTemp.m2G0AmbTemp.value, health: sensors.coreTemp.m2G0AmbTemp.health, max: 75, warningThreshold: 60 },
      ]
    : [];

  const gpuTempSensors = sensors
    ? [
        { label: 'GPU0 Proc', value: sensors.gpuTemp.gpu0Proc.value, health: sensors.gpuTemp.gpu0Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU1 Proc', value: sensors.gpuTemp.gpu1Proc.value, health: sensors.gpuTemp.gpu1Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU2 Proc', value: sensors.gpuTemp.gpu2Proc.value, health: sensors.gpuTemp.gpu2Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU3 Proc', value: sensors.gpuTemp.gpu3Proc.value, health: sensors.gpuTemp.gpu3Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU4 Proc', value: sensors.gpuTemp.gpu4Proc.value, health: sensors.gpuTemp.gpu4Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU5 Proc', value: sensors.gpuTemp.gpu5Proc.value, health: sensors.gpuTemp.gpu5Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU6 Proc', value: sensors.gpuTemp.gpu6Proc.value, health: sensors.gpuTemp.gpu6Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'GPU7 Proc', value: sensors.gpuTemp.gpu7Proc.value, health: sensors.gpuTemp.gpu7Proc.health, max: 100, warningThreshold: 85, criticalThreshold: 95 },
        { label: 'HDD Temp', value: sensors.gpuTemp.hddTemp.value, health: sensors.gpuTemp.hddTemp.health, max: 60, warningThreshold: 50 },
        { label: 'PDB Temp1', value: sensors.gpuTemp.pdbTemp1.value, health: sensors.gpuTemp.pdbTemp1.health, max: 60, warningThreshold: 50 },
        { label: 'PDB Temp2', value: sensors.gpuTemp.pdbTemp2.value, health: sensors.gpuTemp.pdbTemp2.health, max: 60, warningThreshold: 50 },
      ]
    : [];

  const fanSensors = sensors
    ? [
        { label: 'GPU Fan1/2', value: sensors.fanSpeed.gpuFan12.value, health: sensors.fanSpeed.gpuFan12.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan5/6', value: sensors.fanSpeed.gpuFan56.value, health: sensors.fanSpeed.gpuFan56.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'SYS Fan1', value: sensors.fanSpeed.sysFan1.value, health: sensors.fanSpeed.sysFan1.health, unit: 'RPM', max: 8000, warningThreshold: 7000 },
        { label: 'SYS Fan2', value: sensors.fanSpeed.sysFan2.value, health: sensors.fanSpeed.sysFan2.health, unit: 'RPM', max: 8000, warningThreshold: 7000 },
        { label: 'GPU Fan3/4', value: sensors.fanSpeed.gpuFan34.value, health: sensors.fanSpeed.gpuFan34.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan7/8', value: sensors.fanSpeed.gpuFan78.value, health: sensors.fanSpeed.gpuFan78.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan1/2E', value: sensors.fanSpeed.gpuFan12E.value, health: sensors.fanSpeed.gpuFan12E.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
        { label: 'GPU Fan5/6E', value: sensors.fanSpeed.gpuFan56E.value, health: sensors.fanSpeed.gpuFan56E.health, unit: 'RPM', max: 12000, warningThreshold: 10000 },
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
        data: generateHistoryData(sensors?.coreTemp.cpu0Temp.value, 60),
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
      width: 90,
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
      width: 90,
      render: (v: string) => (
        <Tag color={v === 'Enabled' ? 'processing' : 'default'}>{v}</Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/routers', { state: { routerId: bmc?.routerId } })}
        >
          返回
        </Button>

        {/* IP + 状态 强化显示框 */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 16px',
            border: '2px solid #1677ff',
            borderRadius: 8,
            background: '#f6f9ff',
          }}
        >
          <code style={{ fontSize: 16, fontWeight: 700 }}>{bmc.ip}</code>
          <BMCStatusBadge status={bmc.status} showText />
        </div>

        {/* 电源控制按钮 */}
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => message.success(`已向 ${bmc.ip} 发送开机指令`)}
          >
            开机
          </Button>
          <Button
            danger
            icon={<PoweroffOutlined />}
            onClick={() => message.success(`已向 ${bmc.ip} 发送关机指令`)}
          >
            关机
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
                      { label: 'CPU0 VCore', value: sensors.voltage.cpu0Vcore.value, health: sensors.voltage.cpu0Vcore.health, unit: 'V', max: 2.5 },
                      { label: 'CPU0 VCCin', value: sensors.voltage.cpu0Vccin.value, health: sensors.voltage.cpu0Vccin.health, unit: 'V', max: 2.5 },
                      { label: 'DIMMG0 Volt', value: sensors.voltage.dimmG0Volt.value, health: sensors.voltage.dimmG0Volt.health, unit: 'V', max: 1.5 },
                      { label: 'DIMMG1 Volt', value: sensors.voltage.dimmG1Volt.value, health: sensors.voltage.dimmG1Volt.health, unit: 'V', max: 1.5 },
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
                      { label: '12V Rail', value: sensors.voltage.volt12v.value, health: sensors.voltage.volt12v.health, unit: 'V', max: 15 },
                      { label: '5V Rail', value: sensors.voltage.volt5v.value, health: sensors.voltage.volt5v.health, unit: 'V', max: 6 },
                      { label: '3.3V Rail', value: sensors.voltage.volt3v3.value, health: sensors.voltage.volt3v3.health, unit: 'V', max: 4 },
                      { label: 'CPU0 Curr', value: sensors.current.cpu0Current.value, health: sensors.current.cpu0Current.health, unit: 'A', max: 60 },
                      { label: 'DIMMG0 Curr', value: sensors.current.dimmG0Current.value, health: sensors.current.dimmG0Current.health, unit: 'A', max: 10 },
                      { label: 'DIMMG1 Curr', value: sensors.current.dimmG1Current.value, health: sensors.current.dimmG1Current.health, unit: 'A', max: 10 },
                      { label: 'GPU0 Curr', value: sensors.current.gpu0Current.value, health: sensors.current.gpu0Current.health, unit: 'A', max: 80 },
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
