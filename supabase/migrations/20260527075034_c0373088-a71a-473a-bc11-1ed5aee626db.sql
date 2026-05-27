
-- 1. content_index: revoke broad read; access only via search_content RPC (SECURITY DEFINER, now ACL-filtered)
DROP POLICY IF EXISTS "Authenticated users can search content" ON public.content_index;

-- 2. Patch search_content to filter out document_files chunks the user can't access
CREATE OR REPLACE FUNCTION public.search_content(query_text text, match_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, source_table text, source_id uuid, title text, content text, metadata jsonb, relevance real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tsquery_val tsquery;
  tsquery_simple tsquery;
  uid uuid := auth.uid();
BEGIN
  tsquery_val := plainto_tsquery('swedish', query_text);
  tsquery_simple := plainto_tsquery('simple', query_text);

  RETURN QUERY
    WITH scored AS (
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
              WHEN 'google_drive'     THEN
                CASE WHEN (ci.metadata->>'extracted')::boolean = true THEN 0.25 ELSE 0.10 END
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
        )::real AS relevance,
        ROW_NUMBER() OVER (
          PARTITION BY ci.source_table, ci.source_id
          ORDER BY (
            COALESCE(ts_rank_cd(ci.fts, tsquery_val), 0) * 3.0
            + COALESCE(ts_rank_cd(ci.fts, tsquery_simple), 0) * 1.5
            + similarity(ci.title, query_text) * 2.0
          ) DESC
        ) AS rn
      FROM public.content_index ci
      WHERE (ci.fts @@ tsquery_val
         OR ci.fts @@ tsquery_simple
         OR similarity(ci.title, query_text) > 0.2)
        -- ACL: filter out document_files / document_folders the caller cannot access
        AND (
          ci.source_table NOT IN ('document_files', 'document_folders')
          OR uid IS NULL  -- service_role / no auth context: return all (edge functions)
          OR public.is_in_admin_group(uid)
          OR public.has_role(uid, 'it'::app_role)
          OR (
            ci.source_table = 'document_files'
            AND EXISTS (
              SELECT 1 FROM public.document_files df
              WHERE df.id = ci.source_id
                AND public.has_folder_access(uid, df.folder_id)
            )
          )
          OR (
            ci.source_table = 'document_folders'
            AND public.has_folder_access(uid, ci.source_id)
          )
        )
    )
    SELECT s.id, s.source_table, s.source_id, s.title, s.content, s.metadata, s.relevance
    FROM scored s
    WHERE s.rn = 1
    ORDER BY s.relevance DESC
    LIMIT match_limit;
END;
$function$;

-- 3. module_permissions: restrict SELECT
DROP POLICY IF EXISTS "Authenticated can view module permissions" ON public.module_permissions;

CREATE POLICY "Admins owners or grantee can view module permissions"
ON public.module_permissions
FOR SELECT
TO authenticated
USING (
  public.is_in_admin_group(auth.uid())
  OR public.has_module_permission(auth.uid(), module_id, 'owner'::text)
  OR (grantee_type = 'user' AND grantee_id = auth.uid())
  OR (grantee_type = 'group' AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = module_permissions.grantee_id
      AND gm.user_id = auth.uid()
  ))
);

-- 4. shared_password_groups: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view password groups" ON public.shared_password_groups;

CREATE POLICY "Admins IT or users with password access can view"
ON public.shared_password_groups
FOR SELECT
TO authenticated
USING (
  public.is_in_admin_group(auth.uid())
  OR public.has_role(auth.uid(), 'it'::app_role)
  OR public.has_shared_password_access(auth.uid(), password_id)
);

-- 5. kpi-uploads storage: add DELETE and UPDATE policies for admins / kpi editors
CREATE POLICY "Editors can delete kpi files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kpi-uploads'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text)
  )
);

CREATE POLICY "Editors can update kpi files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kpi-uploads'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_module_slug_permission(auth.uid(), 'kpi'::text, 'edit'::text)
  )
);
