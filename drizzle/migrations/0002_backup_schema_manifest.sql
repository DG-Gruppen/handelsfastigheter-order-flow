CREATE OR REPLACE FUNCTION public.backup_schema_manifest()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'tables', (SELECT coalesce(jsonb_agg(t.table_name ORDER BY t.table_name), '[]'::jsonb)
               FROM information_schema.tables t
               WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'),
    'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'table', c.table_name, 'column', c.column_name, 'type', c.data_type,
                  'udt', c.udt_name, 'nullable', c.is_nullable, 'default', c.column_default,
                  'position', c.ordinal_position) ORDER BY c.table_name, c.ordinal_position), '[]'::jsonb)
                FROM information_schema.columns c WHERE c.table_schema = 'public'),
    'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'table', rel.relname, 'name', con.conname,
                  'definition', pg_get_constraintdef(con.oid))), '[]'::jsonb)
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_namespace n ON n.oid = rel.relnamespace
                WHERE n.nspname = 'public'),
    'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'name', indexname, 'definition', indexdef)), '[]'::jsonb)
                FROM pg_indexes WHERE schemaname = 'public'),
    'enums', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', t.typname,
                'values', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid))), '[]'::jsonb)
              FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public' AND t.typtype = 'e'),
    'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', p.proname, 'definition', pg_get_functiondef(p.oid))), '[]'::jsonb)
                  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
                  WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL),
    'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'name', tg.tgname,
                  'definition', pg_get_triggerdef(tg.oid))), '[]'::jsonb)
                 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND NOT tg.tgisinternal),
    'policies', (SELECT coalesce(jsonb_agg(jsonb_build_object('table', tablename, 'name', policyname,
                  'command', cmd, 'roles', roles, 'permissive', permissive, 'using', qual, 'check', with_check)), '[]'::jsonb)
                 FROM pg_policies WHERE schemaname = 'public'),
    'extensions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', extname, 'version', extversion)), '[]'::jsonb) FROM pg_extension)
  ) INTO result;

  BEGIN
    result := result || jsonb_build_object('cron_jobs',
      (SELECT coalesce(jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule,
        'command', regexp_replace(command, 'Bearer [A-Za-z0-9._-]+', 'Bearer <REDACTED>', 'g'))), '[]'::jsonb)
       FROM cron.job));
  EXCEPTION WHEN others THEN
    result := result || jsonb_build_object('cron_jobs', '[]'::jsonb);
  END;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_schema_manifest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backup_schema_manifest() TO authenticated, service_role;