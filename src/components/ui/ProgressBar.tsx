import { cn } from '@/utils/cn';

interface ProgressBarProps {
  value: number;
  className?: string;
  tone?: 'brand' | 'green' | 'red' | 'amber';
}

const toneClasses = {
  brand: 'bg-brand-600',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
};

export function ProgressBar({ value, className, tone = 'brand' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500 ease-smooth', toneClasses[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
