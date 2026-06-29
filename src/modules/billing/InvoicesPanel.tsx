import { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { INVOICE_STATUS_LABELS, INVOICE_OPERATION_CATEGORY_LABELS } from '@/types/domain';
import type { Invoice } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import type { InvoiceItemInput } from '@/services/invoices.service';
import { LineItemsEditor } from './LineItemsEditor';
import { emptyLineItemRow, lineRowsToItems, type LineItemRow } from './lineItemsForm';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { STATUS_TONE, type InvoiceFormState } from './invoiceForm';
import { invoiceFormSchema, lineItemsSchema, validateOrError } from '@/schemas/billing.schema';

function emptyForm(): InvoiceFormState {
  return {
    title: '',
    client_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    operation_category: 'services',
    notes: '',
  };
}

interface InvoicesPanelProps {
  projectId: string;
}

export function InvoicesPanel({ projectId }: InvoicesPanelProps) {
  const { invoices, isLoading, create } = useInvoices(projectId);
  const { clients } = useClients();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<InvoiceFormState>(emptyForm());
  const [rows, setRows] = useState<LineItemRow[]>([emptyLineItemRow()]);
  const [formError, setFormError] = useState<Error | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  function clientName(clientId: string | null) {
    if (!clientId) return '—';
    const client = clients.find((c) => c.id === clientId);
    return client?.company_name ?? client?.name ?? '—';
  }

  function openCreate() {
    setForm(emptyForm());
    setRows([emptyLineItemRow()]);
    setFormError(null);
    setCreateOpen(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formCheck = validateOrError(invoiceFormSchema, form);
    if (formCheck.error) {
      setFormError(formCheck.error);
      return;
    }
    const items = lineRowsToItems<InvoiceItemInput>(rows);
    const itemsCheck = validateOrError(lineItemsSchema, items);
    if (itemsCheck.error) {
      setFormError(itemsCheck.error);
      return;
    }
    setFormError(null);
    create.mutate(
      {
        payload: {
          title: form.title,
          client_id: form.client_id || null,
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          operation_category: form.operation_category,
          notes: form.notes || null,
          currency: 'EUR',
        },
        items,
      },
      { onSuccess: () => setCreateOpen(false) }
    );
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Factures</h3>
          <p className="text-sm text-slate-500">{invoices.length} facture(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune facture"
          description="Créez une facture libre, ou convertissez un devis accepté depuis l'onglet Devis."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="py-3 text-sm">
              <button
                onClick={() => setDetailId(invoice.id)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    Facture #{invoice.number ?? '—'} — {invoice.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                    <span>{clientName(invoice.client_id)}</span>
                    <span>Émise le {formatDate(invoice.issue_date)}</span>
                    {invoice.due_date && <span>Échéance le {formatDate(invoice.due_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{formatCurrency(invoice.total)}</p>
                    {invoice.amount_paid > 0 && (
                      <p className="text-xs text-emerald-600">Réglé : {formatCurrency(invoice.amount_paid)}</p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle facture" size="xl">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-title"
              label="Titre"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select id="form-client-id"
              label="Client"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name ?? c.name}
                </option>
              ))}
            </Select>
            <Input id="form-issue-date"
              type="date"
              label="Date d'émission"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
            <Input id="form-due-date"
              type="date"
              label="Échéance (optionnel)"
              hint="Calculée automatiquement à partir du délai de paiement par défaut si laissée vide."
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
            <Select id="form-operation-category"
              label="Catégorie d'opération"
              value={form.operation_category}
              onChange={(e) => setForm({ ...form, operation_category: e.target.value as Invoice['operation_category'] })}
            >
              {Object.entries(INVOICE_OPERATION_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <LineItemsEditor rows={rows} onChange={setRows} />
          <ErrorMessage error={formError} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer la facture
            </Button>
          </div>
        </form>
      </Modal>

      {detailId && (
        <InvoiceDetailModal
          invoiceId={detailId}
          projectId={projectId}
          clientName={clientName}
          onClose={() => setDetailId(null)}
        />
      )}
    </Card>
  );
}
