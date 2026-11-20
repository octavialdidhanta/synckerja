const LEAD_UTM_MAX = 200;
const LEAD_URL_MAX = 2000;
const LEAD_ALLOWED_KEYS = [
  "landing_url",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type LeadAttributionSanitized = Record<(typeof LEAD_ALLOWED_KEYS)[number], string | null>;

function leadClip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function maxForKey(key: string): number {
  if (key === "landing_url" || key === "referrer") return LEAD_URL_MAX;
  return LEAD_UTM_MAX;
}

function computeAttributionLabel(a: LeadAttributionSanitized): string {
  const campaign = a.utm_campaign?.trim();
  const src = a.utm_source?.trim();
  const med = a.utm_medium?.trim();
  if (campaign) {
    const tail = [src, med].filter(Boolean).join(" / ");
    return tail ? `${campaign} (${tail})`.slice(0, 500) : campaign.slice(0, 500);
  }
  if (src || med) return [src, med].filter(Boolean).join(" / ").slice(0, 500);
  const land = a.landing_url?.trim();
  if (land) return `Landing: ${land.length > 120 ? land.slice(0, 117) + "..." : land}`.slice(0, 500);
  const ref = a.referrer?.trim();
  if (ref) return `Referrer: ${ref.length > 100 ? ref.slice(0, 97) + "..." : ref}`.slice(0, 500);
  return "Direct / unknown";
}

export function parseLeadAttribution(raw: unknown): {
  attribution: LeadAttributionSanitized;
  label: string;
} | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: LeadAttributionSanitized = {
    landing_url: null,
    referrer: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
  };
  for (const key of LEAD_ALLOWED_KEYS) {
    const v = obj[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string") return null;
    const clipped = leadClip(v, maxForKey(key));
    out[key] = clipped.length > 0 ? clipped : null;
  }
  const hasAny = LEAD_ALLOWED_KEYS.some((k) => out[k] != null && out[k] !== "");
  if (!hasAny) return null;
  return { attribution: out, label: computeAttributionLabel(out) };
}

export function attributionToJsonb(a: LeadAttributionSanitized): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of LEAD_ALLOWED_KEYS) {
    const v = a[k];
    if (v != null && v !== "") o[k] = v;
  }
  return o;
}
