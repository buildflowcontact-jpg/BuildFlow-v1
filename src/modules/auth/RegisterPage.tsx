import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { JOB_TITLE_OPTIONS } from '@/types/domain';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { signUp, loading, error } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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

    await signUp(email, password, {
      firstName,
      lastName,
      jobTitle,
      companyName,
      phone,
    });
    setSuccess(true);
    setTimeout(() => navigate('/login', { replace: true }), 1500);
  }

  return (
    <AuthLayout title="Créer un compte" subtitle="Démarrez la gestion de vos chantiers">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            name="firstName"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Nom"
            name="lastName"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <Select label="Profession" name="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
          <option value="" disabled>
            Sélectionner une profession…
          </option>
          {JOB_TITLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Input
          label="Entreprise"
          name="companyName"
          autoComplete="organization"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
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
          label="Numéro de téléphone"
          type="tel"
          name="phone"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Mot de passe"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          hint="8 caractères minimum"
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
        {success && (
          <p className="text-sm text-emerald-600">Compte créé ! Vérifiez vos emails puis connectez-vous.</p>
        )}
        <Button type="submit" loading={loading} className="w-full">
          Créer mon compte
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
