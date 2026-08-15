/** Ekstraksi UTM dan click ID dari URL landing page. */

export type ParsedUrlParams = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  path: string;
};

function pickParam(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key);
  return v && v.trim() ? v.trim() : null;
}

export function parsePageUrl(raw: string): ParsedUrlParams | null {
  try {
    const url = new URL(raw);
    const sp = url.searchParams;
    return {
      utm_source: pickParam(sp, "utm_source"),
      utm_medium: pickParam(sp, "utm_medium"),
      utm_campaign: pickParam(sp, "utm_campaign"),
      utm_term: pickParam(sp, "utm_term"),
      utm_content: pickParam(sp, "utm_content"),
      gclid: pickParam(sp, "gclid"),
      fbclid: pickParam(sp, "fbclid"),
      msclkid: pickParam(sp, "msclkid"),
      gbraid: pickParam(sp, "gbraid"),
      wbraid: pickParam(sp, "wbraid"),
      path: url.pathname || "/",
    };
  } catch {
    return null;
  }
}

export function coalesceUtm(
  body: Record<string, unknown>,
  parsed: ParsedUrlParams | null,
): ParsedUrlParams {
  return {
    utm_source: strOr(body.utm_source) ?? parsed?.utm_source ?? null,
    utm_medium: strOr(body.utm_medium) ?? parsed?.utm_medium ?? null,
    utm_campaign: strOr(body.utm_campaign) ?? parsed?.utm_campaign ?? null,
    utm_term: strOr(body.utm_term) ?? parsed?.utm_term ?? null,
    utm_content: strOr(body.utm_content) ?? parsed?.utm_content ?? null,
    gclid: strOr(body.gclid) ?? parsed?.gclid ?? null,
    fbclid: strOr(body.fbclid) ?? parsed?.fbclid ?? null,
    msclkid: strOr(body.msclkid) ?? parsed?.msclkid ?? null,
    gbraid: strOr(body.gbraid) ?? parsed?.gbraid ?? null,
    wbraid: strOr(body.wbraid) ?? parsed?.wbraid ?? null,
    path: parsed?.path ?? "/",
  };
}

function strOr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/** Existing analytics_sessions attribution columns used when merging traffic-logs updates. */
export type SessionAttributionRow = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  first_utm_source?: string | null;
  first_utm_medium?: string | null;
  first_utm_campaign?: string | null;
  first_utm_content?: string | null;
  first_utm_term?: string | null;
  last_utm_source?: string | null;
  last_utm_medium?: string | null;
  last_utm_campaign?: string | null;
  last_utm_content?: string | null;
  last_utm_term?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  has_gclid?: boolean | null;
  first_has_gclid?: boolean | null;
  last_has_gclid?: boolean | null;
  has_fbclid?: boolean | null;
  first_has_fbclid?: boolean | null;
  last_has_fbclid?: boolean | null;
  has_msclkid?: boolean | null;
  has_gbraid?: boolean | null;
  has_wbraid?: boolean | null;
  fbclid_captured_at?: string | null;
};

export type SessionAttributionMergePatch = {
  last_seen_at: string;
  last_landing_url: string;
  last_referrer: string | null;
  visitor_id: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  first_utm_source?: string | null;
  first_utm_medium?: string | null;
  first_utm_campaign?: string | null;
  first_utm_content?: string | null;
  first_utm_term?: string | null;
  last_utm_source?: string | null;
  last_utm_medium?: string | null;
  last_utm_campaign?: string | null;
  last_utm_content?: string | null;
  last_utm_term?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  has_gclid?: boolean;
  first_has_gclid?: boolean;
  last_has_gclid?: boolean;
  has_fbclid?: boolean;
  first_has_fbclid?: boolean;
  last_has_fbclid?: boolean;
  has_msclkid?: boolean;
  has_gbraid?: boolean;
  has_wbraid?: boolean;
  fbclid_captured_at?: string;
};

function stickyString(
  incoming: string | null,
  ...existing: (string | null | undefined)[]
): string | null {
  if (incoming) return incoming;
  for (const value of existing) {
    const normalized = strOr(value);
    if (normalized) return normalized;
  }
  return null;
}

function stickyBool(
  incomingPresent: boolean,
  ...existing: (boolean | null | undefined)[]
): boolean {
  if (incomingPresent) return true;
  return existing.some((value) => value === true);
}

function mergeUtmDimension(
  incoming: string | null,
  existing: SessionAttributionRow,
  firstKey: keyof SessionAttributionRow,
  utmKey: keyof SessionAttributionRow,
  lastKey: keyof SessionAttributionRow,
): {
  firstTouch: string | null;
  lastTouch: string | null;
} {
  const firstTouch = stickyString(
    incoming,
    existing[firstKey] as string | null | undefined,
    existing[utmKey] as string | null | undefined,
  );
  const lastTouch = stickyString(
    incoming,
    existing[lastKey] as string | null | undefined,
    existing[firstKey] as string | null | undefined,
    existing[utmKey] as string | null | undefined,
  );
  return { firstTouch, lastTouch };
}

/** Sticky session attribution merge for SPA page views without UTM query params. */
export function mergeIncomingAttribution(
  existing: SessionAttributionRow,
  incoming: ParsedUrlParams,
  ctx: { now: string; pageUrl: string; referrer: string | null; visitorId: string },
): SessionAttributionMergePatch {
  const source = mergeUtmDimension(
    incoming.utm_source,
    existing,
    "first_utm_source",
    "utm_source",
    "last_utm_source",
  );
  const medium = mergeUtmDimension(
    incoming.utm_medium,
    existing,
    "first_utm_medium",
    "utm_medium",
    "last_utm_medium",
  );
  const campaign = mergeUtmDimension(
    incoming.utm_campaign,
    existing,
    "first_utm_campaign",
    "utm_campaign",
    "last_utm_campaign",
  );
  const content = mergeUtmDimension(
    incoming.utm_content,
    existing,
    "first_utm_content",
    "utm_content",
    "last_utm_content",
  );
  const term = mergeUtmDimension(
    incoming.utm_term,
    existing,
    "first_utm_term",
    "utm_term",
    "last_utm_term",
  );

  const gclid = stickyString(incoming.gclid, existing.gclid);
  const fbclid = stickyString(incoming.fbclid, existing.fbclid);
  const hasGclid = stickyBool(Boolean(incoming.gclid), existing.has_gclid, existing.first_has_gclid, existing.last_has_gclid);
  const hasFbclid = stickyBool(
    Boolean(incoming.fbclid),
    existing.has_fbclid,
    existing.first_has_fbclid,
    existing.last_has_fbclid,
  );
  const hasMsclkid = stickyBool(Boolean(incoming.msclkid), existing.has_msclkid);
  const hasGbraid = stickyBool(Boolean(incoming.gbraid), existing.has_gbraid);
  const hasWbraid = stickyBool(Boolean(incoming.wbraid), existing.has_wbraid);

  const patch: SessionAttributionMergePatch = {
    last_seen_at: ctx.now,
    last_landing_url: ctx.pageUrl,
    last_referrer: ctx.referrer,
    visitor_id: ctx.visitorId,
    last_utm_source: source.lastTouch,
    last_utm_medium: medium.lastTouch,
    last_utm_campaign: campaign.lastTouch,
    last_utm_content: content.lastTouch,
    last_utm_term: term.lastTouch,
    has_gclid: hasGclid,
    last_has_gclid: hasGclid,
    has_fbclid: hasFbclid,
    last_has_fbclid: hasFbclid,
    has_msclkid: hasMsclkid,
    has_gbraid: hasGbraid,
    has_wbraid: hasWbraid,
  };

  if (gclid) patch.gclid = gclid;
  if (fbclid) patch.fbclid = fbclid;

  const isFirstFbclidCapture =
    Boolean(incoming.fbclid) && !strOr(existing.fbclid);
  if (isFirstFbclidCapture && !strOr(existing.fbclid_captured_at)) {
    patch.fbclid_captured_at = ctx.now;
  }

  if (!strOr(existing.utm_source) && source.firstTouch) {
    patch.utm_source = source.firstTouch;
    patch.first_utm_source = source.firstTouch;
  }
  if (!strOr(existing.utm_medium) && medium.firstTouch) {
    patch.utm_medium = medium.firstTouch;
    patch.first_utm_medium = medium.firstTouch;
  }
  if (!strOr(existing.utm_campaign) && campaign.firstTouch) {
    patch.utm_campaign = campaign.firstTouch;
    patch.first_utm_campaign = campaign.firstTouch;
  }
  if (!strOr(existing.utm_content) && content.firstTouch) {
    patch.utm_content = content.firstTouch;
    patch.first_utm_content = content.firstTouch;
  }
  if (!strOr(existing.utm_term) && term.firstTouch) {
    patch.utm_term = term.firstTouch;
    patch.first_utm_term = term.firstTouch;
  }

  if (!existing.first_has_gclid && hasGclid) patch.first_has_gclid = true;
  if (!existing.first_has_fbclid && hasFbclid) patch.first_has_fbclid = true;

  if (incoming.utm_source && strOr(existing.utm_source)) {
    patch.last_utm_source = incoming.utm_source;
  }
  if (incoming.utm_medium && strOr(existing.utm_medium)) {
    patch.last_utm_medium = incoming.utm_medium;
  }
  if (incoming.utm_campaign && strOr(existing.utm_campaign)) {
    patch.last_utm_campaign = incoming.utm_campaign;
  }
  if (incoming.utm_content && strOr(existing.utm_content)) {
    patch.last_utm_content = incoming.utm_content;
  }
  if (incoming.utm_term && strOr(existing.utm_term)) {
    patch.last_utm_term = incoming.utm_term;
  }

  return patch;
}

export function buildAttributionLabel(utm: ParsedUrlParams): string | null {
  const parts = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" / ");
}

export function extractFbclidFromUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return parsePageUrl(raw)?.fbclid ?? null;
}

/** Resolve gclid/fbclid from session row; fbclid falls back to landing URL when only has_fbclid was stored. */
export type SessionMarketingRow = SessionAttributionRow & {
  landing_url?: string | null;
  last_landing_url?: string | null;
  first_landing_url?: string | null;
  started_at?: string | null;
};

export type SessionMarketingAttribution = {
  attribution: Record<string, unknown>;
  attributionLabel: string | null;
  gclid: string | null;
  fbclid: string | null;
};

function firstTouchUtm(session: SessionAttributionRow): Pick<
  ParsedUrlParams,
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content"
> {
  return {
    utm_source: strOr(session.first_utm_source) ?? strOr(session.utm_source),
    utm_medium: strOr(session.first_utm_medium) ?? strOr(session.utm_medium),
    utm_campaign: strOr(session.first_utm_campaign) ?? strOr(session.utm_campaign),
    utm_content: strOr(session.first_utm_content) ?? strOr(session.utm_content),
    utm_term: strOr(session.first_utm_term) ?? strOr(session.utm_term),
  };
}

/** First-touch UTM + click IDs from analytics_sessions for leads / wa-click attribution. */
export function resolveSessionMarketingAttribution(
  sessionId: string,
  webId: string,
  session: SessionMarketingRow,
): SessionMarketingAttribution {
  const utm = firstTouchUtm(session);
  const clickIds = resolveSessionClickIds(session);
  const landingUrl =
    session.last_landing_url ?? session.landing_url ?? session.first_landing_url ?? null;

  const attribution: Record<string, unknown> = {
    session_id: sessionId,
    web_id: webId,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    landing_url: landingUrl,
    gclid: clickIds.gclid,
    fbclid: clickIds.fbclid,
  };
  if (session.fbclid_captured_at) {
    attribution.fbclid_captured_at = session.fbclid_captured_at;
  }

  const attributionLabel = buildAttributionLabel({
    ...utm,
    gclid: clickIds.gclid,
    fbclid: clickIds.fbclid,
    msclkid: null,
    gbraid: null,
    wbraid: null,
    path: "/",
  });

  return {
    attribution,
    attributionLabel,
    gclid: clickIds.gclid,
    fbclid: clickIds.fbclid,
  };
}

export function resolveSessionClickIds(session: {
  gclid?: string | null;
  fbclid?: string | null;
  has_fbclid?: boolean | null;
  landing_url?: string | null;
  last_landing_url?: string | null;
  first_landing_url?: string | null;
}): { gclid: string | null; fbclid: string | null } {
  const landing =
    session.last_landing_url ?? session.landing_url ?? session.first_landing_url ?? null;
  const fbFromCol = session.fbclid?.trim() || null;
  const fbclid =
    fbFromCol ??
    (session.has_fbclid ? extractFbclidFromUrl(landing) : null) ??
    extractFbclidFromUrl(landing);
  return {
    gclid: session.gclid?.trim() || null,
    fbclid,
  };
}

export function isValidWebId(webId: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(webId) || /^[a-z0-9]{3,64}$/.test(webId);
}

export function normalizeWebId(raw: string): string {
  return raw.trim().toLowerCase();
}
