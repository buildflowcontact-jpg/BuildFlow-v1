-- Notifications automatiques pour les approvisionnements
--
-- 1. Trigger sur supply.status :
--    delivered → notifie created_by + tous les membres du projet
--    delayed   → notifie created_by
--
-- 2. Cron daily à 08h00 : supplies dont la date de livraison prévue
--    est dépassée et dont le statut n'est ni delivered ni cancelled.
--    Envoie une notification par supply en retard (dédupliqué par jour).

-- ─── 1. Trigger livraison ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_supply_status_change()
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
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_project_name
  FROM projects
  WHERE id = NEW.project_id;

  -- Le lien inclut l'id pour un éventuel highlight côté front
  v_link := '/projects/' || NEW.project_id || '/supplies?id=' || NEW.id;

  -- ── delivered : notifie le créateur + tous les membres ───────────────────
  IF NEW.status = 'delivered' THEN
    v_title   := 'Livraison reçue — ' || NEW.item_description;
    v_message := NEW.supplier_name || ' · ' || v_project_name;

    FOR v_member IN
      SELECT DISTINCT user_id
      FROM   project_members
      WHERE  project_id = NEW.project_id
        AND  user_id    IS NOT NULL
    LOOP
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (v_member.user_id, 'supply.delivered',
              v_title, v_message, v_link);
    END LOOP;

    -- Notifier aussi le created_by s'il n'est pas déjà membre
    IF NEW.created_by IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM project_members
         WHERE project_id = NEW.project_id AND user_id = NEW.created_by
       )
    THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (NEW.created_by, 'supply.delivered',
              v_title, v_message, v_link);
    END IF;

  -- ── delayed : notifie le created_by ─────────────────────────────────────
  ELSIF NEW.status = 'delayed' AND NEW.created_by IS NOT NULL THEN
    v_title   := 'Livraison retardée — ' || NEW.item_description;
    v_message := NEW.supplier_name || ' · ' || v_project_name;
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (NEW.created_by, 'supply.delayed',
            v_title, v_message, v_link);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplies_notify ON public.supplies;

CREATE TRIGGER trg_supplies_notify
  AFTER INSERT OR UPDATE OF status
  ON public.supplies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supply_status_change();

REVOKE EXECUTE ON FUNCTION public.notify_supply_status_change()
  FROM PUBLIC, anon, authenticated;

-- ─── 2. Fonction cron : supplies en retard de livraison ───────────────────

CREATE OR REPLACE FUNCTION public.notify_overdue_supplies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_supply  record;
  v_member  record;
  v_title   text;
  v_message text;
  v_link    text;
BEGIN
  FOR v_supply IN
    SELECT s.id,
           s.project_id,
           s.item_description,
           s.supplier_name,
           s.expected_delivery_date,
           s.created_by,
           p.name AS project_name
    FROM   supplies s
    JOIN   projects  p ON p.id = s.project_id
    WHERE  s.expected_delivery_date < CURRENT_DATE
      AND  s.status NOT IN ('delivered', 'cancelled')
  LOOP
    v_title   := 'Livraison en retard — ' || v_supply.item_description;
    v_message := v_supply.supplier_name
                 || ' · prévu le ' || to_char(v_supply.expected_delivery_date, 'DD/MM/YYYY')
                 || ' · ' || v_supply.project_name;
    v_link    := '/projects/' || v_supply.project_id
                 || '/supplies?id=' || v_supply.id;

    FOR v_member IN
      SELECT DISTINCT user_id
      FROM   project_members
      WHERE  project_id = v_supply.project_id
        AND  user_id    IS NOT NULL
    LOOP
      -- Évite les doublons : pas de deuxième notification du même type
      -- pour la même supply le même jour
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE  user_id    = v_member.user_id
          AND  type       = 'supply.retard'
          AND  link       = v_link
          AND  created_at >= CURRENT_DATE
      ) THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (v_member.user_id, 'supply.retard',
                v_title, v_message, v_link);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_overdue_supplies()
  FROM PUBLIC, anon, authenticated;

-- ─── 3. Planification cron (08h00 UTC chaque jour) ────────────────────────

SELECT cron.schedule(
  'notify-overdue-supplies',
  '0 8 * * *',
  $$ SELECT public.notify_overdue_supplies(); $$
);
