import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warrantyService } from '@/services/warranty.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useWarranty(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['warranty-claims', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => warrantyService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate(
    'warranty_claims',
    projectId ? { column: 'project_id', value: projectId } : null,
    queryKey
  );

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'warranty_claims'>, 'project_id'>) =>
      warrantyService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'warranty_claims'> }) =>
      warrantyService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => warrantyService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, claims: query.data ?? [], create, update, remove };
}
