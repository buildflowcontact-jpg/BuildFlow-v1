import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doeService } from '@/services/doe.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useDoe(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['doe-items', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => doeService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('doe_items', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'doe_items'>, 'project_id'>) =>
      doeService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Pièce DOE créée'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'doe_items'> }) =>
      doeService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => doeService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Pièce DOE supprimée'); },
  });

  return { ...query, items: query.data ?? [], create, update, remove };
}
