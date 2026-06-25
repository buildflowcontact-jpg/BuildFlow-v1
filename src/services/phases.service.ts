import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Phase } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const phasesService = {
  async list(projectId: string): Promise<Phase[]> {
    return unwrap(
      await supabase.from('phases').select('*').eq('project_id', projectId).order('order_index', { ascending: true })
    );
  },

  async create(payload: TablesInsert<'phases'>): Promise<Phase> {
    return unwrap(await supabase.from('phases').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'phases'>): Promise<Phase> {
    return unwrap(await supabase.from('phases').update(payload).eq('id', id).select('*').single());
  },

  async reorder(phaseIds: string[]): Promise<void> {
    await Promise.all(
      phaseIds.map((id, index) => supabase.from('phases').update({ order_index: index }).eq('id', id))
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('phases').delete().eq('id', id);
    if (error) throw error;
  },
};
