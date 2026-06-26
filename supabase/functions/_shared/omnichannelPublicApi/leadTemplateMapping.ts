import { RESERVED_LEAD_BODY_KEYS } from "./leadFormData.ts";

export type LeadMappingSource =
  | "parameter_mapping"
  | "organization_whatsapp_templates"
  | "fixed_7";

const FORM_DATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

const CORE_MAPPABLE_KEYS = new Set(["name", "email", "phone_number", "notes"]);

const FIXED_7_KEYS = [
  "name",
  "email",
  "phone_number",
  "package_label",
  "event_date",
  "event_time",
  "event_address",
] as const;

export function sanitizeMetaTemplateParam(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\n\r]+/g, " · ")
    .replace(/\t/g, " ")
    .replace(/ {5,}/g, "    ")
    .trim()
    .slice(0, 1024);
}

export function paramOrDash(value: unknown): string {
  const s = value == null ? "" : String(value).trim();
  if (s.length === 0) return "-";
  return sanitizeMetaTemplateParam(s);
}

export function isValidLeadMappableFieldKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (CORE_MAPPABLE_KEYS.has(trimmed)) return true;
  if (RESERVED_LEAD_BODY_KEYS.has(trimmed)) return false;
  return FORM_DATA_KEY_PATTERN.test(trimmed);
}

/** Parse jsonb parameter_mapping → ordered body keys (slot 1..n). */
export function parseParameterMapping(
  raw: unknown,
  slotCount?: number,
): string[] | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const entries = Object.entries(obj)
    .map(([slot, field]) => ({
      slot: Number.parseInt(slot, 10),
      field: String(field ?? "").trim(),
    }))
    .filter((e) => Number.isFinite(e.slot) && e.slot >= 1 && e.field.length > 0)
    .sort((a, b) => a.slot - b.slot);

  if (entries.length === 0) return null;

  const maxSlot = entries[entries.length - 1]!.slot;
  const expected = slotCount ?? maxSlot;
  if (entries.length !== expected) return null;

  for (let i = 1; i <= expected; i++) {
    const found = entries.find((e) => e.slot === i);
    if (!found) return null;
    if (!isValidLeadMappableFieldKey(found.field)) return null;
  }

  return entries.map((e) => e.field);
}

/** Build Record<number, string> from string[] keys for UI. */
export function bodyKeysToParameterMapping(bodyKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  bodyKeys.forEach((key, idx) => {
    out[String(idx + 1)] = key;
  });
  return out;
}

export function resolveBodyKeyValue(
  key: string,
  args: {
    name: string;
    email: string | null;
    phoneNumber: string;
    notes?: string | null;
    formData: Record<string, unknown> | null;
  },
): string {
  const fd = args.formData ?? {};
  const normalized = key.trim().toLowerCase();

  switch (normalized) {
    case "name":
    case "client":
    case "customer_name":
      return paramOrDash(args.name);
    case "email":
      return paramOrDash(args.email);
    case "phone":
    case "phone_number":
    case "customer_phone":
      return paramOrDash(args.phoneNumber);
    case "notes":
      return paramOrDash(args.notes);
    case "package_label":
    case "package":
    case "needs":
    case "ringkasan_kebutuhan":
      return paramOrDash(fd.package_label ?? fd[normalized] ?? fd[key]);
    case "event_date":
      return paramOrDash(fd.event_date);
    case "event_time":
      return paramOrDash(fd.event_time);
    case "event_address":
    case "office_address":
    case "address":
      return paramOrDash(fd.event_address ?? fd.office_address ?? fd.address);
    case "industry":
    case "business_type":
      return paramOrDash(fd[normalized] ?? fd[key]);
    default:
      return paramOrDash(fd[normalized] ?? fd[key]);
  }
}

export function buildParamsFromMapping(
  bodyKeys: string[],
  args: {
    name: string;
    email: string | null;
    phoneNumber: string;
    notes?: string | null;
    formData: Record<string, unknown> | null;
  },
): string[] {
  return bodyKeys.map((key) => resolveBodyKeyValue(key, args));
}

const PREVIEW_SAMPLE_SUBMISSION = {
  name: "Budi Santoso",
  email: "budi@example.com",
  phoneNumber: "6281234567890",
  notes: null as string | null,
  formData: {
    package_label: "Paket Gold",
    event_date: "2026-12-01",
    event_time: "10:00",
    event_address: "Jakarta",
  } as Record<string, unknown>,
};

/** Preview: use submission values, fall back to sample when a mapped field is empty. */
export function buildPreviewParamsFromMapping(
  bodyKeys: string[],
  args: {
    name: string;
    email: string | null;
    phoneNumber: string;
    notes?: string | null;
    formData: Record<string, unknown> | null;
  },
): string[] {
  const sample = PREVIEW_SAMPLE_SUBMISSION;
  return bodyKeys.map((key) => {
    const real = resolveBodyKeyValue(key, args);
    if (real !== "-") return real;
    return resolveBodyKeyValue(key, {
      name: sample.name,
      email: sample.email,
      phoneNumber: sample.phoneNumber,
      notes: sample.notes,
      formData: sample.formData,
    });
  });
}

export function suggestLeadParameterMapping(
  slotCount: number,
  recentFormDataKeys: string[] = [],
): Record<string, string> {
  if (slotCount <= 0) return {};

  const recentSet = new Set(
    recentFormDataKeys.map((k) => k.trim()).filter((k) => k.length > 0),
  );
  const suggested: string[] = [];

  for (const key of ["name", "email", "phone_number"]) {
    if (suggested.length >= slotCount) break;
    suggested.push(key);
  }

  const preferredFormData = [
    "package_label",
    "event_date",
    "event_time",
    "event_address",
    "industry",
    "consent",
  ] as const;

  for (const key of preferredFormData) {
    if (suggested.length >= slotCount) break;
    if (recentSet.has(key) && !suggested.includes(key)) {
      suggested.push(key);
    }
  }

  const extras = recentFormDataKeys
    .map((k) => k.trim())
    .filter((k) => isValidLeadMappableFieldKey(k) && !CORE_MAPPABLE_KEYS.has(k));

  for (const key of extras) {
    if (suggested.length >= slotCount) break;
    if (!suggested.includes(key)) suggested.push(key);
  }

  while (suggested.length < slotCount) {
    suggested.push(`field_${suggested.length + 1}`);
  }

  return bodyKeysToParameterMapping(suggested.slice(0, slotCount));
}

function countPlaceholders(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

/** Body-only variable count from Meta template components. */
export function countTemplateBodySlotsFromComponents(
  components: unknown[] | null | undefined,
): number {
  if (!Array.isArray(components)) return 0;
  let total = 0;
  for (const raw of components) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    if (String(c.type ?? "").toUpperCase() !== "BODY") continue;
    total += countPlaceholders(String(c.text ?? ""));
  }
  return total;
}

export function validateParameterMappingForSlots(
  parameterMapping: Record<string, string>,
  slotCount: number,
): string | null {
  if (slotCount <= 0) return "Template tidak memiliki variabel body.";
  const keys = parseParameterMapping(parameterMapping, slotCount);
  if (!keys) {
    return `Mapping harus mengisi slot 1 sampai ${slotCount} dengan field yang valid.`;
  }
  return null;
}
