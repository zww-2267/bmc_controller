import type { BMC, BMCStatus, AggregateHealthStatus } from '../types';
import { mockRouters } from './routers';

function randomIp(seed: number): string {
  const a = 10;
  const b = (seed % 255);
  const c = Math.floor(seed / 255) % 255;
  const d = (seed % 253) + 2;
  return `${a}.${b}.${c}.${d}`;
}

function randomStatus(): BMCStatus {
  const r = Math.random();
  if (r < 0.80) return 'online';
  if (r < 0.90) return 'offline';
  if (r < 0.97) return 'warning';
  return 'error';
}

function randomAggHealth(status: BMCStatus): AggregateHealthStatus {
  if (status === 'error') return { level: 'critical', reasons: ['BMC 无响应'] };
  if (status === 'warning') return { level: 'warning', reasons: ['CPU0 温度偏高', '进风口温度过高'] };
  if (status === 'offline') return { level: 'normal', reasons: [] };
  if (Math.random() < 0.05) return { level: 'warning', reasons: ['传感器数据部分异常'] };
  return { level: 'normal', reasons: [] };
}

// 生成大量 BMC 数据（默认 1200 台以模拟千台环境）
export function generateMockBMCs(count: number = 1200): BMC[] {
  const bmcs: BMC[] = [];
  for (let i = 0; i < count; i++) {
    const router = mockRouters[i % mockRouters.length];
    const status = randomStatus();
    const minutesAgo = Math.floor(Math.random() * 120);
    const lastSeen = new Date(Date.now() - minutesAgo * 60000).toISOString();

    const uptime = status === 'online' || status === 'warning'
      ? Math.floor(Math.random() * 30 * 24 * 3600) + 3600
      : 0;

    bmcs.push({
      id: `bmc-${i + 1}`,
      ip: randomIp(i),
      username: 'admin',
      routerId: router.id,
      routerName: router.name,
      status,
      lastSeen,
      uptime,
      hostPowerOn: status === 'online' || status === 'warning',
      aggregateHealth: randomAggHealth(status),
    });
  }
  return bmcs;
}

// 默认导出 120 台 BMC 以便开发调试（完整量级在 hook 中按需生成）
export const mockBMCs: BMC[] = generateMockBMCs(120);
