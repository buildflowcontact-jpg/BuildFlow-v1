import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { TimeEntry } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const timeEntriesService = {
  async list(projectId: string): Promise<TimeEntry[]> {
    return unwrap(
      await supabase.from('time_entries').select('*').eq('project_id', projectId).order('work_date', { ascending: false })
    );
  },

  async listForUser(projectId: string, userId: string): Promise<TimeEntry[]> {
    return unwrap(
      await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .order('work_date', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'time_entries'>): Promise<TimeEntry> {
    return unwrap(await supabase.from('time_entries').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'time_entries'>): Promise<TimeEntry> {
    return unwrap(await supabase.from('time_entries').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) throw error;
  },
};
