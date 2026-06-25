import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { TaskDependency, Task } from '@/types/domain';

/**
 * Vérifie côté client si l'ajout d'une dépendance créerait un cycle, en plus
 * de la protection définitive assurée par le trigger SQL check_no_circular_dependency.
 */
function wouldCreateCycle(
  taskId: string,
  dependsOnTaskId: string,
  existing: TaskDependency[]
): boolean {
  if (taskId === dependsOnTaskId) return true;

  const graph = new Map<string, string[]>();
  for (const dep of existing) {
    const list = graph.get(dep.task_id) ?? [];
    list.push(dep.depends_on_task_id);
    graph.set(dep.task_id, list);
  }
  // Avec la nouvelle dépendance, dependsOnTaskId hériterait des dépendances de taskId
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) ?? []) stack.push(next);
  }
  return false;
}

export const taskDependenciesService = {
  async listForProject(projectIdTasks: Task[]): Promise<TaskDependency[]> {
    const taskIds = projectIdTasks.map((t) => t.id);
    if (taskIds.length === 0) return [];
    return unwrap(await supabase.from('task_dependencies').select('*').in('task_id', taskIds));
  },

  async listForTask(taskId: string): Promise<TaskDependency[]> {
    return unwrap(await supabase.from('task_dependencies').select('*').eq('task_id', taskId));
  },

  async create(taskId: string, dependsOnTaskId: string, existing: TaskDependency[]): Promise<TaskDependency> {
    if (wouldCreateCycle(taskId, dependsOnTaskId, existing)) {
      throw new Error('Cette dépendance créerait un cycle entre les tâches.');
    }
    return unwrap(
      await supabase
        .from('task_dependencies')
        .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId })
        .select('*')
        .single()
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('task_dependencies').delete().eq('id', id);
    if (error) throw error;
  },
};
