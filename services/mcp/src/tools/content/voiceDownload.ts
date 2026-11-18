import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived download links for ElevenLabs VO clips:
 *   GET https://mcp.synckerja.com/downloads/voice/<token>
 *
 * The token is signed (no DB row) and names exactly one clip of one plan for one user in one org.
 * On download the server checks the user is still a member before reading the file.
 * AI sandboxes usually only allow mcp.synckerja.com, not the Supabase storage host, which is why
 * the file is served from here.
 */
export const VOICE_DOWNLOAD_TTL_SECONDS = 15 * 60;
/** A VO clip is a few hundred KB. This only guards against a wrong file in the bucket. */
export const VOICE_DOWNLOAD_MAX_BYTES = 25 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VoiceDownloadClaims = {
  userId: string;
  organizationId: string;
  planId: string;
  clipId: string;
  /** Unix seconds. */
  expiresAt: number;
};

export type VoiceDownloadCheck =
  | { ok: true; claims: VoiceDownloadClaims }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Separate key per purpose, derived from the MCP signing secret. */
export function voiceDownloadKey(jwtSecret: string): Buffer {
  return createHmac("sha256", jwtSecret).update("synckerja-mcp-voice-download-v1").digest();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(`v1.${payload}`).digest("base64url");
}

export function mintVoiceDownloadToken(
  key: Buffer,
  claims: Omit<VoiceDownloadClaims, "expiresAt">,
  nowMs: number,
  ttlSeconds = VOICE_DOWNLOAD_TTL_SECONDS,
): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = b64url(
    JSON.stringify({ u: claims.userId, o: claims.organizationId, p: claims.planId, c: claims.clipId, e: expiresAt }),
  );
  return { token: `v1.${payload}.${sign(key, payload)}`, expiresAt };
}

export function verifyVoiceDownloadToken(key: Buffer, token: string, nowMs: number): VoiceDownloadCheck {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) return { ok: false, reason: "malformed" };
  const [, payload, signature] = parts as [string, string, string];

  const expected = Buffer.from(sign(key, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad_signature" };
  }

  let raw: { u?: unknown; o?: unknown; p?: unknown; c?: unknown; e?: unknown };
  try {
    raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const ids = [raw.u, raw.o, raw.p, raw.c];
  if (!ids.every((id) => typeof id === "string" && UUID.test(id)) || typeof raw.e !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (raw.e * 1000 <= nowMs) return { ok: false, reason: "expired" };
  return {
    ok: true,
    claims: {
      userId: raw.u as string,
      organizationId: raw.o as string,
      planId: raw.p as string,
      clipId: raw.c as string,
      expiresAt: raw.e,
    },
  };
}

export function voiceDownloadUrl(publicUrl: string, token: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/downloads/voice/${token}`;
}

/** Error codes on GET /downloads/voice/<token>, each with what the AI should do next. */
export const VOICE_DOWNLOAD_NEXT_STEP: Record<string, string> = {
  expired: "This link is older than 15 minutes. Call content.briefs.voice.get again for a new download_url.",
  unknown_link: "This is not a valid download link. Call content.briefs.voice.get again and use its download_url exactly.",
  forbidden: "This user is no longer a member of the organization. Ask the user to check their access in Synckerja.",
  not_found: "The clip was deleted or replaced. Call content.briefs.voice.list to see the current clips.",
  clip_not_mp3: "The stored file is not an MP3. Ask the user to regenerate the VO for this shot in Synckerja.",
  clip_too_large: "The stored file is unexpectedly large. Ask the user to regenerate the VO for this shot in Synckerja.",
  request_failed: "Synckerja could not read the file right now. Try again in a minute.",
};

export function voiceDownloadNextStep(code: string): string {
  return VOICE_DOWNLOAD_NEXT_STEP[code] ?? VOICE_DOWNLOAD_NEXT_STEP.request_failed!;
}
