import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MAX_GCLID_LEN = 500;

export function normalizeGclid(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length <= MAX_GCLID_LEN ? t : t.slice(0, MAX_GCLID_LEN);
}

export async function resolveSessionGclid(
  admin: SupabaseClient,
  sessionId: string,
): Promise<string | null> {
  const id = sessionId.trim();
  if (!id) return null;
  const { data, error } = await admin
    .from("analytics_sessions")
    .select("gclid")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("resolveSessionGclid:", error.message);
    return null;
  }
  return normalizeGclid(data?.gclid);
}

export async function resolveGclidForEvent(
  admin: SupabaseClient,
  sessionId: string,
  bodyGclid: unknown,
): Promise<string | null> {
  return normalizeGclid(bodyGclid) ?? (await resolveSessionGclid(admin, sessionId));
}
