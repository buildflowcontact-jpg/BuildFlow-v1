-- Migration 0046 : sécuriser le trigger email via secret webhook
--
-- Met à jour trigger_send_email_notification pour inclure le header
-- x-webhook-secret lorsqu'un secret est configuré via le paramètre
-- de base de données app.notification_webhook_secret.
--
-- Étapes de configuration (après déploiement) :
--
-- 1. Générer un secret fort (ex. openssl rand -hex 32)
--
-- 2. L'enregistrer comme paramètre PostgreSQL :
--      ALTER DATABASE postgres
--        SET app.notification_webhook_secret TO 'votre-secret-ici';
--    Puis recharger la config :
--      SELECT pg_reload_conf();
--
-- 3. Ajouter le même secret dans Supabase Dashboard →
--    Edge Functions → Secrets → NOTIFICATION_WEBHOOK_SECRET
--
-- Sans ce paramètre DB, le trigger fonctionne sans header (comportement
-- identique à avant), et l'Edge Function accepte la requête car
-- WEBHOOK_SECRET est vide côté fonction.

CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions
AS $$
DECLARE
  v_secret  text;
  v_headers jsonb;
BEGIN
  -- Lire le secret depuis les paramètres de la DB (null si non défini)
  v_secret := current_setting('app.notification_webhook_secret', true);

  -- Construire les headers : toujours Content-Type, + x-webhook-secret si disponible
  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    v_headers := v_headers || jsonb_build_object('x-webhook-secret', v_secret);
  END IF;

  PERFORM net.http_post(
    url     := 'https://nonqaratfnjpdogjbzyi.supabase.co/functions/v1/send-email-notification',
    body    := to_jsonb(NEW),
    headers := v_headers,
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

-- Le trigger on_notification_send_email reste inchangé (déjà créé en 0042).
-- Cette migration ne fait que remplacer la fonction sous-jacente.
