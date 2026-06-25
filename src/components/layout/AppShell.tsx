import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { OfflineBanner } from './OfflineBanner';

interface RouteHandle {
  title?: string;
  showBack?: boolean;
}

export function AppShell() {
  const matches = useMatches();
  const current = matches[matches.length - 1];
  const handle = current?.handle as RouteHandle | undefined;
  const title = handle?.title;
  const showBack = handle?.showBack ?? false;
  const queryClient = useQueryClient();

  // Dès que la connexion revient, on relance les mutations mises en attente
  // (créées/modifiées hors-ligne) puis on revalide les données affichées.
  useEffect(() => {
    function handleOnline() {
      queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries());
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-slate-50 to-brand-50/20">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        <Topbar title={title} showBack={showBack} />
        <main className="flex-1 overflow-y-auto p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
