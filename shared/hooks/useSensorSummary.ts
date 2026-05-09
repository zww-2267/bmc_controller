import { useQuery } from '@tanstack/react-query';
import { fetchAllSensorSummaries, fetchMultiCpuHistory } from '../api/sensors';

export function useSensorSummary() {
  return useQuery({
    queryKey: ['sensor-summaries'],
    queryFn: fetchAllSensorSummaries,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}

export function useCpuTempTrend(bmcIds: string[]) {
  return useQuery({
    queryKey: ['cpu-trend', bmcIds],
    queryFn: () => fetchMultiCpuHistory(bmcIds),
    refetchInterval: 10_000,
    staleTime: 8_000,
    enabled: bmcIds.length > 0,
  });
}
