import { useState } from 'react';
import { Map, Box, Camera } from 'lucide-react';
import { PlansTab } from '@/modules/plans/PlansTab';
import { Models3dTab } from '@/modules/models3d/Models3dTab';
import { CapturesPanel } from '@/modules/captures/CapturesPanel';
import { cn } from '@/utils/cn';

interface PlansAnd3dTabProps {
  projectId: string;
}

type View = 'plans' | 'models3d' | 'captures';

export function PlansAnd3dTab({ projectId }: PlansAnd3dTabProps) {
  const [view, setView] = useState<View>('plans');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-fit gap-1 rounded-lg border border-slate-200/70 bg-white p-1 shadow-soft">
        <button
          onClick={() => setView('plans')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            view === 'plans' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          )}
        >
          <Map className="h-4 w-4" />
          Plans
        </button>
        <button
          onClick={() => setView('models3d')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            view === 'models3d' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          )}
        >
          <Box className="h-4 w-4" />
          Maquettes 3D
        </button>
        <button
          onClick={() => setView('captures')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            view === 'captures' ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          )}
        >
          <Camera className="h-4 w-4" />
          Mes captures
        </button>
      </div>

      {view === 'plans' && <PlansTab projectId={projectId} />}
      {view === 'models3d' && <Models3dTab projectId={projectId} />}
      {view === 'captures' && <CapturesPanel projectId={projectId} />}
    </div>
  );
}
