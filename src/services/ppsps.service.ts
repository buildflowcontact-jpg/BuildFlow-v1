import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { PpspsRecord } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const ppspsService = {
  async list(projectId: string): Promise<PpspsRecord[]> {
    return unwrap(
      await supabase
        .from('ppsps_records')
        .select('*')
        .eq('project_id', projectId)
    );
  },

  async upsert(payload: TablesInsert<'ppsps_records'>): Promise<PpspsRecord> {
    return unwrap(
      await supabase
        .from('ppsps_records')
        .upsert(payload, { onConflict: 'project_id,company_id' })
        .select('*')
        .single()
    );
  },

  async update(id: string, payload: TablesUpdate<'ppsps_records'>): Promise<PpspsRecord> {
    return unwrap(await supabase.from('ppsps_records').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('ppsps_records').delete().eq('id', id);
    if (error) throw error;
  },
};
