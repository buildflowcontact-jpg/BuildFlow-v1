import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { firePermitsService } from '@/services/firePermits.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useFirePermits(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['fire-permits', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => firePermitsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('fire_permits', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'fire_permits'>, 'project_id'>) =>
      firePermitsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'fire_permits'> }) =>
      firePermitsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => firePermitsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, permits: query.data ?? [], create, update, remove };
}
