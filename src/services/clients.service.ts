import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Client } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';

export const clientsService = {
  async list(organizationId: string): Promise<Client[]> {
    return unwrap(
      await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })
    );
  },

  async getById(id: string): Promise<Client> {
    return unwrap(await supabase.from('clients').select('*').eq('id', id).single());
  },

  async create(payload: TablesInsert<'clients'>): Promise<Client> {
    return unwrap(await supabase.from('clients').insert(payload).select('*').single());
  },

  async update(id: string, payload: TablesUpdate<'clients'>): Promise<Client> {
    return unwrap(await supabase.from('clients').update(payload).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  },
};
