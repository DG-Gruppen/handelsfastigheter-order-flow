// Google Workspace Domain-Wide Delegation: fullständigt diagnostiktest
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
      scope: [
        "https://www.googleapis.com/auth/admin.directory.user",
        "https://www.googleapis.com/auth/admin.directory.group",
        "https://www.googleapis.com/auth/admin.directory.orgunit",
      ].join(" "),
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const log: any[] = [];
  const ts = Date.now();
  const testEmail = `lovable-test-${ts}@handelsfastigheter.se`;
  const testGroupEmail = `lovable-testgroup-${ts}@handelsfastigheter.se`;
  const failures: string[] = [];
  const fail = (step: string) => failures.push(step);

  // 1. identity
  let subject: string | null = null;
  try {
    const keyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") ?? null;
    subject = Deno.env.get("GOOGLE_ADMIN_SUBJECT_EMAIL") ?? null;
    const key = keyJson ? JSON.parse(keyJson) : null;
    log.push({
      step: "identity",
      status: key && subject ? "ok" : "incomplete",
      client_email: key?.client_email ?? null,
      client_id: key?.client_id ?? null,
      subject_email: subject,
    });
    if (!key || !subject) fail("identity");
  } catch (e) {
    log.push({ step: "identity", status: "error", message: (e as Error).message });
    fail("identity");
  }

  // 2. token
  let token: string | null = null;
  try {
    token = await getAccessToken();
    log.push({ step: "token", status: "ok" });
  } catch (e) {
    log.push({ step: "token", status: "error", message: (e as Error).message });
    fail("token");
    return new Response(JSON.stringify({ ok: false, log }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // 3. granted_scopes
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    );
    const body = await res.json();
    log.push({
      step: "granted_scopes",
      status: res.status,
      scopes: typeof body.scope === "string" ? body.scope.split(" ") : null,
      error: body.error ?? undefined,
    });
    if (!res.ok) fail("granted_scopes");
  } catch (e) {
    log.push({ step: "granted_scopes", status: "error", message: (e as Error).message });
    fail("granted_scopes");
  }

  // 4. subject_privileges
  try {
    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(subject ?? "")}`,
      { headers: authHeaders },
    );
    const body = await res.json();
    log.push({
      step: "subject_privileges",
      status: res.status,
      primaryEmail: body.primaryEmail ?? null,
      isAdmin: body.isAdmin ?? null,
      isDelegatedAdmin: body.isDelegatedAdmin ?? null,
      orgUnitPath: body.orgUnitPath ?? null,
      suspended: body.suspended ?? null,
      error: res.ok ? undefined : body,
    });
    if (!res.ok) fail("subject_privileges");
  } catch (e) {
    log.push({ step: "subject_privileges", status: "error", message: (e as Error).message });
    fail("subject_privileges");
  }

  // 5. orgunits
  try {
    const res = await fetch(
      "https://admin.googleapis.com/admin/directory/v1/customer/my_customer/orgunits?type=all",
      { headers: authHeaders },
    );
    const body = await res.json();
    const units = Array.isArray(body.organizationUnits) ? body.organizationUnits : [];
    log.push({
      step: "orgunits",
      status: res.status,
      count: units.length,
      paths: units.map((u: any) => u.orgUnitPath),
      error: res.ok ? undefined : body,
    });
    if (!res.ok) fail("orgunits");
  } catch (e) {
    log.push({ step: "orgunits", status: "error", message: (e as Error).message });
    fail("orgunits");
  }

  // 6. create_user
  let userCreated = false;
  try {
    const res = await fetch("https://admin.googleapis.com/admin/directory/v1/users", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        primaryEmail: testEmail,
        name: { givenName: "Lovable", familyName: "Test" },
        password: crypto.randomUUID() + "Aa1!",
        changePasswordAtNextLogin: true,
      }),
    });
    const body = await res.json();
    userCreated = res.ok;
    log.push({ step: "create_user", email: testEmail, status: res.status, body });
    if (!res.ok) fail("create_user");
  } catch (e) {
    log.push({ step: "create_user", status: "error", message: (e as Error).message });
    fail("create_user");
  }

  // 7. create_group
  let groupCreated = false;
  try {
    const res = await fetch("https://admin.googleapis.com/admin/directory/v1/groups", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email: testGroupEmail, name: `Lovable Test Group ${ts}` }),
    });
    const body = await res.json();
    groupCreated = res.ok;
    log.push({ step: "create_group", email: testGroupEmail, status: res.status, body });
    if (!res.ok) fail("create_group");
  } catch (e) {
    log.push({ step: "create_group", status: "error", message: (e as Error).message });
    fail("create_group");
  }

  // 8. add_member (eventually consistent → upp till 5 försök)
  if (userCreated && groupCreated) {
    let added = false;
    let attempts = 0;
    let last: any = null;
    for (let i = 1; i <= 5; i++) {
      attempts = i;
      try {
        const res = await fetch(
          `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(testGroupEmail)}/members`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ email: testEmail, role: "MEMBER" }),
          },
        );
        last = { status: res.status, body: await res.json() };
        if (res.ok) {
          added = true;
          break;
        }
      } catch (e) {
        last = { status: "error", message: (e as Error).message };
      }
      if (i < 5) await sleep(2000);
    }
    log.push({ step: "add_member", status: added ? "ok" : "failed", attempts, last });
    if (!added) fail("add_member");
  } else {
    log.push({ step: "add_member", status: "skipped", reason: "user or group missing" });
    fail("add_member");
  }

  // 9. cleanup — körs alltid
  try {
    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(testGroupEmail)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const text = await res.text();
    log.push({ step: "cleanup_group", status: res.status, body: text || "(empty)" });
    if (!res.ok && groupCreated) fail("cleanup_group");
  } catch (e) {
    log.push({ step: "cleanup_group", status: "error", message: (e as Error).message });
    fail("cleanup_group");
  }

  try {
    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(testEmail)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    const text = await res.text();
    log.push({ step: "cleanup_user", status: res.status, body: text || "(empty)" });
    if (!res.ok && userCreated) fail("cleanup_user");
  } catch (e) {
    log.push({ step: "cleanup_user", status: "error", message: (e as Error).message });
    fail("cleanup_user");
  }

  return new Response(JSON.stringify({ ok: failures.length === 0, failed_steps: failures, log }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
