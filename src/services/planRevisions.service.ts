import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { PlanRevision } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const planRevisionsService = {
  async list(projectId: string): Promise<PlanRevision[]> {
    return unwrap(
      await supabase
        .from('plan_revisions')
        .select('*')
        .eq('project_id', projectId)
        .order('discipline', { ascending: true })
        .order('title', { ascending: true })
        .order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'plan_revisions'>): Promise<PlanRevision> {
    return unwrap(
      await supabase.from('plan_revisions').insert(payload).select('*').single()
    );
  },

  async update(id: string, payload: TablesUpdate<'plan_revisions'>): Promise<PlanRevision> {
    return unwrap(
      await supabase.from('plan_revisions').update(payload).eq('id', id).select('*').single()
    );
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('plan_revisions').delete().eq('id', id);
    if (error) throw error;
  },
};
