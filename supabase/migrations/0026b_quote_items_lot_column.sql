-- Add lot column to quote_items for grouping line items by trade/lot
-- Applied to production: 2026-06-26 (migration quote_items_add_lot_column)

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS lot text;
