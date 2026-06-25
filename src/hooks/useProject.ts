import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@/services/projects.service';
import type { TablesUpdate } from '@/types/database.types';
import type { ProjectMember } from '@/types/domain';
import { useRealtimeInvalidate } from './useRealtimeInvalidate';

export function useProject(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['project', projectId];
  const membersKey = ['project-members', projectId];

  const project = useQuery({
    queryKey,
    queryFn: () => projectsService.getById(projectId!),
    enabled: Boolean(projectId),
  });

  const members = useQuery({
    queryKey: membersKey,
    queryFn: () => projectsService.listMembers(projectId!),
    enabled: Boolean(projectId),
  });

  useRealtimeInvalidate('projects', projectId ? { column: 'id', value: projectId } : null, queryKey);

  const update = useMutation({
    mutationFn: (payload: TablesUpdate<'projects'>) => projectsService.update(projectId!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const inviteMember = useMutation({
    mutationFn: ({ email, role }: { email: string; role?: ProjectMember['role'] }) =>
      projectsService.inviteMember(projectId!, email, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: ProjectMember['role'] }) =>
      projectsService.updateMemberRole(memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => projectsService.removeMember(memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  const transferOwnership = useMutation({
    mutationFn: ({ newOwnerUserId }: { newOwnerUserId: string }) =>
      projectsService.transferOwnership(projectId!, newOwnerUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: membersKey });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    project: project.data,
    isLoading: project.isLoading,
    error: project.error,
    members: members.data ?? [],
    membersLoading: members.isLoading,
    update,
    inviteMember,
    updateMemberRole,
    removeMember,
    transferOwnership,
  };
}
