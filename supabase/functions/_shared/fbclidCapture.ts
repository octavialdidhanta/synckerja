/** First-touch fbclid capture timestamps for Meta CAPI fbc (fb.1.{clickTime}.{fbclid}). */

function trimOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

export function parseFbclidCapturedAtFromAttribution(attribution: unknown): string | null {
  if (attribution == null) return null;
  let obj: Record<string, unknown>;
  if (typeof attribution === "string") {
    try {
      obj = JSON.parse(attribution) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof attribution === "object" && !Array.isArray(attribution)) {
    obj = attribution as Record<string, unknown>;
  } else {
    return null;
  }
  return trimOrNull(obj.fbclid_captured_at);
}

export function mergeAttributionWithFbclidCapture(
  existing: unknown,
  fbclid: string,
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
  base.fbclid = fbclid.trim();
  if (!trimOrNull(base.fbclid_captured_at)) {
    base.fbclid_captured_at = capturedAtIso;
  }
  return base;
}

export type ResolveFbclidCapturedAtArgs = {
  columnCapturedAt?: string | null;
  attribution?: unknown;
  sessionCapturedAt?: string | null;
  sessionStartedAt?: string | null;
  sessionFbclid?: string | null;
  leadCreatedAt?: string | null;
};

/** Read-time fallback chain for fbc click time (never uses Date.now() at upload). */
export function resolveFbclidCapturedAtIso(args: ResolveFbclidCapturedAtArgs): string | null {
  const fromColumn = trimOrNull(args.columnCapturedAt);
  if (fromColumn) return fromColumn;

  const fromAttribution = parseFbclidCapturedAtFromAttribution(args.attribution);
  if (fromAttribution) return fromAttribution;

  const fromSessionCapture = trimOrNull(args.sessionCapturedAt);
  if (fromSessionCapture) return fromSessionCapture;

  const sessionFbclid = trimOrNull(args.sessionFbclid);
  const sessionStarted = trimOrNull(args.sessionStartedAt);
  if (sessionFbclid && sessionStarted) return sessionStarted;

  return trimOrNull(args.leadCreatedAt);
}

export function fbclidCapturedAtToEpoch(iso: string | null | undefined): number | undefined {
  const trimmed = trimOrNull(iso);
  if (!trimmed) return undefined;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

export type LeadFbclidCapturePatchArgs = {
  existingFbclid?: string | null;
  existingCapturedAt?: string | null;
  existingAttribution?: unknown;
  incomingFbclid?: string | null;
  sessionCapturedAt?: string | null;
  nowIso: string;
};

/** First-touch lead patch when fbclid is newly assigned. */
export function leadFbclidCapturePatch(
  args: LeadFbclidCapturePatchArgs,
): {
  fbclid?: string;
  fbclid_captured_at?: string;
  attribution?: Record<string, unknown>;
} {
  const incoming = trimOrNull(args.incomingFbclid);
  if (!incoming) return {};

  const existingFbclid = trimOrNull(args.existingFbclid);
  const existingCapturedAt = trimOrNull(args.existingCapturedAt);

  const patch: {
    fbclid?: string;
    fbclid_captured_at?: string;
    attribution?: Record<string, unknown>;
  } = {};

  if (!existingFbclid) {
    patch.fbclid = incoming;
  }

  if (!existingCapturedAt) {
    const capturedAt =
      trimOrNull(args.sessionCapturedAt) ?? args.nowIso;
    patch.fbclid_captured_at = capturedAt;
    patch.attribution = mergeAttributionWithFbclidCapture(
      args.existingAttribution,
      incoming,
      capturedAt,
    );
  }

  return patch;
}
