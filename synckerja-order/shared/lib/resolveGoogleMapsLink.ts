import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/lib/supabaseClient";
import { canonicalGoogleMapsUrl, isGoogleMapsShortLink } from "./googleMapsLink";

const expanded = new Map<string, string>();

/** Turn a pasted Maps link into a stable https URL. Short links are expanded once. */
export async function expandGoogleMapsUrl(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  const direct = canonicalGoogleMapsUrl(trimmed);
  if (direct) return direct;
  if (!isGoogleMapsShortLink(trimmed) || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const cached = expanded.get(trimmed);
  if (cached) return cached;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/synckerja-order-maps-resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url: trimmed }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { resolved_url?: unknown };
    const canonical = canonicalGoogleMapsUrl(
      typeof payload.resolved_url === "string" ? payload.resolved_url : "",
    );
    if (canonical) expanded.set(trimmed, canonical);
    return canonical;
  } catch {
    return null;
  }
}
