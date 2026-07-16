export type LeadMagnetAction = "follow_confirm" | "get_framework";

const ACTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function actionSecret(): string {
  const dedicated = (Deno.env.get("LEAD_MAGNET_ACTION_SECRET") ?? "").trim();
  if (dedicated) return dedicated;
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
}

export function publicAppOrigin(): string {
  const fromEnv = (
    Deno.env.get("PUBLIC_APP_ORIGIN")
    ?? Deno.env.get("VITE_APP_URL")
    ?? ""
  ).trim().replace(/\/$/, "");
  return fromEnv || "https://office.synckerja.com";
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SPA landing page — Messenger webview renders office.synckerja.com reliably. */
export function leadMagnetActionPagePath(): string {
  return "/digital-marketing/lead-magnet/action";
}

export function leadMagnetActionApiPath(): string {
  return "/functions/v1/lead-magnet-runtime/action";
}

export async function buildLeadMagnetActionUrl(
  enrollmentId: string,
  action: LeadMagnetAction,
): Promise<string> {
  const secret = actionSecret();
  if (!secret) throw new Error("Missing action signing secret");

  const expiry = String(Date.now() + ACTION_TTL_MS);
  const canonical = `${enrollmentId}:${action}:${expiry}`;
  const sig = await hmacSha256Hex(secret, canonical);
  const params = new URLSearchParams({
    e: enrollmentId,
    a: action,
    t: expiry,
    s: sig,
  });
  return `${publicAppOrigin()}${leadMagnetActionPagePath()}?${params.toString()}`;
}

export async function verifyLeadMagnetActionUrl(
  enrollmentId: string,
  action: LeadMagnetAction,
  expiryRaw: string,
  sigRaw: string,
): Promise<boolean> {
  const secret = actionSecret();
  if (!secret) return false;

  const expiryMs = Number(expiryRaw);
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return false;
  if (action !== "follow_confirm" && action !== "get_framework") return false;
  if (!enrollmentId.trim()) return false;

  const canonical = `${enrollmentId}:${action}:${expiryRaw}`;
  const expected = await hmacSha256Hex(secret, canonical);
  return expected === sigRaw.trim();
}
