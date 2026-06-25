import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { usePhases } from '@/hooks/usePhases';
import { useProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { TaskTree } from './TaskTree';
import { TaskFormModal } from './TaskFormModal';
import { DependenciesModal } from './DependenciesModal';
import { ResourceSharingModal } from '@/components/sharing/ResourceSharingModal';
import type { Task, TaskWithChildren } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

interface TasksTabProps {
  projectId: string;
}

export function TasksTab({ projectId }: TasksTabProps) {
  const { tasks, tree, dependencies, isLoading, create, update, remove, addDependency, removeDependency } = useTasks(projectId);
  const { phases } = usePhases(projectId);
  const { members } = useProject(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>(undefined);

  const [depsTask, setDepsTask] = useState<Task | null>(null);
  const [depsOpen, setDepsOpen] = useState(false);

  const [sharingTask, setSharingTask] = useState<Task | null>(null);

  function openCreate(parentId?: string) {
    setEditingTask(null);
    setDefaultParentId(parentId);
    setFormOpen(true);
  }

  function openEdit(task: TaskWithChildren) {
    setEditingTask(task);
    setDefaultParentId(undefined);
    setFormOpen(true);
  }

  function handleDelete(task: TaskWithChildren) {
    if (task.children.length > 0) {
      if (!confirm(`Supprimer "${task.title}" supprimera aussi ses ${task.children.length} sous-tâche(s). Continuer ?`)) return;
    } else if (!confirm(`Supprimer la tâche "${task.title}" ?`)) {
      return;
    }
    remove.mutate(task.id);
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

  if (isLoading) return <FullPageSpinner />;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Arborescence des tâches</h3>
          <p className="text-sm text-slate-500">{tasks.length} tâche(s) au total</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          Nouvelle tâche
        </Button>
      </div>

      <TaskTree
        nodes={tree}
        dependencies={dependencies}
        onEdit={openEdit}
        onAddChild={openCreate}
        onDelete={handleDelete}
        onManageDependencies={openDependencies}
        onShare={setSharingTask}
      />

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
