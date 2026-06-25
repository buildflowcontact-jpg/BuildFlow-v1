import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { router } from './App';
import { AuthProvider } from './app/AuthProvider';
import { ErrorBoundary } from './app/ErrorBoundary';
import './index.css';

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
// (le SplashScreen affiché par AuthProvider pendant l'initialisation). Le double
// requestAnimationFrame garantit qu'on attend bien le rendu effectif avant de
// faire disparaître l'écran statique, évitant tout flash d'écran blanc.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('initial-splash');
    if (!splash) return;
    splash.classList.add('is-hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  });
});
