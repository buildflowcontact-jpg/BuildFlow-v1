import { useState } from 'react';
import { Plus, FileSignature, Pencil, Trash2, Send, Check, X } from 'lucide-react';
import { useChangeOrders } from '@/hooks/useChangeOrders';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { CHANGE_ORDER_STATUS_LABELS } from '@/types/domain';
import { formatCurrency } from '@/utils/currency';
import { formatDate, formatDateTime } from '@/utils/date';
import type { ChangeOrder } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';
import { confirmStore } from '@/components/ui/ConfirmModal';

const STATUS_TONE: Record<ChangeOrder['status'], 'slate' | 'yellow' | 'green' | 'red'> = {
  draft: 'slate',
  pending_approval: 'yellow',
  approved: 'green',
  rejected: 'red',
};

type ChangeOrderFormState = {
  title: string;
  description: string;
  cost_impact: string;
  delay_impact_days: string;
};

function emptyForm(): ChangeOrderFormState {
  return { title: '', description: '', cost_impact: '', delay_impact_days: '' };
}

interface ChangeOrdersTabProps {
  projectId: string;
}

export function ChangeOrdersTab({ projectId }: ChangeOrdersTabProps) {
  const { changeOrders, isLoading, create, update, submitForApproval, decide, remove } = useChangeOrders(projectId);
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useAuthStore((s) => s.profile);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ChangeOrder | null>(null);
  const [form, setForm] = useState<ChangeOrderFormState>(emptyForm());

  const [decideTarget, setDecideTarget] = useState<ChangeOrder | null>(null);
  const [decideApprove, setDecideApprove] = useState(true);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(co: ChangeOrder) {
    setEditing(co);
    setForm({
      title: co.title,
      description: co.description ?? '',
      cost_impact: co.cost_impact.toString(),
      delay_impact_days: co.delay_impact_days.toString(),
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      title: form.title,
      description: form.description || null,
      cost_impact: form.cost_impact ? Number(form.cost_impact) : 0,
      delay_impact_days: form.delay_impact_days ? Number(form.delay_impact_days) : 0,
    };
    if (editing) {
      update.mutate({ id: editing.id, payload: base }, { onSuccess: () => setModalOpen(false) });
    } else {
      const payload: Omit<TablesInsert<'change_orders'>, 'project_id' | 'number'> & { number: number } = {
        number: null as unknown as number,
        ...base,
        requested_by: userId ?? null,
      };
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  function openDecide(co: ChangeOrder, approve: boolean) {
    setDecideTarget(co);
    setDecideApprove(approve);
    setSignerName(profile?.full_name ?? profile?.email ?? '');
    setSignatureData(null);
  }

  function handleDecideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decideTarget) return;
    decide.mutate(
      {
        changeOrderId: decideTarget.id,
        approve: decideApprove,
        signature: decideApprove && signatureData ? { data: signatureData, signerName } : undefined,
      },
      { onSuccess: () => setDecideTarget(null) }
    );
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Avenants</h3>
          <p className="text-sm text-slate-500">{changeOrders.length} avenant(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvel avenant
        </Button>
      </div>

      {changeOrders.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Aucun avenant"
          description="Formalisez les modifications de périmètre, coût ou délai avec signature électronique."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {changeOrders.map((co) => (
            <li key={co.id} className="py-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    Avenant #{co.number} — {co.title}
                  </p>
                  {co.description && <p className="mt-0.5 text-slate-600">{co.description}</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                    <span className={co.cost_impact > 0 ? 'text-amber-600' : co.cost_impact < 0 ? 'text-emerald-600' : ''}>
                      Impact coût : {formatCurrency(co.cost_impact)}
                    </span>
                    {co.delay_impact_days !== 0 && (
                      <span>
                        Impact délai : {co.delay_impact_days > 0 ? '+' : ''}
                        {co.delay_impact_days} j
                      </span>
                    )}
                    {co.decided_at && <span>Décidé le {formatDateTime(co.decided_at)}</span>}
                    <span>Créé le {formatDate(co.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[co.status]}>{CHANGE_ORDER_STATUS_LABELS[co.status]}</Badge>
                  {co.status === 'draft' && (
                    <>
                      <button
                        onClick={() => submitForApproval.mutate(co.id)}
                        title="Soumettre pour approbation"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-brand-600"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(co)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          confirmStore.getState().show({ message: 'Supprimer cet avenant ?' }).then((ok) => { if (ok) remove.mutate(co.id); });
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {co.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => openDecide(co, true)}
                        title="Approuver"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDecide(co, false)}
                        title="Rejeter"
                        className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'avenant" : 'Nouvel avenant'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="form-title" label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-cost-impact"
              type="number"
              step="0.01"
              label="Impact coût (€)"
              value={form.cost_impact}
              onChange={(e) => setForm({ ...form, cost_impact: e.target.value })}
            />
            <Input id="form-delay-impact-days"
              type="number"
              label="Impact délai (jours)"
              value={form.delay_impact_days}
              onChange={(e) => setForm({ ...form, delay_impact_days: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!decideTarget}
        onClose={() => setDecideTarget(null)}
        title={decideTarget ? `${decideApprove ? 'Approuver' : 'Rejeter'} — Avenant #${decideTarget.number}` : ''}
      >
        <form onSubmit={handleDecideSubmit} className="flex flex-col gap-4">
          {decideApprove ? (
            <>
              <Input id="signername" label="Nom du signataire" required value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Signature</p>
                <SignaturePad onChange={setSignatureData} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Confirmez-vous le rejet de cet avenant ?</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDecideTarget(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={decide.isPending} disabled={decideApprove && (!signatureData || !signerName.trim())}>
              Confirmer
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
