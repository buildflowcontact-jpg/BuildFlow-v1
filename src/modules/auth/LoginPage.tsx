import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { signIn, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await signIn(email, password);
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    navigate(redirectTo, { replace: true });
  }

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à vos projets BTP">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Adresse email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Se connecter
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  );
}
