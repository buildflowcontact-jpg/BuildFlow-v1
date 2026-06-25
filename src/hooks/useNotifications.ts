import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications.service';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useNotifications() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const queryKey = ['notifications', userId];

  const query = useQuery({
    queryKey,
    queryFn: () => notificationsService.list(userId!),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });

  useRealtimeInvalidate('notifications', userId ? { column: 'user_id', value: userId } : null, queryKey);

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, notifications, unreadCount, markAsRead, markAllAsRead };
}
