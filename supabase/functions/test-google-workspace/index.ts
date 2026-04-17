// Test Google Workspace Domain-Wide Delegation: create + delete a test user
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const keyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;
  const subject = Deno.env.get("GOOGLE_ADMIN_SUBJECT_EMAIL")!;
  const key = JSON.parse(keyJson);

  // Import private key
  const pemContents = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: key.client_email,
      sub: subject,
      scope: "https://www.googleapis.com/auth/admin.directory.user",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(3600),
      iat: getNumericDate(0),
    },
    cryptoKey,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const log: any[] = [];
  const testEmail = `lovable-test-${Date.now()}@handelsfastigheter.se`;

  try {
    log.push({ step: "auth", status: "starting" });
    const token = await getAccessToken();
    log.push({ step: "auth", status: "ok" });

    // Create test user
    log.push({ step: "create", email: testEmail, status: "starting" });
    const createRes = await fetch("https://admin.googleapis.com/admin/directory/v1/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryEmail: testEmail,
        name: { givenName: "Lovable", familyName: "Test" },
        password: crypto.randomUUID() + "Aa1!",
        changePasswordAtNextLogin: true,
      }),
    });
    const createBody = await createRes.json();
    log.push({ step: "create", status: createRes.status, body: createBody });

    if (!createRes.ok) {
      return new Response(JSON.stringify({ ok: false, log }, null, 2), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete test user
    log.push({ step: "delete", status: "starting" });
    const delRes = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(testEmail)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const delText = await delRes.text();
    log.push({ step: "delete", status: delRes.status, body: delText || "(empty)" });

    return new Response(JSON.stringify({ ok: delRes.ok, log }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    log.push({ step: "error", message: (e as Error).message });
    return new Response(JSON.stringify({ ok: false, log }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
