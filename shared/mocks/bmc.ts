import type { BMC, BMCStatus } from '../types';
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
  if (r < 0.85) return 'online';
  if (r < 0.95) return 'offline';
  return 'error';
}

// 生成大量 BMC 数据（默认 1200 台以模拟千台环境）
export function generateMockBMCs(count: number = 1200): BMC[] {
  const bmcs: BMC[] = [];
  for (let i = 0; i < count; i++) {
    const router = mockRouters[i % mockRouters.length];
    const status = randomStatus();
    const minutesAgo = Math.floor(Math.random() * 120);
    const lastSeen = new Date(Date.now() - minutesAgo * 60000).toISOString();

    const uptime = status === 'online'
      ? Math.floor(Math.random() * 30 * 24 * 3600) + 3600 // 1小时 ~ 30天
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
    });
  }
  return bmcs;
}

// 默认导出 120 台 BMC 以便开发调试（完整量级在 hook 中按需生成）
export const mockBMCs: BMC[] = generateMockBMCs(120);
