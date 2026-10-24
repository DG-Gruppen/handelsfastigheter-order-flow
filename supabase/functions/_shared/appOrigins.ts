/**
 * Android/iOS-appen (Capacitor) gör anrop från https://localhost (Android)
 * respektive capacitor://localhost (iOS). Funktioner som låser CORS till
 * intra.handelsfastigheter.se svarar med appens origin i stället, så att
 * appens anrop inte blockeras. Behörigheten kontrolleras som vanligt med JWT.
 */
export const NATIVE_APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

export function isNativeAppOrigin(origin: string | null): boolean {
  return origin !== null && NATIVE_APP_ORIGINS.includes(origin);
}

export function allowNativeAppOrigins(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const res = await handler(req);
    const origin = req.headers.get("Origin");
    if (!isNativeAppOrigin(origin)) return res;
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", origin!);
    headers.append("Vary", "Origin");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
