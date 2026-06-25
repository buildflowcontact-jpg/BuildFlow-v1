import { cn } from '@/utils/cn';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-smooth',
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
