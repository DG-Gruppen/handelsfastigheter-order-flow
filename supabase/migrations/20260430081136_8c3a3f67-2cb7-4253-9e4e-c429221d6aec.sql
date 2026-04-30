ALTER TABLE public.recognitions ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_recognitions_batch_id ON public.recognitions(batch_id);