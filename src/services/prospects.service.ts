import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Prospect, ProspectVisit } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const prospectsService = {
  async list(organizationId: string): Promise<Prospect[]> {
    return unwrap(
      await supabase
        .from('prospects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('next_action_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'prospects'>): Promise<Prospect> {
    return unwrap(await supabase.from('prospects').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'prospects'>): Promise<Prospect> {
    return unwrap(await supabase.from('prospects').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('prospects').delete().eq('id', id);
    if (error) throw error;
  },

  // Visites techniques
  async listVisits(prospectId: string): Promise<ProspectVisit[]> {
    return unwrap(
      await supabase
        .from('prospect_visits')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('visit_date', { ascending: false })
    );
  },

  async createVisit(payload: TablesInsert<'prospect_visits'>): Promise<ProspectVisit> {
    return unwrap(await supabase.from('prospect_visits').insert(payload).select('*').single());
  },

  async removeVisit(id: string): Promise<void> {
    const { error } = await supabase.from('prospect_visits').delete().eq('id', id);
    if (error) throw error;
  },
};
