import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { reportError } from '../lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Filet de sécurité global : si un composant lève une exception au rendu
 * (bug, donnée inattendue, etc.), on affiche un écran de repli clair au lieu
 * de laisser React démonter l'arbre entier et afficher une page blanche.
 *
 * Doit être une classe : c'est le seul moyen d'implémenter
 * componentDidCatch/getDerivedStateFromError en React 18 (pas d'équivalent hook).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En l'absence d'un service de monitoring externe branché, on garde au
    // moins une trace en console pour le diagnostic.
    console.error('[ErrorBoundary] Exception non interceptée :', error, info.componentStack);
    // No-op si VITE_SENTRY_DSN n'est pas configuré (cf. src/lib/sentry.ts).
    reportError(error, { componentStack: info.componentStack });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Une erreur inattendue est survenue</h1>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              BuildFlow a rencontré un problème et n'a pas pu afficher cette page. Vous pouvez essayer de
              recharger l'application ; si le problème persiste, contactez votre administrateur.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Recharger l'application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
