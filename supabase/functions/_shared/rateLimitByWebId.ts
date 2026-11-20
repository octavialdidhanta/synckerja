import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BUCKET_SECONDS = 60;
const MAX_TOKENS = 30;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bucketWindowIso(now = new Date()): string {
  const ms = Math.floor(now.getTime() / (BUCKET_SECONDS * 1000)) * BUCKET_SECONDS * 1000;
  return new Date(ms).toISOString();
}

export async function rateLimitByWebId(
  admin: SupabaseClient,
  webId: string,
  clientIp: string,
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const ipHash = await sha256Hex(clientIp || "unknown");
  const window = bucketWindowIso();

  const { data: row } = await admin
    .from("hub_rate_limits")
    .select("tokens")
    .eq("web_id", webId)
    .eq("client_ip_hash", ipHash)
    .eq("bucket_window", window)
    .maybeSingle();

  const tokens = (row?.tokens ?? 0) + 1;

  if (tokens > MAX_TOKENS) {
    return { ok: false, retryAfterSeconds: BUCKET_SECONDS };
  }

  await admin.from("hub_rate_limits").upsert(
    {
      web_id: webId,
      client_ip_hash: ipHash,
      bucket_window: window,
      tokens,
    },
    { onConflict: "web_id,client_ip_hash,bucket_window" },
  );

  return { ok: true };
}

export function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "0.0.0.0"
  );
}
