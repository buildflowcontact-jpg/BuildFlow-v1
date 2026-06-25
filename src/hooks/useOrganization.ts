import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationsService } from '@/services/organizations.service';
import { useAuthStore } from '@/stores/authStore';
import type { Organization, OrganizationMember } from '@/types/domain';

export function useOrganization() {
  const organization = useAuthStore((s) => s.organization);
  const setOrganization = useAuthStore((s) => s.setOrganization);
  const queryClient = useQueryClient();
  const membersKey = ['organization-members', organization?.id];

  const members = useQuery({
    queryKey: membersKey,
    queryFn: () => organizationsService.listMembers(organization!.id),
    enabled: Boolean(organization?.id),
  });

  const update = useMutation({
    mutationFn: (updates: Partial<Organization>) => organizationsService.update(organization!.id, updates),
    onSuccess: (updated) => setOrganization(updated),
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrganizationMember['role'] }) =>
      organizationsService.updateMemberRole(memberId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => organizationsService.removeMember(memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  const addMember = useMutation({
    mutationFn: ({ email, role }: { email: string; role: OrganizationMember['role'] }) =>
      organizationsService.addMemberByEmail(organization!.id, email, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  });

  return {
    organization,
    members: members.data ?? [],
    membersLoading: members.isLoading,
    update,
    updateMemberRole,
    removeMember,
    addMember,
  };
}
