import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const { sendPasswordReset, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendPasswordReset(email);
    setSent(true);
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation par email">
      {sent ? (
        <p className="text-sm text-emerald-600">
          Un email a été envoyé à {email}. Suivez le lien pour réinitialiser votre mot de passe.
        </p>
      ) : (
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthLayout>
  );
}
