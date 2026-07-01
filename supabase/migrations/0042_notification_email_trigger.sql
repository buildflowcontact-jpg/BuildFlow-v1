-- Migration 0042 : trigger email via Edge Function send-email-notification
--
-- Prérequis :
--   1. pg_net activé (CREATE EXTENSION pg_net SCHEMA extensions — déjà fait)
--   2. Edge Function "send-email-notification" déployée sur Supabase
--
-- Secrets à configurer dans Supabase Dashboard > Edge Functions > Secrets :
--   RESEND_API_KEY   : clé API Resend (https://resend.com/api-keys)
--   APP_URL          : URL publique de l'app (ex. https://app.buildflow.fr)
--   EMAIL_FROM       : expéditeur (ex. BuildFlow <no-reply@buildflow.fr>)
--
-- Sans RESEND_API_KEY, la function log un avertissement et ne fait rien.
-- Les emails sont envoyés de manière asynchrone (pg_net fire-and-forget).

CREATE OR REPLACE FUNCTION public.trigger_send_email_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://nonqaratfnjpdogjbzyi.supabase.co/functions/v1/send-email-notification',
    body    := to_jsonb(NEW),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_send_email ON public.notifications;
CREATE TRIGGER on_notification_send_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_send_email_notification();
