-- Migration 0044 : liaison budget ↔ devis accepté
-- Ajoute un lien optionnel entre une dépense et le devis dont elle est issue.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_quote_id_idx ON public.expenses(quote_id);
