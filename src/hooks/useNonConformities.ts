import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nonConformitiesService } from '@/services/nonConformities.service';
import { toast } from '@/stores/toastStore';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useNonConformities(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['non-conformities', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => nonConformitiesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('non_conformities', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'non_conformities'>, 'project_id'>) =>
      nonConformitiesService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Non-conformité créée'); },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'non_conformities'> }) =>
      nonConformitiesService.update(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Non-conformité mise à jour'); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => nonConformitiesService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Non-conformité supprimée'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return { ...query, nonConformities: query.data ?? [], create, update, remove };
}
