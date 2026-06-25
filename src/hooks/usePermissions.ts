import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionsService } from '@/services/permissions.service';
import type { PermissionLevel, ResourceType } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';

export function useResourcePermissions(resourceType: ResourceType, resourceId: string | undefined, projectId: string | undefined) {
  const grantedBy = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const queryKey = ['resource-permissions', resourceType, resourceId];

  const query = useQuery({
    queryKey,
    queryFn: () => permissionsService.listForResource(resourceType, resourceId!),
    enabled: Boolean(resourceId),
  });

  const grant = useMutation({
    mutationFn: ({ granteeUserId, permission }: { granteeUserId: string; permission: PermissionLevel }) =>
      permissionsService.grant({
        resourceType,
        resourceId: resourceId!,
        projectId: projectId!,
        granteeUserId,
        permission,
        grantedBy: grantedBy!,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => permissionsService.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, permissions: query.data ?? [], grant, revoke };
}
