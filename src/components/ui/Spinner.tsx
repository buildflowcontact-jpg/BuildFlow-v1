import { cn } from '@/utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600', className)}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center py-20">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
