import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksService, buildTaskTree } from '@/services/tasks.service';
import { taskDependenciesService } from '@/services/taskDependencies.service';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useTasks(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['tasks', projectId];
  const depsKey = ['task-dependencies', projectId];

  const query = useQuery({
    queryKey,
    queryFn: () => tasksService.list(projectId!),
    enabled: Boolean(projectId),
  });

  const tasks = useMemo(() => query.data ?? [], [query.data]);

  const dependenciesQuery = useQuery({
    queryKey: depsKey,
    queryFn: () => taskDependenciesService.listForProject(tasks),
    enabled: Boolean(projectId) && tasks.length > 0,
  });

  useRealtimeInvalidate('tasks', projectId ? { column: 'project_id', value: projectId } : null, queryKey);
  useRealtimeInvalidate('task_dependencies', null, depsKey);

  const tree = useMemo(() => buildTaskTree(tasks), [tasks]);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'tasks'>, 'project_id'>) =>
      tasksService.create({ ...payload, project_id: projectId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'tasks'> }) => tasksService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => tasksService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addDependency = useMutation({
    mutationFn: ({ taskId, dependsOnTaskId }: { taskId: string; dependsOnTaskId: string }) =>
      taskDependenciesService.create(taskId, dependsOnTaskId, dependenciesQuery.data ?? []),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: depsKey }),
  });

  const removeDependency = useMutation({
    mutationFn: (id: string) => taskDependenciesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: depsKey }),
  });

  return {
    ...query,
    tasks,
    tree,
    dependencies: dependenciesQuery.data ?? [],
    create,
    update,
    remove,
    addDependency,
    removeDependency,
  };
}
