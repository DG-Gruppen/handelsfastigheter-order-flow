
-- Add chunk_index column to content_index for document chunking
ALTER TABLE public.content_index ADD COLUMN IF NOT EXISTS chunk_index integer NOT NULL DEFAULT 0;

-- Drop old unique constraint and create new one that includes chunk_index
ALTER TABLE public.content_index DROP CONSTRAINT IF EXISTS content_index_source_table_source_id_key;
ALTER TABLE public.content_index ADD CONSTRAINT content_index_source_chunk_key UNIQUE (source_table, source_id, chunk_index);

-- Create a helper function for chunking text in triggers
CREATE OR REPLACE FUNCTION public.upsert_chunked_content(
  _source_table text,
  _source_id uuid,
  _title text,
  _content text,
  _metadata jsonb,
  _chunk_size integer DEFAULT 800
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_len integer;
  _chunk_idx integer := 0;
  _start integer := 1;
  _chunk text;
  _overlap integer := 100;
BEGIN
  _total_len := length(_content);
  
  -- If content is short enough, single chunk
  IF _total_len <= _chunk_size THEN
    INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
    VALUES (_source_table, _source_id, 0, _title, _content, _metadata, now())
    ON CONFLICT (source_table, source_id, chunk_index)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
    -- Clean up any old extra chunks
    DELETE FROM public.content_index 
    WHERE source_table = _source_table AND source_id = _source_id AND chunk_index > 0;
    RETURN;
  END IF;

  -- Split into chunks with overlap
  WHILE _start <= _total_len LOOP
    _chunk := substring(_content FROM _start FOR _chunk_size);
    
    INSERT INTO public.content_index (source_table, source_id, chunk_index, title, content, metadata, updated_at)
    VALUES (_source_table, _source_id, _chunk_idx, 
            _title || CASE WHEN _chunk_idx > 0 THEN ' (del ' || (_chunk_idx + 1) || ')' ELSE '' END,
            _chunk, _metadata, now())
    ON CONFLICT (source_table, source_id, chunk_index)
    DO UPDATE SET title = excluded.title, content = excluded.content,
                  metadata = excluded.metadata, updated_at = now();
    
    _chunk_idx := _chunk_idx + 1;
    _start := _start + _chunk_size - _overlap;
  END LOOP;

  -- Clean up any old chunks beyond current count
  DELETE FROM public.content_index 
  WHERE source_table = _source_table AND source_id = _source_id AND chunk_index >= _chunk_idx;
END;
$$;

-- Update kb_articles trigger to use chunking
CREATE OR REPLACE FUNCTION public.index_kb_article()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'kb_articles' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_published = true THEN
    PERFORM public.upsert_chunked_content(
      'kb_articles', NEW.id, NEW.title,
      NEW.excerpt || E'\n' || NEW.content,
      jsonb_build_object('tags', NEW.tags, 'category_id', NEW.category_id)
    );
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'kb_articles' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update news trigger to use chunking
CREATE OR REPLACE FUNCTION public.index_news()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_index WHERE source_table = 'news' AND source_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.is_published = true THEN
    PERFORM public.upsert_chunked_content(
      'news', NEW.id, NEW.title,
      NEW.excerpt || E'\n' || NEW.body,
      jsonb_build_object('category', NEW.category, 'emoji', NEW.emoji, 'published_at', NEW.published_at)
    );
  ELSE
    DELETE FROM public.content_index WHERE source_table = 'news' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update search_content to handle chunks (group by source, take best chunk)
CREATE OR REPLACE FUNCTION public.search_content(query_text text, match_limit integer DEFAULT 12)
RETURNS TABLE(id uuid, source_table text, source_id uuid, title text, content text, metadata jsonb, relevance real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tsquery_val tsquery;
  tsquery_simple tsquery;
BEGIN
  tsquery_val := plainto_tsquery('swedish', query_text);
  tsquery_simple := plainto_tsquery('simple', query_text);

  RETURN QUERY
    SELECT DISTINCT ON (ci.source_table, ci.source_id)
      ci.id,
      ci.source_table,
      ci.source_id,
      ci.title,
      ci.content,
      ci.metadata,
      (
        COALESCE(ts_rank_cd(ci.fts, tsquery_val), 0) * 3.0
        + COALESCE(ts_rank_cd(ci.fts, tsquery_simple), 0) * 1.5
        + similarity(ci.title, query_text) * 2.0
        + CASE WHEN ci.title ILIKE '%' || query_text || '%' THEN 0.5 ELSE 0.0 END
        + CASE ci.source_table
            WHEN 'kb_articles'      THEN 0.35
            WHEN 'it_faq'           THEN 0.30
            WHEN 'ceo_blog'         THEN 0.20
            WHEN 'news'             THEN 0.15
            WHEN 'kb_videos'        THEN 0.10
            WHEN 'document_files'   THEN
              CASE WHEN (ci.metadata->>'extracted')::boolean = true THEN 0.25 ELSE 0.05 END
            WHEN 'tools'            THEN 0.10
            WHEN 'website'          THEN 0.08
            WHEN 'departments'      THEN 0.05
            WHEN 'document_folders' THEN 0.03
            WHEN 'allabolag'        THEN 0.05
            ELSE 0.0
          END
        + CASE
            WHEN ci.source_table IN ('news', 'ceo_blog')
              AND ci.updated_at > now() - interval '30 days' THEN 0.15
            WHEN ci.source_table IN ('news', 'ceo_blog')
              AND ci.updated_at > now() - interval '90 days' THEN 0.08
            ELSE 0.0
          END
      )::real AS relevance
    FROM public.content_index ci
    WHERE ci.fts @@ tsquery_val
       OR ci.fts @@ tsquery_simple
       OR similarity(ci.title, query_text) > 0.2
    ORDER BY ci.source_table, ci.source_id, relevance DESC
    LIMIT match_limit * 3;
END;
$$;
