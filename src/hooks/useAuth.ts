import { useCallback, useState } from 'react';
import { authService, type SignUpProfileData } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const organization = useAuthStore((s) => s.organization);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, profileData: SignUpProfileData) => {
    setLoading(true);
    setError(null);
    try {
      await authService.signUp(email, password, profileData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'inscription");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await authService.sendPasswordReset(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'envoi de l'email");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      await authService.updatePassword(newPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour du mot de passe');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    session,
    profile,
    organization,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    loading,
    error,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
  };
}
