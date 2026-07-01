-- Notifications automatiques pour le workflow de validation des plans
--
-- Règles métier :
--   soumis      → notifie tous les membres du projet (sauf l'auteur)
--   approuvé    → notifie l'auteur de la révision (submitted_by)
--   refusé      → notifie l'auteur avec le commentaire du relecteur
--   en_révision → notifie l'auteur avec les demandes de modifications
--
-- La fonction tourne en SECURITY DEFINER pour bypasser RLS sur notifications.

-- ─── Fonction trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_plan_revision_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_project_name text;
  v_member       record;
  v_title        text;
  v_message      text;
  v_link         text;
BEGIN
  -- Ignorer si le statut n'a pas changé
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_project_name
  FROM projects
  WHERE id = NEW.project_id;

  v_link := '/projects/' || NEW.project_id || '/plan-validations';

  -- ── soumis : notifie les relecteurs (tous les membres sauf l'auteur) ──────
  IF NEW.status = 'soumis' THEN
    v_title   := 'Plan à valider — ' || NEW.title;
    v_message := NEW.discipline || ' · Rev. ' || NEW.revision_index
                 || ' · ' || v_project_name;

    FOR v_member IN
      SELECT user_id
      FROM   project_members
      WHERE  project_id = NEW.project_id
        AND  user_id    IS NOT NULL
        AND  user_id   <> COALESCE(NEW.submitted_by,
                                   '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (v_member.user_id, 'plan_revision.soumis',
              v_title, v_message, v_link);
    END LOOP;

  -- ── approuvé : notifie l'auteur ───────────────────────────────────────────
  ELSIF NEW.status = 'approuve' AND NEW.submitted_by IS NOT NULL THEN
    v_title   := 'Plan approuvé — ' || NEW.title;
    v_message := 'Rev. ' || NEW.revision_index || ' · ' || v_project_name;
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.submitted_by, 'plan_revision.approuve',
            v_title, v_message, v_link);

  -- ── refusé : notifie l'auteur avec le motif ───────────────────────────────
  ELSIF NEW.status = 'refuse' AND NEW.submitted_by IS NOT NULL THEN
    v_title   := 'Plan refusé — ' || NEW.title;
    v_message := COALESCE(NEW.reviewer_comment,
                          'Rev. ' || NEW.revision_index || ' · ' || v_project_name);
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.submitted_by, 'plan_revision.refuse',
            v_title, v_message, v_link);

  -- ── en_revision : notifie l'auteur avec les demandes ─────────────────────
  ELSIF NEW.status = 'en_revision' AND NEW.submitted_by IS NOT NULL THEN
    v_title   := 'Révisions demandées — ' || NEW.title;
    v_message := COALESCE(NEW.reviewer_comment,
                          'Rev. ' || NEW.revision_index || ' · ' || v_project_name);
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.submitted_by, 'plan_revision.en_revision',
            v_title, v_message, v_link);
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Trigger ───────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_plan_revisions_notify ON public.plan_revisions;

CREATE TRIGGER trg_plan_revisions_notify
  AFTER INSERT OR UPDATE OF status
  ON public.plan_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_plan_revision_status_change();

-- Révoque l'accès direct à la fonction pour les rôles non privilegiés
-- (elle est appelée uniquement via le trigger, pas directement par les clients)
REVOKE EXECUTE ON FUNCTION public.notify_plan_revision_status_change()
  FROM PUBLIC, anon, authenticated;
