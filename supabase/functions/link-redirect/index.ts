/**
 * Supabase Edge Function: link-redirect
 *
 * GET/HEAD: 302 redirect to PUBLIC_SITE_ORIGIN + pathname + optional UTM query.
 * Lookup by slug (marketing_short_links), service role.
 *
 * Visitor dedupe: prefers `X-Sl-Visitor` (set by Vercel `api/shortlink-redirect`) or cookie `vialdi_sl_vid`.
 *
 * Redirect latency: 302 is returned immediately after slug lookup. Visitor + click counters run in the
 * background via `EdgeRuntime.waitUntil` so taps from Instagram etc. are not blocked on DB RPCs.
 *
 * Secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - PUBLIC_SITE_ORIGIN (optional fallback; e.g. https://jasafotowedding.com, no trailing slash)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Keep isolate alive for analytics after sending 302 (Supabase Edge background tasks). */
function scheduleShortLinkAnalytics(promise: PromiseLike<unknown>): void {
  const edge = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil: (p: PromiseLike<unknown>) => void };
  }).EdgeRuntime;
  if (edge) {
    edge.waitUntil(Promise.resolve(promise));
  } else {
    void Promise.resolve(promise);
  }
}

const MAX_PATH_LEN = 512;
const MAX_UTM_LEN = 200;

type LinkRow = {
  id: string;
  slug: string;
  site_origin: string | null;
  pathname: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  active: boolean;
};

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v?.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function tryGetEnv(name: string): string | null {
  const v = Deno.env.get(name);
  return v?.trim() ? v.trim() : null;
}

function normalizeOrigin(raw: string): string {
  const s = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) throw new Error("PUBLIC_SITE_ORIGIN must start with http:// or https://");
  return s;
}

function tryParseQueryOrigin(reqUrl: string): string | null {
  const url = new URL(reqUrl);
  const o = (url.searchParams.get("origin") ?? "").trim();
  return o.length ? o : null;
}

function isDisallowedPublicOrigin(origin: string): boolean {
  const s = origin.trim().toLowerCase();
  return (
    s.includes("edge-runtime.supabase.com") ||
    s.endsWith(".supabase.co") ||
    s.includes(".supabase.com")
  );
}

function extractSlug(reqUrl: string): string | null {
  const url = new URL(reqUrl);
  const fromQuery = url.searchParams.get("slug")?.trim().toLowerCase();
  if (fromQuery && /^[a-z0-9-]{3,64}$/.test(fromQuery)) return fromQuery;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const markers = ["/functions/v1/link-redirect/", "/link-redirect/"];
  for (const m of markers) {
    const i = path.indexOf(m);
    if (i !== -1) {
      const rest = path.slice(i + m.length).split("/").filter(Boolean)[0];
      if (rest && /^[a-z0-9-]{3,64}$/i.test(rest)) return rest.toLowerCase();
    }
  }
  return null;
}

function isValidPathname(p: string): boolean {
  if (typeof p !== "string" || p.length === 0 || p.length > MAX_PATH_LEN) return false;
  if (!p.startsWith("/")) return false;
  if (p.startsWith("//")) return false;
  if (p.toLowerCase().startsWith("/admin")) return false;
  if (p.includes("..")) return false;
  if (p.includes("\0")) return false;
  return true;
}

function clipUtm(s: string | null): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > MAX_UTM_LEN ? t.slice(0, MAX_UTM_LEN) : t;
}

/** First-party cookie name when redirect is served directly from this function (dev / non-Vercel). */
const VISITOR_COOKIE = "vialdi_sl_vid";
/** Set by `api/shortlink-redirect` (Vercel) so this function does not need to set cookies on Supabase domain. */
const VISITOR_HEADER = "x-sl-visitor";

function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    const v = part.slice(idx + 1).trim();
    return v.length ? decodeURIComponent(v) : null;
  }
  return null;
}

function isValidVisitorKey(s: string): boolean {
  const t = s.trim();
  return t.length >= 1 && t.length <= 64 && /^[\w.-]+$/.test(t);
}

/** Resolve visitor key for dedupe; optionally attach Set-Cookie for direct Supabase hits only. */
function resolveVisitorKey(req: Request): { key: string; setCookie: string | null } {
  const fromProxy = (req.headers.get(VISITOR_HEADER) ?? "").trim();
  if (fromProxy && isValidVisitorKey(fromProxy)) {
    return { key: fromProxy.trim(), setCookie: null };
  }
  const fromCookie = parseCookieHeader(req.headers.get("cookie"), VISITOR_COOKIE);
  if (fromCookie && isValidVisitorKey(fromCookie)) {
    return { key: fromCookie.trim(), setCookie: null };
  }
  const fresh = crypto.randomUUID();
  const maxAge = 31536000;
  const secure = new URL(req.url).protocol === "https:";
  const cookieVal = `${VISITOR_COOKIE}=${encodeURIComponent(fresh)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${
    secure ? "; Secure" : ""
  }`;
  return { key: fresh, setCookie: cookieVal };
}

function buildLocation(origin: string, row: LinkRow): string {
  const params = new URLSearchParams();
  const pairs: [string, string | null][] = [
    ["utm_source", row.utm_source],
    ["utm_medium", row.utm_medium],
    ["utm_campaign", row.utm_campaign],
    ["utm_content", row.utm_content],
    ["utm_term", row.utm_term],
  ];
  for (const [k, v] of pairs) {
    const c = clipUtm(v);
    if (c) params.set(k, c);
  }
  const qs = params.toString();
  return qs ? `${origin}${row.pathname}?${qs}` : `${origin}${row.pathname}`;
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, HEAD, OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const slug = extractSlug(req.url);
  if (!slug) return notFound();

  const supabaseUrl = mustGetEnv("SUPABASE_URL");
  const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("marketing_short_links")
    .select("id, slug, site_origin, pathname, utm_source, utm_medium, utm_campaign, utm_content, utm_term, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data || !(data as LinkRow).pathname) return notFound();

  const row = data as LinkRow;
  if (!isValidPathname(row.pathname)) return notFound();

  let origin = row.site_origin?.trim() || null;
  if (!origin) {
    // Allow caller (e.g. Vercel Edge) to pass desired public origin safely.
    origin = tryParseQueryOrigin(req.url);
  }
  if (!origin) {
    // Fallback for direct Supabase URL usage or non-proxied calls.
    origin = tryGetEnv("PUBLIC_SITE_ORIGIN");
  }
  if (!origin) {
    return new Response("Server misconfiguration", { status: 500 });
  }
  try {
    origin = normalizeOrigin(origin);
    if (isDisallowedPublicOrigin(origin)) throw new Error("disallowed origin");
  } catch {
    return new Response("Server misconfiguration", { status: 500 });
  }

  const location = buildLocation(origin, row);
  const { key: visitorKey, setCookie } = resolveVisitorKey(req);

  scheduleShortLinkAnalytics(
    Promise.all([
      supabase.rpc("record_marketing_short_link_visitor", {
        p_link_id: row.id,
        p_visitor_key: visitorKey,
      }),
      supabase.rpc("increment_marketing_short_link_click", { p_id: row.id }),
    ]).catch(() => undefined),
  );

  const redirectHeaders: Record<string, string> = { Location: location };
  if (setCookie) redirectHeaders["Set-Cookie"] = setCookie;

  if (req.method === "HEAD") {
    return new Response(null, { status: 302, headers: redirectHeaders });
  }

  return new Response(null, { status: 302, headers: redirectHeaders });
});
