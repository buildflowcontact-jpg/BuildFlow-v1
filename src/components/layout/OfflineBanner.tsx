import { WifiOff, RefreshCw } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { cn } from '@/utils/cn';

/**
 * Bannière persistante affichée lorsque l'application fonctionne en mode
 * hors-ligne (pas d'accès internet ou Supabase inaccessible). L'utilisateur
 * peut continuer à consulter les données déjà chargées (servies depuis le
 * cache local) et à préparer des modifications : celles-ci sont mises en
 * attente et synchronisées automatiquement dès le retour de la connexion.
 */
export function OfflineBanner() {
  const syncStatus = useSyncStatus();

  if (syncStatus.state === 'online') return null;

  const reason = !syncStatus.isOnline
    ? "Pas d'accès internet."
    : 'Le serveur BuildFlow est temporairement inaccessible.';

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800'
      )}
      role="status"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        <strong className="font-medium">Mode hors-ligne.</strong> {reason} La synchronisation est désactivée — vos
        modifications sont conservées localement et seront envoyées automatiquement dès qu'une connexion sera
        disponible.
      </span>
      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin opacity-60" />
    </div>
  );
}
