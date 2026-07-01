import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore, type ToastItem, type ToastKind } from '@/stores/toastStore';
import { cn } from '@/utils/cn';

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />,
  info: <Info className="h-4 w-4 shrink-0 text-brand-500" />,
};

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-brand-200 bg-brand-50 text-brand-900',
};

function ToastRow({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-lg',
        STYLES[toast.kind]
      )}
    >
      {ICONS[toast.kind]}
      <p className="flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => dismiss(toast.id)}
        aria-label="Fermer"
        className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** À placer une seule fois dans AppShell — affiche tous les toasts actifs. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-80 flex-col gap-2"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastRow toast={t} />
        </div>
      ))}
    </div>
  );
}
