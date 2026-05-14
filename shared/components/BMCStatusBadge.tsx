import { Badge } from 'antd';
import type { BMCStatus } from '@shared/types';

const statusConfig: Record<BMCStatus, { color: string; text: string; badge: 'success' | 'error' | 'warning' | 'default' }> = {
  online: { color: '#52c41a', text: '在线', badge: 'success' },
  offline: { color: '#d9d9d9', text: '离线', badge: 'default' },
  warning: { color: '#faad14', text: '警告', badge: 'warning' },
  error: { color: '#ff4d4f', text: '异常', badge: 'error' },
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
        status={cfg.badge}
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
