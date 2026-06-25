import { ChevronDown } from 'lucide-react';
import { PROJECT_SECTIONS, getProjectSection } from '@/modules/projects/projectSections';

interface ProjectSplitViewProps {
  projectId: string;
  leftKey: string;
  rightKey: string;
  onChangeLeft: (key: string) => void;
  onChangeRight: (key: string) => void;
}

function PaneSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {PROJECT_SECTIONS.map((section) => (
          <option key={section.key} value={section.key}>
            {section.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function Pane({
  projectId,
  sectionKey,
  onChange,
}: {
  projectId: string;
  sectionKey: string;
  onChange: (key: string) => void;
}) {
  const section = getProjectSection(sectionKey) ?? PROJECT_SECTIONS[0]!;
  const Component = section.Component;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <section.icon className="h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <PaneSelector value={sectionKey} onChange={onChange} />
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto pb-2">
        <Component projectId={projectId} />
      </div>
    </div>
  );
}

export function ProjectSplitView({
  projectId,
  leftKey,
  rightKey,
  onChangeLeft,
  onChangeRight,
}: ProjectSplitViewProps) {
  return (
    <div className="flex h-full min-h-0 gap-5">
      <Pane projectId={projectId} sectionKey={leftKey} onChange={onChangeLeft} />
      <div className="w-px shrink-0 bg-slate-200" />
      <Pane projectId={projectId} sectionKey={rightKey} onChange={onChangeRight} />
    </div>
  );
}
