import type { SensorData, SensorSummary, CpuTempHistory } from '../types';
import { apiGet } from './client';
import { generateSensorData, generateSensorSummary, generateCpuTempHistory, generateMultiCpuHistory } from '../mocks/sensors';

export async function fetchSensorData(bmcId: string): Promise<SensorData> {
  const data = generateSensorData(bmcId);
  return apiGet(data, 50);
}

export async function fetchAllSensorSummaries(): Promise<SensorSummary[]> {
  const summaries = generateSensorSummary();
  return apiGet(summaries, 100);
}

export async function fetchCpuTempHistory(bmcId: string, minutes?: number): Promise<CpuTempHistory> {
  const history = generateCpuTempHistory(bmcId, minutes);
  return apiGet(history, 80);
}

export async function fetchMultiCpuHistory(bmcIds: string[], minutes?: number): Promise<CpuTempHistory[]> {
  const histories = generateMultiCpuHistory(bmcIds, minutes);
  return apiGet(histories, 120);
}
