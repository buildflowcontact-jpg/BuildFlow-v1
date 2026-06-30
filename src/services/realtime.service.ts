import { supabase } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type RealtimeTable =
  | 'projects'
  | 'tasks'
  | 'task_dependencies'
  | 'documents'
  | 'incidents'
  | 'supplies'
  | 'comments'
  | 'punch_list_items'
  | 'notifications'
  | 'phases'
  | 'daily_logs'
  | 'budget_categories'
  | 'expenses'
  | 'rfis'
  | 'change_orders'
  | 'time_entries'
  | 'resource_attachments'
  | 'signatures'
  | 'daily_reports'
  | 'quotes'
  | 'invoices'
  | 'invoice_payments'
  | 'quality_templates'
  | 'quality_inspections'
  | 'quality_inspection_results'
  | 'non_conformities'
  | 'conversations'
  | 'conversation_participants'
  | 'messages'
  | 'meeting_reports'
  | 'meeting_action_items'
  | 'fire_permits'
  | 'ppsps_records'
  | 'doe_items'
  | 'waste_trackings'
  | 'prospects'
  | 'prospect_visits';

/**
 * Abonnement générique à une table filtrée (par défaut sur project_id).
 * Retourne une fonction de désabonnement à appeler dans le cleanup du useEffect.
 */
let channelSeq = 0;

export function subscribeToTable<T extends Record<string, unknown>>(
  table: RealtimeTable,
  filter: { column: string; value: string } | null,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void
): () => void {
  // Le nom du canal doit être unique par abonnement : en dev (StrictMode/HMR),
  // un remount rapide peut survenir avant que le canal précédent ne soit
  // pleinement retiré côté client Supabase. Réutiliser le même nom renvoie
  // alors l'instance déjà "subscribed", et y appeler `.on()` lève
  // "cannot add postgres_changes callbacks ... after subscribe()", ce qui
  // plante toute la page. Un suffixe incrémental élimine toute collision.
  channelSeq += 1;
  const baseName = filter ? `realtime:${table}:${filter.column}:${filter.value}` : `realtime:${table}`;
  const channelName = `${baseName}:${channelSeq}`;

  const channel = supabase.channel(channelName).on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table,
      ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
    },
    (payload) => onChange(payload as RealtimePostgresChangesPayload<T>)
  );

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
