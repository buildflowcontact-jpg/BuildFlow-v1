import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Supply } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const suppliesService = {
  async list(projectId: string): Promise<Supply[]> {
    return unwrap(
      await supabase
        .from('supplies')
        .select('*')
        .eq('project_id', projectId)
        .order('expected_delivery_date', { ascending: true, nullsFirst: false })
    );
  },

  async listLate(projectId: string): Promise<Supply[]> {
    const today = new Date().toISOString().slice(0, 10);
    return unwrap(
      await supabase
        .from('supplies')
        .select('*')
        .eq('project_id', projectId)
        .lt('expected_delivery_date', today)
        .not('status', 'in', '(delivered,cancelled)')
    );
  },

  async create(payload: TablesInsert<'supplies'>): Promise<Supply> {
    const supply = unwrap(await supabase.from('supplies').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: supply.project_id,
      action: 'supply.created',
      entity_type: 'supply',
      entity_id: supply.id,
      metadata: { supplier: supply.supplier_name },
    });
    return supply;
  },

  async update(id: string, payload: TablesUpdate<'supplies'>): Promise<Supply> {
    return unwrap(await supabase.from('supplies').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) throw error;
  },
};
