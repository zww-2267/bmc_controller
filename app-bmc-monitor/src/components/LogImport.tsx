import { useState, useCallback } from 'react';
import { Card, Upload, Table, Tag, Select, Typography, Empty, Button, Space } from 'antd';
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

const { Title, Text } = Typography;

interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
}

const mockLogs: LogEntry[] = [
  { time: '2026-05-09 10:23:01', level: 'ERROR', source: 'CPU0', message: 'Temperature critical: 94°C exceeds threshold 85°C' },
  { time: '2026-05-09 10:22:58', level: 'WARN', source: 'FAN3', message: 'Fan speed abnormal: 8500 RPM > threshold 8000 RPM' },
  { time: '2026-05-09 10:22:45', level: 'INFO', source: 'PSU1', message: 'Power output stable: 450W' },
  { time: '2026-05-09 10:21:30', level: 'ERROR', source: 'GPU5', message: 'GPU temperature high: 91°C' },
  { time: '2026-05-09 10:20:15', level: 'WARN', source: 'DIMMG0', message: 'Voltage fluctuation: 1.45V > 1.35V expected' },
  { time: '2026-05-09 10:19:00', level: 'INFO', source: 'BMC', message: 'System boot completed, uptime: 3d 5h' },
];

export default function LogImport() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const uploadProps: UploadProps = {
    accept: '.csv,.json',
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          if (file.name.endsWith('.csv')) {
            const lines = text.split('\n').filter((l) => l.trim());
            const parsed: LogEntry[] = lines.slice(1).map((line) => {
              const [time, level, source, ...msg] = line.split(',');
              return { time, level, source, message: msg.join(',').trim() };
            });
            setLogs(parsed);
          } else {
            setLogs(JSON.parse(text));
          }
        } catch {
          // parse errors ignored for mock stage
        }
      };
      reader.readAsText(file);
      return false;
    },
  };

  const filteredLogs =
    logs && levelFilter !== 'all'
      ? logs.filter((l) => l.level === levelFilter)
      : logs;

  const columns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: (l: string) => (
        <Tag color={l === 'ERROR' ? 'error' : l === 'WARN' ? 'warning' : 'default'}>{l}</Tag>
      ),
    },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '消息', dataIndex: 'message', key: 'message' },
  ];

  return (
    <Card
      title={<><FileTextOutlined /> 日志分析</>}
      extra={
        <Space>
          <Button onClick={() => setLogs(mockLogs)}>加载示例日志</Button>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>导入 CSV/JSON</Button>
          </Upload>
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            style={{ width: 100 }}
            options={[
              { label: '全部', value: 'all' },
              { label: 'ERROR', value: 'ERROR' },
              { label: 'WARN', value: 'WARN' },
              { label: 'INFO', value: 'INFO' },
            ]}
          />
        </Space>
      }
    >
      {!filteredLogs ? (
        <Empty description="点击「加载示例日志」或导入 CSV/JSON 文件" />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey={(r, i) => `${r.time}-${i}`}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      )}
    </Card>
  );
}
