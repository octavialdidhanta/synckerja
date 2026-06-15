import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BrickEnvConfig } from "../brickEnv.ts";
import { brickJson } from "../brickApi.ts";
import { parseBrickVaCallbackPayload } from "./parseBrickCallback.ts";
import { parseBrickDisbursementCallbackPayload } from "./parseBrickDisbursementCallback.ts";
import { isBrickWebhookRequest, verifyBrickWebhookSignature } from "./verifyWebhook.ts";
import { processBrickVaStatusUpdate } from "./handleVaCallback.ts";
import { processBrickDisbursementStatusUpdate } from "./handleDisbursementCallback.ts";

async function processWebhookEvent(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
  body: Record<string, unknown>,
  handler: () => Promise<Record<string, unknown>>,
): Promise<Response> {
  const { data: existing } = await admin
    .from("brick_webhook_events")
    .select("id, processed_at")
    .eq("brick_event_id", eventId)
    .maybeSingle();

  if (existing?.processed_at) {
    return brickJson({ ok: true, duplicate: true }, 200);
  }

  const { data: inserted, error: insErr } = await admin
    .from("brick_webhook_events")
    .insert({
      brick_event_id: eventId,
      event_type: eventType,
      payload: body,
    })
    .select("id")
    .single();

  if (insErr && !String(insErr.message).includes("duplicate")) {
    console.error("brick_webhook_events insert:", insErr.message);
  }

  try {
    const result = await handler();
    const logId = inserted?.id ?? existing?.id;
    if (logId) {
      await admin.from("brick_webhook_events").update({
        processed_at: new Date().toISOString(),
        error: null,
      }).eq("id", logId);
    }
    return brickJson({ ok: true, ...result }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook processing failed";
    console.error("brick-webhook:", message);
    const logId = inserted?.id ?? existing?.id;
    if (logId) {
      await admin.from("brick_webhook_events").update({
        processed_at: new Date().toISOString(),
        error: message,
      }).eq("id", logId);
    }
    return brickJson({ error: message }, 500);
  }
}

export async function processBrickWebhook(
  admin: SupabaseClient,
  env: BrickEnvConfig,
  req: Request,
  rawBody: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!env.skipWebhookVerify) {
    const valid = await verifyBrickWebhookSignature(req, rawBody, env);
    if (!valid) {
      return brickJson({ error: "Invalid webhook signature" }, 401);
    }
  }

  const disbursementParsed = parseBrickDisbursementCallbackPayload(body);
  if (disbursementParsed) {
    const eventId = `${disbursementParsed.eventId}-${disbursementParsed.status}`;
    return processWebhookEvent(
      admin,
      eventId,
      disbursementParsed.status,
      body,
      async () => {
        const result = await processBrickDisbursementStatusUpdate(admin, disbursementParsed);
        return { ...result, status: disbursementParsed.status, kind: "disbursement" };
      },
    );
  }

  const parsed = parseBrickVaCallbackPayload(body);
  if (!parsed) {
    return brickJson({ error: "Unrecognized Brick callback payload" }, 400);
  }

  const eventId = `${parsed.eventId}-${parsed.status}`;
  return processWebhookEvent(
    admin,
    eventId,
    parsed.status,
    body,
    async () => {
      const result = await processBrickVaStatusUpdate(admin, parsed);
      return { ...result, status: parsed.status, kind: "va" };
    },
  );
}

export function shouldHandleAsBrickWebhook(req: Request, body: Record<string, unknown>): boolean {
  return isBrickWebhookRequest(req, body);
}
