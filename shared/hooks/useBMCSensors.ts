import { useQuery } from '@tanstack/react-query';
import { fetchSensorData } from '../api/sensors';

export function useBMCSensors(bmcId: string | undefined) {
  return useQuery({
    queryKey: ['sensors', bmcId],
    queryFn: () => fetchSensorData(bmcId!),
    enabled: !!bmcId,
    refetchInterval: 5_000, // 5 秒轮询
    staleTime: 4_000,
  });
}
