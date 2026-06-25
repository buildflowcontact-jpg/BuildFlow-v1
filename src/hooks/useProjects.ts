import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@/services/projects.service';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export function useProjects() {
  const organization = useAuthStore((s) => s.organization);
  const queryClient = useQueryClient();
  const queryKey = ['projects', organization?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => projectsService.list(organization!.id),
    enabled: Boolean(organization?.id),
  });

  useRealtimeInvalidate('projects', organization ? { column: 'organization_id', value: organization.id } : null, queryKey);

  const create = useMutation({
    mutationFn: (payload: Omit<TablesInsert<'projects'>, 'organization_id' | 'owner_id'>) =>
      projectsService.create({
        ...payload,
        organization_id: organization!.id,
        owner_id: useAuthStore.getState().session!.user.id,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<'projects'> }) =>
      projectsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, projects: query.data ?? [], create, update, remove };
}

export function useProjectsProgress(projectIds: string[]) {
  const sortedIds = projectIds.slice().sort();
  return useQuery({
    queryKey: ['projects-progress', sortedIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('project_id, progress')
        .in('project_id', sortedIds);
      if (error) throw error;
      const byProject: Record<string, number> = {};
      const grouped = new Map<string, number[]>();
      for (const row of data ?? []) {
        const list = grouped.get(row.project_id) ?? [];
        list.push(row.progress ?? 0);
        grouped.set(row.project_id, list);
      }
      for (const id of sortedIds) {
        const values = grouped.get(id) ?? [];
        byProject[id] = values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
      }
      return byProject;
    },
    enabled: sortedIds.length > 0,
  });
}
