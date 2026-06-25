import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationsDropdown } from './NotificationsDropdown';

export function Topbar({ title, showBack }: { title?: string; showBack?: boolean }) {
  const { profile, organization, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

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
        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors duration-150 hover:bg-slate-100"
          >
            <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
            <span className="text-sm font-medium text-slate-700">{profile?.full_name ?? profile?.email}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 z-40 mt-2 w-48 rounded-xl border border-slate-200/70 bg-white py-1.5 shadow-popover">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
