import type { CSSProperties } from 'react';
import { cn } from '@/utils/cn';

/** Bloc shimmer générique. */
export function SkeletonBlock({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200', className)} style={style} />;
}

/**
 * Squelette de page complet — remplace le spinner plein écran pendant le
 * chargement initial d'un module (lazy chunk + data fetching).
 * Donne une perception de réactivité en affichant la structure de la page
 * avant que les données n'arrivent.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* En-tête : titre + bouton action */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="h-9 w-32" />
      </div>

      {/* KPIs / stats (3 cartes côte à côte) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-8 w-32" />
          </div>
        ))}
      </div>

      {/* Tableau / liste principale */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-8 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg px-2 py-3">
            <SkeletonBlock className="h-4 w-4 shrink-0 rounded-full" />
            <SkeletonBlock className="h-4 flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <SkeletonBlock className="h-6 w-20 shrink-0" />
            <SkeletonBlock className="h-6 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
