import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { PunchListItem } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const punchListService = {
  async list(projectId: string): Promise<PunchListItem[]> {
    return unwrap(
      await supabase
        .from('punch_list_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'punch_list_items'>): Promise<PunchListItem> {
    const item = unwrap(await supabase.from('punch_list_items').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: item.project_id,
      action: 'punch_list.created',
      entity_type: 'punch_list_item',
      entity_id: item.id,
      metadata: { title: item.title },
    });
    return item;
  },

  async update(id: string, payload: TablesUpdate<'punch_list_items'>): Promise<PunchListItem> {
    return unwrap(await supabase.from('punch_list_items').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('punch_list_items').delete().eq('id', id);
    if (error) throw error;
  },
};
