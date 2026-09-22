import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PUSH_TRIGGER_SECRET = Deno.env.get("PUSH_TRIGGER_SECRET") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const FIREBASE_MESSAGING_API_KEY = Deno.env.get("FIREBASE_MESSAGING_API_KEY") ?? "";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const APP_ORIGIN = "https://intra.handelsfastigheter.se";

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

  if (!LOVABLE_API_KEY || !FIREBASE_MESSAGING_API_KEY) {
    return json({ error: "Firebase-anslutningen är inte konfigurerad" }, 500);
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

  const { data: devices, error } = await supabase
    .from("fcm_tokens")
    .select("id, token")
    .in("user_id", [...targets]);

  if (error) return json({ error: error.message }, 500);
  if (!devices || devices.length === 0) return json({ sent: 0, removed: 0 });

  const path = payload.url ?? "/dashboard";
  const link = path.startsWith("http") ? path : `${APP_ORIGIN}${path}`;

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    devices.map(async (device) => {
      try {
        const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": FIREBASE_MESSAGING_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: payload.title, body: payload.body ?? "" },
              data: { url: path },
              webpush: {
                notification: {
                  icon: "/pwa-icon-192.png",
                  badge: "/pwa-icon-192.png",
                  tag: payload.tag ?? undefined,
                },
                fcm_options: { link },
              },
            },
          }),
        });

        if (res.ok) {
          sent++;
          return;
        }

        const errorBody = await res.text();
        console.error(`FCM send failed [${res.status}]: ${errorBody}`);
        if (res.status === 404 || (res.status === 400 && errorBody.includes("INVALID_ARGUMENT"))) {
          stale.push(device.id);
        }
      } catch (err) {
        console.error("FCM send error:", (err as Error).message);
      }
    }),
  );

  if (stale.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", stale);
  }

  return json({ sent, removed: stale.length });
});
