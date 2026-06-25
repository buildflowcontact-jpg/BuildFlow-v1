import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rfisService } from '@/services/rfis.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useRfis(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['rfis', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => rfisService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('rfis', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'rfis'>, 'project_id'>) =>
      rfisService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) => rfisService.respond(id, response),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'rfis'> }) => rfisService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => rfisService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, rfis: query.data ?? [], create, respond, update, remove };
}
