import { useState } from 'react';
import { Plus, Users2, Pencil, Trash2, FileDown, Archive, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { useMeetingReports } from '@/hooks/useMeetingReports';
import { useProject } from '@/hooks/useProject';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { MEETING_ACTION_ITEM_STATUS_LABELS } from '@/types/domain';
import { formatDate } from '@/utils/date';
import type { MeetingAttendee, MeetingReportWithItems } from '@/types/domain';
import type { MeetingActionItemStatus, TablesInsert } from '@/types/database.types';

type ReportFormState = {
  title: string;
  meeting_date: string;
  location: string;
  next_meeting_date: string;
  agenda: string;
  notes: string;
  attendees: MeetingAttendee[];
};

function emptyForm(): ReportFormState {
  return {
    title: '',
    meeting_date: new Date().toISOString().slice(0, 10),
    location: '',
    next_meeting_date: '',
    agenda: '',
    notes: '',
    attendees: [],
  };
}

type ActionItemFormState = {
  description: string;
  assigned_to: string;
  due_date: string;
};

function emptyActionItemForm(): ActionItemFormState {
  return { description: '', assigned_to: '', due_date: '' };
}

interface MeetingReportsTabProps {
  projectId: string;
}

export function MeetingReportsTab({ projectId }: MeetingReportsTabProps) {
  const { reports, isLoading, create, update, remove, createActionItem, updateActionItem, removeActionItem } =
    useMeetingReports(projectId);
  const { project, members } = useProject(projectId);
  const { upload } = useDocuments(projectId);
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingReportWithItems | null>(null);
  const [form, setForm] = useState<ReportFormState>(emptyForm());

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionItemForm, setActionItemForm] = useState<ActionItemFormState>(emptyActionItemForm());
  const [archivingId, setArchivingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(report: MeetingReportWithItems) {
    setEditing(report);
    setForm({
      title: report.title,
      meeting_date: report.meeting_date,
      location: report.location ?? '',
      next_meeting_date: report.next_meeting_date ?? '',
      agenda: report.agenda ?? '',
      notes: report.notes ?? '',
      attendees: Array.isArray(report.attendees) ? (report.attendees as unknown as MeetingAttendee[]) : [],
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Omit<TablesInsert<'meeting_reports'>, 'project_id'> = {
      title: form.title,
      meeting_date: form.meeting_date,
      location: form.location || null,
      next_meeting_date: form.next_meeting_date || null,
      agenda: form.agenda || null,
      notes: form.notes || null,
      attendees: form.attendees as unknown as TablesInsert<'meeting_reports'>['attendees'],
    };
    if (editing) {
      update.mutate({ id: editing.id, payload }, { onSuccess: () => setModalOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  function addAttendeeRow() {
    setForm((f) => ({ ...f, attendees: [...f.attendees, { name: '', role: '' }] }));
  }

  function updateAttendeeRow(index: number, patch: Partial<MeetingAttendee>) {
    setForm((f) => ({
      ...f,
      attendees: f.attendees.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }

  function removeAttendeeRow(index: number) {
    setForm((f) => ({ ...f, attendees: f.attendees.filter((_, i) => i !== index) }));
  }

  function toggleExpand(reportId: string) {
    setExpandedId((current) => (current === reportId ? null : reportId));
    setActionItemForm(emptyActionItemForm());
  }

  function handleAddActionItem(reportId: string) {
    if (!actionItemForm.description.trim()) return;
    createActionItem.mutate(
      {
        meeting_report_id: reportId,
        description: actionItemForm.description,
        assigned_to: actionItemForm.assigned_to || null,
        due_date: actionItemForm.due_date || null,
      },
      { onSuccess: () => setActionItemForm(emptyActionItemForm()) }
    );
  }

  async function handleArchive(report: MeetingReportWithItems) {
    if (!project || !profile) return;
    setArchivingId(report.id);
    try {
      const { exportMeetingReportPdf } = await import('@/services/pdfExport.service');
      const file = exportMeetingReportPdf(project, report, members);
      await upload.mutateAsync({
        file,
        type: 'compte_rendu',
        uploadedBy: profile.id,
        folder: 'Comptes-rendus',
      });
    } finally {
      setArchivingId(null);
    }
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Comptes-rendus de réunion</h3>
          <p className="text-sm text-slate-500">{reports.length} compte(s)-rendu(s)</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau compte-rendu
        </Button>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Aucun compte-rendu"
          description="Consignez les comptes-rendus des réunions de chantier."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {reports.map((report) => {
            const expanded = expandedId === report.id;
            const openCount = report.actionItems.filter((i) => i.status === 'open').length;
            return (
              <li key={report.id} className="py-3">
                <div className="flex items-center justify-between text-sm">
                  <button
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => toggleExpand(report.id)}
                  >
                    {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    <div>
                      <p className="font-medium text-slate-800">{report.title}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(report.meeting_date)}
                        {report.location ? ` · ${report.location}` : ''}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    {report.actionItems.length > 0 && (
                      <Badge tone={openCount > 0 ? 'red' : 'green'}>
                        {openCount > 0 ? `${openCount} action(s) à faire` : 'Actions traitées'}
                      </Badge>
                    )}
                    <button
                      onClick={() =>
                        void import('@/services/pdfExport.service').then((m) => {
                          if (project) m.exportMeetingReportPdf(project, report, members);
                        })
                      }
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Exporter en PDF"
                    >
                      <FileDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleArchive(report)}
                      disabled={archivingId === report.id}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Archiver dans Documents"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEdit(report)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer ce compte-rendu ?')) remove.mutate(report.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 ml-6 flex flex-col gap-3 rounded-xl bg-slate-50 p-3">
                    {report.agenda && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Ordre du jour</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{report.agenda}</p>
                      </div>
                    )}
                    {report.notes && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Notes</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{report.notes}</p>
                      </div>
                    )}

                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-slate-500">Points d'action</p>
                      {report.actionItems.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucun point d'action.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {report.actionItems.map((item) => {
                            const assignee = members.find((m) => m.profile?.id === item.assigned_to);
                            return (
                              <li key={item.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                <div>
                                  <p className="text-slate-800">{item.description}</p>
                                  <p className="text-xs text-slate-400">
                                    {assignee ? `${assignee.profile?.full_name ?? assignee.invited_email} · ` : ''}
                                    {item.due_date ? formatDate(item.due_date) : 'Pas d’échéance'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateActionItem.mutate({
                                        id: item.id,
                                        payload: { status: item.status === 'open' ? 'done' : 'open' },
                                      })
                                    }
                                    className={
                                      item.status === 'done'
                                        ? 'rounded-lg p-1 text-green-600 hover:bg-green-50'
                                        : 'rounded-lg p-1 text-slate-400 hover:bg-slate-100'
                                    }
                                    aria-label={item.status === 'open' ? 'Marquer comme fait' : 'Marquer à faire'}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <Badge tone={item.status === 'done' ? 'green' : 'blue'}>
                                    {MEETING_ACTION_ITEM_STATUS_LABELS[item.status as MeetingActionItemStatus]}
                                  </Badge>
                                  <button
                                    onClick={() => removeActionItem.mutate(item.id)}
                                    className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    aria-label="Supprimer le point d'action"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      <div className="mt-2 grid grid-cols-[1fr_160px_140px_auto] items-end gap-2">
                        <Input
                          id={`new-action-${report.id}`}
                          label="Nouveau point d'action"
                          value={actionItemForm.description}
                          onChange={(e) => setActionItemForm({ ...actionItemForm, description: e.target.value })}
                        />
                        <Select
                          id={`new-action-assignee-${report.id}`}
                          label="Responsable"
                          value={actionItemForm.assigned_to}
                          onChange={(e) => setActionItemForm({ ...actionItemForm, assigned_to: e.target.value })}
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
                        <Input
                          id={`new-action-date-${report.id}`}
                          label="Échéance"
                          type="date"
                          value={actionItemForm.due_date}
                          onChange={(e) => setActionItemForm({ ...actionItemForm, due_date: e.target.value })}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={createActionItem.isPending}
                          onClick={() => handleAddActionItem(report.id)}
                        >
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le compte-rendu' : 'Nouveau compte-rendu'} size="lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input id="form-title" label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-3 gap-4">
            <Input
              id="form-date"
              label="Date de réunion"
              type="date"
              required
              value={form.meeting_date}
              onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
            />
            <Input id="form-location" label="Lieu" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input
              id="form-next-meeting"
              label="Prochaine réunion"
              type="date"
              value={form.next_meeting_date}
              onChange={(e) => setForm({ ...form, next_meeting_date: e.target.value })}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Participants</p>
              <Button type="button" size="sm" variant="outline" onClick={addAttendeeRow}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.attendees.map((attendee, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    id={`attendee-name-${index}`}
                    placeholder="Nom"
                    value={attendee.name}
                    onChange={(e) => updateAttendeeRow(index, { name: e.target.value })}
                  />
                  <Input
                    id={`attendee-role-${index}`}
                    placeholder="Rôle"
                    value={attendee.role ?? ''}
                    onChange={(e) => updateAttendeeRow(index, { role: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeAttendeeRow(index)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Retirer ce participant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {form.attendees.length === 0 && <p className="text-sm text-slate-400">Aucun participant ajouté.</p>}
            </div>
          </div>

          <Textarea label="Ordre du jour" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
          <Textarea label="Notes / compte-rendu" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

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
