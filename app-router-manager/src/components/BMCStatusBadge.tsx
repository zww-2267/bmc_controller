import { Badge } from 'antd';
import type { BMCStatus } from '@shared/types';

const statusConfig: Record<BMCStatus, { color: string; text: string }> = {
  online: { color: '#52c41a', text: '在线' },
  offline: { color: '#d9d9d9', text: '离线' },
  error: { color: '#ff4d4f', text: '异常' },
};

interface Props {
  status: BMCStatus;
  lastSeen?: string;
  showText?: boolean;
}

export default function BMCStatusBadge({ status, lastSeen, showText = true }: Props) {
  const cfg = statusConfig[status];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Badge
        status={status === 'error' ? 'error' : status === 'online' ? 'success' : 'default'}
        text={showText ? cfg.text : undefined}
        color={cfg.color}
      />
      {lastSeen && (
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>
          {new Date(lastSeen).toLocaleString('zh-CN')}
        </span>
      )}
    </span>
  );
}
