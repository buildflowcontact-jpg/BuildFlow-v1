import { useState } from 'react';
import { Pencil, Trash2, Send, Check, X, ArrowRightCircle } from 'lucide-react';
import { useQuote, useUpdateQuote } from '@/hooks/useQuotes';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { QUOTE_STATUS_LABELS } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import type { QuoteItemInput } from '@/services/quotes.service';
import { LineItemsEditor } from './LineItemsEditor';
import { emptyLineItemRow, lineRowsToItems, type LineItemRow } from './lineItemsForm';
import { STATUS_TONE, type QuoteFormState } from './quoteForm';

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

export function QuoteDetailModal({
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
