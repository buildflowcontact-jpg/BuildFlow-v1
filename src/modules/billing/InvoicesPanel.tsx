import { useState } from 'react';
import { Plus, Receipt, Pencil, Trash2, Send, Ban, Download, CreditCard, X } from 'lucide-react';
import { useInvoices, useInvoice, useUpdateInvoice } from '@/hooks/useInvoices';
import { useClients } from '@/hooks/useClients';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { INVOICE_STATUS_LABELS, INVOICE_OPERATION_CATEGORY_LABELS } from '@/types/domain';
import type { Invoice } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import type { InvoiceItemInput } from '@/services/invoices.service';
import { LineItemsEditor, emptyLineItemRow, lineRowsToItems, type LineItemRow } from './LineItemsEditor';

const STATUS_TONE: Record<Invoice['status'], 'slate' | 'blue' | 'green' | 'red' | 'yellow' | 'purple'> = {
  draft: 'slate',
  sent: 'blue',
  partially_paid: 'purple',
  paid: 'green',
  overdue: 'red',
  cancelled: 'slate',
};

interface InvoiceFormState {
  title: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  operation_category: Invoice['operation_category'];
  notes: string;
}

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
  const [detailId, setDetailId] = useState<string | null>(null);

  function clientName(clientId: string | null) {
    if (!clientId) return '—';
    const client = clients.find((c) => c.id === clientId);
    return client?.company_name ?? client?.name ?? '—';
  }

  function openCreate() {
    setForm(emptyForm());
    setRows([emptyLineItemRow()]);
    setCreateOpen(true);
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = lineRowsToItems<InvoiceItemInput>(rows);
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
            <Input
              label="Titre"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select
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
            <Input
              type="date"
              label="Date d'émission"
              value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            />
            <Input
              type="date"
              label="Échéance (optionnel)"
              hint="Calculée automatiquement à partir du délai de paiement par défaut si laissée vide."
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
            <Select
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

interface PaymentFormState {
  amount: string;
  paid_at: string;
  method: string;
  notes: string;
}

function emptyPaymentForm(): PaymentFormState {
  return { amount: '', paid_at: new Date().toISOString().slice(0, 10), method: '', notes: '' };
}

interface InvoiceDetailModalProps {
  invoiceId: string;
  projectId: string;
  clientName: (clientId: string | null) => string;
  onClose: () => void;
}

function InvoiceDetailModal({ invoiceId, projectId, clientName, onClose }: InvoiceDetailModalProps) {
  const { data: invoice, isLoading, addPayment, removePayment, generateFacturX } = useInvoice(invoiceId);
  const { send, cancel, remove } = useInvoices(projectId);
  const updateInvoice = useUpdateInvoice(invoiceId, projectId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InvoiceFormState | null>(null);
  const [rows, setRows] = useState<LineItemRow[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(emptyPaymentForm());
  const [facturXError, setFacturXError] = useState<string | null>(null);

  function startEdit() {
    if (!invoice) return;
    setForm({
      title: invoice.title,
      client_id: invoice.client_id ?? '',
      issue_date: invoice.issue_date,
      due_date: invoice.due_date ?? '',
      operation_category: invoice.operation_category,
      notes: invoice.notes ?? '',
    });
    setRows(
      invoice.items.length > 0
        ? invoice.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unit_price: String(item.unit_price),
            vat_rate: String(item.vat_rate),
          }))
        : [emptyLineItemRow()]
    );
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateInvoice.mutate(
      {
        payload: {
          title: form.title,
          client_id: form.client_id || null,
          issue_date: form.issue_date,
          due_date: form.due_date || null,
          operation_category: form.operation_category,
          notes: form.notes || null,
        },
        items: lineRowsToItems<InvoiceItemInput>(rows),
      },
      { onSuccess: () => setEditing(false) }
    );
  }

  function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    addPayment.mutate(
      {
        amount: Number(paymentForm.amount) || 0,
        paid_at: paymentForm.paid_at,
        method: paymentForm.method || null,
        notes: paymentForm.notes || null,
      },
      {
        onSuccess: () => {
          setPaymentOpen(false);
          setPaymentForm(emptyPaymentForm());
        },
      }
    );
  }

  async function handleDownloadFacturX() {
    setFacturXError(null);
    try {
      const result = await generateFacturX.mutateAsync();
      window.open(result.signedUrl, '_blank', 'noopener');
    } catch (err) {
      setFacturXError(err instanceof Error ? err.message : 'Échec de la génération de la facture Factur-X.');
    }
  }

  const due = invoice ? invoice.total - invoice.amount_paid : 0;

  return (
    <Modal open onClose={onClose} title={invoice ? `Facture #${invoice.number ?? '—'}` : 'Facture'} size="xl">
      {isLoading || !invoice ? (
        <Spinner />
      ) : editing && form ? (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input
              type="date"
              label="Échéance"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <LineItemsEditor rows={rows} onChange={setRows} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={updateInvoice.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-slate-800">{invoice.title}</p>
              <p className="text-sm text-slate-500">{clientName(invoice.client_id)}</p>
            </div>
            <Badge tone={STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">Qté</th>
                  <th className="px-2 py-2 text-left">Unité</th>
                  <th className="px-2 py-2 text-left">Prix unit. HT</th>
                  <th className="px-2 py-2 text-left">TVA</th>
                  <th className="px-3 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1.5">{item.description}</td>
                    <td className="px-2 py-1.5">{item.quantity}</td>
                    <td className="px-2 py-1.5">{item.unit}</td>
                    <td className="px-2 py-1.5">{formatCurrency(item.unit_price)}</td>
                    <td className="px-2 py-1.5">{item.vat_rate} %</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Total HT</span>
                <span className="font-medium text-slate-800">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">TVA</span>
                <span className="font-medium text-slate-800">{formatCurrency(invoice.vat_amount)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="font-medium text-slate-700">Total TTC</span>
                <span className="font-semibold text-slate-900">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Déjà réglé</span>
                <span className="font-medium text-emerald-600">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 py-1 pt-1.5">
                <span className="font-medium text-slate-700">Solde dû</span>
                <span className="font-semibold text-slate-900">{formatCurrency(due)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Paiements</p>
              {invoice.status !== 'cancelled' && (
                <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                  <CreditCard className="h-4 w-4" />
                  Enregistrer un paiement
                </Button>
              )}
            </div>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun paiement enregistré.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-800">{formatCurrency(payment.amount)}</span>
                      <span className="ml-2 text-slate-400">le {formatDate(payment.paid_at)}</span>
                      {payment.method && <span className="ml-2 text-slate-400">({payment.method})</span>}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce paiement ?')) removePayment.mutate(payment.id);
                      }}
                      className="rounded-lg p-1 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {invoice.notes && <p className="text-sm text-slate-600">{invoice.notes}</p>}
          <ErrorMessage error={facturXError} />

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="outline" loading={generateFacturX.isPending} onClick={handleDownloadFacturX}>
              <Download className="h-4 w-4" />
              Télécharger (Factur-X)
            </Button>
            {invoice.status === 'draft' && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    if (confirm('Supprimer cette facture ?')) remove.mutate(invoice.id, { onSuccess: onClose });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
                <Button loading={send.isPending} onClick={() => send.mutate(invoice.id)}>
                  <Send className="h-4 w-4" />
                  Envoyer au client
                </Button>
              </>
            )}
            {invoice.status !== 'cancelled' && invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <Button
                variant="outline"
                className="text-red-600"
                loading={cancel.isPending}
                onClick={() => {
                  if (confirm('Annuler cette facture ?')) cancel.mutate(invoice.id);
                }}
              >
                <Ban className="h-4 w-4" />
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Enregistrer un paiement">
        <form onSubmit={handleAddPayment} className="flex flex-col gap-4">
          <Input
            type="number"
            step="0.01"
            label="Montant (€)"
            required
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
          />
          <Input
            type="date"
            label="Date de paiement"
            required
            value={paymentForm.paid_at}
            onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
          />
          <Input
            label="Moyen de paiement"
            placeholder="Virement, chèque, CB..."
            value={paymentForm.method}
            onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={addPayment.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>
    </Modal>
  );
}
