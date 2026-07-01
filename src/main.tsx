import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { router } from './App';
import { AuthProvider } from './app/AuthProvider';
import { ErrorBoundary } from './app/ErrorBoundary';
import { initSentry } from './lib/sentry';
import { toast } from '@/stores/toastStore';
import './index.css';

initSentry();

// networkMode 'offlineFirst' : les requêtes servent le cache existant immédiatement
// et tentent une revalidation en arrière-plan, sans bloquer l'UI hors-ligne.
// Les mutations restent en mode 'online' (comportement par défaut) : si l'utilisateur
// est hors-ligne, elles sont automatiquement mises en pause par React Query et
// reprises dès le retour de la connexion (voir PersistQueryClientProvider.onSuccess
// qui relance resumePausedMutations).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'online',
      retry: 1,
      // Gestionnaire d'erreur global : toutes les mutations qui échouent sans
      // onError explicite affichent un toast. Évite le silence total en cas
      // d'erreur réseau ou de violation RLS.
      onError: (error: unknown) => {
        const msg =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Une erreur est survenue';
        toast.error(msg);
      },
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'buildflow-query-cache',
  throttleTime: 1000,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => query.state.status === 'success',
          },
        }}
        onSuccess={() => {
          // Une fois le cache restauré depuis le localStorage, on relance les
          // mutations qui étaient en attente (créées hors-ligne) si la connexion est revenue.
          queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
        }}
      >
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Retire l'écran de lancement statique (défini dans index.html, visible dès le
// premier octet HTML) une fois que React a peint son propre écran de chargement
// (le SplashS