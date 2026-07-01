import { create } from 'zustand';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

// ── Store Zustand (singleton) ────────────────────────────────────────────────

export interface ConfirmOptions {
  /** Texte principal de la modale. */
  message: string;
  /** Titre optionnel (défaut : "Confirmer"). */
  title?: string;
  /** Libellé du bouton de confirmation (défaut : "Confirmer"). */
  confirmLabel?: string;
  /** Déclenche la variante rouge "danger" (défaut). */
  variant?: 'danger' | 'warning';
}

interface ConfirmStore {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  show: (opts: ConfirmOptions | string) => Promise<boolean>;
  _close: (result: boolean) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const confirmStore = create<ConfirmStore>((set, get) => ({
  open: false,
  options: { message: '' },
  resolve: null,

  show(opts) {
    const options: ConfirmOptions =
      typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      set({ open: true, options, resolve });
    });
  },

  _close(result) {
    get().resolve?.(result);
    set({ open: false, resolve: null });
  },
}));

/**
 * Hook React pour déclencher la modale de confirmation.
 *
 * Usage dans un composant :
 *   const confirm = useConfirm();
 *   confirm({ message: 'Supprimer ce projet ?' }).then(ok => {
 *     if (ok) remove.mutate(id);
 *   });
 *
 * Depuis un service/hook (sans composant) :
 *   import { confirmStore } from '@/components/ui/ConfirmModal';
 *   confirmStore.getState().show('Supprimer ?').then(ok => { if (ok) ... });
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return confirmStore((s) => s.show);
}

// ── Composant à monter une seule fois dans AppShell ──────────────────────────

export function ConfirmModal() {
  const { open, options, _close } = confirmStore();
  const isDanger = options.variant !== 'warning';

  return (
    <Modal
      open={open}
      onClose={() => _close(false)}
      title={options.title ?? (isDanger ? 'Confirmer la suppression' : 'Confirmer')}
      size="sm"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isDanger ? 'bg-red-100' : 'bg-amber-100'
          }`}
        >
          {isDanger ? (
            <Trash2 className="h-5 w-5 text-red-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
        </div>
        <p className="pt-1.5 text-sm text-slate-600">{options.message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => _close(false)}>
          Annuler
        </Button>
        <Button
          type="button"
          variant={isDanger ? 'danger' : 'secondary'}
          onClick={() => _close(true)}
        >
          {options.confirmLabel ?? (isDanger ? 'Supprimer' : 'Confirmer')}
        </Button>
      </div>
    </Modal>
  );
}
