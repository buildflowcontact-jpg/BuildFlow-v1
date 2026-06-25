import { useQuery } from '@tanstack/react-query';
import { activityLogsService } from '@/services/activityLogs.service';

export function useActivityLogs(projectId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: ['activity-logs', projectId, limit],
    queryFn: () => activityLogsService.listForProject(projectId!, limit),
    enabled: Boolean(projectId),
  });
}
