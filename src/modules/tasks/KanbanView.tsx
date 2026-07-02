import { useState } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { TASK_PRIORITY_LABELS } from '@/types/domain';
import type { Task, ProjectMemberWithProfile } from '@/types/domain';
import type { TaskStatus, TaskPriority } from '@/types/database.types';

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string }[] = [
  { status: 'todo',        label: 'À faire',   color: 'text-slate-600',  bg: 'bg-slate-100' },
  { status: 'in_progress', label: 'En cours',  color: 'text-blue-700',   bg: 'bg-blue-50'   },
  { status: 'blocked',     label: 'Bloquée',   color: 'text-red-700',    bg: 'bg-red-50'    },
  { status: 'done',        label: 'Terminée',  color: 'text-green-700',  bg: 'bg-green-50'  },
];

const PRIORITY_TONE: Record<TaskPriority, 'slate' | 'blue' | 'yellow' | 'red'> = {
  low:      'slate',
  medium:   'blue',
  high:     'yellow',
  critical: 'red',
};

interface KanbanViewProps {
  tasks: Task[];
  members: ProjectMemberWithProfile[];
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask: () => void;
}

export function KanbanView({ tasks, members, onEdit, onStatusChange, onAddTask }: KanbanViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDraggingId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverColumn(status);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) onStatusChange(taskId, status);
    setDraggingId(null);
    setOverColumn(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);
        const isOver = overColumn === col.status;

        return (
          <div
            key={col.status}
            className={cn(
              'flex w-72 shrink-0 flex-col rounded-xl border transition-colors duration-150',
              isOver ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 bg-slate-50'
            )}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={() => setOverColumn(null)}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            {/* En-tête colonne */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-semibold', col.color)}>{col.label}</span>
                <span className={cn('flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium', col.bg, col.color)}>
                  {columnTasks.length}
                </span>
              </div>
              {col.status === 'todo' && (
                <button
                  onClick={onAddTask}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                  title="Nouvelle tâche"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Cartes */}
            <div className="flex flex-col gap-2 px-3 pb-3">
              {columnTasks.map((task) => {
                const assignee = members.find((m) => m.profile?.id === task.assignee_id);
                const isDragging = draggingId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onEdit(task)}
                    className={cn(
                      'group cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm',
                      'transition-all duration-150 hover:border-brand-300 hover:shadow-md',
                      isDragging && 'opacity-40 ring-2 ring-brand-400'
                    )}
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                      <p className="flex-1 text-sm font-medium leading-snug text-slate-800">{task.title}</p>
                    </div>

                    {/* Barre de progression */}
                    {task.progress > 0 && (
                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full transition-all', task.status === 'done' ? 'bg-green-500' : 'bg-brand-500')}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={PRIORITY_TONE[task.priority as TaskPriority]}>
                        {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        {task.progress > 0 && (
                          <span className="text-xs text-slate-400">{task.progress}%</span>
                        )}
                        {assignee?.profile && (
                          <Avatar
                            name={assignee.profile.full_name}
                            src={assignee.profile.avatar_url}
                            size="xs"
                          />
                        )}
                      </div>
                    </div>

                    {task.end_date && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        Échéance : {new Date(task.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Zone de dépôt vide */}
              {columnTasks.length === 0 && (
                <div className={cn(
                  'flex h-16 items-center justify-center rounded-xl border-2 border-dashed text-xs text-slate-400 transition-colors',
                  isOver ? 'border-brand-300 text-brand-500' : 'border-slate-200'
                )}>
                  {isOver ? 'Déposer ici' : 'Aucune tâche'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
