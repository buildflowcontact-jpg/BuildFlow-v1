-- Add supply categories and rental tracking to supplies table
-- Applied to production: 2026-06-30 (migration supplies_categories_and_delivery_notifications)
--
-- category: classifies the supply type (material, equipment, rental)
-- rental_end_date: tracks end of rental period for location category

ALTER TABLE public.supplies
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'materiau'
    CHECK (category IN ('materiau', 'equipement', 'location')),
  ADD COLUMN IF NOT EXISTS rental_end_date date;
