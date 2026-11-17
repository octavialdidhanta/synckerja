/**
 * Short-lived, file-scoped tokens for Drive media/thumbnail URLs.
 *
 * <video src> and <img src> cannot send an Authorization header, so the dashboard used to put the
 * full Supabase session JWT in the query string (`supabase_token`), where it ended up in edge logs.
 * A media token instead only lets its holder read ONE Drive file through google-drive-file-media /
 * google-drive-file-thumbnail, as the user who minted it, until it expires.
 *
 * Format: v1.<base64url(userId)>.<fileId>.<expUnixSeconds>.<base64url(hmacSha256)>
 */

const VERSION = "v1";
export const DRIVE_MEDIA_TOKEN_TTL_SECONDS = 6 * 60 * 60;
const FILE_ID_RE = /^[a-zA-Z0-9-_]+$/;

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToString(text: string): string | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

async function hmac(keyBytes: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Signing key: DRIVE_MEDIA_TOKEN_SECRET when set, otherwise derived from the service role key
 * (never used directly) so no new secret is required to deploy.
 */
export async function getDriveMediaTokenKey(
  env: (name: string) => string | undefined = (n) => Deno.env.get(n),
): Promise<Uint8Array | null> {
  const dedicated = env("DRIVE_MEDIA_TOKEN_SECRET")?.trim();
  if (dedicated) return encoder.encode(dedicated);
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!serviceRole) return null;
  return hmac(encoder.encode(serviceRole), "synckerja:drive-media-token:v1");
}

export async function mintDriveMediaToken(
  key: Uint8Array,
  userId: string,
  fileId: string,
  ttlSeconds = DRIVE_MEDIA_TOKEN_TTL_SECONDS,
  nowMs = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  if (!userId) throw new Error("userId required");
  if (!FILE_ID_RE.test(fileId)) throw new Error("invalid fileId");
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${VERSION}.${b64urlEncode(encoder.encode(userId))}.${fileId}.${exp}`;
  const sig = b64urlEncode(await hmac(key, payload));
  return { token: `${payload}.${sig}`, expiresAt: exp };
}

export type DriveMediaTokenCheck =
  | { ok: true; userId: string; expiresAt: number }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "file_mismatch" };

export async function verifyDriveMediaToken(
  key: Uint8Array,
  token: string,
  fileId: string,
  nowMs = Date.now(),
): Promise<DriveMediaTokenCheck> {
  const parts = (token ?? "").split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) return { ok: false, reason: "malformed" };
  const [version, userB64, tokenFileId, expRaw, sig] = parts;
  if (!/^\d{1,12}$/.test(expRaw) || !FILE_ID_RE.test(tokenFileId)) {
    return { ok: false, reason: "malformed" };
  }

  const expected = b64urlEncode(await hmac(key, `${version}.${userB64}.${tokenFileId}.${expRaw}`));
  if (!timingSafeEqual(sig, expected)) return { ok: false, reason: "bad_signature" };

  const exp = Number(expRaw);
  if (exp * 1000 <= nowMs) return { ok: false, reason: "expired" };
  if (tokenFileId !== fileId) return { ok: false, reason: "file_mismatch" };

  const userId = b64urlDecodeToString(userB64);
  if (!userId) return { ok: false, reason: "malformed" };
  return { ok: true, userId, expiresAt: exp };
}
