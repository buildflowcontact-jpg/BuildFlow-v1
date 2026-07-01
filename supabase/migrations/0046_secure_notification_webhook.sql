-- Migration 0046 : sécuriser le trigger email via secret webhook (Supabase Vault)
--
-- Met à jour trigger_send_email_notification pour inclure le header
-- x-webhook-secret lu depuis le Vault Supabase.
--
-- Étapes de configuration (une seule fois, dans le SQL Editor) :
--
-- 1. Stocker le secret dans le Vault :
--      SELECT vault.create_secret(
--        'VALEUR_DU_SECRET',
--        'notification_webhook_secret',
--        'Secret partagé entre le trigger DB et l''Edge Function email'
--      );
--
-- 2. Ajouter le même secret dans Supabase Dashboard →
--    Edge Functions → Manage secrets → NOTIFICATION_WEBHOOK_SECRET
--
-- Sans secret dans le Vault, le trigger fonctionne sans header
-- (comportement identique à avant la migration 0042).

CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secret  text;
  v_headers jsonb;
BEGIN
  -- Lire le secret depuis le Vault Supabase (null si non configuré)
  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'notification_webhook_secret'
   LIMIT 1;

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
