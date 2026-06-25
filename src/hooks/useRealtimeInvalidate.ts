import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToTable, type RealtimeTable } from '@/services/realtime.service';

/**
 * Invalide une query React Query dès qu'un changement Realtime est reçu sur
 * la table donnée (filtrée par colonne/valeur, typiquement project_id).
 */
export function useRealtimeInvalidate(
  table: RealtimeTable,
  filter: { column: string; value: string } | null,
  queryKey: unknown[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (filter && !filter.value) return;
    const unsubscribe = subscribeToTable(table, filter, () => {
      queryClient.invalidateQueries({ queryKey });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter?.column, filter?.value, JSON.stringify(queryKey)]);
}
