import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { WasteTracking } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const wasteTrackingService = {
  async list(projectId: string): Promise<WasteTracking[]> {
    return unwrap(
      await supabase
        .from('waste_trackings')
        .select('*')
        .eq('project_id', projectId)
        .order('removal_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'waste_trackings'>): Promise<WasteTracking> {
    return unwrap(await supabase.from('waste_trackings').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'waste_trackings'>): Promise<WasteTracking> {
    return unwrap(await supabase.from('waste_trackings').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('waste_trackings').delete().eq('id', id);
    if (error) throw error;
  },
};
