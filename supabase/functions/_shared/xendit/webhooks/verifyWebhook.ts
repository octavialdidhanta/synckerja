import type { XenditEnvConfig } from "../xenditEnv.ts";

export function verifyXenditWebhookToken(
  req: Request,
  env: XenditEnvConfig,
): boolean {
  if (env.skipWebhookVerify) return true;
  const token = env.webhookToken;
  if (!token) return false;
  const header = req.headers.get("x-callback-token") ?? req.headers.get("X-CALLBACK-TOKEN") ?? "";
  return header === token;
}

export function extractXenditEventId(payload: Record<string, unknown>): string {
  const id = payload.id ?? payload.event_id ?? payload.callback_authentication_token;
  if (id != null) return String(id);
  const ext = payload.external_id != null ? String(payload.external_id) : "";
  const status = payload.status != null ? String(payload.status) : "";
  return `${ext}:${status}:${JSON.stringify(payload).slice(0, 64)}`;
}

export function detectXenditEventType(payload: Record<string, unknown>): string {
  const event = String(payload.event ?? payload.type ?? "").trim().toLowerCase();
  if (event === "split.payment") return "split.payment";
  if (payload.callback_virtual_account_id != null || payload.payment_id != null) {
    return "virtual_account.payment";
  }
  if (payload.disbursement_id != null || (payload.status && payload.external_id && payload.amount)) {
    const status = String(payload.status ?? "").toUpperCase();
    if (status) return `disbursement.${status.toLowerCase()}`;
  }
  return String(payload.event ?? payload.type ?? "unknown");
}
