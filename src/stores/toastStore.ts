import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push(kind, message) {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      4000
    );
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/**
 * Utilitaire impératif pour émettre des toasts depuis n'importe quel
 * service, hook ou callback sans avoir besoin d'un composant React.
 *
 * Usage :
 *   import { toast } from '@/stores/toastStore';
 *   toast.success('Projet enregistré');
 *   toast.error('Connexion impossible');
 */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
};
