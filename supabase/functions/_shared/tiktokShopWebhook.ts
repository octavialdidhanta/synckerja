/** TikTok Shop CS webhook signature verify + type 13/14 payload helpers. */

const TIMESTAMP_TOLERANCE_SEC = 300; // 5 minutes

export const TIKTOK_SHOP_CS_NEW_CONVERSATION_TYPE = 13;
export const TIKTOK_SHOP_CS_NEW_MESSAGE_TYPE = 14;

export type TikTokShopCsWebhookMessageData = {
  message_id?: string;
  index?: string;
  conversation_id?: string;
  type?: string;
  content?: string;
  create_time?: number;
  is_visible?: boolean;
  sender?: {
    im_user_id?: string;
    role?: string;
  };
};

export type TikTokShopCsWebhookPayload = {
  type?: number;
  tts_notification_id?: string;
  shop_id?: string;
  timestamp?: number;
  data?: TikTokShopCsWebhookMessageData;
};

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Parse `t=…,s=…` from TikTok-Signature / Tiktok-Signature header. */
export function parseTikTokSignatureHeader(
  header: string | null,
): { t: string; s: string } | null {
  if (!header?.trim()) return null;
  let t = "";
  let s = "";
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === "t") t = value;
    if (key === "s") s = value;
  }
  if (!t || !s) return null;
  return { t, s };
}

/**
 * Verify TikTok webhook signature:
 * signed_payload = `${timestamp}.${rawBody}`, HMAC-SHA256 hex with app secret.
 */
export async function verifyTikTokShopWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = appSecret.trim();
  if (!secret) return { ok: false, reason: "missing_secret" };

  const parsed = parseTikTokSignatureHeader(signatureHeader);
  if (!parsed) return { ok: false, reason: "missing_or_malformed_signature" };

  const ts = Number.parseInt(parsed.t, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid_timestamp" };
  if (Math.abs(nowSec - ts) > TIMESTAMP_TOLERANCE_SEC) {
    return { ok: false, reason: "timestamp_skew" };
  }

  const signedPayload = `${parsed.t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = bytesToHex(sigBuffer);
  if (!secureCompare(expected.toLowerCase(), parsed.s.toLowerCase())) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

export function getTikTokSignatureHeader(req: Request): string | null {
  return (
    req.headers.get("TikTok-Signature") ??
    req.headers.get("Tiktok-Signature") ??
    req.headers.get("tiktok-signature")
  );
}

export function resolveWebhookNotificationId(
  payload: TikTokShopCsWebhookPayload,
): string {
  const fromRoot = String(payload.tts_notification_id ?? "").trim();
  if (fromRoot) return fromRoot;
  const shopId = String(payload.shop_id ?? "").trim();
  const messageId = String(payload.data?.message_id ?? "").trim();
  if (shopId && messageId) return `${shopId}:${messageId}`;
  const conversationId = String(payload.data?.conversation_id ?? "").trim();
  if (shopId && conversationId) return `${shopId}:conv:${conversationId}`;
  return "";
}
