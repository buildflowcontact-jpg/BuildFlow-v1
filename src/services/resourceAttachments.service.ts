import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ResourceAttachment, Document } from '@/types/domain';
import type { TablesInsert } from '@/types/database.types';

export type AttachableResourceType = 'daily_log' | 'rfi' | 'change_order';

export const resourceAttachmentsService = {
  async listForResource(
    resourceType: AttachableResourceType,
    resourceId: string
  ): Promise<(ResourceAttachment & { document: Document | null })[]> {
    return unwrap(
      await supabase
        .from('resource_attachments')
        .select('*, document:documents(*)')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })
    ) as unknown as (ResourceAttachment & { document: Document | null })[];
  },

  async attach(payload: TablesInsert<'resource_attachments'>): Promise<ResourceAttachment> {
    return unwrap(await supabase.from('resource_attachments').insert(payload).select('*').single());
  },

  async detach(id: string): Promise<void> {
    const { error } = await supabase.from('resource_attachments').delete().eq('id', id);
    if (error) throw error;
  },
};
