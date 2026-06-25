import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesService } from '@/services/companies.service';
import { useAuthStore } from '@/stores/authStore';
import type { TablesInsert } from '@/types/database.types';

export function useCompanies() {
  const organization = useAuthStore((s) => s.organization);
  const queryClient = useQueryClient();
  const queryKey = ['companies', organization?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => companiesService.list(organization!.id),
    enabled: Boolean(organization?.id),
  });

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'companies'>, 'organization_id'>) =>
      companiesService.create({ ...payload, organization_id: organization!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => companiesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, companies: query.data ?? [], create, remove };
}

export function useProjectCompanies(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['project-companies', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => companiesService.listForProject(projectId!),
    enabled: Boolean(projectId),
  });

  const attach = useMutation({
    mutationFn: ({ companyId, role }: { companyId: string; role?: string }) =>
      companiesService.attachToProject(projectId!, companyId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const detach = useMutation({
    mutationFn: (projectCompanyId: string) => companiesService.detachFromProject(projectCompanyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, projectCompanies: query.data ?? [], attach, detach };
}
