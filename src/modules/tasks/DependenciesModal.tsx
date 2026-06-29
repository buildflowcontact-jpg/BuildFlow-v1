import { useState } from 'react';
import { Link2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Task, TaskDependency } from '@/types/domain';

interface DependenciesModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  allTasks: Task[];
  dependencies: TaskDependency[];
  onAdd: (dependsOnTaskId: string) => Promise<void> | void;
  onRemove: (id: string) => void;
  adding: boolean;
}

export function DependenciesModal({ open, onClose, task, allTasks, dependencies, onAdd, onRemove, adding }: DependenciesModalProps) {
  const [selected, setSelected] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!task) return null;

  const taskDeps = dependencies.filter((d) => d.task_id === task.id);
  const dependentTaskIds = new Set(taskDeps.map((d) => d.depends_on_task_id));
  const options = allTasks.filter((t) => t.id !== task.id && !dependentTaskIds.has(t.id));

  async function handleAdd() {
    if (!selected) return;
    setErrorMessage(null);
    try {
      await onAdd(selected);
      setSelected('');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Impossible d'ajouter cette dépendance.");
    }
  }

  function taskTitle(id: string): string {
    return allTasks.find((t) => t.id === id)?.title ?? 'Tâche inconnue';
  }

  return (
    <Modal open={open} onClose={onClose} title={`Dépendances — ${task.title}`} size="md">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Cette tâche démarrera après l'achèvement des tâches sélectionnées ci-dessous (fin → début).
        </p>

        {taskDeps.length === 0 ? (
          <EmptyState icon={Link2} title="Aucune dépendance" description="Cette tâche peut démarrer librement." />
        ) : (
          <ul className="flex flex-col gap-2">
            {taskDeps.map((dep) => (
              <li
                key={dep.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-slate-400" />
                  {taskTitle(dep.depends_on_task_id)}
                </span>
                <button
                  onClick={() => onRemove(dep.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
          <Select id="selected" label="Ajouter une dépendance" value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1">
            <option value="">Sélectionner une tâche…</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={handleAdd} loading={adding} disabled={!selected}>
            Ajouter
          </Button>
        </div>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </Modal>
  );
}
