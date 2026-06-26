import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qualityInspectionsService, type AdHocChecklistItem } from '@/services/qualityInspections.service';
import type { QualityInspectionResult, TablesInsert } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useQualityInspections(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['quality-inspections', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => qualityInspectionsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('quality_inspections', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: ({
      payload,
      adHocItems,
    }: {
      payload: Omit<TablesInsert<'quality_inspections'>, 'project_id'>;
      adHocItems?: AdHocChecklistItem[];
    }) => qualityInspectionsService.create({ ...payload, project_id: projectId! }, adHocItems),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => qualityInspectionsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, inspections: query.data ?? [], create, remove };
}

export function useQualityInspection(inspectionId: string | undefined, projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['quality-inspection', inspectionId];

  const query = useQuery({
    queryKey,
    queryFn: () => qualityInspectionsService.getWithResults(inspectionId!),
    enabled: Boolean(inspectionId),
  });

  // Les non-conformités sont créées par trigger SQL côté serveur dès qu'un
  // résultat passe à "non_conforme" : on écoute aussi cette table pour que la
  // liste de NC se mette à jour sans action manuelle de l'utilisateur.
  useRealtimeInvalidate('quality_inspection_results', { column: 'inspection_id', value: inspectionId ?? '' }, queryKey);

  const setResult = useMutation({
    mutationFn: ({
      resultId,
      result,
      comment,
    }: {
      resultId: string;
      result: QualityInspectionResult | null;
      comment?: string | null;
    }) => qualityInspectionsService.setResult(resultId, result, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['non-conformities', projectId] });
    },
  });

  const complete = useMutation({
    mutationFn: (inspectedBy: string | null) => qualityInspectionsService.complete(inspectionId!, inspectedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['quality-inspections', projectId] });
    },
  });

  return { ...query, setResult, complete };
}
