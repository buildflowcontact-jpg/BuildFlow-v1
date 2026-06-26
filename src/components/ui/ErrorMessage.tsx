import { AlertTriangle } from 'lucide-react';

interface ErrorMessageProps {
  /** Erreur brute (Error, string, ou autre) ou message déjà formaté. `null`/`undefined` : rien n'est rendu. */
  error: unknown;
  /** Préfixe générique affiché quand `error` n'a pas de message exploitable. */
  fallback?: string;
  className?: string;
}

function toMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Affichage d'erreur partagé (mutation, fetch, validation) : reprend le style
 * déjà utilisé dans DpgfImportModal — la version la plus aboutie qui
 * existait avant unification (cf. audit du 26/06/2026, section UI).
 * Rend `null` si `error` est absent, donc s'utilise en JSX sans condition :
 * `<ErrorMessage error={create.error} />`.
 */
export function ErrorMessage({ error, fallback = 'Une erreur est survenue. Veuillez réessayer.', className = '' }: ErrorMessageProps) {
  if (!error) return null;
  return (
    <div className={`flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{toMessage(error, fallback)}</span>
    </div>
  );
}
