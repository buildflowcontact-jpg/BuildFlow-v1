import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resourceAttachmentsService, type AttachableResourceType } from '@/services/resourceAttachments.service';
import type { TablesInsert } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useResourceAttachments(resourceType: AttachableResourceType, resourceId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['resource_attachments', resourceType, resourceId];

  const query = useQuery({
    queryKey,
    queryFn: () => resourceAttachmentsService.listForResource(resourceType, resourceId!),
    enabled: Boolean(resourceId),
  });

  useRealtimeInvalidate('resource_attachments', resourceId ? { column: 'resource_id', value: resourceId } : null, queryKey);

  const attach = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'resource_attachments'>, 'resource_type' | 'resource_id'>) =>
      resourceAttachmentsService.attach({ ...payload, resource_type: resourceType, resource_id: resourceId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const detach = useMutation({
    mutationFn: (id: string) => resourceAttachmentsService.detach(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, attachments: query.data ?? [], attach, detach };
}
