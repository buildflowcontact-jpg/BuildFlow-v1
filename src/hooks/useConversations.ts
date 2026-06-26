import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messagingService } from '@/services/messaging.service';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useConversations(projectId: string | undefined, currentUserId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['conversations', projectId, currentUserId];

  const ensureGroup = useMutation({
    mutationFn: () => messagingService.ensureGroupConversation(projectId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Le fil "groupe" est créé à la volée dès l'ouverture de l'onglet Messagerie
  // (idempotent côté serveur : find-or-create).
  useEffect(() => {
    if (projectId) ensureGroup.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const query = useQuery({
    queryKey,
    queryFn: () => messagingService.listConversations(projectId!, currentUserId!),
    enabled: Boolean(projectId && currentUserId),
  });

  useRealtimeInvalidate('conversations', projectId ? { column: 'project_id', value: projectId } : null, queryKey);

  const startDirect = useMutation({
    mutationFn: (otherUserId: string) => messagingService.getOrCreateDirectConversation(projectId!, otherUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markRead = useMutation({
    mutationFn: (conversationId: string) => messagingService.markRead(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, conversations: query.data ?? [], startDirect, markRead };
}
