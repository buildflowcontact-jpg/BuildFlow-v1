import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Comment, Profile } from '@/types/domain';
import type { CommentParentType } from '@/types/database.types';

export const commentsService = {
  async list(parentType: CommentParentType, parentId: string): Promise<(Comment & { author: Profile | null })[]> {
    return unwrap(
      await supabase
        .from('comments')
        .select('*, author:profiles(*)')
        .eq('parent_type', parentType)
        .eq('parent_id', parentId)
        .order('created_at', { ascending: true })
    ) as unknown as (Comment & { author: Profile | null })[];
  },

  async create(payload: {
    project_id: string;
    parent_type: CommentParentType;
    parent_id: string;
    author_id: string;
    content: string;
  }): Promise<Comment> {
    return unwrap(await supabase.from('comments').insert(payload).select('*').single());
  },

  async update(id: string, content: string): Promise<Comment> {
    return unwrap(await supabase.from('comments').update({ content }).eq('id', id).select('*').single());
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw error;
  },
};
