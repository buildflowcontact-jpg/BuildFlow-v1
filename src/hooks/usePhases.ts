import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { phasesService } from '@/services/phases.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function usePhases(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['phases', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => phasesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('phases', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'phases'>, 'project_id'>) =>
      phasesService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Phase créée'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'phases'> }) => phasesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => phasesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const reorder = useMutation({
    mutationFn: (phaseIds: string[]) => phasesService.reorder(phaseIds),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Phase supprimée'); },
  });

  return { ...query, phases: query.data ?? [], create, update, remove, reorder };
}
