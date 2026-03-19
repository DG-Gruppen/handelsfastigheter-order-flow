-- Add season column to workwear_orders so admin can filter orders by season
ALTER TABLE public.workwear_orders ADD COLUMN IF NOT EXISTS season text;
