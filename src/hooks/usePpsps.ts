import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ppspsService } from '@/services/ppsps.service';
import { toast } from '@/stores/toastStore';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function usePpsps(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['ppsps-records', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => ppspsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('ppsps_records', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const upsert = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'ppsps_records'>, 'project_id'>) =>
      ppspsService.upsert({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Enregistrement PPSPS sauvegardé'); },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'ppsps_records'> }) =>
      ppspsService.update(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('PPSPS mis à jour'); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ppspsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Enregistrement supprimé'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return { ...query, records: query.data ?? [], upsert, update, remove };
}
