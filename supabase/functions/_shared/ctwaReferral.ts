/** Click-to-WhatsApp (CTWA) referral parsing from Meta WhatsApp webhook payloads. */

export type CtwaReferralSnapshot = {
  ctwa_clid: string;
  source_type: string | null;
  source_id: string | null;
  source_url: string | null;
  headline: string | null;
  body: string | null;
  raw: Record<string, unknown>;
};

function trimOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/** Parse `messages[].referral` from WhatsApp Cloud API webhook. */
export function parseCtwaReferral(referral: unknown): CtwaReferralSnapshot | null {
  if (referral == null || typeof referral !== "object") return null;
  const obj = referral as Record<string, unknown>;
  const ctwaClid = trimOrNull(obj.ctwa_clid ?? obj.CTWA_CLID);
  if (!ctwaClid) return null;
  return {
    ctwa_clid: ctwaClid,
    source_type: trimOrNull(obj.source_type),
    source_id: trimOrNull(obj.source_id),
    source_url: trimOrNull(obj.source_url),
    headline: trimOrNull(obj.headline),
    body: trimOrNull(obj.body),
    raw: obj,
  };
}

export function parseCtwaClidFromAttribution(attribution: unknown): string | null {
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
  return trimOrNull(obj.ctwa_clid ?? obj.CTWA_CLID);
}

export function mergeCtwaClid(column: string | null, attribution: unknown): string | null {
  const fromCol = column?.trim() || null;
  if (fromCol) return fromCol;
  return parseCtwaClidFromAttribution(attribution);
}

export function mergeAttributionWithCtwa(
  existing: unknown,
  snapshot: CtwaReferralSnapshot,
  capturedAtIso: string,
): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (existing != null) {
    if (typeof existing === "string") {
      try {
        base = JSON.parse(existing) as Record<string, unknown>;
      } catch {
        base = {};
      }
    } else if (typeof existing === "object") {
      base = { ...(existing as Record<string, unknown>) };
    }
  }
  base.ctwa_clid = snapshot.ctwa_clid;
  if (snapshot.source_type) base.ctwa_source_type = snapshot.source_type;
  if (snapshot.source_id) base.ctwa_source_id = snapshot.source_id;
  if (snapshot.source_url) base.ctwa_source_url = snapshot.source_url;
  base.ctwa_captured_at = capturedAtIso;
  return base;
}
