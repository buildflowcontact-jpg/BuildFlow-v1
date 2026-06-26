import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { NonConformity } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const nonConformitiesService = {
  async list(projectId: string): Promise<NonConformity[]> {
    return unwrap(
      await supabase.from('non_conformities').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    );
  },

  /** Création manuelle (hors déclenchement automatique par une checklist). */
  async create(payload: TablesInsert<'non_conformities'>): Promise<NonConformity> {
    const nc = unwrap(await supabase.from('non_conformities').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: nc.project_id,
      action: 'non_conformity.created',
      entity_type: 'non_conformity',
      entity_id: nc.id,
      metadata: { title: nc.title, severity: nc.severity },
    });
    return nc;
  },

  async update(id: string, payload: TablesUpdate<'non_conformities'>): Promise<NonConformity> {
    const nc = unwrap(await supabase.from('non_conformities').update(payload).eq('id', id).select('*').single());
    if (payload.status === 'resolue' || payload.status === 'verifiee') {
      await activityLogsService.log({
        project_id: nc.project_id,
        action: payload.status === 'resolue' ? 'non_conformity.resolved' : 'non_conformity.verified',
        entity_type: 'non_conformity',
        entity_id: nc.id,
        metadata: { title: nc.title },
      });
    }
    return nc;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('non_conformities').delete().eq('id', id);
    if (error) throw error;
  },
};
