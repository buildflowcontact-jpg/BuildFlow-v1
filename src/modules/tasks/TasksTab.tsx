import { useState } from 'react';
import { Plus, List, LayoutGrid, CheckCheck, X } from 'lucide-react';
import { confirmStore } from '@/components/ui/ConfirmModal';
import { useTasks } from '@/hooks/useTasks';
import { usePhases } from '@/hooks/usePhases';
import { useProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/toastStore';
import { TaskTree } from './TaskTree';
import { KanbanView } from './KanbanView';
import { TaskFormModal } from './TaskFormModal';
import { DependenciesModal } from './DependenciesModal';
import { ResourceSharingModal } from '@/components/sharing/ResourceSharingModal';
import { cn } from '@/utils/cn';
import type { Task, TaskWithChildren } from '@/types/domain';
import type { TablesInsert, TablesUpdate, TaskStatus } from '@/types/database.types';

type ViewMode = 'list' | 'kanban';

interface TasksTabProps {
  projectId: string;
}

export function TasksTab({ projectId }: TasksTabProps) {
  const { tasks, tree, dependencies, isLoading, create, update, remove, addDependency, removeDependency } = useTasks(projectId);
  const { phases } = usePhases(projectId);
  const { members } = useProject(projectId);

  const [view, setView] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

  const [depsTask, setDepsTask] = useState<Task | null>(null);
  const [depsOpen, setDepsOpen] = useState(false);

  const [sharingTask, setSharingTask] = useState<Task | null>(null);

  // Bulk selection (list view only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDone() {
    const ids = [...selectedIds];
    setBulkPending(true);
    try {
      await Promise.all(ids.map((id) => update.mutateAsync({ id, payload: { status: 'done' } })));
      setSelectedIds(new Set());
      toast.success(`${ids.length} tâche(s) terminée(s)`);
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setBulkPending(false);
    }
  }

  function openCreate(parentId?: string) {
    setEditingTask(null);
    setDefaultParentId(parentId);
    setFormOpen(true);
  }

  function openEdit(task: Task | TaskWithChildren) {
    setEditingTask(task);
    setDefaultParentId(undefined);
    setFormOpen(true);
  }

  function handleDelete(task: TaskWithChildren) {
    const message =
      task.children.length > 0
        ? `Supprimer "${task.title}" supprimera aussi ses ${task.children.length} sous-tâche(s). Continuer ?`
        : `Supprimer la tâche "${task.title}" ?`;
    confirmStore.getState().show({ message }).then((ok) => {
      if (ok) remove.mutate(task.id);
    });
  }

  function handleFormSubmit(payload: Omit<TablesInsert<'tasks'>, 'project_id'> | TablesUpdate<'tasks'>, current: Task | null) {
    if (current) {
      update.mutate({ id: current.id, payload }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(payload as Omit<TablesInsert<'tasks'>, 'project_id'>, { onSuccess: () => setFormOpen(false) });
    }
  }

  function openDependencies(task: TaskWithChildren) {
    setDepsTask(task);
    setDepsOpen(true);
  }

  async function handleAddDependency(dependsOnTaskId: string) {
    if (!depsTask) return;
    await addDependency.mutateAsync({ taskId: depsTask.id, dependsOnTaskId });
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    update.mutate({ id: taskId, payload: { status: newStatus } });
  }

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {view === 'list' ? 'Arborescence des tâches' : 'Kanban des tâches'}
          </h3>
          <p className="text-sm text-slate-500">{tasks.length} tâche(s) au total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Liste
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                view === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {view === 'list' && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-700">{selectedIds.size} sélectionnée(s)</span>
          <Button size="sm" loading={bulkPending} onClick={handleBulkDone}>
            <CheckCheck className="h-4 w-4" />
            Marquer comme terminées
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-blue-500 hover:text-blue-700"
            aria-label="Annuler la sélection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {view === 'list' ? (
        <TaskTree
          nodes={tree}
          dependencies={dependencies}
          onEdit={openEdit}
          onAddChild={openCreate}
          onDelete={handleDelete}
          onManageDependencies={openDependencies}
          onShare={setSharingTask}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <KanbanView
          tasks={tasks}
          members={members}
          onEdit={openEdit}
          onStatusChange={handleStatusChange}
          onAddTask={() => openCreate()}
        />
      )}

      <TaskFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingTask={editingTask}
        defaultParentId={defaultParentId}
        allTasks={tasks}
        phases={phases}
        members={members}
        saving={create.isPending || update.isPending}
        onSubmit={handleFormSubmit}
      />

      <DependenciesModal
        open={depsOpen}
        onClose={() => setDepsOpen(false)}
        task={depsTask}
        allTasks={tasks}
        dependencies={dependencies}
        onAdd={handleAddDependency}
        onRemove={(id) => removeDependency.mutate(id)}
        adding={addDependency.isPending}
      />

      <ResourceSharingModal
        open={Boolean(sharingTask)}
        onClose={() => setSharingTask(null)}
        resourceType="task"
        resourceId={sharingTask?.id}
        resourceLabel={sharingTask?.title ?? ''}
        projectId={projectId}
        members={members}
      />
    </Card>
  );
}
