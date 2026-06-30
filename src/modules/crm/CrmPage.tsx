import { useState } from 'react';
import { Plus, Calendar, Euro, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useProspects, useProspectVisits } from '@/hooks/useProspects';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import {
  PROSPECT_STATUS_LABELS,
  PROSPECT_SOURCE_LABELS,
} from '@/types/domain';
import type { Prospect } from '@/types/domain';
import type { ProspectStatus, ProspectSource, TablesInsert } from '@/types/database.types';
import { formatDate } from '@/utils/date';

const STATUS_TONE: Record<ProspectStatus, 'blue' | 'purple' | 'red' | 'green'> = {
  prospect: 'blue',
  visite_planifiee: 'purple',
  devis_en_cours: 'blue',
  gagne: 'green',
  perdu: 'red',
  sans_suite: 'red',
};

const PIPELINE_STAGES: ProspectStatus[] = ['prospect', 'visite_planifiee', 'devis_en_cours'];
const CLOSED_STAGES: ProspectStatus[] = ['gagne', 'perdu', 'sans_suite'];

type ProspectFormState = {
  name: string;
  client_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  work_type: string;
  estimated_budget: string;
  source: ProspectSource;
  status: ProspectStatus;
  next_action: string;
  next_action_date: string;
  notes: string;
};

function emptyProspectForm(): ProspectFormState {
  return {
    name: '',
    client_name: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    work_type: '',
    estimated_budget: '',
    source: 'autre',
    status: 'prospect',
    next_action: '',
    next_action_date: '',
    notes: '',
  };
}

// ---------- Sub-component: Visits panel ----------

function VisitsPanel({ prospect }: { prospect: Prospect }) {
  const { visits, isLoading, create, remove } = useProspectVisits(prospect.id);
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState('');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');

  function handleAddVisit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      visit_date: visitDate,
      duration_minutes: duration ? parseInt(duration) : null,
      attendees: attendees || null,
      notes: notes || null,
      outcome: outcome || null,
      created_by: profile?.id ?? null,
    } as Omit<TablesInsert<'prospect_visits'>, 'prospect_id'>);
    setDuration(''); setAttendees(''); setNotes(''); setOutcome('');
    setVisitDate(new Date().toISOString().slice(0, 10));
    setOpen(false);
  }

  if (isLoading) return <p className="text-sm text-slate-400">Chargement…</p>;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Visites techniques ({visits.length})</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {open && (
        <form onSubmit={handleAddVisit} className="mb-3 flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              id="visit-date"
              label="Date"
              type="date"
              required
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
            <Input
              id="visit-duration"
              label="Durée (min)"
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <Input
            id="visit-attendees"
            label="Participants"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
          />
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Textarea
            label="Suite donnée"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" size="sm" loading={create.isPending}>Enregistrer</Button>
          </div>
        </form>
      )}

      {visits.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune visite enregistrée.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visits.map((v) => (
            <li key={v.id} className="flex items-start justify-between rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-700">
                  {formatDate(v.visit_date)}
                  {v.duration_minutes ? ` · ${v.duration_minutes} min` : ''}
                </p>
                {v.attendees && <p className="text-xs text-slate-500">Participants : {v.attendees}</p>}
                {v.notes && <p className="text-xs text-slate-500 mt-0.5">{v.notes}</p>}
                {v.outcome && <p className="text-xs text-slate-600 mt-0.5 font-medium">→ {v.outcome}</p>}
              </div>
              <button
                onClick={() => { if (confirm('Supprimer cette visite ?')) remove.mutate(v.id); }}
                className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Supprimer la visite"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Sub-component: Prospect card ----------

function ProspectCard({
  prospect,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  prospect: Prospect;
  onEdit: (p: Prospect) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ProspectStatus) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
         onClick={() => onEdit(prospect)}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 leading-snug">{prospect.name}</p>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer ce prospect ?')) onDelete(prospect.id); }}
          className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
          aria-label="Supprimer le prospect"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {prospect.client_name && <p className="text-xs text-slate-500 mb-1">{prospect.client_name}</p>}
      {prospect.work_type && <p className="text-xs text-slate-400 mb-1">{prospect.work_type}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mb-2">
        {prospect.estimated_budget != null && (
          <span className="flex items-center gap-0.5">
            <Euro className="h-3 w-3" />
            {prospect.estimated_budget.toLocaleString('fr-FR')} €
          </span>
        )}
        {prospect.contact_name && <span>{prospect.contact_name}</span>}
        {prospect.next_action_date && (
          <span className="flex items-center gap-0.5 text-amber-500">
            <Calendar className="h-3 w-3" />
            {formatDate(prospect.next_action_date)}
          </span>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          id={`status-${prospect.id}`}
          value={prospect.status}
          onChange={(e) => onStatusChange(prospect.id, e.target.value as ProspectStatus)}
          className="h-7 text-xs"
        >
          {(Object.keys(PROSPECT_STATUS_LABELS) as ProspectStatus[]).map((s) => (
            <option key={s} value={s}>{PROSPECT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}

// ---------- Main CRM page ----------

export default function CrmPage() {
  const { prospects, isLoading, create, update, remove } = useProspects();
  const { profile } = useAuth();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ProspectFormState>(emptyProspectForm());
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    create.mutate({
      name: form.name.trim(),
      client_name: form.client_name || null,
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      address: form.address || null,
      work_type: form.work_type || null,
      estimated_budget: form.estimated_budget ? parseFloat(form.estimated_budget) : null,
      source: form.source,
      status: form.status,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes || null,
      created_by: profile?.id ?? null,
    } as Omit<TablesInsert<'prospects'>, 'organization_id'>);
    setCreateOpen(false);
  }

  function handleSaveDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!detailProspect || !form.name.trim()) return;
    update.mutate({
      id: detailProspect.id,
      payload: {
        name: form.name.trim(),
        client_name: form.client_name || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        address: form.address || null,
        work_type: form.work_type || null,
        estimated_budget: form.estimated_budget ? parseFloat(form.estimated_budget) : null,
        source: form.source,
        status: form.status,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        notes: form.notes || null,
      },
    });
    setDetailProspect(null);
  }

  function openDetail(p: Prospect) {
    setDetailProspect(p);
    setForm({
      name: p.name,
      client_name: p.client_name ?? '',
      contact_name: p.contact_name ?? '',
      contact_phone: p.contact_phone ?? '',
      contact_email: p.contact_email ?? '',
      address: p.address ?? '',
      work_type: p.work_type ?? '',
      estimated_budget: p.estimated_budget != null ? String(p.estimated_budget) : '',
      source: (p.source as ProspectSource) ?? 'autre',
      status: (p.status as ProspectStatus) ?? 'prospect',
      next_action: p.next_action ?? '',
      next_action_date: p.next_action_date ?? '',
      notes: p.notes ?? '',
    });
  }

  if (isLoading) return <FullPageSpinner />;

  const pipelineProspects = (status: ProspectStatus) => prospects.filter((p) => p.status === status);
  const closedProspects = prospects.filter((p) => CLOSED_STAGES.includes(p.status as ProspectStatus));
  const total = prospects.length;
  const gained = prospects.filter((p) => p.status === 'gagne').length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM — Pipeline commercial</h1>
          <p className="text-sm text-slate-500">{total} affaire(s) · {gained} gagnée(s)</p>
        </div>
        <Button onClick={() => { setForm(emptyProspectForm()); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau prospect
        </Button>
      </div>

      {/* Pipeline Kanban */}
      {prospects.filter((p) => PIPELINE_STAGES.includes(p.status as ProspectStatus)).length === 0 && !showClosed ? (
        <EmptyState
          icon={Plus}
          title="Pipeline vide"
          description="Ajoutez vos premiers prospects pour suivre vos affaires commerciales."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const items = pipelineProspects(stage);
            return (
              <div key={stage}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={STATUS_TONE[stage]}>{PROSPECT_STATUS_LABELS[stage]}</Badge>
                  <span className="text-xs text-slate-400">({items.length})</span>
                </div>
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {items.map((p) => (
                    <ProspectCard
                      key={p.id}
                      prospect={p}
                      onEdit={openDetail}
                      onDelete={(id) => remove.mutate(id)}
                      onStatusChange={(id, status) => update.mutate({ id, payload: { status } })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Closed section */}
      {closedProspects.length > 0 && (
        <div>
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {showClosed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Affaires clôturées ({closedProspects.length})
          </button>
          {showClosed && (
            <div className="mt-3 grid grid-cols-3 gap-4">
              {CLOSED_STAGES.map((stage) => {
                const items = pipelineProspects(stage);
                if (items.length === 0) return null;
                return (
                  <div key={stage}>
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone={STATUS_TONE[stage]}>{PROSPECT_STATUS_LABELS[stage]}</Badge>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((p) => (
                        <ProspectCard
                          key={p.id}
                          prospect={p}
                          onEdit={openDetail}
                          onDelete={(id) => remove.mutate(id)}
                          onStatusChange={(id, status) => update.mutate({ id, payload: { status } })}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau prospect" size="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input id="p-name" label="Nom de l'affaire" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="p-client" label="Client / maître d'ouvrage" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            <Input id="p-work-type" label="Type de travaux" value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input id="p-contact" label="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <Input id="p-phone" label="Téléphone" type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            <Input id="p-email" label="Email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <Input id="p-address" label="Adresse / localisation" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="p-budget" label="Budget estimé (€)" type="number" min="0" value={form.estimated_budget} onChange={(e) => setForm({ ...form, estimated_budget: e.target.value })} />
            <Select id="p-source" label="Origine" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ProspectSource })}>
              {(Object.keys(PROSPECT_SOURCE_LABELS) as ProspectSource[]).map((s) => (
                <option key={s} value={s}>{PROSPECT_SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="p-next-action" label="Prochaine action" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
            <Input id="p-next-date" label="Date de la prochaine action" type="date" value={form.next_action_date} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button type="submit" loading={create.isPending}>Créer le prospect</Button>
          </div>
        </form>
      </Modal>

      {/* Detail / edit modal */}
      <Modal open={Boolean(detailProspect)} onClose={() => setDetailProspect(null)} title={detailProspect?.name ?? ''} size="lg">
        {detailProspect && (
          <form onSubmit={handleSaveDetail} className="flex flex-col gap-4">
            <Input id="pd-name" label="Nom de l'affaire" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input id="pd-client" label="Client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              <Input id="pd-work-type" label="Type de travaux" value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input id="pd-contact" label="Contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              <Input id="pd-phone" label="Téléphone" type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              <Input id="pd-email" label="Email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <Input id="pd-address" label="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="grid grid-cols-3 gap-4">
              <Input id="pd-budget" label="Budget (€)" type="number" min="0" value={form.estimated_budget} onChange={(e) => setForm({ ...form, estimated_budget: e.target.value })} />
              <Select id="pd-source" label="Origine" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ProspectSource })}>
                {(Object.keys(PROSPECT_SOURCE_LABELS) as ProspectSource[]).map((s) => (
                  <option key={s} value={s}>{PROSPECT_SOURCE_LABELS[s]}</option>
                ))}
              </Select>
              <Select id="pd-status" label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProspectStatus })}>
                {(Object.keys(PROSPECT_STATUS_LABELS) as ProspectStatus[]).map((s) => (
                  <option key={s} value={s}>{PROSPECT_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input id="pd-next-action" label="Prochaine action" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
              <Input id="pd-next-date" label="Date" type="date" value={form.next_action_date} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} />
            </div>
            <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

            <VisitsPanel prospect={detailProspect} />

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setDetailProspect(null)}>Annuler</Button>
              <Button type="submit" loading={update.isPending}>Enregistrer</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
