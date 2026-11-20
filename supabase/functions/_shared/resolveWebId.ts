import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ResolvedProperty = {
  slug: string;
  organization_id: string;
  is_active: boolean;
  display_name: string;
};

type CacheEntry = { at: number; value: ResolvedProperty | null };

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function resolveActiveProperty(
  admin: SupabaseClient,
  rawWebId: unknown,
): Promise<
  | { ok: true; property: ResolvedProperty }
  | { ok: false; status: 404 | 403; error: string }
> {
  if (typeof rawWebId !== "string") {
    return { ok: false, status: 404, error: "unknown_web_id" };
  }
  const trimmed = rawWebId.trim();
  if (trimmed.length < 3 || trimmed.length > 64) {
    return { ok: false, status: 404, error: "unknown_web_id" };
  }

  const key = cacheKey(trimmed);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    if (!hit.value) return { ok: false, status: 404, error: "unknown_web_id" };
    if (!hit.value.is_active) return { ok: false, status: 403, error: "property_inactive" };
    return { ok: true, property: hit.value };
  }

  const { data: aliasRow } = await admin
    .from("property_web_id_aliases")
    .select("canonical_slug")
    .eq("alias", trimmed.toLowerCase())
    .maybeSingle();

  const slug = (aliasRow?.canonical_slug ?? trimmed).toLowerCase();

  const { data: prop, error } = await admin
    .from("properties")
    .select("slug, organization_id, is_active, display_name")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !prop) {
    cache.set(key, { at: now, value: null });
    return { ok: false, status: 404, error: "unknown_web_id" };
  }

  const resolved: ResolvedProperty = {
    slug: String(prop.slug),
    organization_id: String(prop.organization_id),
    is_active: Boolean(prop.is_active),
    display_name: String(prop.display_name ?? prop.slug),
  };

  cache.set(key, { at: now, value: resolved });

  if (!resolved.is_active) {
    return { ok: false, status: 403, error: "property_inactive" };
  }

  return { ok: true, property: resolved };
}
