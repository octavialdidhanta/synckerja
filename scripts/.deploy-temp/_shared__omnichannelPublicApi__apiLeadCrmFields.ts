export const API_LEAD_SOURCE_WEBSITE_FORM = "Website form";
export const API_LEAD_SOURCE_WHATSAPP_BUTTON = "WhatsApp button";
/** Empty — API leads have no human CRM creator; audit uses created_by UUID. */
export const API_LEAD_CREATED_BY_NAME = "";

/** @deprecated migrated display label */
export const LEGACY_API_CREATED_BY_WEBSITE_FORM = "Website form";

/** @deprecated use API_LEAD_SOURCE_WHATSAPP_BUTTON */
export const LEGACY_FLOATING_WA_LEAD_SOURCE = "WhatsApp floating click";

export const LEGACY_API_LEAD_TITLE = "Lead Website";
export const LEGACY_FLOATING_WA_TITLE = "Floating WA click";
export const LEGACY_API_LEAD_CATEGORY = "Website API";
export const LEGACY_API_LEAD_SOURCE_WEBSITE = "Website";
export const LEGACY_API_CREATED_BY = "Synckerja API";

const MAX_TITLE_LEN = 120;
const MAX_CATEGORY_LEN = 120;
const MAX_SOURCE_LEN = 80;

export type ApiLeadCrmChannel = "website_form" | "whatsapp_button";

export type LeadFormOverrides = {
  title?: string | null;
  category?: string | null;
  source_label?: string | null;
};

export type DeriveApiLeadCrmFieldsArgs = {
  webId: string;
  channel: ApiLeadCrmChannel;
  overrides?: LeadFormOverrides | null;
  formData?: Record<string, unknown> | null;
  notes?: string | null;
  attribution?: Record<string, unknown> | null;
  /** Path from floating WA click (e.g. /contact). */
  clickPath?: string | null;
};

export type ApiLeadCrmFields = {
  title: string;
  category: string;
  source: string;
  created_by_name: string;
};

export function sanitizeCrmText(
  value: string | null | undefined,
  maxLen: number,
): string | null {
  if (value == null) return null;
  const collapsed = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return null;
  return collapsed.slice(0, maxLen);
}

export function humanizeWebId(webId: string): string {
  const trimmed = webId.trim();
  if (!trimmed) return "General";
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function pathFromLandingUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.trim();
    return path && path !== "/" ? path : null;
  } catch {
    const raw = url.trim();
    if (raw.startsWith("/")) return raw.split("?")[0] || null;
    return null;
  }
}

export function pickFormString(
  formData: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  if (!formData) return null;
  for (const key of keys) {
    const raw = formData[key];
    if (raw == null) continue;
    const text = sanitizeCrmText(String(raw), MAX_CATEGORY_LEN);
    if (text) return text;
  }
  return null;
}

export function isFloatingWaLeadSource(source: string | null | undefined): boolean {
  const s = String(source ?? "").trim();
  return s === API_LEAD_SOURCE_WHATSAPP_BUTTON || s === LEGACY_FLOATING_WA_LEAD_SOURCE;
}

export function isLegacyApiLeadRow(row: {
  title?: string | null;
  category?: string | null;
  source?: string | null;
  created_by_name?: string | null;
}): boolean {
  const title = String(row.title ?? "").trim();
  const category = String(row.category ?? "").trim();
  const source = String(row.source ?? "").trim();
  const createdBy = String(row.created_by_name ?? "").trim();
  return (
    title === LEGACY_API_LEAD_TITLE ||
    title === LEGACY_FLOATING_WA_TITLE ||
    category === LEGACY_API_LEAD_CATEGORY ||
    createdBy === LEGACY_API_CREATED_BY ||
    createdBy === LEGACY_API_CREATED_BY_WEBSITE_FORM ||
    source === LEGACY_API_LEAD_SOURCE_WEBSITE ||
    source === LEGACY_FLOATING_WA_LEAD_SOURCE
  );
}

export function extractLeadFormOverrides(body: Record<string, unknown>): LeadFormOverrides {
  return {
    title: body.title != null ? String(body.title) : null,
    category: body.category != null ? String(body.category) : null,
    source_label: body.source_label != null ? String(body.source_label) : null,
  };
}

function defaultSourceForChannel(channel: ApiLeadCrmChannel): string {
  return channel === "whatsapp_button"
    ? API_LEAD_SOURCE_WHATSAPP_BUTTON
    : API_LEAD_SOURCE_WEBSITE_FORM;
}

function deriveTitle(args: DeriveApiLeadCrmFieldsArgs, packageLabel: string | null): string {
  const override = sanitizeCrmText(args.overrides?.title, MAX_TITLE_LEN);
  if (override) return override;

  if (args.channel === "whatsapp_button") {
    const path = sanitizeCrmText(args.clickPath, 80)
      ?? pathFromLandingUrl(
        args.attribution?.landing_url != null ? String(args.attribution.landing_url) : null,
      );
    if (path) return sanitizeCrmText(`WhatsApp click · ${path}`, MAX_TITLE_LEN)!;
    return sanitizeCrmText(`WhatsApp click · ${args.webId}`, MAX_TITLE_LEN)!;
  }

  if (packageLabel) {
    return sanitizeCrmText(`Inquiry — ${packageLabel}`, MAX_TITLE_LEN)!;
  }

  const notesFirstLine = args.notes?.split(/\r?\n/)[0]?.trim();
  const fromNotes = sanitizeCrmText(notesFirstLine, MAX_TITLE_LEN);
  if (fromNotes) return fromNotes;

  const landingPath = pathFromLandingUrl(
    args.attribution?.landing_url != null ? String(args.attribution.landing_url) : null,
  );
  if (landingPath) {
    return sanitizeCrmText(`Contact form · ${landingPath}`, MAX_TITLE_LEN)!;
  }

  return sanitizeCrmText(`Contact form · ${args.webId}`, MAX_TITLE_LEN)!;
}

function deriveCategory(
  args: DeriveApiLeadCrmFieldsArgs,
  packageLabel: string | null,
  titleUsesPackage: boolean,
): string {
  const override = sanitizeCrmText(args.overrides?.category, MAX_CATEGORY_LEN);
  if (override) return override;

  const industry = pickFormString(args.formData, ["industry", "business_type"]);
  if (industry) return industry;

  if (packageLabel && !titleUsesPackage) return packageLabel;

  if (args.channel === "whatsapp_button") {
    const path = sanitizeCrmText(args.clickPath, 80);
    if (path) return path;
  }

  return humanizeWebId(args.webId);
}

export function deriveApiLeadCrmFields(args: DeriveApiLeadCrmFieldsArgs): ApiLeadCrmFields {
  const packageLabel = pickFormString(args.formData, ["package_label"]);
  const titleUsesPackage = Boolean(packageLabel) && !sanitizeCrmText(args.overrides?.title, MAX_TITLE_LEN);

  const sourceOverride = sanitizeCrmText(args.overrides?.source_label, MAX_SOURCE_LEN);
  const source = sourceOverride ?? defaultSourceForChannel(args.channel);

  return {
    title: deriveTitle(args, packageLabel),
    category: deriveCategory(args, packageLabel, titleUsesPackage),
    source,
    created_by_name: API_LEAD_CREATED_BY_NAME,
  };
}
