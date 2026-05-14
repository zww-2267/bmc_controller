import { Card, Empty } from 'antd';
import SensorValue from './SensorGauge';
import type { SensorHealthLevel } from '../types';

interface SensorItem {
  label: string;
  value: number | null;
  unit?: string;
  max?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  health?: SensorHealthLevel | null;
}

interface Props {
  title: string;
  sensors: SensorItem[];
  extra?: React.ReactNode;
}

export default function SensorGroup({ title, sensors, extra }: Props) {
  const hasData = sensors.some((s) => s.value !== null);

  return (
    <Card
      title={title}
      size="small"
      extra={extra}
      style={{ height: '100%' }}
    >
      {!hasData ? (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {sensors.map((s) => (
            <SensorValue
              key={s.label}
              label={s.label}
              value={s.value}
              unit={s.unit}
              warningThreshold={s.warningThreshold}
              criticalThreshold={s.criticalThreshold}
              health={s.health}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
