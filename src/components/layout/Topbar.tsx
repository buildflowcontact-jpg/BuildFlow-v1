import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationsDropdown } from './NotificationsDropdown';

export function Topbar({ title, showBack }: { title?: string; showBack?: boolean }) {
  const { organization } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-7 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            title="Retour"
            aria-label="Retour"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          {title && <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>}
          {organization && <p className="text-xs text-slate-400">{organization.name}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationsDropdown />
      </div>
    </header>
  );
}
