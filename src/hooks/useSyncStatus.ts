import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type SyncState = 'online' | 'offline' | 'checking';

interface SyncStatus {
  state: SyncState;
  isOnline: boolean;
  isSupabaseReachable: boolean;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
}

const CHECK_INTERVAL_MS = 30_000;

/**
 * Vérifie à intervalles réguliers (et lors des changements de connectivité)
 * que le navigateur a accès à internet ET que Supabase est joignable.
 * Le statut est vert seulement si les deux conditions sont réunies.
 */
export function useSyncStatus(): SyncStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastErrorAt, setLastErrorAt] = useState<Date | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
      setLastErrorAt(new Date());
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    async function ping() {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        if (!navigator.onLine) {
          setIsSupabaseReachable(false);
          checkingRef.current = false;
          return;
        }
        const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1);
        if (error) {
          setIsSupabaseReachable(false);
          setLastErrorAt(new Date());
        } else {
          setIsSupabaseReachable(true);
          setLastSyncAt(new Date());
        }
      } catch {
        setIsSupabaseReachable(false);
        setLastErrorAt(new Date());
      } finally {
        checkingRef.current = false;
      }
    }

    ping();
    const interval = setInterval(ping, CHECK_INTERVAL_MS);

    function handleOnlineRecheck() {
      ping();
    }
    window.addEventListener('online', handleOnlineRecheck);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnlineRecheck);
    };
  }, []);

  const online = isOnline && isSupabaseReachable;

  return {
    state: online ? 'online' : 'offline',
    isOnline,
    isSupabaseReachable,
    lastSyncAt,
    lastErrorAt,
  };
}
