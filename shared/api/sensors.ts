import type { SensorData, SensorSummary, CpuTempHistory } from '../types';
import api from './client';

export async function fetchSensorData(bmcId: string): Promise<SensorData> {
  const { data } = await api.get(`/bmcs/${bmcId}/sensors`);
  return data;
}

export async function fetchAllSensorSummaries(): Promise<SensorSummary[]> {
  const { data: routers } = await api.get('/routers');
  const summaries: SensorSummary[] = [];
  for (const router of routers) {
    const { data: bmcs } = await api.get('/bmcs', { params: { routerId: router.id } });
    for (const bmc of bmcs) {
      try {
        const { data: sensors } = await api.get(`/bmcs/${bmc.id}/sensors`);
        summaries.push({
          bmcId: bmc.id,
          bmcIp: bmc.ip,
          routerName: router.name,
          status: bmc.status,
          cpu0Temp: sensors.coreTemp?.cpu0Temp ?? null,
          inletAirTemp: sensors.coreTemp?.inletAirTemp ?? null,
          chassisPower: sensors.power?.chassisPower ?? 0,
          hasError: bmc.status !== 'online' || (sensors.power?.chassisPowerHealth === 'Critical'),
          timestamp: sensors.timestamp,
        });
      } catch {
        summaries.push({
          bmcId: bmc.id,
          bmcIp: bmc.ip,
          routerName: router.name,
          status: 'offline',
          cpu0Temp: null,
          inletAirTemp: null,
          chassisPower: 0,
          hasError: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  return summaries;
}

export async function fetchCpuTempHistory(bmcId: string, _minutes?: number): Promise<CpuTempHistory> {
  const { data } = await api.get(`/bmcs/${bmcId}/sensors`);
  return {
    bmcId,
    bmcIp: '',
    points: [{ time: data.timestamp, value: data.coreTemp?.cpu0Temp ?? null }],
  };
}

export async function fetchMultiCpuHistory(bmcIds: string[], _minutes?: number): Promise<CpuTempHistory[]> {
  return Promise.all(bmcIds.map(id => fetchCpuTempHistory(id)));
}
