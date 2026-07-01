import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import type { TablesInsert } from '@/types/database.types';

export interface PortalToken {
  id: string;
  project_id: string;
  client_email: string;
  token: string;
  expires_at: string;
  created_by: string | null;
  created_at: string;
}

export function usePortalTokens(projectId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const queryKey = ['portal_tokens', projectId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_tokens')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalToken[];
    },
    enabled: Boolean(projectId),
  });

  const create = useMutation({
    mutationFn: async (clientEmail: string) => {
      const payload: TablesInsert<'portal_tokens'> = {
        project_id: projectId,
        client_email: clientEmail,
        created_by: userId ?? null,
      };
      const { data, error } = await supabase
        .from('portal_tokens')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data as PortalToken;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revoke = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase.from('portal_tokens').delete().eq('id', tokenId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    tokens: query.data ?? [],
    isLoading: query.isLoading,
    create,
    revoke,
  };
}
