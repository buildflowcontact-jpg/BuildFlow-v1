import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ResourceSignature } from '@/types/domain';

/**
 * Lecture seule côté front : les signatures ne sont jamais créées via un
 * insert direct (policy signatures_select_member en select uniquement) mais
 * uniquement via les fonctions RPC decide_change_order / decide_selection /
 * decide_quote, qui les écrivent en bypassant RLS.
 */
export const signaturesService = {
  async getForResource(
    resourceType: 'change_order' | 'selection' | 'quote',
    resourceId: string
  ): Promise<ResourceSignature | null> {
    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listForProject(projectId: string): Promise<ResourceSignature[]> {
    return unwrap(
      await supabase.from('signatures').select('*').eq('project_id', projectId).order('signed_at', { ascending: false })
    );
  },
};
