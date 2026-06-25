import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ActivityLog, Profile } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';

export const activityLogsService = {
  async log(payload: TablesInsert<'activity_logs'>): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('activity_logs').insert({ ...payload, user_id: payload.user_id ?? userData.user?.id ?? null });
  },

  async listForProject(projectId: string, limit = 30): Promise<(ActivityLog & { user: Profile | null })[]> {
    return unwrap(
      await supabase
        .from('activity_logs')
        .select('*, user:profiles(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit)
    ) as unknown as (ActivityLog & { user: Profile | null })[];
  },
};
