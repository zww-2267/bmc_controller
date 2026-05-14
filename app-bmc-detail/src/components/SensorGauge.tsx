import type { SensorHealthLevel } from '@shared/types';

interface Props {
  label: string;
  value: number | null;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  health?: SensorHealthLevel | null;
}

export default function SensorValue({
  label,
  value,
  unit = '°C',
  warningThreshold = 80,
  criticalThreshold = 95,
  health,
}: Props) {
  const healthColor =
    health === 'Critical' ? '#ff4d4f' :
    health === 'Warning' ? '#faad14' :
    health === 'OK' ? '#52c41a' :
    undefined;

  const color =
    value === null
      ? '#d9d9d9'
      : value >= criticalThreshold
        ? '#ff4d4f'
        : value >= warningThreshold
          ? '#faad14'
          : '#52c41a';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <span style={{ fontSize: 12, color: '#8c8c8c', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {healthColor && (
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: healthColor,
          }} />
        )}
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color,
          fontFamily: 'monospace',
        }}
      >
        {value !== null ? value : 'N/A'}
        {value !== null && (
          <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 1 }}>
            {' '}{unit}
          </span>
        )}
      </span>
    </div>
  );
}
