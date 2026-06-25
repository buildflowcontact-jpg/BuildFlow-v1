import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
      <div className="rounded-full bg-white p-3.5 shadow-sm">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
