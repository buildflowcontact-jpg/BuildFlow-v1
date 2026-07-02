import { useState } from 'react';
import { Plus, AlertTriangle, Pencil, Trash2, Camera } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { INCIDENT_SEVERITY_LABELS, INCIDENT_STATUS_LABELS } from '@/types/domain';
import { formatDateTime } from '@/utils/date';
import type { Incident } from '@/types/domain';
import type { IncidentSeverity, IncidentStatus, TablesInsert } from '@/types/database.types';
import { confirmStore } from '@/components/ui/ConfirmModal';
import { PhotoUploadField } from '@/components/ui/PhotoUploadField';

const SEVERITY_TONE: Record<IncidentSeverity, 'slate' | 'blue' | 'yellow' | 'red'> = {
  low: 'slate',
  medium: 'blue',
  high: 'yellow',
  critical: 'red',
};

const STATUS_TONE: Record<IncidentStatus, 'red' | 'blue' | 'green' | 'slate'> = {
  open: 'red',
  in_progress: 'blue',
  resolved: 'green',
  closed: 'slate',
};

type IncidentFormState = {
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location: string;
  assigned_to: string;
  photo_document_id: string | null;
};

const emptyForm: IncidentFormState = {
  title: '',
  description: '',
  severity: 'medium',
  status: 'open',
  location: '',
  assigned_to: '',
  photo_document_id: null,
};

interface IncidentsTabProps {
  projectId: string;
}

export function IncidentsTab({ projectId }: IncidentsTabProps) {
  const { incidents, isLoading, create, update, remove } = useIncidents(projectId);
  const { members } = useProject(projectId);
  const userId = useAuthStore((s) => s.session?.user.id ?? s.profile?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);
  const [form, setForm] = useState<IncidentFormState>(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(incident: Incident) {
    setEditing(incident);
    setForm({
      title: incident.title,
      description: incident.description ?? '',
      severity: incident.severity as IncidentSeverity,
      status: incident.status as IncidentStatus,
      location: incident.location ?? '',
      assigned_to: incident.assigned_to ?? '',
      photo_document_id: incident.photo_document_id ?? null,
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'incidents'>, 'project_id'> = {
      title: form.title,
      description: form.description || null,
      severity: form.severity,
      status: form.status,
      location: form.location || null,
      assigned_to: form.assigned_to || null,
      reported_by: editing?.reported_by ?? userId ?? null,
      photo_document_id: form.photo_document_id ?? null,
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
          <h3 className="text-base font-semibold text-slate-900">Incidents</h3>
          <p className="text-sm text-slate-500">{incidents.length} incident(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Signaler un incident
        </Button>
      </div>

      {incidents.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Aucun incident" description="Signalez les incidents et anomalies de chantier." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {incidents.map((incident) => {
            const assignee = members.find((m) => m.profile?.id === incident.assigned_to);
            return (
              <li key={incident.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{incident.title}</p>
                  <p className="text-xs text-slate-400">
                    {incident.location ? `${incident.location} · ` : ''}
                    {formatDateTime(incident.created_at)}
                    {assignee ? ` · Assigné à ${assignee.profile?.full_name ?? assignee.invited_email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {incident.photo_document_id && (
                    <span title="Photo attachée"><Camera className="h-4 w-4 shrink-0 text-slate-400" /></span>
                  )}
                  <Badge tone={SEVERITY_TONE[incident.severity as IncidentSeverity]}>{INCIDENT_SEVERITY_LABELS[incident.severity as IncidentSeverity]}</Badge>
                  <Badge tone={STATUS_TONE[incident.status as IncidentStatus]}>{INCIDENT_STATUS_LABELS[incident.status as IncidentStatus]}</Badge>
                  <button onClick={() => openEdit(incident)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      confirmStore.getState().show({ message: 'Supprimer cet incident ?' }).then((ok) => { if (ok) remove.mutate(incident.id); });
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'incident" : 'Signaler un incident'} size="lg">
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
          <div className="grid grid-cols-2 gap-4">
            <Select id="form-severity"
              label="Gravité"
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as IncidentSeverity })}
            >
              {Object.entries(INCIDENT_SEVERITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select id="form-status" label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IncidentStatus })}>
              {Object.entries(INCIDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {userId && (
            <PhotoUploadField
              projectId={projectId}
              uploadedBy={userId}
              existingDocumentId={form.photo_document_id}
              onChange={(docId) => setForm((f) => ({ ...f, photo_document_id: docId }))}
            />
          )}
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
