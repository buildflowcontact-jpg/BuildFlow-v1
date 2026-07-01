import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incidentsService } from '@/services/incidents.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useIncidents(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['incidents', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => incidentsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('incidents', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'incidents'>, 'project_id'>) =>
      incidentsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Incident créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'incidents'> }) => incidentsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => incidentsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Incident supprimé'); },
  });

  return { ...query, incidents: query.data ?? [], create, update, remove };
}
