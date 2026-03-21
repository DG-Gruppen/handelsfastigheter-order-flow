-- Optimized search_content v2: drop expensive content similarity, add dual-language FTS, extracted doc boost, recency bonus
CREATE OR REPLACE FUNCTION public.search_content(query_text text, match_limit integer DEFAULT 12)
RETURNS TABLE(id uuid, source_table text, source_id uuid, title text, content text, metadata jsonb, relevance real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tsquery_val tsquery;
  tsquery_simple tsquery;
BEGIN
  tsquery_val := plainto_tsquery('swedish', query_text);
  tsquery_simple := plainto_tsquery('simple', query_text);

  RETURN QUERY
    SELECT
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
    ORDER BY relevance DESC
    LIMIT match_limit;
END;
$function$;