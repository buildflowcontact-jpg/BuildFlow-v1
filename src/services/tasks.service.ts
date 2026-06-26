import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Task, TaskWithChildren } from '@/types/domain';
import type { Json, TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export function buildTaskTree(tasks: Task[]): TaskWithChildren[] {
  const byId = new Map<string, TaskWithChildren>();
  for (const task of tasks) byId.set(task.id, { ...task, children: [] });

  const roots: TaskWithChildren[] = [];
  for (const task of byId.values()) {
    if (task.parent_task_id && byId.has(task.parent_task_id)) {
      byId.get(task.parent_task_id)!.children.push(task);
    } else {
      roots.push(task);
    }
  }

  const sortByPosition = (list: TaskWithChildren[]) => {
    list.sort((a, b) => a.position - b.position);
    list.forEach((t) => sortByPosition(t.children));
  };
  sortByPosition(roots);

  return roots;
}

export type ListPageOpts = { limit?: number; offset?: number };

export const tasksService = {
  /**
   * `opts` optionnel et rétrocompatible (cf. quotesService.list). À NE PAS
   * utiliser depuis TasksTab/buildTaskTree : la reconstruction de l'arbre
   * parent/enfant exige la liste complète du projet, pas une page partielle.
   * Réservé aux futurs usages qui n'ont pas besoin de la hiérarchie complète.
   */
  async list(projectId: string, opts?: ListPageOpts): Promise<Task[]> {
    let query = supabase.from('tasks').select('*').eq('project_id', projectId).order('position', { ascending: true });
    if (opts?.limit !== undefined) {
      const offset = opts.offset ?? 0;
      query = query.range(offset, offset + opts.limit - 1);
    }
    return unwrap(await query);
  },

  async listByPhase(phaseId: string): Promise<Task[]> {
    return unwrap(
      await supabase.from('tasks').select('*').eq('phase_id', phaseId).order('position', { ascending: true })
    );
  },

  async getById(id: string): Promise<Task> {
    return unwrap(await supabase.from('tasks').select('*').eq('id', id).single());
  },

  async create(payload: TablesInsert<'tasks'>): Promise<Task> {
    const task = unwrap(await supabase.from('tasks').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: task.project_id,
      action: 'task.created',
      entity_type: 'task',
      entity_id: task.id,
      metadata: { title: task.title },
    });
    return task;
  },

  async update(id: string, payload: TablesUpdate<'tasks'>): Promise<Task> {
    const task = unwrap(await supabase.from('tasks').update(payload).eq('id', id).select('*').single());
    await activityLogsService.log({
      project_id: task.project_id,
      action: 'task.updated',
      entity_type: 'task',
      entity_id: task.id,
      metadata: payload as unknown as Json,
    });

    if (payload.assignee_id) {
      await supabase.from('notifications').insert({
        user_id: payload.assignee_id,
        type: 'task_assigned',
        title: 'Tâche assignée',
        message: `On vous a assigné la tâche "${task.title}".`,
        link: `/projects/${task.project_id}?tab=tasks&task=${task.id}`,
      });
    }

    return task;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },

  async reorderSiblings(updates: Array<{ id: string; position: number; parent_task_id: string | null }>): Promise<void> {
    await Promise.all(
      updates.map((u) =>
        supabase.from('tasks').update({ position: u.position, parent_task_id: u.parent_task_id }).eq('id', u.id)
      )
    );
  },
};
