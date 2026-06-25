import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const { updatePassword, loading, error } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 8) {
      setLocalError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Les mots de passe ne correspondent pas.');
      return;
    }

    await updatePassword(password);
    setSuccess(true);
    setTimeout(() => navigate('/', { replace: true }), 1200);
  }

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nouveau mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {(localError || error) && <p className="text-sm text-red-600">{localError ?? error}</p>}
        {success && <p className="text-sm text-emerald-600">Mot de passe mis à jour, redirection…</p>}
        <Button type="submit" loading={loading} className="w-full">
          Mettre à jour
        </Button>
      </form>
    </AuthLayout>
  );
}
