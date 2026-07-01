-- Migration 0047 : ajouter photo_document_id sur daily_logs
-- Cohérent avec incidents et punch_list_items qui ont déjà ce champ.

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS photo_document_id uuid
    REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_logs_photo ON public.daily_logs(photo_document_id)
  WHERE photo_document_id IS NOT NULL;
