import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeEntriesService } from '@/services/timeEntries.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useTimeEntries(projectId: string | undefined, userId?: string) {
  const queryClient = useQueryClient();
  const queryKey = userId ? ['time_entries', projectId, userId] : ['time_entries', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => (userId ? timeEntriesService.listForUser(projectId!, userId) : timeEntriesService.list(projectId!)),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('time_entries', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'time_entries'>, 'project_id'>) =>
      timeEntriesService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Entrée créée'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'time_entries'> }) =>
      timeEntriesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => timeEntriesService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Entrée supprimée'); },
  });

  return { ...query, timeEntries: query.data ?? [], create, update, remove };
}
