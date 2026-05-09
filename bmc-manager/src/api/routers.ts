import type { Router } from '../types';
import { apiGet, apiPost, apiDelete } from './client';
import { mockRouters } from '../mocks/routers';

export async function fetchRouters(): Promise<Router[]> {
  return apiGet(mockRouters, 100);
}

export async function createRouter(input: Omit<Router, 'id'>): Promise<Router> {
  const router: Router = { ...input, id: `r-${Date.now()}` };
  mockRouters.push(router);
  return apiPost(router, 200);
}

export async function deleteRouter(id: string): Promise<{ success: boolean }> {
  const idx = mockRouters.findIndex(r => r.id === id);
  if (idx >= 0) mockRouters.splice(idx, 1);
  return apiDelete();
}
