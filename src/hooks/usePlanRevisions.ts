import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planRevisionsService } from '@/services/planRevisions.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function usePlanRevisions(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['plan-revisions', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => planRevisionsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate(
    'plan_revisions',
    projectId ? { column: 'project_id', value: projectId } : null,
    queryKey
  );

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'plan_revisions'>, 'project_id'>) =>
      planRevisionsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'plan_revisions'> }) =>
      planRevisionsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => planRevisionsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, revisions: query.data ?? [], create, update, remove };
}
