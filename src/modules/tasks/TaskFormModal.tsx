import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/types/domain';
import type { Task, Phase, ProjectMemberWithProfile } from '@/types/domain';
import type { TablesInsert, TablesUpdate, TaskStatus, TaskPriority } from '@/types/database.types';

export interface TaskFormValue {
  title: string;
  description: string;
  phase_id: string;
  parent_task_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  start_date: string;
  end_date: string;
  is_milestone: boolean;
  assignee_id: string;
}

function toFormValue(task: Task | null, defaultParentId?: string): TaskFormValue {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    phase_id: task?.phase_id ?? '',
    parent_task_id: task?.parent_task_id ?? defaultParentId ?? '',
    status: (task?.status as TaskStatus) ?? 'todo',
    priority: (task?.priority as TaskPriority) ?? 'medium',
    progress: task?.progress ?? 0,
    start_date: task?.start_date ?? '',
    end_date: task?.end_date ?? '',
    is_milestone: task?.is_milestone ?? false,
    assignee_id: task?.assignee_id ?? '',
  };
}

function collectDescendantIds(task: Task, allTasks: Task[]): Set<string> {
  const ids = new Set<string>();
  const stack = [task.id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const t of allTasks) {
      if (t.parent_task_id === current && !ids.has(t.id)) {
        ids.add(t.id);
        stack.push(t.id);
      }
    }
  }
  return ids;
}

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  editingTask: Task | null;
  defaultParentId?: string;
  allTasks: Task[];
  phases: Phase[];
  members: ProjectMemberWithProfile[];
  saving: boolean;
  onSubmit: (
    payload: Omit<TablesInsert<'tasks'>, 'project_id'> | TablesUpdate<'tasks'>,
    editingTask: Task | null
  ) => void;
}

export function TaskFormModal({
  open,
  onClose,
  editingTask,
  defaultParentId,
  allTasks,
  phases,
  members,
  saving,
  onSubmit,
}: TaskFormModalProps) {
  const [form, setForm] = useState<TaskFormValue>(toFormValue(editingTask, defaultParentId));

  useEffect(() => {
    if (open) setForm(toFormValue(editingTask, defaultParentId));
  }, [open, editingTask, defaultParentId]);

  const excludedParentIds = editingTask
    ? new Set([editingTask.id, ...collectDescendantIds(editingTask, allTasks)])
    : new Set<string>();

  const parentOptions = allTasks.filter((t) => !excludedParentIds.has(t.id));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || null,
      phase_id: form.phase_id || null,
      parent_task_id: form.parent_task_id || null,
      status: form.status,
      priority: form.priority,
      progress: form.progress,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_milestone: form.is_milestone,
      assignee_id: form.assignee_id || null,
    };
    onSubmit(payload, editingTask);
  }

  return (
    <Modal open={open} onClose={onClose} title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Titre" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Phase" value={form.phase_id} onChange={(e) => setForm({ ...form, phase_id: e.target.value })}>
            <option value="">Aucune</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </Select>
          <Select
            label="Tâche parente"
            value={form.parent_task_id}
            onChange={(e) => setForm({ ...form, parent_task_id: e.target.value })}
          >
            <option value="">Aucune (tâche racine)</option>
            {parentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Priorité"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
          >
            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Avancement (%)"
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date de début"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <Input
            label="Date de fin"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Assigné à"
            value={form.assignee_id}
            onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
          >
            <option value="">Non assigné</option>
            {members.map((member) => (
              <option key={member.user_id ?? member.id} value={member.user_id ?? ''}>
                {member.profile?.full_name ?? member.invited_email ?? 'Membre'}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_milestone}
              onChange={(e) => setForm({ ...form, is_milestone: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
            />
            Jalon (milestone)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
