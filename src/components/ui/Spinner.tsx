import { cn } from '@/utils/cn';
import { PageSkeleton } from './Skeleton';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600', className)}
    />
  );
}

/**
 * Remplacé par un squelette de page (audit 2026-07-01 : les spinners plein
 * écran bloquent la perception de réactivité). Le spinner inline `<Spinner />`
 * reste disponible pour les cas d'usage locaux (boutons, formulaires…).
 */
export function FullPageSpinner() {
  return <PageSkeleton />;
}
