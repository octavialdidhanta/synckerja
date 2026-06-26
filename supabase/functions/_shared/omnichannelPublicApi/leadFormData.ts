export const RESERVED_LEAD_BODY_KEYS = new Set([
  "name",
  "phone_number",
  "email",
  "notes",
  "session_id",
  "status",
  "title",
  "category",
  "source_label",
  "consent",
  "form_id",
]);

export const MAX_FORM_DATA_KEYS = 64;
export const MAX_FORM_DATA_BYTES = 32 * 1024;

const FORM_DATA_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export type LeadFormCoreFields = {
  name: string;
  phone_number: string;
  email: string;
  notes: string | null;
  session_id: string | null;
  status: string | null;
};

export type ExtractLeadFormResult =
  | { ok: true; core: LeadFormCoreFields; formData: Record<string, unknown> | null }
  | { ok: false; error: string };

function isPrimitiveFormValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function validateFormDataValue(value: unknown, path: string): string | null {
  if (isPrimitiveFormValue(value)) return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const err = validateFormDataValue(value[i], `${path}[${i}]`);
      if (err) return err;
    }
    return null;
  }

  if (value !== null && typeof value === "object") {
    return `${path}: nested object tidak diperbolehkan.`;
  }

  return `${path}: tipe nilai tidak didukung.`;
}

export function validateFormDataRecord(formData: Record<string, unknown>): string | null {
  const keys = Object.keys(formData);
  if (keys.length > MAX_FORM_DATA_KEYS) {
    return `Maksimal ${MAX_FORM_DATA_KEYS} field tambahan per submission.`;
  }

  for (const key of keys) {
    if (!FORM_DATA_KEY_PATTERN.test(key)) {
      return `Nama field "${key}" tidak valid. Gunakan huruf, angka, dan underscore (maks. 64 karakter).`;
    }
    const err = validateFormDataValue(formData[key], key);
    if (err) return err;
  }

  const serialized = JSON.stringify(formData);
  if (serialized.length > MAX_FORM_DATA_BYTES) {
    return `form_data melebihi batas ${MAX_FORM_DATA_BYTES} byte.`;
  }

  return null;
}

export function extractLeadFormPayload(body: Record<string, unknown>): ExtractLeadFormResult {
  const core: LeadFormCoreFields = {
    name: String(body.name ?? "").trim(),
    phone_number: body.phone_number != null ? String(body.phone_number).trim() : "",
    email: body.email != null ? String(body.email).trim() : "",
    notes: body.notes != null ? String(body.notes).trim() || null : null,
    session_id: body.session_id != null ? String(body.session_id).trim() || null : null,
    status: body.status != null ? String(body.status).trim() || null : null,
  };

  const formData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (RESERVED_LEAD_BODY_KEYS.has(key)) continue;
    if (value === undefined) continue;
    formData[key] = value;
  }

  const keys = Object.keys(formData);
  if (keys.length === 0) {
    return { ok: true, core, formData: null };
  }

  const validationError = validateFormDataRecord(formData);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  return { ok: true, core, formData };
}
