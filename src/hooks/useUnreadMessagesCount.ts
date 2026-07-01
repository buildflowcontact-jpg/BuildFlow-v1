import { useQuery } from '@tanstack/react-query';
import { messagingService } from '@/services/messaging.service';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

/**
 * Retourne le nombre total de messages non lus pour l'utilisateur courant
 * sur un projet. Partage la même queryKey que useConversations pour éviter
 * les requêtes dupliquées quand l'onglet Messagerie est ouvert.
 */
export function useUnreadMessagesCount(
  projectId: string | undefined,
  currentUserId: string | undefined
): number {
  const queryKey = ['conversations', projectId, currentUserId];

  const query = useQuery({
    queryKey,
    queryFn: () => messagingService.listConversations(projectId!, currentUserId!),
    enabled: Boolean(projectId && currentUserId),
    staleTime: 30_000,
  });

  useRealtimeInvalidate(
    'messages',
    projectId ? { column: 'conversation_id', value: projectId } : null,
    queryKey
  );

  return query.data?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;
}
