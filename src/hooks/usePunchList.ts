import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { punchListService } from '@/services/punchList.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function usePunchList(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['punch-list', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => punchListService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('punch_list_items', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'punch_list_items'>, 'project_id'>) =>
      punchListService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Réserve créée'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'punch_list_items'> }) =>
      punchListService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => punchListService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Réserve supprimée'); },
  });

  return { ...query, items: query.data ?? [], create, update, remove };
}
