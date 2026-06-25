import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ProjectContact } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const projectContactsService = {
  async listForProject(projectId: string): Promise<ProjectContact[]> {
    return unwrap(
      await supabase
        .from('project_contacts')
        .select('*')
        .eq('project_id', projectId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
    );
  },

  async create(payload: TablesInsert<'project_contacts'>): Promise<ProjectContact> {
    return unwrap(await supabase.from('project_contacts').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'project_contacts'>): Promise<ProjectContact> {
    return unwrap(await supabase.from('project_contacts').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('project_contacts').delete().eq('id', id);
    if (error) throw error;
  },

  async setPrimary(projectId: string, contactId: string): Promise<void> {
    // Démote tous les contacts du projet puis promeut celui sélectionné.
    const { error: demoteError } = await supabase
      .from('project_contacts')
      .update({ is_primary: false })
      .eq('project_id', projectId);
    if (demoteError) throw demoteError;

    const { error: promoteError } = await supabase
      .from('project_contacts')
      .update({ is_primary: true })
      .eq('id', contactId);
    if (promoteError) throw promoteError;
  },
};
