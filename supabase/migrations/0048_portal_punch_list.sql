-- Migration 0048 : portail client — ajout widget réserves + correctifs RPC
--
-- Corrections apportées à get_portal_data :
--   • daily_logs : colonne summary → progress_summary
--   • change_orders : colonne amount → cost_impact
--   • Ajout du sous-select punch_list (10 réserves ouvertes les plus récentes)

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
      SELECT coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id, 'number', number, 'title', title,
          'status', status, 'created_at', created_at
        ) ORDER BY number DESC),
        '[]'::jsonb
      )
      FROM rfis WHERE project_id = v_project_id AND status <> 'closed' LIMIT 5
    ),
    'pending_change_orders', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id, 'title', title, 'status', status,
          'amount', cost_impact, 'created_at', created_at
        )),
        '[]'::jsonb
      )
      FROM change_orders WHERE project_id = v_project_id AND status = 'pending_approval' LIMIT 5
    ),
    'recent_documents', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id, 'name', name, 'type', type, 'created_at', created_at
        ) ORDER BY created_at DESC),
        '[]'::jsonb
      )
      FROM documents WHERE project_id = v_project_id ORDER BY created_at DESC LIMIT 8
    ),
    'recent_logs', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id, 'log_date', log_date,
          'summary', progress_summary, 'weather', weather
        ) ORDER BY log_date DESC),
        '[]'::jsonb
      )
      FROM daily_logs WHERE project_id = v_project_id ORDER BY log_date DESC LIMIT 3
    ),
    'punch_list', (
      SELECT coalesce(
        jsonb_agg(jsonb_build_object(
          'id', id, 'title', title, 'status', status,
          'location', location, 'due_date', due_date
        ) ORDER BY created_at DESC),
        '[]'::jsonb
      )
      FROM punch_list_items
      WHERE project_id = v_project_id
        AND status NOT IN ('resolved', 'verified')
      LIMIT 10
    )
  ) INTO v_result FROM projects p WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_data(uuid) TO anon;
