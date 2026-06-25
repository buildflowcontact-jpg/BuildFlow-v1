import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import type { Document } from '@/types/domain';
import type { DocumentType } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useDocuments(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['documents', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => documentsService.list(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('documents', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const upload = useMutation({
    mutationFn: (params: { file: File; type: DocumentType; uploadedBy: string; folder?: string | null; silent?: boolean }) =>
      documentsService.upload({ projectId: projectId!, ...params }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (doc: Document) => documentsService.remove(doc),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, documents: query.data ?? [], upload, remove };
}
