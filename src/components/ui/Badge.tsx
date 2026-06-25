import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'slate' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';

const toneClasses: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  yellow: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-violet-50 text-violet-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'slate', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
