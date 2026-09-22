import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:it@handelsfastigheter.se";
const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface PushPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID keys not configured" }, 500);
  }

  // Interna anrop (databastrigger) autentiseras med delad hemlighet.
  // Övriga anrop kräver en giltig inloggad användare.
  const triggerSecret = req.headers.get("x-push-secret") ?? "";
  let callerId: string | null = null;

  if (!PUSH_TRIGGER_SECRET || triggerSecret !== PUSH_TRIGGER_SECRET) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    callerId = userData.user.id;
  }

  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const targets = new Set<string>();
  if (payload.user_id) targets.add(payload.user_id);
  (payload.user_ids ?? []).forEach((id) => targets.add(id));

  if (targets.size === 0 || !payload.title) {
    return json({ error: "user_id/user_ids och title krävs" }, 400);
  }
  // Inloggade användare får bara skicka till sig själva (testnotis).
  if (callerId && (targets.size !== 1 || !targets.has(callerId))) {
    return json({ error: "Forbidden" }, 403);
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", [...targets]);

  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, removed: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        console.error(`push failed [${status}]:`, (err as Error).message);
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    }),
  );

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", stale);
  }

  return json({ sent, removed: stale.length });
});
