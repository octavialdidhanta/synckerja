import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Only Google Maps https URLs. This keeps the public function from fetching arbitrary hosts. */
function allowedMapsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (SHORT_HOSTS.has(host) || host === "maps.google.com" || GOOGLE_HOST.test(host)) return url;
    return null;
  } catch {
    return null;
  }
}

async function followMapsRedirect(start: string): Promise<string | null> {
  let current = start;
  for (let hop = 0; hop < 5; hop += 1) {
    const url = allowedMapsUrl(current);
    if (!url) return null;
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    const location = res.headers.get("location");
    await res.body?.cancel();
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    if (res.status >= 200 && res.status < 300) return current;
    return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });

  let url = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url.trim() : "";
  } catch {
    return json(400, { ok: false, error: "invalid_body" });
  }
  if (url.length < 12 || url.length > 2000 || !allowedMapsUrl(url)) {
    return json(400, { ok: false, error: "invalid_url" });
  }

  try {
    const resolved = await followMapsRedirect(url);
    if (!resolved || !allowedMapsUrl(resolved)) return json(422, { ok: false, error: "unresolved" });
    return json(200, { ok: true, resolved_url: resolved });
  } catch (error) {
    console.warn("synckerja-order-maps-resolve:", error instanceof Error ? error.message : "failed");
    return json(502, { ok: false, error: "lookup_failed" });
  }
});
