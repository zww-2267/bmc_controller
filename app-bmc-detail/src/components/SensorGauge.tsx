interface Props {
  label: string;
  value: number | null;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export default function SensorValue({
  label,
  value,
  unit = '°C',
  warningThreshold = 80,
  criticalThreshold = 95,
}: Props) {
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
      <span style={{ fontSize: 12, color: '#8c8c8c' }}>{label}</span>
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
