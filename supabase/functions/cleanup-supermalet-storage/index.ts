import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const results: Record<string, unknown> = {};
  for (const bucket of ["supermalet-passports", "supermalet-exports"]) {
    const paths: string[] = [];
    const walk = async (prefix: string) => {
      const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      for (const item of data ?? []) {
        const p = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) paths.push(p);
        else await walk(p);
      }
    };
    await walk("");
    if (paths.length) await admin.storage.from(bucket).remove(paths);
    const { error } = await admin.storage.deleteBucket(bucket);
    results[bucket] = { removed: paths.length, error: error?.message ?? null };
  }
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
