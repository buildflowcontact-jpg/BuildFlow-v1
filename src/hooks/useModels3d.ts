import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { models3dService } from '@/services/models3d.service';
import { toast } from '@/stores/toastStore';
import type { Model3D } from '@/types/domain';

export function useModels3d(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['models3d', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => models3dService.list(projectId!),
    enabled: Boolean(projectId),
  });

  const upload = useMutation({
    mutationFn: (params: { file: File; uploadedBy: string }) =>
      models3dService.upload({ projectId: projectId!, ...params }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Modèle 3D ajouté'); },
    onError: () => toast.error("Erreur lors de l'upload du modèle"),
  });

  const remove = useMutation({
    mutationFn: (model: Model3D) => models3dService.remove(model),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Modèle 3D supprimé'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  return { ...query, models: query.data ?? [], upload, remove };
}
