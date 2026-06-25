import { useQuery } from '@tanstack/react-query';
import { signaturesService } from '@/services/signatures.service';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useSignatureForResource(resourceType: 'change_order', resourceId: string | undefined) {
  const queryKey = ['signature', resourceType, resourceId];

  return useQuery({
    queryKey,
    queryFn: () => signaturesService.getForResource(resourceType, resourceId!),
    enabled: Boolean(resourceId),
  });
}

export function useProjectSignatures(projectId: string | undefined) {
  const queryKey = ['signatures', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => signaturesService.listForProject(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('signatures', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  return { ...query, signatures: query.data ?? [] };
}
