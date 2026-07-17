/** Canonical + legacy Public API lead labels (mirrors apiLeadCrmFields.ts). */

export const API_LEAD_SOURCE_WEBSITE_FORM = "Website form";
export const API_LEAD_SOURCE_WHATSAPP_BUTTON = "WhatsApp button";

const LEGACY_SOURCE_WEBSITE = "Website";
const LEGACY_SOURCE_FLOATING_WA = "WhatsApp floating click";
const LEGACY_CREATED_BY = "Synckerja API";
const LEGACY_CREATED_BY_WEBSITE_FORM = "Website form";

/** Seed filter dropdown before backfill completes. */
export const API_LEAD_KNOWN_SOURCES: string[] = [
  API_LEAD_SOURCE_WEBSITE_FORM,
  API_LEAD_SOURCE_WHATSAPP_BUTTON,
  LEGACY_SOURCE_WEBSITE,
  LEGACY_SOURCE_FLOATING_WA,
];

const LEGACY_SOURCE_TO_CANONICAL: Record<string, string> = {
  [LEGACY_SOURCE_WEBSITE]: API_LEAD_SOURCE_WEBSITE_FORM,
  [LEGACY_SOURCE_FLOATING_WA]: API_LEAD_SOURCE_WHATSAPP_BUTTON,
};

const LEGACY_CREATED_BY_TO_EMPTY = new Set([
  LEGACY_CREATED_BY,
  LEGACY_CREATED_BY_WEBSITE_FORM,
]);

export function humanizeWebId(webId: string): string {
  const trimmed = webId.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatLeadWebPropertyDisplay(webId?: string | null): string {
  const raw = (webId ?? "").trim();
  if (!raw) return "";
  return humanizeWebId(raw);
}

export function normalizeApiLeadSourceDisplay(source?: string | null): string {
  const raw = (source ?? "").trim();
  if (!raw) return API_LEAD_SOURCE_WEBSITE_FORM;
  return LEGACY_SOURCE_TO_CANONICAL[raw] ?? raw;
}

/** Staff name for manual leads; empty for API leads (UI shows —). */
export function normalizeApiLeadCreatedByDisplay(name?: string | null): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  if (LEGACY_CREATED_BY_TO_EMPTY.has(raw)) return "";
  return raw;
}

/** Lead Magnet / omnichannel social leads are not website analytics properties. */
export function shouldShowLeadWebPropertyAsEmpty(lead: {
  source?: string | null;
  category?: string | null;
  _fromLeadMagnet?: boolean;
}): boolean {
  if (lead._fromLeadMagnet === true) return true;
  const source = (lead.source ?? "").trim();
  const category = (lead.category ?? "").trim();
  return source === "Lead Magnet" || category === "Lead Magnet";
}

export function formatLeadWebPropertyCell(lead: {
  web_id?: string | null;
  source?: string | null;
  category?: string | null;
  _fromLeadMagnet?: boolean;
}): string {
  if (shouldShowLeadWebPropertyAsEmpty(lead)) return "";
  return formatLeadWebPropertyDisplay(lead.web_id);
}

/** Map source string to LeadsTable color key (legacy → canonical bucket). */
export function resolveApiLeadSourceColorKey(source?: string | null): string {
  const normalized = normalizeApiLeadSourceDisplay(source);
  if (normalized === API_LEAD_SOURCE_WEBSITE_FORM) return "Website form";
  if (normalized === API_LEAD_SOURCE_WHATSAPP_BUTTON) return "WhatsApp button";
  return normalized || "Website form";
}
