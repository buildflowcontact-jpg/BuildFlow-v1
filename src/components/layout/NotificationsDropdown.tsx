import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelative } from '@/utils/date';
import { cn } from '@/utils/cn';

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors duration-150 hover:bg-slate-100"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200/70 bg-white shadow-popover">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Aucune notification</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markAsRead.mutate(n.id);
                  setOpen(false);
                  if (n.link) navigate(n.link);
                }}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50',
                  !n.is_read && 'bg-brand-50/40'
                )}
              >
                <span className="text-sm font-medium text-slate-800">{n.title}</span>
                {n.message && <span className="text-xs text-slate-500">{n.message}</span>}
                <span className="text-[11px] text-slate-400">{formatRelative(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
