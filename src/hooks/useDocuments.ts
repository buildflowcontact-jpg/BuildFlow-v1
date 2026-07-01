import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import type { Document } from '@/types/domain';
import type { DocumentType } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import { toast } from '@/stores/toastStore';

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
    mutationFn: (params: {
      file: File;
      type: DocumentType;
      uploadedBy: string;
      folder?: string | null;
      companyId?: string | null;
      amount?: number | null;
      silent?: boolean;
    }) => documentsService.upload({ projectId: projectId!, ...params }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Document ajouté'); },
  });

  const remove = useMutation({
    mutationFn: (doc: Document) => documentsService.remove(doc),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('Document supprimé'); },
  });

  return { ...query, documents: query.data ?? [], upload, remove };
}
