import { Suspense, type ReactNode } from 'react';
import { FullPageSpinner } from '@/components/ui/Spinner';

/**
 * Enrobe une page chargée via React.lazy() d'un fallback de chargement.
 * Évite de répéter <Suspense fallback={...}> sur chaque route de App.tsx.
 */
export function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;
}
