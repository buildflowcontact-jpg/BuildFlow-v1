import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { FirePermit } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const firePermitsService = {
  async list(projectId: string): Promise<FirePermit[]> {
    return unwrap(
      await supabase
        .from('fire_permits')
        .select('*')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'fire_permits'>): Promise<FirePermit> {
    const permit = unwrap(await supabase.from('fire_permits').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: permit.project_id,
      action: 'fire_permit.created',
      entity_type: 'fire_permit',
      entity_id: permit.id,
      metadata: { location: permit.location },
    });
    return permit;
  },

  async update(id: string, payload: TablesUpdate<'fire_permits'>): Promise<FirePermit> {
    return unwrap(await supabase.from('fire_permits').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fire_permits').delete().eq('id', id);
    if (error) throw error;
  },
};
