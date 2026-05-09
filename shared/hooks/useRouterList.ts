import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRouters, createRouter, deleteRouter } from '../api/routers';

export function useRouterList() {
  return useQuery({
    queryKey: ['routers'],
    queryFn: fetchRouters,
    staleTime: 60_000,
  });
}

export function useCreateRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRouter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routers'] }),
  });
}

export function useDeleteRouter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteRouter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routers'] });
      qc.invalidateQueries({ queryKey: ['bmcs'] });
    },
  });
}
