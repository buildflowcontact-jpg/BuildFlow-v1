-- Migration 0043 : portail client externe (tokens + RPC get_portal_data)

CREATE TABLE IF NOT EXISTS public.portal_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_email text NOT NULL,
  token       uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_manage_portal_tokens" ON public.portal_tokens
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "anon_read_portal_tokens" ON public.portal_tokens
  FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.get_portal_data(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_result     jsonb;
BEGIN
  SELECT project_id INTO v_project_id
  FROM portal_tokens
  WHERE token = p_token AND expires_at > now();

  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Token invalide ou expiré');
  END IF;

  SELECT jsonb_build_object(
    'project', to_jsonb(p),
    'progress', (
      SELECT CASE WHEN count(*) = 0 THEN 0
             ELSE round(count(*) FILTER (WHERE status = 'done')::numeric / count(*) * 100)
             END
      FROM tasks WHERE project_id = v_project_id
    ),
    'open_rfis', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'number',number,'title',title,'status',status,'created_at',created_at) ORDER BY number DESC),'[]'::jsonb)
      FROM rfis WHERE project_id = v_project_id AND status <> 'closed' LIMIT 5
    ),
    'pending_change_orders', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'amount',amount,'created_at',created_at)),'[]'::jsonb)
      FROM change_orders WHERE project_id = v_project_id AND status = 'pending_approval' LIMIT 5
    ),
    'recent_documents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'created_at',created_at) ORDER BY created_at DESC),'[]'::jsonb)
      FROM documents WHERE project_id = v_project_id ORDER BY created_at DESC LIMIT 8
    ),
    'recent_logs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'log_date',log_date,'summary',summary,'weather',weather) ORDER BY log_date DESC),'[]'::jsonb)
      FROM daily_logs WHERE project_id = v_project_id ORDER BY log_date DESC LIMIT 3
    )
  ) INTO v_result FROM projects p WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_data(uuid) TO anon;
