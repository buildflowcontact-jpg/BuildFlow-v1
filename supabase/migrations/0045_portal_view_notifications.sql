-- Migration 0045 : notification in-app quand un client consulte le portail
--
-- Stratégie :
-- - Colonne last_viewed_at sur portal_tokens (throttle 1 heure)
-- - get_portal_data met à jour last_viewed_at et insère une notif
--   pour chaque membre du projet si le délai est écoulé.

-- ── 1. Colonne de throttle ────────────────────────────────────────────────────

ALTER TABLE public.portal_tokens
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- ── 2. Réécriture de get_portal_data avec notifications ───────────────────────

CREATE OR REPLACE FUNCTION public.get_portal_data(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_project_id   uuid;
  v_project_name text;
  v_client_email text;
  v_last_viewed  timestamptz;
  v_member       record;
  v_result       jsonb;
BEGIN
  SELECT project_id, client_email, last_viewed_at
    INTO v_project_id, v_client_email, v_last_viewed
  FROM portal_tokens
  WHERE token = p_token AND expires_at > now();

  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Token invalide ou expiré');
  END IF;

  -- ── Mise à jour de la date de dernière consultation ──────────────────────
  UPDATE portal_tokens
     SET last_viewed_at = now()
   WHERE token = p_token;

  -- ── Notification (throttle 1 heure) ─────────────────────────────────────
  IF v_last_viewed IS NULL OR v_last_viewed < now() - interval '1 hour' THEN
    SELECT name INTO v_project_name FROM projects WHERE id = v_project_id;

    FOR v_member IN
      SELECT DISTINCT user_id
      FROM   project_members
      WHERE  project_id = v_project_id
        AND  user_id    IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        v_member.user_id,
        'portal.viewed',
        'Portail consulté',
        v_client_email || ' · ' || v_project_name,
        '/projects/' || v_project_id || '/portal'
      );
    END LOOP;
  END IF;

  -- ── Construction de la réponse ───────────────────────────────────────────
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
