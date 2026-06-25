import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Notification } from '@/types/domain';
import type { ResourceType as ShareableResourceType } from '@/types/database.types';

type ResourceType = ShareableResourceType | 'model3d';

/**
 * Calcule l'ensemble des utilisateurs ayant acces a une ressource donnee :
 * - les membres du projet (role owner ou collaborator, qui ont au moins un acces "view")
 * - les beneficiaires d'un partage fin via resource_permissions sur cette ressource precise
 * Cela evite de notifier tous les contacts du projet quand seule une poignee
 * d'entre eux a reellement acces au document/plan/maquette concerne.
 *
 * Note : 'model3d' n'existe pas dans l'enum resource_type de resource_permissions
 * (qui ne couvre que document/plan/task/project) — il n'y a donc pas de partage fin
 * possible pour les maquettes 3D pour l'instant, l'audience se limite aux membres du projet.
 */
async function getResourceAudience(params: {
  resourceType: ResourceType;
  resourceId: string;
  projectId: string;
  excludeUserId?: string;
}): Promise<string[]> {
  const isShareable = params.resourceType !== 'model3d';

  const [{ data: projectMembers }, resourcePerms] = await Promise.all([
    supabase.from('project_members').select('user_id').eq('project_id', params.projectId).not('user_id', 'is', null),
    isShareable
      ? supabase
          .from('resource_permissions')
          .select('grantee_user_id')
          .eq('resource_type', params.resourceType as ShareableResourceType)
          .eq('resource_id', params.resourceId)
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const ids = new Set<string>();
  for (const m of projectMembers ?? []) {
    if (m.user_id) ids.add(m.user_id);
  }
  for (const p of resourcePerms ?? []) {
    if (p.grantee_user_id) ids.add(p.grantee_user_id);
  }
  if (params.excludeUserId) ids.delete(params.excludeUserId);
  return Array.from(ids);
}

export const notificationsService = {
  /**
   * Notifie uniquement les utilisateurs ayant acces a la ressource (document,
   * plan ou maquette 3D) concernee — pas l'ensemble des membres du projet.
   */
  async notifyResourceChange(params: {
    resourceType: ResourceType;
    resourceId: string;
    projectId: string;
    actorId?: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }): Promise<void> {
    const audience = await getResourceAudience({
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      projectId: params.projectId,
      excludeUserId: params.actorId,
    });
    if (audience.length === 0) return;

    const { error } = await supabase.from('notifications').insert(
      audience.map((userId) => ({
        user_id: userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
      }))
    );
    if (error) throw error;
  },

  async list(userId: string): Promise<Notification[]> {
    return unwrap(
      await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
    );
  },

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  },

  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
  },
};
