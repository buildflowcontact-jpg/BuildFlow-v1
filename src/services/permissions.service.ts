import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ResourcePermission, Profile } from '@/types/domain';
import type { PermissionLevel, ResourceType } from '@/types/database.types';

export const permissionsService = {
  async listForResource(
    resourceType: ResourceType,
    resourceId: string
  ): Promise<(ResourcePermission & { grantee: Profile | null })[]> {
    return unwrap(
      await supabase
        .from('resource_permissions')
        .select('*, grantee:profiles(*)')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
    ) as unknown as (ResourcePermission & { grantee: Profile | null })[];
  },

  async grant(params: {
    resourceType: ResourceType;
    resourceId: string;
    projectId: string;
    granteeUserId: string;
    permission: PermissionLevel;
    grantedBy: string;
  }): Promise<ResourcePermission> {
    return unwrap(
      await supabase
        .from('resource_permissions')
        .upsert(
          {
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            project_id: params.projectId,
            grantee_user_id: params.granteeUserId,
            permission: params.permission,
            granted_by: params.grantedBy,
          },
          { onConflict: 'resource_type,resource_id,grantee_user_id' }
        )
        .select('*')
        .single()
    );
  },

  async revoke(id: string): Promise<void> {
    const { error } = await supabase.from('resource_permissions').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Vérifie l'accès via la fonction SQL has_resource_access (même logique que les
   * policies RLS) : priorité ressource > projet > organisation.
   */
  async checkAccess(params: {
    resourceType: ResourceType;
    resourceId: string;
    projectId: string;
    minPermission: PermissionLevel;
  }): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_resource_access', {
      p_resource_type: params.resourceType,
      p_resource_id: params.resourceId,
      p_project_id: params.projectId,
      p_min_permission: params.minPermission,
    });
    if (error) throw error;
    return Boolean(data);
  },
};
