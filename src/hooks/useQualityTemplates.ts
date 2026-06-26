import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qualityTemplatesService, type QualityTemplateItemInput } from '@/services/qualityTemplates.service';
import type { TablesInsert } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useQualityTemplates(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['quality-templates', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => qualityTemplatesService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('quality_templates', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const create = useMutation({
    mutationFn: ({
      payload,
      items,
    }: {
      payload: Omit<TablesInsert<'quality_templates'>, 'project_id'>;
      items: QualityTemplateItemInput[];
    }) => qualityTemplatesService.create({ ...payload, project_id: projectId! }, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
      items,
    }: {
      id: string;
      payload: Parameters<typeof qualityTemplatesService.update>[1];
      items: QualityTemplateItemInput[];
    }) => qualityTemplatesService.update(id, payload, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => qualityTemplatesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, templates: query.data ?? [], create, update, remove };
}

export function useQualityTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['quality-template', templateId],
    queryFn: () => qualityTemplatesService.getWithItems(templateId!),
    enabled: Boolean(templateId),
  });
}
