import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { capturesService } from '@/services/captures.service';
import type { AnnotatedCapture, CaptureAnnotationShape, CaptureSourceType, Project } from '@/types/domain';

/**
 * Brouillons de captures annotées de l'utilisateur courant (3D ou plan 2D,
 * distingués par `source_type`). Partagé par IfcViewer et PlanViewer.
 */
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: (params: { capture: AnnotatedCapture; dataUrl: string; annotations: CaptureAnnotationShape[] }) =>
      capturesService.update(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (capture: AnnotatedCapture) => capturesService.remove(capture),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const sendReport = useMutation({
    mutationFn: (params: {
      project: Project;
      title: string;
      captures: AnnotatedCapture[];
      recipients: { id: string; label: string }[];
    }) => capturesService.sendReport({ ...params, createdBy: userId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
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
