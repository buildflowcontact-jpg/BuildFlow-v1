import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 via-slate-50 to-brand-50/20">
      <p className="text-5xl font-bold tracking-tight text-slate-300">404</p>
      <p className="text-slate-600">Cette page n'existe pas.</p>
      <Link to="/">
        <Button>Retour au tableau de bord</Button>
      </Link>
    </div>
  );
}
