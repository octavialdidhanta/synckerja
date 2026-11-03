// Pure request parsing and helpers for whatsapp-embedded-signup (testable in Node).

export type ConnectMode = "coexistence" | "cloud_api";

export type SignupRequest =
  | {
    action: "connect";
    organizationId: string;
    code: string;
    wabaId: string;
    phoneNumberId: string | null;
    mode: ConnectMode;
  }
  | {
    action: "retry_sync";
    organizationId: string;
    phoneNumberId: string;
  };

export type MetaPhoneNumber = {
  id: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
  name_status?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const META_ID = /^\d{5,30}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export function parseSignupRequest(raw: unknown): { ok: true; value: SignupRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_input" };
  const body = raw as Record<string, unknown>;
  const organizationId = text(body.organization_id);
  if (!UUID.test(organizationId)) return { ok: false, error: "invalid_input: organization_id" };
  const action = text(body.action) || "connect";

  if (action === "retry_sync") {
    const phoneNumberId = text(body.phone_number_id);
    if (!META_ID.test(phoneNumberId)) return { ok: false, error: "invalid_input: phone_number_id" };
    return { ok: true, value: { action, organizationId, phoneNumberId } };
  }
  if (action !== "connect") return { ok: false, error: "invalid_input: action" };

  const code = text(body.code);
  if (!code || code.length > 2048) return { ok: false, error: "invalid_input: code" };
  const wabaId = text(body.waba_id);
  if (!META_ID.test(wabaId)) return { ok: false, error: "invalid_input: waba_id" };
  const phoneRaw = text(body.phone_number_id);
  if (phoneRaw && !META_ID.test(phoneRaw)) return { ok: false, error: "invalid_input: phone_number_id" };
  const modeRaw = text(body.mode) || "coexistence";
  if (modeRaw !== "coexistence" && modeRaw !== "cloud_api") return { ok: false, error: "invalid_input: mode" };

  return {
    ok: true,
    value: { action: "connect", organizationId, code, wabaId, phoneNumberId: phoneRaw || null, mode: modeRaw },
  };
}

/**
 * Numbers to save. The coexistence finish event carries only the WABA id, so when no
 * phone_number_id is given every number on the WABA is saved.
 */
export function pickPhoneNumbers(numbers: MetaPhoneNumber[], phoneNumberId: string | null): MetaPhoneNumber[] {
  const valid = numbers.filter((n) => n && META_ID.test(String(n.id ?? "")));
  if (phoneNumberId) return valid.filter((n) => String(n.id) === phoneNumberId);
  return valid;
}

/** Six-digit two-step verification PIN for registering a Cloud API number. */
export function randomPin(randomBytes: (n: number) => Uint8Array = secureBytes): string {
  // Rejection sampling keeps every digit equally likely.
  let pin = "";
  while (pin.length < 6) {
    for (const byte of randomBytes(12)) {
      if (byte < 250 && pin.length < 6) pin += String(byte % 10);
    }
  }
  return pin;
}

function secureBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}
