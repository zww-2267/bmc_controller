import type { BMC, BMCCreateInput } from '../types';
import { apiGet, apiPost, apiDelete } from './client';
import { mockBMCs, generateMockBMCs } from '../mocks/bmc';

// 首次访问时扩充到千级 BMC
let expanded = false;
function ensureExpanded() {
  if (!expanded) {
    const large = generateMockBMCs(1200);
    mockBMCs.length = 0;
    mockBMCs.push(...large);
    expanded = true;
  }
}

export async function fetchBMCsByRouter(routerId: string): Promise<BMC[]> {
  ensureExpanded();
  await new Promise(r => setTimeout(r, 50));
  return apiGet(
    mockBMCs.filter(b => b.routerId === routerId),
    100
  );
}

export async function fetchAllBMCs(): Promise<BMC[]> {
  ensureExpanded();
  return apiGet(mockBMCs, 150);
}

export async function fetchBMCById(id: string): Promise<BMC | null> {
  ensureExpanded();
  const bmc = mockBMCs.find(b => b.id === id);
  return apiGet(bmc || null, 80);
}

export async function createBMC(input: BMCCreateInput): Promise<BMC> {
  ensureExpanded();
  const bmc: BMC = {
    id: `bmc-${Date.now()}`,
    ip: input.ip,
    username: input.username,
    routerId: input.routerId,
    status: 'online',
    lastSeen: new Date().toISOString(),
    uptime: 0,
    hostPowerOn: true,
    aggregateHealth: { level: 'normal', reasons: [] },
  };
  mockBMCs.unshift(bmc);
  return apiPost(bmc, 200);
}

export async function deleteBMC(id: string): Promise<{ success: boolean }> {
  const idx = mockBMCs.findIndex(b => b.id === id);
  if (idx >= 0) mockBMCs.splice(idx, 1);
  return apiDelete();
}
