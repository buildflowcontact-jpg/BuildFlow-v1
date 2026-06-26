import { useState } from 'react';
import { ClipboardList, ClipboardCheck, AlertOctagon } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { TemplatesPanel } from './TemplatesPanel';
import { InspectionsPanel } from './InspectionsPanel';
import { NonConformitiesPanel } from './NonConformitiesPanel';

const TABS: TabItem[] = [
  { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { key: 'non_conformities', label: 'Non-conformités', icon: AlertOctagon },
  { key: 'templates', label: 'Modèles', icon: ClipboardList },
];

interface QualityTabProps {
  projectId: string;
}

export function QualityTab({ projectId }: QualityTabProps) {
  const [active, setActive] = useState('inspections');

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === 'inspections' && <InspectionsPanel projectId={projectId} />}
      {active === 'non_conformities' && <NonConformitiesPanel projectId={projectId} />}
      {active === 'templates' && <TemplatesPanel projectId={projectId} />}
    </div>
  );
}
