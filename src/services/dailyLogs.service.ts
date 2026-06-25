import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { DailyLog } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const dailyLogsService = {
  async list(projectId: string): Promise<DailyLog[]> {
    return unwrap(
      await supabase.from('daily_logs').select('*').eq('project_id', projectId).order('log_date', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'daily_logs'>): Promise<DailyLog> {
    const log = unwrap(await supabase.from('daily_logs').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: log.project_id,
      action: 'daily_log.created',
      entity_type: 'daily_log',
      entity_id: log.id,
      metadata: { log_date: log.log_date },
    });
    return log;
  },

  async update(id: string, payload: TablesUpdate<'daily_logs'>): Promise<DailyLog> {
    return unwrap(await supabase.from('daily_logs').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('daily_logs').delete().eq('id', id);
    if (error) throw error;
  },
};
