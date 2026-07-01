import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wasteTrackingService } from '@/services/wasteTracking.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useWasteTrackings(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['waste-trackings', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => wasteTrackingService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('waste_trackings', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'waste_trackings'>, 'project_id'>) =>
      wasteTrackingService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('BSD créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'waste_trackings'> }) =>
      wasteTrackingService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => wasteTrackingService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('BSD supprimé'); },
  });

  return { ...query, trackings: query.data ?? [], create, update, remove };
}
