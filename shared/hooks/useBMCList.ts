import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBMCsByRouter, fetchAllBMCs, fetchBMCById, createBMC, deleteBMC } from '../api/bmc';

export function useBMCList(routerId: string | null) {
  return useQuery({
    queryKey: ['bmcs', routerId],
    queryFn: () => routerId ? fetchBMCsByRouter(routerId) : fetchAllBMCs(),
    staleTime: 30_000,
    enabled: routerId !== null,
  });
}

export function useBMCById(id: string | undefined) {
  return useQuery({
    queryKey: ['bmc', id],
    queryFn: () => fetchBMCById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateBMC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBMC,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bmcs'] }),
  });
}

export function useDeleteBMC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBMC,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bmcs'] });
      qc.invalidateQueries({ queryKey: ['sensor-summaries'] });
    },
  });
}
