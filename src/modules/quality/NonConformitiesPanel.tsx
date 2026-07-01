import { useState } from 'react';
import { Plus, AlertOctagon, Pencil, Trash2 } from 'lucide-react';
import { useNonConformities } from '@/hooks/useNonConformities';
import { useProject } from '@/hooks/useProject';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { NON_CONFORMITY_SEVERITY_LABELS, NON_CONFORMITY_STATUS_LABELS } from '@/types/domain';
import type { NonConformity } from '@/types/domain';
import type { NonConformitySeverity, NonConformityStatus, TablesInsert } from '@/types/database.types';
import { formatDate, isOverdue } from '@/utils/date';
import { confirmStore } from '@/components/ui/ConfirmModal';

const SEVERITY_TONE: Record<NonConformitySeverity, 'slate' | 'yellow' | 'red'> = {
  mineure: 'slate',
  majeure: 'yellow',
  critique: 'red',
};

const STATUS_TONE: Record<NonConformityStatus, 'red' | 'blue' | 'green' | 'purple'> = {
  ouverte: 'red',
  en_cours: 'blue',
  resolue: 'green',
  verifiee: 'purple',
};

type NcFormState = {
  title: string;
  description: string;
  location: string;
  severity: NonConformitySeverity;
  status: NonConformityStatus;
  assigned_to: string;
  due_date: string;
  resolution_notes: string;
};

function emptyForm(): NcFormState {
  return {
    title: '',
    description: '',
    location: '',
    severity: 'mineure',
    status: 'ouverte',
    assigned_to: '',
    due_date: '',
    resolution_notes: '',
  };
}

interface NonConformitiesPanelProps {
  projectId: string;
}

export function NonConformitiesPanel({ projectId }: NonConformitiesPanelProps) {
  const { nonConformities, isLoading, create, update, remove } = useNonConformities(projectId);
  const { members } = useProject(projectId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NonConformity | null>(null);
  const [form, setForm] = useState<NcFormState>(emptyForm());

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(nc: NonConformity) {
    setEditing(nc);
    setForm({
      title: nc.title,
      description: nc.description ?? '',
      location: nc.location ?? '',
      severity: nc.severity as NonConformitySeverity,
      status: nc.status as NonConformityStatus,
      assigned_to: nc.assigned_to ?? '',
      due_date: nc.due_date ?? '',
      resolution_notes: nc.resolution_notes ?? '',
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'non_conformities'>, 'project_id'> = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      severity: form.severity,
      status: form.status,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      resolution_notes: form.resolution_notes || null,
      resolved_at: editing?.resolved_at ?? (form.status === 'resolue' || form.status === 'verifiee' ? new Date().toISOString() : null),
    };
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Non-conformités</h3>
          <p className="text-sm text-slate-500">{nonConformities.length} non-conformité(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle non-conformité
        </Button>
      </div>

      {nonConformities.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          title="Aucune non-conformité"
          description="Les non-conformités relevées lors des inspections apparaissent ici automatiquement."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {nonConformities.map((nc) => {
            const assignee = members.find((m) => m.profile?.id === nc.assigned_to);
            const late = isOverdue(nc.due_date) && nc.status !== 'resolue' && nc.status !== 'verifiee';
            return (
              <li key={nc.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{nc.title}</p>
                  <p className="text-xs text-slate-400">
                    {nc.location ? `${nc.location} · ` : ''}
                    {assignee ? `Assigné à ${assignee.profile?.full_name ?? assignee.invited_email}` : 'Non assigné'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={late ? 'text-xs font-medium text-red-500' : 'text-xs text-slate-400'}>
                    {nc.due_date ? formatDate(nc.due_date) : '—'}
                  </span>
                  <Badge tone={SEVERITY_TONE[nc.severity as NonConformitySeverity]}>
                    {NON_CONFORMITY_SEVERITY_LABELS[nc.severity as NonConformitySeverity]}
                  </Badge>
                  <Badge tone={STATUS_TONE[nc.status as NonConformityStatus]}>
                    {NON_CONFORMITY_STATUS_LABELS[nc.status as NonConformityStatus]}
                  </Badge>
                  <button onClick={() => openEdit(nc)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      confirmStore.getState().show({ message: 'Supprimer cette non-conformité ?' }).then((ok) => { if (ok) remove.mutate(nc.id); });
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la non-conformité' : 'Nouvelle non-conformité'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="form-title" label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-location" label="Localisation" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select id="form-assigned-to"
              label="Assigné à"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">Non assigné</option>
              {members
                .filter((m) => m.profile)
                .map((m) => (
                  <option key={m.profile!.id} value={m.profile!.id}>
                    {m.profile!.full_name ?? m.profile!.email}
                  </option>
                ))}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select id="form-severity"
              label="Sévérité"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as NonConformitySeverity })}
            >
              {Object.entries(NON_CONFORMITY_SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select id="form-status" label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as NonConformityStatus })}>
              {Object.entries(NON_CONFORMITY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Input id="form-due-date"
              label="Échéance"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          {(form.status === 'resolue' || form.status === 'verifiee') && (
            <Textarea
              label="Notes de résolution"
              value={form.resolution_notes}
              onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
            />
          )}
          <ErrorMessage error={create.error ?? update.error} />
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
    </Card>
  );
}
