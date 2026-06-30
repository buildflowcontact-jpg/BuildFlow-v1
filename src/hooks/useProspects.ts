import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prospectsService } from '@/services/prospects.service';
import { useAuthStore } from '@/stores/authStore';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useProspects() {
  const organizationId = useAuthStore((s) => s.organization?.id);
  const queryClient = useQueryClient();
  const queryKey = ['prospects', organizationId];

  const query = useQuery({
    queryKey,
    queryFn: () => prospectsService.list(organizationId!),
    enabled: Boolean(organizationId),
  });

  useRealtimeInvalidate(
    'prospects',
    organizationId ? { column: 'organization_id', value: organizationId } : null,
    queryKey
  );

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'prospects'>, 'organization_id'>) =>
      prospectsService.create({ ...payload, organization_id: organizationId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'prospects'> }) =>
      prospectsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => prospectsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, prospects: query.data ?? [], create, update, remove };
}

export function useProspectVisits(prospectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['prospect-visits', prospectId];

  const query = useQuery({
    queryKey,
    queryFn: () => prospectsService.listVisits(prospectId!),
    enabled: Boolean(prospectId),
  });

  useRealtimeInvalidate(
    'prospect_visits',
    prospectId ? { column: 'prospect_id', value: prospectId } : null,
    queryKey
  );

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'prospect_visits'>, 'prospect_id'>) =>
      prospectsService.createVisit({ ...payload, prospect_id: prospectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => prospectsService.removeVisit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, visits: query.data ?? [], create, remove };
}
