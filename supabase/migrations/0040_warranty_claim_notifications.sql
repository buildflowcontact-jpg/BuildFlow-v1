-- Notifications automatiques pour le workflow Garantie / SAV
--
-- Règles métier :
--   ouvert      → notifie tous les membres du projet (nouvelle réclamation)
--   en_cours    → notifie le created_by (quelqu'un prend en charge)
--   resolu      → notifie le created_by + tous les membres (résolution)
--   clos        → notifie le created_by (clôture définitive)
--
-- La fonction tourne en SECURITY DEFINER pour bypasser RLS sur notifications.

CREATE OR REPLACE FUNCTION public.notify_warranty_claim_status_change()
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
  v_type_label   text;
BEGIN
  -- Ignorer si le statut n'a pas changé (UPDATE sans changement de statut)
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_project_name
  FROM projects
  WHERE id = NEW.project_id;

  v_link := '/projects/' || NEW.project_id || '/warranty';

  -- label lisible du type de garantie
  v_type_label := CASE NEW.warranty_type
    WHEN 'parfait_achevement' THEN 'Parfait achèvement'
    WHEN 'biennale'           THEN 'Biennale'
    WHEN 'decennale'          THEN 'Décennale'
    ELSE 'Hors garantie'
  END;

  -- ── ouvert (nouvelle réclamation) : notifie tous les membres ─────────────
  IF NEW.status = 'ouvert' THEN
    v_title   := 'Nouvelle réclamation — ' || NEW.title;
    v_message := v_type_label || ' · ' || v_project_name;

    FOR v_member IN
      SELECT user_id
      FROM   project_members
      WHERE  project_id = NEW.project_id
        AND  user_id    IS NOT NULL
        AND  user_id   <> COALESCE(NEW.created_by,
                                   '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (v_member.user_id, 'warranty.ouvert',
              v_title, v_message, v_link);
    END LOOP;

  -- ── en_cours : notifie le created_by ────────────────────────────────────
  ELSIF NEW.status = 'en_cours' AND NEW.created_by IS NOT NULL THEN
    v_title   := 'Garantie prise en charge — ' || NEW.title;
    v_message := v_type_label || ' · ' || v_project_name;
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.created_by, 'warranty.en_cours',
            v_title, v_message, v_link);

  -- ── resolu : notifie le created_by + les membres ────────────────────────
  ELSIF NEW.status = 'resolu' THEN
    v_title   := 'Garantie résolue — ' || NEW.title;
    v_message := v_type_label || ' · ' || v_project_name;

    FOR v_member IN
      SELECT DISTINCT user_id
      FROM   project_members
      WHERE  project_id = NEW.project_id
        AND  user_id    IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (v_member.user_id, 'warranty.resolu',
              v_title, v_message, v_link);
    END LOOP;

  -- ── clos : notifie le created_by ────────────────────────────────────────
  ELSIF NEW.status = 'clos' AND NEW.created_by IS NOT NULL THEN
    v_title   := 'Garantie clôturée — ' || NEW.title;
    v_message := v_type_label || ' · ' || v_project_name;
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.created_by, 'warranty.clos',
            v_title, v_message, v_link);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warranty_claims_notify ON public.warranty_claims;

CREATE TRIGGER trg_warranty_claims_notify
  AFTER INSERT OR UPDATE OF status
  ON public.warranty_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_warranty_claim_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_warranty_claim_status_change()
  FROM PUBLIC, anon, authenticated;
