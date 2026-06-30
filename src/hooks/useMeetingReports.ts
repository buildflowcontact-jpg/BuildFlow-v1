import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meetingReportsService } from '@/services/meetingReports.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useMeetingReports(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['meeting-reports', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => meetingReportsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('meeting_reports', projectId ? { column: 'project_id', value: projectId } : null, queryKey);
  useRealtimeInvalidate('meeting_action_items', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'meeting_reports'>, 'project_id'>) =>
      meetingReportsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'meeting_reports'> }) =>
      meetingReportsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => meetingReportsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const createActionItem = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'meeting_action_items'>, 'project_id'>) =>
      meetingReportsService.createActionItem({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateActionItem = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'meeting_action_items'> }) =>
      meetingReportsService.updateActionItem(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeActionItem = useMutation({
    mutationFn: (id: string) => meetingReportsService.removeActionItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    ...query,
    reports: query.data ?? [],
    create,
    update,
    remove,
    createActionItem,
    updateActionItem,
    removeActionItem,
  };
}
