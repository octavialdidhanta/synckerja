/**
 * ElevenLabs error bodies, turned into one message the owner can act on. A spent balance is told apart from every
 * other refusal so Office and the MCP can say "credits ran out, top up" instead of a generic failure:
 * - newer API: HTTP 402, detail.type "payment_required", detail.code "insufficient_credits";
 * - older API: HTTP 401 (sometimes 400), detail.status "quota_exceeded", message "This request exceeds your quota…".
 * Docs: https://elevenlabs.io/docs/eleven-api/resources/errors and help article "API - Error Code 400 or 401".
 */

export const ELEVEN_CREDIT_CODE = "voice_credit_exhausted";
export const ELEVEN_BILLING_URL = "https://elevenlabs.io/app/subscription";

const CREDIT_MARKERS = new Set(["quota_exceeded", "insufficient_credits", "payment_required"]);

export type ElevenFailure = { message: string; code: string | null; status: number; credit: boolean };

export function describeElevenError(status: number, payload: unknown): ElevenFailure {
  const detail = payload && typeof payload === "object" ? (payload as { detail?: unknown }).detail : undefined;
  let raw = "";
  const markers: string[] = [];
  if (typeof detail === "string") raw = detail.trim();
  else if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    raw = String(d.message ?? "").trim();
    for (const k of ["status", "code", "type"]) if (typeof d[k] === "string") markers.push(String(d[k]).toLowerCase());
  }
  const credit = status === 402 || markers.some((m) => CREDIT_MARKERS.has(m)) || /exceeds your quota|insufficient credits/i.test(raw);
  if (credit) {
    return {
      message:
        `Kredit ElevenLabs habis, jadi VO belum bisa dibuat. Isi kredit (atau aktifkan usage-based billing) di ${ELEVEN_BILLING_URL}, lalu coba lagi.`
        + (raw ? ` Pesan ElevenLabs: ${raw.slice(0, 200)}` : ""),
      code: ELEVEN_CREDIT_CODE,
      status: 402,
      credit: true,
    };
  }
  return { message: raw || `ElevenLabs menolak permintaan (${status}).`, code: null, status, credit: false };
}
