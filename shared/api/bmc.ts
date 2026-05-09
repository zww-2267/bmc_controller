import type { BMC, BMCCreateInput } from '../types';
import api from './client';

export async function fetchBMCsByRouter(routerId: string): Promise<BMC[]> {
  const { data } = await api.get('/bmcs', { params: { routerId } });
  return data;
}

export async function fetchAllBMCs(): Promise<BMC[]> {
  const { data } = await api.get('/bmcs');
  return data;
}

export async function fetchBMCById(id: string): Promise<BMC> {
  const { data } = await api.get(`/bmcs/${id}/status`);
  return data;
}

export async function createBMC(input: BMCCreateInput): Promise<BMC> {
  const { data } = await api.post('/bmcs', input);
  return data;
}

export async function deleteBMC(id: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/bmcs/${id}`);
  return data;
}

export async function fetchBMCStatus(id: string): Promise<{ bmcId: string; status: string; uptime: number }> {
  const { data } = await api.get(`/bmcs/${id}/status`);
  return data;
}
