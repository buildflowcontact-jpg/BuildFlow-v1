import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messagingService } from '@/services/messaging.service';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['messages', conversationId];

  const query = useQuery({
    queryKey,
    queryFn: () => messagingService.listMessages(conversationId!),
    enabled: Boolean(conversationId),
  });

  useRealtimeInvalidate(
    'messages',
    conversationId ? { column: 'conversation_id', value: conversationId } : null,
    queryKey
  );

  const send = useMutation({
    mutationFn: ({ senderId, content }: { senderId: string; content: string }) =>
      messagingService.sendMessage(conversationId!, senderId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Marque le fil comme lu dès l'ouverture (badge "non lus" de la liste).
  useEffect(() => {
    if (conversationId) {
      messagingService.markRead(conversationId).catch(() => {
        // Non bloquant : un échec du marqueur de lecture ne doit pas gêner la lecture des messages.
      });
    }
  }, [conversationId]);

  return { ...query, messages: query.data ?? [], send };
}
