import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(date: string | null | undefined, pattern = 'dd/MM/yyyy'): string {
  if (!date) return '—';
  return format(parseISO(date), pattern, { locale: fr });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return format(parseISO(date), "dd/MM/yyyy 'à' HH:mm", { locale: fr });
}

export function formatRelative(date: string | null | undefined): string {
  if (!date) return '—';
  return formatDistanceToNow(parseISO(date), { addSuffix: true, locale: fr });
}

export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false;
  return isBefore(parseISO(date), new Date());
}

export function isUpcoming(date: string | null | undefined, days = 7): boolean {
  if (!date) return false;
  const target = parseISO(date);
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);
  return isAfter(target, now) && isBefore(target, future);
}

export function daysBetween(start: string, end: string): number {
  const ms = parseISO(end).getTime() - parseISO(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
