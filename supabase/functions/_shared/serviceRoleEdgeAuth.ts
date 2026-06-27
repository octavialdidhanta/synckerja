/**
 * Service-role / secret-key auth for Edge Functions invoked by pg_cron or ops tools.
 * Supports legacy JWT (SUPABASE_SERVICE_ROLE_KEY) and new sb_secret keys (SUPABASE_SECRET_KEYS).
 */

function parseSecretKeysEnv(raw: string): string[] {
  const out: string[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const v of Object.values(parsed as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      }
    } else if (Array.isArray(parsed)) {
      for (const v of parsed) {
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      }
    }
  } catch {
    /* ignore malformed JSON */
  }
  return out;
}

/** All keys that may authenticate as service/secret caller for this project. */
export function getServiceRoleKeys(): string[] {
  const keys = new Set<string>();

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) keys.add(legacy);

  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (secretKeysRaw) {
    for (const k of parseSecretKeysEnv(secretKeysRaw)) keys.add(k);
  }

  return [...keys];
}

/** Bearer token or apikey header (Supabase secret-key invoke pattern). */
export function extractCallerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (bearer) return bearer;

  const apikey = req.headers.get("apikey")?.trim();
  if (apikey) return apikey;

  return null;
}

export function isAuthorizedServiceCaller(req: Request): boolean {
  const token = extractCallerToken(req);
  if (!token) return false;
  const allowed = getServiceRoleKeys();
  return allowed.length > 0 && allowed.includes(token);
}

/** Key for createClient — prefers legacy env, falls back to first secret key. */
export function resolveSupabaseAdminKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const keys = getServiceRoleKeys();
  return keys[0] ?? "";
}
