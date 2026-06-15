import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { xenditJson } from "../xenditAuth.ts";
import { normalizeXenditError } from "../xenditErrors.ts";
import {
  detectXenditEventType,
  extractXenditEventId,
  verifyXenditWebhookToken,
} from "./verifyWebhook.ts";
import { handleVaPaidWebhook } from "./handleVaPaid.ts";
import { handleDisbursementWebhook } from "./handleDisbursement.ts";
import { handleSplitPaymentWebhook } from "./handleSplitPayment.ts";

export function isXenditWebhookRequest(req: Request): boolean {
  const token = req.headers.get("x-callback-token") ?? req.headers.get("X-CALLBACK-TOKEN") ?? "";
  return token.trim().length > 0;
}

export async function processXenditWebhook(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  req: Request,
): Promise<Response> {
  if (!verifyXenditWebhookToken(req, env)) {
    return xenditJson({ error: "Invalid webhook token" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return xenditJson({ error: "Invalid JSON" }, 400);
  }

  const eventId = extractXenditEventId(payload);
  const eventType = detectXenditEventType(payload);

  const { data: existing } = await admin
    .from("xendit_webhook_events")
    .select("id, processed_at")
    .eq("xendit_event_id", eventId)
    .maybeSingle();
  if (existing?.processed_at) {
    return xenditJson({ ok: true, duplicate: true }, 200);
  }

  const { data: inserted, error: insErr } = await admin
    .from("xendit_webhook_events")
    .insert({ xendit_event_id: eventId, event_type: eventType, payload })
    .select("id")
    .single();
  if (insErr && !String(insErr.message).includes("duplicate")) {
    console.error("xendit-webhook insert:", insErr.message);
  }

  try {
    if (eventType === "split.payment") {
      await handleSplitPaymentWebhook(admin, payload);
    }
    if (eventType.startsWith("virtual_account") || payload.external_id && payload.amount) {
      const ext = String(payload.external_id ?? "");
      if (ext.startsWith("synckerja:") && ext.includes(":sap:")) {
        await handleVaPaidWebhook(admin, payload);
      }
    }
    if (eventType.startsWith("disbursement") || payload.disbursement_id) {
      await handleDisbursementWebhook(admin, env, payload);
    }

    const logId = inserted?.id ?? existing?.id;
    if (logId) {
      await admin.from("xendit_webhook_events").update({
        processed_at: new Date().toISOString(),
        error: null,
      }).eq("id", logId);
    }
    return xenditJson({ ok: true, event_type: eventType }, 200);
  } catch (err) {
    const message = normalizeXenditError(err);
    console.error("xendit-webhook process:", message);
    const logId = inserted?.id ?? existing?.id;
    if (logId) {
      await admin.from("xendit_webhook_events").update({
        processed_at: new Date().toISOString(),
        error: message,
      }).eq("id", logId);
    }
    return xenditJson({ error: message }, 500);
  }
}
