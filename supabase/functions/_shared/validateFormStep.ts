export type FormFieldDef = {
  key: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  options?: string[];
};

export type FormSchemaV1 = {
  version: number;
  steps: Array<{ step: number; fields: FormFieldDef[] }>;
};

export type ValidateResult =
  | { ok: true; sanitized: Record<string, unknown>; honeypotTriggered: boolean }
  | { ok: false; error: string };

const MAX_FORM_DATA_BYTES = 64 * 1024;

function byteLengthJson(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isPhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 16;
}

export function parseFormSchema(raw: unknown): FormSchemaV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as FormSchemaV1;
  if (o.version !== 1 || !Array.isArray(o.steps)) return null;
  return o;
}

export function getStepFields(schema: FormSchemaV1, step: number): FormFieldDef[] | null {
  const found = schema.steps.find((s) => s.step === step);
  return found?.fields ?? null;
}

export function getMaxStep(schema: FormSchemaV1): number {
  return Math.max(...schema.steps.map((s) => s.step), 1);
}

export function validateFormStep(
  fields: FormFieldDef[],
  formData: Record<string, unknown>,
): ValidateResult {
  const sanitized: Record<string, unknown> = {};
  const allowedKeys = new Set(fields.map((f) => f.key));

  for (const key of Object.keys(formData)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: `Unknown field: ${key}` };
    }
  }

  for (const field of fields) {
    if (field.type === "honeypot") {
      const v = formData[field.key];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return { ok: true, sanitized: {}, honeypotTriggered: true };
      }
      continue;
    }

    const raw = formData[field.key];
    const empty = raw === undefined || raw === null || String(raw).trim() === "";

    if (empty) {
      if (field.required) return { ok: false, error: `Missing required field: ${field.key}` };
      continue;
    }

    let val: unknown = raw;

    switch (field.type) {
      case "text":
      case "textarea":
      case "phone":
      case "email":
      case "date": {
        if (typeof val !== "string") return { ok: false, error: `Invalid type for ${field.key}` };
        const s = val.trim();
        const max = field.maxLength ?? (field.type === "textarea" ? 4000 : 200);
        if (s.length > max) return { ok: false, error: `${field.key} too long` };
        if (field.type === "email" && !isEmail(s)) return { ok: false, error: `Invalid email` };
        if (field.type === "phone" && !isPhone(s)) return { ok: false, error: `Invalid phone` };
        val = s;
        break;
      }
      case "select": {
        if (typeof val !== "string") return { ok: false, error: `Invalid select for ${field.key}` };
        const s = val.trim();
        if (field.options && !field.options.includes(s)) {
          return { ok: false, error: `Invalid option for ${field.key}` };
        }
        val = s;
        break;
      }
      case "consent": {
        if (val !== true && val !== "true" && val !== 1) {
          return { ok: false, error: `Consent required: ${field.key}` };
        }
        val = true;
        break;
      }
      default:
        if (typeof val === "string") val = val.trim();
    }

    sanitized[field.key] = val;
  }

  if (byteLengthJson(sanitized) > MAX_FORM_DATA_BYTES) {
    return { ok: false, error: "form_data too large" };
  }

  return { ok: true, sanitized, honeypotTriggered: false };
}
