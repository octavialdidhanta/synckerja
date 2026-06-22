export type LeadMappableFieldGroup = "core" | "form_common" | "custom";

export type LeadMappableFieldOption = {
  key: string;
  group: LeadMappableFieldGroup;
  labelKey: string;
};

export const LEAD_CORE_MAPPABLE_FIELDS: LeadMappableFieldOption[] = [
  { key: "name", group: "core", labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.name" },
  { key: "email", group: "core", labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.email" },
  {
    key: "phone_number",
    group: "core",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.phoneNumber",
  },
  { key: "notes", group: "core", labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.notes" },
];

export const LEAD_COMMON_FORM_DATA_FIELDS: LeadMappableFieldOption[] = [
  {
    key: "package_label",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.packageLabel",
  },
  {
    key: "event_date",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.eventDate",
  },
  {
    key: "event_time",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.eventTime",
  },
  {
    key: "event_address",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.eventAddress",
  },
  {
    key: "industry",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.industry",
  },
  {
    key: "consent",
    group: "form_common",
    labelKey: "omnichannel.settings.apiIntegration.leadMapper.field.consent",
  },
];

const FORM_DATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export function isValidLeadFormDataKey(key: string): boolean {
  return FORM_DATA_KEY_PATTERN.test(key.trim());
}

/** Keys from form_data that have a non-empty value (matches fields actually submitted). */
export function extractNonEmptyFormDataKeys(
  formData: Record<string, unknown> | null | undefined,
): string[] {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return [];

  const out: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    const k = key.trim();
    if (!k) continue;
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out.push(k);
  }

  return out.sort((a, b) => a.localeCompare(b));
}

export function buildLeadMappableFieldOptions(
  recentFormDataKeys: string[],
): LeadMappableFieldOption[] {
  const recentSet = new Set(
    recentFormDataKeys.map((k) => k.trim()).filter((k) => k.length > 0),
  );

  const formCommon = LEAD_COMMON_FORM_DATA_FIELDS.filter((f) => recentSet.has(f.key));

  const catalogKeys = new Set([
    ...LEAD_CORE_MAPPABLE_FIELDS.map((f) => f.key),
    ...LEAD_COMMON_FORM_DATA_FIELDS.map((f) => f.key),
  ]);

  const custom: LeadMappableFieldOption[] = [...recentSet]
    .filter((key) => !catalogKeys.has(key) && isValidLeadFormDataKey(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      group: "custom" as const,
      labelKey: key,
    }));

  return [...LEAD_CORE_MAPPABLE_FIELDS, ...formCommon, ...custom];
}

const PREFERRED_FORM_DATA_ORDER = [
  "package_label",
  "event_date",
  "event_time",
  "event_address",
  "industry",
  "consent",
] as const;

function suggestLeadBodyKeys(slotCount: number, recentFormDataKeys: string[]): string[] {
  const recentSet = new Set(
    recentFormDataKeys.map((k) => k.trim()).filter((k) => k.length > 0),
  );
  const suggested: string[] = [];

  for (const key of ["name", "email", "phone_number"]) {
    if (suggested.length >= slotCount) break;
    suggested.push(key);
  }

  for (const key of PREFERRED_FORM_DATA_ORDER) {
    if (suggested.length >= slotCount) break;
    if (recentSet.has(key) && !suggested.includes(key)) {
      suggested.push(key);
    }
  }

  const coreKeys = new Set(LEAD_CORE_MAPPABLE_FIELDS.map((f) => f.key));
  for (const key of recentFormDataKeys.map((k) => k.trim()).filter((k) => k.length > 0)) {
    if (suggested.length >= slotCount) break;
    if (coreKeys.has(key) || suggested.includes(key)) continue;
    if (!isValidLeadFormDataKey(key)) continue;
    suggested.push(key);
  }

  while (suggested.length < slotCount) {
    suggested.push(`field_${suggested.length + 1}`);
  }

  return suggested.slice(0, slotCount);
}

export function suggestLeadMappingFromFields(
  slotCount: number,
  recentFormDataKeys: string[],
): Record<number, string> {
  if (slotCount <= 0) return {};

  const keys = suggestLeadBodyKeys(slotCount, recentFormDataKeys);
  const out: Record<number, string> = {};
  keys.forEach((key, idx) => {
    out[idx + 1] = key;
  });
  return out;
}

export function parameterMappingToRecord(
  mapping: Record<string, string> | null | undefined,
): Record<number, string> {
  if (!mapping) return {};
  const out: Record<number, string> = {};
  for (const [slot, field] of Object.entries(mapping)) {
    const n = Number.parseInt(slot, 10);
    if (Number.isFinite(n) && n >= 1) {
      out[n] = String(field ?? "").trim();
    }
  }
  return out;
}

export function recordToParameterMapping(mapping: Record<number, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, field] of Object.entries(mapping)) {
    const trimmed = String(field ?? "").trim();
    if (trimmed) out[slot] = trimmed;
  }
  return out;
}

export function isLeadMappingComplete(
  mapping: Record<number, string>,
  slotCount: number,
): boolean {
  if (slotCount <= 0) return true;
  const core = new Set(["name", "email", "phone_number", "notes"]);
  for (let i = 1; i <= slotCount; i++) {
    const key = mapping[i]?.trim();
    if (!key) return false;
    if (!core.has(key) && !isValidLeadFormDataKey(key)) return false;
  }
  return true;
}
