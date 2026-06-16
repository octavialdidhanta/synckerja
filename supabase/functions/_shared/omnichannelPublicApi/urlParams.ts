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
