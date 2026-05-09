import type { Router } from '../types';
import api from './client';

export async function fetchRouters(): Promise<Router[]> {
  const { data } = await api.get('/routers');
  return data;
}

export async function createRouter(input: Omit<Router, 'id'>): Promise<Router> {
  return { ...input, id: `r-${Date.now()}` };
}

export async function deleteRouter(id: string): Promise<{ success: boolean }> {
  return { success: true };
}
