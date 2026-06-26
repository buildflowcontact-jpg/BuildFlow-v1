import { useState } from 'react';
import { Plus, FileText, Pencil, Trash2, Send, Check, X, ArrowRightCircle, FileSpreadsheet } from 'lucide-react';
import { useQuotes, useQuote, useUpdateQuote } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { QUOTE_STATUS_LABELS } from '@/types/domain';
import type { Quote } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import type { QuoteItemInput } from '@/services/quotes.service';
import { LineItemsEditor, emptyLineItemRow, lineRowsToItems, type LineItemRow } from './LineItemsEditor';
import { DpgfImportModal } from './DpgfImportModal';

const STATUS_TONE: Record<Quote['status'], 'slate' | 'blue' | 'green' | 'red' | 'yellow'> = {
  draft: 'slate',
  sent: 'blue',
  accepted: 'green',
  declined: 'red',
  expired: 'yellow',
};

interface QuoteFormState {
  title: string;
  client_id: string;
  issue_date: string;
  validity_until: string;
  notes: string;
}

function emptyForm(): QuoteFormState {
  return {
    title: '',
    client_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    validity_until: '',
    notes: '',
  };
}

interface QuotesPanelProps {
  projectId: string;
}

export function QuotesPanel({ projectId }: QuotesPanelProps) {
  const { quotes, isLoading, create, send, decide, convertToInvoice, remove } = useQuotes(projectId);
  const { clients } = useClients();
  const profile = useAuthStore((s) => s.profile);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<QuoteFormState>(emptyForm());
  const [rows, setRows] = useState<LineItemRow[]>([emptyLineItemRow()]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [decideMode, setDecideMode] = useState<'accept' | 'decline' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

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
    const items = lineRowsToItems<QuoteItemInput>(rows);
    create.mutate(
      {
        payload: {
          title: form.title,
          client_id: form.client_id || null,
          issue_date: form.issue_date,
          validity_until: form.validity_until || null,
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
          <h3 className="text-base font-semibold text-slate-900">Devis</h3>
          <p className="text-sm text-slate-500">{quotes.length} devis</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" />
            Importer DPGF
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau devis
          </Button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description="Créez un devis avec ses lignes pour ce chantier."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {quotes.map((quote) => (
            <li key={quote.id} className="py-3 text-sm">
              <button
                onClick={() => setDetailId(quote.id)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    Devis #{quote.number ?? '—'} — {quote.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                    <span>{clientName(quote.client_id)}</span>
                    <span>Émis le {formatDate(quote.issue_date)}</span>
                    {quote.validity_until && <span>Valide jusqu'au {formatDate(quote.validity_until)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">{formatCurrency(quote.total)}</span>
                  <Badge tone={STATUS_TONE[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau devis" size="xl">
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
              label="Valide jusqu'au"
              value={form.validity_until}
              onChange={(e) => setForm({ ...form, validity_until: e.target.value })}
            />
          </div>
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <LineItemsEditor rows={rows} onChange={setRows} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer le devis
            </Button>
          </div>
        </form>
      </Modal>

      <DpgfImportModal
        projectId={projectId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(quoteId) => setDetailId(quoteId)}
      />

      {detailId && (
        <QuoteDetailModal
          quoteId={detailId}
          projectId={projectId}
          clientName={clientName}
          onClose={() => setDetailId(null)}
          onSend={(id) => send.mutate(id)}
          sendPending={send.isPending}
          onOpenDecide={(mode) => {
            setDecideMode(mode);
            setSignerName(profile?.full_name ?? profile?.email ?? '');
            setSignatureData(null);
          }}
          onConvert={(id) =>
            convertToInvoice.mutate(id, {
              onSuccess: () => setDetailId(null),
            })
          }
          convertPending={convertToInvoice.isPending}
          onDelete={(id) =>
            remove.mutate(id, { onSuccess: () => setDetailId(null) })
          }
        />
      )}

      <Modal
        open={!!decideMode}
        onClose={() => setDecideMode(null)}
        title={decideMode === 'accept' ? 'Accepter le devis' : 'Refuser le devis'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!detailId || !decideMode) return;
            decide.mutate(
              {
                quoteId: detailId,
                accept: decideMode === 'accept',
                signature:
                  decideMode === 'accept' && signatureData ? { data: signatureData, signerName } : undefined,
              },
              { onSuccess: () => setDecideMode(null) }
            );
          }}
          className="flex flex-col gap-4"
        >
          {decideMode === 'accept' ? (
            <>
              <Input label="Nom du signataire" required value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Signature</p>
                <SignaturePad onChange={setSignatureData} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Confirmez-vous le refus de ce devis ?</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDecideMode(null)}>
              Annuler
            </Button>
            <Button
              type="submit"
              loading={decide.isPending}
              disabled={decideMode === 'accept' && (!signatureData || !signerName.trim())}
            >
              Confirmer
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

interface QuoteDetailModalProps {
  quoteId: string;
  projectId: string;
  clientName: (clientId: string | null) => string;
  onClose: () => void;
  onSend: (id: string) => void;
  sendPending: boolean;
  onOpenDecide: (mode: 'accept' | 'decline') => void;
  onConvert: (id: string) => void;
  convertPending: boolean;
  onDelete: (id: string) => void;
}

function QuoteDetailModal({
  quoteId,
  projectId,
  clientName,
  onClose,
  onSend,
  sendPending,
  onOpenDecide,
  onConvert,
  convertPending,
  onDelete,
}: QuoteDetailModalProps) {
  const { data: quote, isLoading } = useQuote(quoteId);
  const updateQuote = useUpdateQuote(quoteId, projectId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<QuoteFormState | null>(null);
  const [rows, setRows] = useState<LineItemRow[]>([]);

  function startEdit() {
    if (!quote) return;
    setForm({
      title: quote.title,
      client_id: quote.client_id ?? '',
      issue_date: quote.issue_date,
      validity_until: quote.validity_until ?? '',
      notes: quote.notes ?? '',
    });
    setRows(
      quote.items.length > 0
        ? quote.items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            unit: item.unit,
            unit_price: String(item.unit_price),
            vat_rate: String(item.vat_rate),
            lot: item.lot ?? '',
          }))
        : [emptyLineItemRow()]
    );
    setEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateQuote.mutate(
      {
        payload: {
          title: form.title,
          client_id: form.client_id || null,
          issue_date: form.issue_date,
          validity_until: form.validity_until || null,
          notes: form.notes || null,
        },
        items: lineRowsToItems<QuoteItemInput>(rows),
      },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <Modal open onClose={onClose} title={quote ? `Devis #${quote.number ?? '—'}` : 'Devis'} size="xl">
      {isLoading || !quote ? (
        <Spinner />
      ) : editing && form ? (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input
              type="date"
              label="Valide jusqu'au"
              value={form.validity_until}
              onChange={(e) => setForm({ ...form, validity_until: e.target.value })}
            />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <LineItemsEditor rows={rows} onChange={setRows} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={updateQuote.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-slate-800">{quote.title}</p>
              <p className="text-sm text-slate-500">{clientName(quote.client_id)}</p>
            </div>
            <Badge tone={STATUS_TONE[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Lot</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-2 py-2 text-left">Qté</th>
                  <th className="px-2 py-2 text-left">Unité</th>
                  <th className="px-2 py-2 text-left">Prix unit. HT</th>
                  <th className="px-2 py-2 text-left">TVA</th>
                  <th className="px-3 py-2 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-1.5 text-slate-400">{item.lot ?? '—'}</td>
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
                <span className="font-medium text-slate-800">{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">TVA</span>
                <span className="font-medium text-slate-800">{formatCurrency(quote.vat_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 py-1 pt-1.5">
                <span className="font-medium text-slate-700">Total TTC</span>
                <span className="font-semibold text-slate-900">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && <p className="text-sm text-slate-600">{quote.notes}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            {quote.status === 'draft' && (
              <>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600"
                  onClick={() => {
                    if (confirm('Supprimer ce devis ?')) onDelete(quote.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
                <Button loading={sendPending} onClick={() => onSend(quote.id)}>
                  <Send className="h-4 w-4" />
                  Envoyer au client
                </Button>
              </>
            )}
            {quote.status === 'sent' && (
              <>
                <Button variant="outline" className="text-red-600" onClick={() => onOpenDecide('decline')}>
                  <X className="h-4 w-4" />
                  Marquer refusé
                </Button>
                <Button onClick={() => onOpenDecide('accept')}>
                  <Check className="h-4 w-4" />
                  Marquer accepté
                </Button>
              </>
            )}
            {quote.status === 'accepted' && (
              <Button loading={convertPending} onClick={() => onConvert(quote.id)}>
                <ArrowRightCircle className="h-4 w-4" />
                Convertir en facture
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
