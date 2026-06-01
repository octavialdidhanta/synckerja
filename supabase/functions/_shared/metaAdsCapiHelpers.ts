/** Meta Conversions API helpers — hashing, fbc from fbclid. */

export async function sha256Hex(input: string): Promise<string> {
  const normalized = input.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62") && p.length >= 9) p = "62" + p;
  return p;
}

export async function hashMetaUserData(
  email: string | null,
  phone: string | null,
): Promise<{ em?: string[]; ph?: string[] }> {
  const out: { em?: string[]; ph?: string[] } = {};
  if (email?.trim()) {
    out.em = [await sha256Hex(email.trim())];
  }
  if (phone?.trim()) {
    out.ph = [await sha256Hex(normalizePhone(phone.trim()))];
  }
  return out;
}

export function buildFbcFromFbclid(fbclid: string | null): string | undefined {
  if (!fbclid?.trim()) return undefined;
  const ts = Math.floor(Date.now() / 1000);
  return `fb.1.${ts}.${fbclid.trim()}`;
}

export function parseFbclidFromAttribution(attribution: unknown): string | null {
  if (attribution == null) return null;
  let obj: Record<string, unknown>;
  if (typeof attribution === "string") {
    try {
      obj = JSON.parse(attribution) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof attribution === "object") {
    obj = attribution as Record<string, unknown>;
  } else {
    return null;
  }
  const fbclid = obj.fbclid ?? obj.FBCLID;
  return fbclid != null ? String(fbclid).trim() || null : null;
}

export function mergeFbclid(column: string | null, attribution: unknown): string | null {
  const fromCol = column?.trim() || null;
  if (fromCol) return fromCol;
  return parseFbclidFromAttribution(attribution);
}

export type MetaCapiEventPayload = {
  event_name: string;
  event_time: number;
  event_id?: string;
  action_source: "system_generated";
  user_data: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
};

export async function sendMetaCapiEvents(
  pixelId: string,
  accessToken: string,
  events: MetaCapiEventPayload[],
  graphVersion: string,
): Promise<{ ok: boolean; body: unknown; error?: string }> {
  const url = `https://graph.facebook.com/${graphVersion}/${pixelId}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: events,
      access_token: accessToken,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (body as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, body, error: err };
  }
  return { ok: true, body };
}
