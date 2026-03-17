
-- Add is_starred column to tools table
ALTER TABLE public.tools ADD COLUMN is_starred boolean NOT NULL DEFAULT false;

-- Set initial starred tools
UPDATE public.tools SET is_starred = true WHERE name IN (
  'Vitec', 'Vyer', 'Zendesk', 'Rillion', 'ViaEstate', 'Momentum', 'Metry', 'Svenska Handelsfastigheter'
);
