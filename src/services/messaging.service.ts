import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { Conversation, ConversationParticipant, ConversationWithMeta, Message, MessageWithSender, Profile } from '@/types/domain';

type ParticipantWithProfile = ConversationParticipant & { profile: Profile | null };

export type ListMessagesOpts = { limit?: number };

export const messagingService = {
  /** Récupère (ou crée) le fil "groupe" du projet, visible par toute l'équipe. */
  async ensureGroupConversation(projectId: string): Promise<string> {
    const { data, error } = await supabase.rpc('ensure_project_group_conversation', { p_project_id: projectId });
    if (error) throw error;
    return data as string;
  },

  /** Récupère (ou crée) la conversation directe entre l'appelant et un autre membre du projet. */
  async getOrCreateDirectConversation(projectId: string, otherUserId: string): Promise<string> {
    const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
      p_project_id: projectId,
      p_other_user_id: otherUserId,
    });
    if (error) throw error;
    return data as string;
  },

  /** Marque la conversation comme lue pour l'appelant (badge "non lus"). */
  async markRead(conversationId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
    if (error) throw error;
  },

  /**
   * Liste les conversations visibles par l'utilisateur sur le projet, enrichies
   * du nom à afficher (équipe ou nom de l'interlocuteur), de l'aperçu du dernier
   * message et du nombre de messages non lus.
   */
  async listConversations(projectId: string, currentUserId: string): Promise<ConversationWithMeta[]> {
    const conversations = unwrap(
      await supabase
        .from('conversations')
        .select('*')
        .eq('project_id', projectId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
    );
    if (conversations.length === 0) return [];

    const ids = conversations.map((c) => c.id);
    const participants = unwrap(
      await supabase.from('conversation_participants').select('*, profile:profiles(*)').in('conversation_id', ids)
    ) as unknown as ParticipantWithProfile[];

    const metas = await Promise.all(
      conversations.map(async (conv: Conversation) => {
        const own = participants.find((p) => p.conversation_id === conv.id && p.user_id === currentUserId);
        const lastReadAt = own?.last_read_at ?? null;

        const lastMessages = unwrap(
          await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
        );

        let unreadQuery = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', currentUserId);
        if (lastReadAt) unreadQuery = unreadQuery.gt('created_at', lastReadAt);
        const { count } = await unreadQuery;

        let displayName = 'Discussion d’équipe';
        if (conv.type === 'direct') {
          const other = participants.find((p) => p.conversation_id === conv.id && p.user_id !== currentUserId);
          displayName = other?.profile?.full_name ?? 'Conversation directe';
        }

        return {
          ...conv,
          displayName,
          lastMessagePreview: lastMessages[0]?.content ?? null,
          unreadCount: count ?? 0,
        } satisfies ConversationWithMeta;
      })
    );

    return metas;
  },

  /**
   * Sans `opts`, comportement inchangé (historique complet, ordre chronologique).
   * Avec `{ limit }`, ne charge que les `limit` messages les plus récents (tri
   * descendant côté requête puis ré-inversion) — évite de charger tout
   * l'historique d'une conversation longue juste pour afficher les derniers
   * échanges (cf. audit du 26/06/2026, section Perf).
   */
  async listMessages(conversationId: string, opts?: ListMessagesOpts): Promise<MessageWithSender[]> {
    if (opts?.limit !== undefined) {
      const recent = unwrap(
        await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(opts.limit)
      ) as unknown as MessageWithSender[];
      return recent.reverse();
    }
    return unwrap(
      await supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
    ) as unknown as MessageWithSender[];
  },

  async sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
    return unwrap(
      await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, content })
        .select('*')
        .single()
    );
  },
};
