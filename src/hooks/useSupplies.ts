import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliesService } from '@/services/supplies.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useSupplies(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['supplies', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => suppliesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('supplies', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'supplies'>, 'project_id'>) =>
      suppliesService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Commande créée'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'supplies'> }) => suppliesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => suppliesService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Commande supprimée'); },
  });

  return { ...query, supplies: query.data ?? [], create, update, remove };
}
