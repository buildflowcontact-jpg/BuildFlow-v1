import { useEffect, type ReactNode } from 'react';
import { authService } from '@/services/auth.service';
import { organizationsService } from '@/services/organizations.service';
import { useAuthStore } from '@/stores/authStore';
import { SplashScreen } from '@/components/ui/SplashScreen';

export function AuthProvider({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const setInitializing = useAuthStore((s) => s.setInitializing);
  const initializing = useAuthStore((s) => s.initializing);

  useEffect(() => {
    let isMounted = true;

    async function hydrate(userId: string) {
      const [profile, orgs] = await Promise.all([
        authService.getProfile(userId),
        organizationsService.listMine(),
      ]);
      if (!isMounted) return;
      setProfile(profile);
      setOrganization(orgs[0] ?? null);
    }

    // Filet de securite : si getSession() (ou l'hydratation profil/organisation)
    // reste bloque - verrou navigateur orphelin de supabase-js, coupure reseau,
    // etc. - on ne laisse jamais l'ecran de chargement tourner indefiniment.
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setInitializing(false);
    }, 8000);

    authService
      .getSession()
      .then((s) => {
        if (!isMounted) return;
        setSession(s);
        if (s?.user) {
          hydrate(s.user.id).finally(() => isMounted && setInitializing(false));
        } else {
          setInitializing(false);
        }
      })
      .catch((error) => {
        // Une session illisible ne doit pas bloquer l'acces a la page de connexion.
        console.error('Erreur lors de la recuperation de la session :', error);
        if (isMounted) setInitializing(false);
      })
      .finally(() => clearTimeout(safetyTimeout));

    const { data: subscription } = authService.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await hydrate(newSession.user.id);
      } else {
        setProfile(null);
        setOrganization(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
