import { useState } from 'react';
import { Plus, FileText, FileSpreadsheet } from 'lucide-react';
import { useQuotes } from '@/hooks/useQuotes';
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
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { QUOTE_STATUS_LABELS } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import type { QuoteItemInput } from '@/services/quotes.service';
import { LineItemsEditor, emptyLineItemRow, lineRowsToItems, type LineItemRow } from './LineItemsEditor';
import { DpgfImportModal } from './DpgfImportModal';
import { QuoteDetailModal } from './QuoteDetailModal';
import { STATUS_TONE, type QuoteFormState } from './quoteForm';

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
