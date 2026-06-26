import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry uniquement si un DSN est fourni (VITE_SENTRY_DSN).
 *
 * Sans compte Sentry créé côté utilisateur, cette variable est absente et
 * l'appel est un no-op total : aucune dépendance supplémentaire chargée au
 * runtime, aucun appel réseau. Dès qu'un DSN est renseigné dans .env, les
 * exceptions interceptées par ErrorBoundary (cf. componentDidCatch) et les
 * rejets de promesse non gérés sont automatiquement reportés.
 *
 * Pour activer : créer un projet sur sentry.io (plan gratuit suffisant à ce
 * stade), copier le DSN du projet React, le mettre dans .env sous
 * VITE_SENTRY_DSN, redéployer.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Pas de tracing de performance par défaut (coût/volume) — uniquement
    // la capture d'erreurs. À activer explicitement si besoin plus tard :
    // tracesSampleRate / integrations: [Sentry.browserTracingIntegration()].
  });
}

/** Reporte une exception à Sentry si initialisé, sinon ne fait rien. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
