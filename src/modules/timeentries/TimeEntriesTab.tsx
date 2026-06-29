import { useMemo, useState } from 'react';
import { Plus, Clock, Pencil, Trash2, Lock } from 'lucide-react';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useTasks } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProject';
import { useAuthStore } from '@/stores/authStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/date';
import type { TimeEntry } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';

type TimeEntryFormState = {
  task_id: string;
  work_date: string;
  hours: string;
  notes: string;
};

function emptyForm(): TimeEntryFormState {
  return { task_id: '', work_date: new Date().toISOString().slice(0, 10), hours: '', notes: '' };
}

interface TimeEntriesTabProps {
  projectId: string;
}

export function TimeEntriesTab({ projectId }: TimeEntriesTabProps) {
  const { timeEntries, isLoading, create, update, remove } = useTimeEntries(projectId);
  const { tasks } = useTasks(projectId);
  const { members } = useProject(projectId);
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useAuthStore((s) => s.profile);
  const canAccess = profile?.job_title === 'Chef de chantier';

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [form, setForm] = useState<TimeEntryFormState>(emptyForm());

  const totalHours = useMemo(() => timeEntries.reduce((sum, e) => sum + Number(e.hours), 0), [timeEntries]);
  const myHours = useMemo(
    () => timeEntries.filter((e) => e.user_id === userId).reduce((sum, e) => sum + Number(e.hours), 0),
    [timeEntries, userId]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(entry: TimeEntry) {
    setEditing(entry);
    setForm({
      task_id: entry.task_id ?? '',
      work_date: entry.work_date,
      hours: entry.hours.toString(),
      notes: entry.notes ?? '',
    });
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      task_id: form.task_id || null,
      work_date: form.work_date,
      hours: Number(form.hours || 0),
      notes: form.notes || null,
    };
    if (editing) {
      update.mutate({ id: editing.id, payload: base }, { onSuccess: () => setModalOpen(false) });
    } else {
      const payload: Omit<TablesInsert<'time_entries'>, 'project_id'> = { ...base, user_id: userId! };
      create.mutate(payload, { onSuccess: () => setModalOpen(false) });
    }
  }

  function taskTitle(id: string | null) {
    if (!id) return null;
    return tasks.find((t) => t.id === id)?.title ?? null;
  }

  function memberName(uid: string) {
    const member = members.find((m) => m.profile?.id === uid);
    return member?.profile?.full_name ?? member?.profile?.email ?? 'Utilisateur';
  }

  if (!canAccess) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="Accès réservé"
          description="L'onglet Pointage horaire est réservé au chef de chantier du projet."
        />
      </Card>
    );
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total heures (projet)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalHours.toFixed(1)} h</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mes heures</p>
          <p className="mt-1 text-2xl font-semibold text-brand-600">{myHours.toFixed(1)} h</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Pointage horaire</h3>
            <p className="text-sm text-slate-500">{timeEntries.length} entrée(s)</p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </Button>
        </div>

        {timeEntries.length === 0 ? (
          <EmptyState icon={Clock} title="Aucune entrée" description="Enregistrez les heures travaillées sur ce projet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {timeEntries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    {memberName(entry.user_id)} · {formatDate(entry.work_date)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {taskTitle(entry.task_id) ?? 'Sans tâche associée'}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </p>
                </div>
                <p className="w-16 text-right font-semibold text-slate-800">{Number(entry.hours).toFixed(1)} h</p>
                {entry.user_id === userId && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(entry)} className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Supprimer cette entrée ?')) remove.mutate(entry.id);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'entrée" : 'Nouvelle entrée'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="form-work-date"
              type="date"
              label="Date"
              required
              value={form.work_date}
              onChange={(e) => setForm({ ...form, work_date: e.target.value })}
            />
            <Input id="form-hours"
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              label="Heures"
              required
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </div>
          <Select id="form-task-id" label="Tâche associée" value={form.task_id} onChange={(e) => setForm({ ...form, task_id: e.target.value })}>
            <option value="">Sans tâche associée</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </Select>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
    </div>
  );
}
