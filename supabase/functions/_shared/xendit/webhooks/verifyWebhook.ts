import type { XenditEnvConfig } from "../xenditEnv.ts";

export function verifyXenditWebhookToken(
  req: Request,
  env: XenditEnvConfig,
): boolean {
  if (env.skipWebhookVerify) return true;
  const token = env.webhookToken?.trim();
  if (!token) return false;
  const header = (req.headers.get("x-callback-token") ?? req.headers.get("X-CALLBACK-TOKEN") ?? "").trim();
  return header === token;
}

export function unwrapXenditWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...payload, ...(data as Record<string, unknown>) };
  }
  return payload;
}

export function extractXenditEventId(payload: Record<string, unknown>): string {
  const flat = unwrapXenditWebhookPayload(payload);
  const id = flat.id ?? payload.id ?? payload.event_id ?? payload.callback_authentication_token;
  if (id != null) return String(id);
  const ext = flat.external_id != null ? String(flat.external_id) : flat.reference_id != null ? String(flat.reference_id) : "";
  const status = flat.status != null ? String(flat.status) : "";
  return `${ext}:${status}:${JSON.stringify(payload).slice(0, 64)}`;
}

export function detectXenditEventType(payload: Record<string, unknown>): string {
  const event = String(payload.event ?? payload.type ?? "").trim().toLowerCase();
  if (event === "split.payment") return "split.payment";
  if (event === "qr.payment") return "qr.payment";
  if (payload.callback_virtual_account_id != null || payload.payment_id != null) {
    return "virtual_account.payment";
  }
  if (payload.disbursement_id != null || (payload.status && payload.external_id && payload.amount)) {
    const status = String(payload.status ?? "").toUpperCase();
    if (status) return `disbursement.${status.toLowerCase()}`;
  }
  return String(payload.event ?? payload.type ?? "unknown");
}
