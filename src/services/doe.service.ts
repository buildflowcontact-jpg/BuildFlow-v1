import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { DoeItem } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const doeService = {
  async list(projectId: string): Promise<DoeItem[]> {
    return unwrap(
      await supabase
        .from('doe_items')
        .select('*')
        .eq('project_id', projectId)
        .order('lot', { ascending: true })
    );
  },

  async create(payload: TablesInsert<'doe_items'>): Promise<DoeItem> {
    return unwrap(await supabase.from('doe_items').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'doe_items'>): Promise<DoeItem> {
    return unwrap(await supabase.from('doe_items').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('doe_items').delete().eq('id', id);
    if (error) throw error;
  },
};
