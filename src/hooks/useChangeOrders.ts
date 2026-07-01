import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeOrdersService } from '@/services/changeOrders.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

export function useChangeOrders(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['change_orders', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => changeOrdersService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('change_orders', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'change_orders'>, 'project_id'>) =>
      changeOrdersService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Avenant créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'change_orders'> }) =>
      changeOrdersService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const submitForApproval = useMutation({
    mutationFn: (id: string) => changeOrdersService.submitForApproval(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const decide = useMutation({
    mutationFn: ({
      changeOrderId,
      approve,
      signature,
    }: {
      changeOrderId: string;
      approve: boolean;
      signature?: { data: string; signerName: string };
    }) => changeOrdersService.decide(changeOrderId, approve, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['signatures', projectId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => changeOrdersService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Avenant supprimé'); },
  });

  return { ...query, changeOrders: query.data ?? [], create, update, submitForApproval, decide, remove };
}
