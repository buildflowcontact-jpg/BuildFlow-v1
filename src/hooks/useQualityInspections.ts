import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qualityInspectionsService, type AdHocChecklistItem } from '@/services/qualityInspections.service';
import { toast } from '@/stores/toastStore';
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Inspection créée'); },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => qualityInspectionsService.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Inspection supprimée'); },
    onError: () => toast.error("Erreur lors de la suppression"),
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
      toast.success('Inspection clôturée');
    },
    onError: () => toast.error("Erreur lors de la clôture"),
  });

  return { ...query, setResult, complete };
}
