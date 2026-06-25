import type { ReactNode } from 'react';
import { HardHat } from 'lucide-react';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-brand-50/40 to-violet-50/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-gradient-brand px-3 py-2 text-white shadow-glow">
            <HardHat className="h-5 w-5" />
            <span className="text-lg font-semibold">BuildFlow</span>
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}
