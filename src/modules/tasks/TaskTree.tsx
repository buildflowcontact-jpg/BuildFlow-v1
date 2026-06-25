import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Link2, Flag, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/types/domain';
import type { TaskWithChildren, TaskDependency } from '@/types/domain';
import type { TaskStatus, TaskPriority } from '@/types/database.types';
import { formatDate } from '@/utils/date';
import { cn } from '@/utils/cn';

const STATUS_TONE: Record<TaskStatus, 'slate' | 'blue' | 'red' | 'green'> = {
  todo: 'slate',
  in_progress: 'blue',
  blocked: 'red',
  done: 'green',
};

const PRIORITY_TONE: Record<TaskPriority, 'slate' | 'blue' | 'yellow' | 'red'> = {
  low: 'slate',
  medium: 'blue',
  high: 'yellow',
  critical: 'red',
};

interface TaskTreeProps {
  nodes: TaskWithChildren[];
  dependencies: TaskDependency[];
  onEdit: (task: TaskWithChildren) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (task: TaskWithChildren) => void;
  onManageDependencies: (task: TaskWithChildren) => void;
  onShare: (task: TaskWithChildren) => void;
  depth?: number;
}

export function TaskTree({ nodes, dependencies, onEdit, onAddChild, onDelete, onManageDependencies, onShare, depth = 0 }: TaskTreeProps) {
  if (nodes.length === 0 && depth === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Aucune tâche pour le moment.</p>;
  }

  return (
    <ul className={cn('flex flex-col gap-1', depth > 0 && 'mt-1 border-l border-slate-100 pl-4')}>
      {nodes.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          dependencies={dependencies}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onManageDependencies={onManageDependencies}
          onShare={onShare}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  dependencies,
  onEdit,
  onAddChild,
  onDelete,
  onManageDependencies,
  onShare,
  depth,
}: {
  task: TaskWithChildren;
  dependencies: TaskDependency[];
  onEdit: (task: TaskWithChildren) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (task: TaskWithChildren) => void;
  onManageDependencies: (task: TaskWithChildren) => void;
  onShare: (task: TaskWithChildren) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = task.children.length > 0;
  const depCount = dependencies.filter((d) => d.task_id === task.id).length;

  return (
    <li>
      <div className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn('flex h-5 w-5 items-center justify-center text-slate-400', !hasChildren && 'invisible')}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {task.is_milestone && <Flag className="h-3.5 w-3.5 shrink-0 text-amber-500" />}

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{task.title}</span>

        {depCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Link2 className="h-3 w-3" />
            {depCount}
          </span>
        )}

        <Badge tone={PRIORITY_TONE[task.priority as TaskPriority]}>{TASK_PRIORITY_LABELS[task.priority as TaskPriority]}</Badge>
        <Badge tone={STATUS_TONE[task.status as TaskStatus]}>{TASK_STATUS_LABELS[task.status as TaskStatus]}</Badge>

        <div className="hidden w-24 shrink-0 sm:block">
          <ProgressBar value={task.progress} />
        </div>
        <span className="hidden w-10 shrink-0 text-right text-xs text-slate-400 md:inline">{task.progress}%</span>
        <span className="hidden w-24 shrink-0 text-right text-xs text-slate-400 lg:inline">
          {task.end_date ? formatDate(task.end_date) : '—'}
        </span>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onAddChild(task.id)}
            title="Ajouter une sous-tâche"
            aria-label="Ajouter une sous-tâche"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onManageDependencies(task)}
            title="Gérer les dépendances"
            aria-label="Gérer les dépendances"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onShare(task)}
            title="Partager"
            aria-label="Partager"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(task)}
            title="Modifier"
            aria-label="Modifier"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(task)}
            title="Supprimer"
            aria-label="Supprimer"
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <TaskTree
          nodes={task.children}
          dependencies={dependencies}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onManageDependencies={onManageDependencies}
          onShare={onShare}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
