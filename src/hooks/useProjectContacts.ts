import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectContactsService } from '@/services/projectContacts.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export function useProjectContacts(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['project-contacts', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => projectContactsService.listForProject(projectId!),
    enabled: Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'project_contacts'>, 'project_id'>) =>
      projectContactsService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'project_contacts'> }) =>
      projectContactsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => projectContactsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setPrimary = useMutation({
    mutationFn: (contactId: string) => projectContactsService.setPrimary(projectId!, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    setPrimary,
  };
}
