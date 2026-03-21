
CREATE OR REPLACE FUNCTION public.search_content(query_text text, match_limit integer DEFAULT 12)
RETURNS TABLE(id uuid, source_table text, source_id uuid, title text, content text, metadata jsonb, relevance real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  tsquery_val tsquery;
begin
  tsquery_val := plainto_tsquery('swedish', query_text);

  return query
    select
      ci.id,
      ci.source_table,
      ci.source_id,
      ci.title,
      ci.content,
      ci.metadata,
      (
        ts_rank(ci.fts, tsquery_val) * 2.0
        + similarity(ci.title, query_text) * 1.5
        + similarity(ci.content, query_text) * 0.5
        + CASE ci.source_table
            WHEN 'kb_articles' THEN 0.3
            WHEN 'it_faq' THEN 0.25
            WHEN 'ceo_blog' THEN 0.2
            WHEN 'news' THEN 0.15
            WHEN 'kb_videos' THEN 0.1
            WHEN 'website' THEN 0.1
            WHEN 'allabolag' THEN 0.05
            ELSE 0.0
          END
      )::real as relevance
    from public.content_index ci
    where ci.fts @@ tsquery_val
       or similarity(ci.title, query_text) > 0.15
       or similarity(ci.content, query_text) > 0.1
    order by relevance desc
    limit match_limit;
end;
$function$;
