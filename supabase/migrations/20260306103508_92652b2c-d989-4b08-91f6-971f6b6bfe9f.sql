
-- Add icon column to order_types
ALTER TABLE public.order_types ADD COLUMN icon TEXT DEFAULT 'package';

-- Allow admins to insert order types (the ALL policy already covers this, but let's be explicit)
-- Also allow admins to delete order types
