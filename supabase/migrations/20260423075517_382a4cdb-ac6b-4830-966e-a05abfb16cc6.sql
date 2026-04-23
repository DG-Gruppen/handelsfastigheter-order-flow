CREATE TABLE public.link_preview_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_link_preview_cache_url ON public.link_preview_cache(url);
CREATE INDEX idx_link_preview_cache_expires ON public.link_preview_cache(expires_at);

ALTER TABLE public.link_preview_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read link previews"
ON public.link_preview_cache
FOR SELECT
TO authenticated
USING (true);