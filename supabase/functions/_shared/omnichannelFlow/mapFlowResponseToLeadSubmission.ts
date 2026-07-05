import {
  validateFormDataRecord,
  type LeadFormCoreFields,
} from "../omnichannelPublicApi/leadFormData.ts";

export type FlowProfileFields = {
  gender: string | null;
  age: number | null;
  occupation: string | null;
  location: string | null;
};

export type FlowResponseExtract = {
  core: Pick<LeadFormCoreFields, "name" | "email" | "phone_number">;
  profile: FlowProfileFields;
  formData: Record<string, unknown> | null;
  humanBody: string;
};

const NAME_ALIASES = new Set(["nama", "name", "full_name", "fullname", "contact_name"]);
const EMAIL_ALIASES = new Set(["email", "e_mail", "e-mail", "mail"]);
const PHONE_ALIASES = new Set([
  "phone",
  "telepon",
  "telpon",
  "hp",
  "phone_number",
  "phonenumber",
  "wa",
  "no_hp",
  "nomor_hp",
  "nomor_telepon",
  "whatsapp",
]);

const PROFILE_FIELD_ALIASES: Record<keyof FlowProfileFields, Set<string>> = {
  gender: new Set(["gender", "jenis_kelamin", "jk", "sex", "kelamin"]),
  age: new Set(["age", "umur", "usia"]),
  occupation: new Set(["occupation", "pekerjaan", "job", "profesi", "work"]),
  location: new Set(["location", "lokasi", "domisili", "alamat", "address", "city", "kota"]),
};

const ALL_MAPPED_ALIAS_SETS: Set<string>[] = [
  NAME_ALIASES,
  EMAIL_ALIASES,
  PHONE_ALIASES,
  ...Object.values(PROFILE_FIELD_ALIASES),
];

function normalizeFieldKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, "_");
}

function isMappedAlias(normKey: string): boolean {
  return ALL_MAPPED_ALIAS_SETS.some((aliases) => aliases.has(normKey));
}

function pickCoreValue(
  response: Record<string, unknown>,
  aliases: Set<string>,
): string {
  for (const [rawKey, rawVal] of Object.entries(response)) {
    const key = normalizeFieldKey(rawKey);
    if (!aliases.has(key)) continue;
    const val = String(rawVal ?? "").trim();
    if (val) return val.slice(0, 512);
  }
  return "";
}

function pickRawValueForAliases(
  response: Record<string, unknown>,
  aliases: Set<string>,
): unknown {
  for (const [rawKey, rawVal] of Object.entries(response)) {
    const key = normalizeFieldKey(rawKey);
    if (!aliases.has(key)) continue;
    if (rawVal == null || String(rawVal).trim() === "") continue;
    return rawVal;
  }
  return null;
}

/** Normalize Meta Flow gender to Client Profile values: Male | Female | Other. */
export function normalizeFlowGender(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;

  if (["male", "m", "l", "laki", "laki-laki", "laki laki", "pria", "cowok"].includes(s)) {
    return "Male";
  }
  if (["female", "f", "p", "perempuan", "wanita", "cewek", "cewe"].includes(s)) {
    return "Female";
  }
  if (["other", "lainnya", "lain", "non-binary", "nonbinary", "non binary"].includes(s)) {
    return "Other";
  }

  return null;
}

/** Parse age for lead_submissions.age (1–149). */
export function parseFlowAge(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) return null;
  const age = Math.trunc(n);
  if (age <= 0 || age >= 150) return null;
  return age;
}

function pickProfileText(raw: unknown): string | null {
  const val = String(raw ?? "").trim();
  return val ? val.slice(0, 512) : null;
}

export function extractFlowProfileFields(response: Record<string, unknown>): FlowProfileFields {
  const genderRaw = pickRawValueForAliases(response, PROFILE_FIELD_ALIASES.gender);
  const ageRaw = pickRawValueForAliases(response, PROFILE_FIELD_ALIASES.age);
  const occupationRaw = pickRawValueForAliases(response, PROFILE_FIELD_ALIASES.occupation);
  const locationRaw = pickRawValueForAliases(response, PROFILE_FIELD_ALIASES.location);

  return {
    gender: normalizeFlowGender(genderRaw),
    age: parseFlowAge(ageRaw),
    occupation: pickProfileText(occupationRaw),
    location: pickProfileText(locationRaw),
  };
}

function sanitizeFormDataKey(rawKey: string): string | null {
  const key = rawKey.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^[^a-zA-Z]+/, "");
  if (!key || key.length > 64) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) return null;
  return key;
}

/** Build human-readable chat body from flow field map. */
export function formatFlowResponseBody(response: Record<string, unknown>, flowName?: string | null): string {
  const lines: string[] = [];
  if (flowName?.trim()) lines.push(`Form: ${flowName.trim()}`);
  for (const [key, val] of Object.entries(response)) {
    if (val == null || val === "") continue;
    lines.push(`${key}: ${String(val).slice(0, 200)}`);
  }
  return lines.length > 0 ? lines.join("\n") : "Form submitted";
}

export function parseFlowResponseJson(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { _raw: trimmed.slice(0, 4000) };
    }
  }
  return {};
}

/**
 * Map Meta WhatsApp Flow `nfm_reply.response_json` to lead_submissions columns.
 * Core → name/email/phone_number; profile → gender/age/occupation/location; extras → form_data.
 */
export function mapFlowResponseToLeadSubmission(
  responseJson: Record<string, unknown>,
  flowName?: string | null,
): FlowResponseExtract {
  const core = {
    name: pickCoreValue(responseJson, NAME_ALIASES),
    email: pickCoreValue(responseJson, EMAIL_ALIASES),
    phone_number: pickCoreValue(responseJson, PHONE_ALIASES),
  };

  const profile = extractFlowProfileFields(responseJson);

  const usedKeys = new Set<string>();
  for (const [rawKey] of Object.entries(responseJson)) {
    const norm = normalizeFieldKey(rawKey);
    if (isMappedAlias(norm)) usedKeys.add(rawKey);
  }

  const formData: Record<string, unknown> = {};
  for (const [rawKey, rawVal] of Object.entries(responseJson)) {
    if (usedKeys.has(rawKey)) continue;
    if (rawVal == null || String(rawVal).trim() === "") continue;
    const safeKey = sanitizeFormDataKey(rawKey);
    if (!safeKey) continue;
    formData[safeKey] = typeof rawVal === "object" ? JSON.stringify(rawVal).slice(0, 1024) : rawVal;
  }

  const hasExtraFields = Object.keys(formData).length > 0;

  let finalFormData: Record<string, unknown> | null = null;
  if (hasExtraFields) {
    const err = validateFormDataRecord(formData);
    finalFormData = err ? { _validation_error: err.slice(0, 500), ...formData } : formData;
  }

  return {
    core,
    profile,
    formData: finalFormData,
    humanBody: formatFlowResponseBody(responseJson, flowName),
  };
}
