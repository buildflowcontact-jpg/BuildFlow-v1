import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsService } from '@/services/clients.service';
import { useAuthStore } from '@/stores/authStore';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { toast } from '@/stores/toastStore';

export function useClients() {
  const organization = useAuthStore((s) => s.organization);
  const queryClient = useQueryClient();
  const queryKey = ['clients', organization?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => clientsService.list(organization!.id),
    enabled: Boolean(organization?.id),
  });

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'clients'>, 'organization_id'>) =>
      clientsService.create({ ...payload, organization_id: organization!.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Client créé'); },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'clients'> }) => clientsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => clientsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Client supprimé'); },
  });

  return { ...query, clients: query.data ?? [], create, update, remove };
}
