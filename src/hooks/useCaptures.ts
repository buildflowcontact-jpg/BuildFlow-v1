import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { capturesService } from '@/services/captures.service';
import { toast } from '@/stores/toastStore';
import type { AnnotatedCapture, CaptureAnnotationShape, CaptureSourceType, Project } from '@/types/domain';

export function useCaptures(projectId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['captures-drafts', projectId, userId];

  const query = useQuery({
    queryKey,
    queryFn: () => capturesService.listDrafts(projectId!, userId!),
    enabled: Boolean(projectId) && Boolean(userId),
  });

  const create = useMutation({
    mutationFn: (params: {
      sourceType: CaptureSourceType;
      sourceId: string;
      sourceLabel: string;
      dataUrl: string;
      annotations: CaptureAnnotationShape[];
    }) => capturesService.create({ projectId: projectId!, createdBy: userId!, ...params }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Capture sauvegardée'); },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  const update = useMutation({
    mutationFn: (params: { capture: AnnotatedCapture; dataUrl: string; annotations: CaptureAnnotationShape[] }) =>
      capturesService.update(params),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Capture mise à jour'); },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const remove = useMutation({
    mutationFn: (capture: AnnotatedCapture) => capturesService.remove(capture),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Capture supprimée'); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const sendReport = useMutation({
    mutationFn: (params: {
      project: Project;
      title: string;
      captures: AnnotatedCapture[];
      recipients: { id: string; label: string }[];
    }) => capturesService.sendReport({ ...params, createdBy: userId! }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Rapport envoyé'); },
    onError: () => toast.error("Erreur lors de l'envoi du rapport"),
  });

  return { ...query, drafts: query.data ?? [], create, update, remove, sendReport };
}

export function useCaptureReports(projectId: string | undefined) {
  const queryKey = ['capture-reports', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => capturesService.listReports(projectId!),
    enabled: Boolean(projectId),
  });

  return { ...query, reports: query.data ?? [] };
}
