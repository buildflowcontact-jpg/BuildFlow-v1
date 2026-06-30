import { useState } from 'react';
import { FileText, FileInput, Receipt } from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { QuotesPanel } from './QuotesPanel';
import { ReceivedQuotesPanel } from './ReceivedQuotesPanel';
import { InvoicesPanel } from './InvoicesPanel';

const TABS: TabItem[] = [
  { key: 'quotes', label: 'Devis', icon: FileText },
  { key: 'received-quotes', label: 'Devis reçus', icon: FileInput },
  { key: 'invoices', label: 'Factures', icon: Receipt },
];

interface BillingTabProps {
  projectId: string;
}

export function BillingTab({ projectId }: BillingTabProps) {
  const [active, setActive] = useState('quotes');

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === 'quotes' && <QuotesPanel projectId={projectId} />}
      {active === 'received-quotes' && <ReceivedQuotesPanel projectId={projectId} />}
      {active === 'invoices' && <InvoicesPanel projectId={projectId} />}
    </div>
  );
}
