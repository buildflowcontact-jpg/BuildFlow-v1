import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyLogsService } from '@/services/dailyLogs.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useDailyLogs(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['daily_logs', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => dailyLogsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('daily_logs', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'daily_logs'>, 'project_id'>) =>
      dailyLogsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Journal créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'daily_logs'> }) =>
      dailyLogsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dailyLogsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Journal supprimé'); },
  });

  return { ...query, dailyLogs: query.data ?? [], create, update, remove };
}
