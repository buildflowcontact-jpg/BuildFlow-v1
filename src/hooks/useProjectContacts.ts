import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectContactsService } from '@/services/projectContacts.service';
import { toast } from '@/stores/toastStore';
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Contact ajouté'); },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'project_contacts'> }) =>
      projectContactsService.update(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Contact mis à jour'); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => projectContactsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Contact supprimé'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const setPrimary = useMutation({
    mutationFn: (contactId: string) => projectContactsService.setPrimary(projectId!, contactId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Contact principal défini'); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
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
