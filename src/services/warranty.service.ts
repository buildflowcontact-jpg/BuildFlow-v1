import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { WarrantyClaim } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const warrantyService = {
  async list(projectId: string): Promise<WarrantyClaim[]> {
    return unwrap(
      await supabase
        .from('warranty_claims')
        .select('*')
        .eq('project_id', projectId)
        .order('reported_date', { ascending: false })
        .order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'warranty_claims'>): Promise<WarrantyClaim> {
    return unwrap(
      await supabase.from('warranty_claims').insert(payload).select('*').single()
    );
  },

  async update(id: string, payload: TablesUpdate<'warranty_claims'>): Promise<WarrantyClaim> {
    return unwrap(
      await supabase.from('warranty_claims').update(payload).eq('id', id).select('*').single()
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('warranty_claims').delete().eq('id', id);
    if (error) throw error;
  },
};
