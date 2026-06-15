import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBrickCloseVaStatus, readBrickEnv } from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import { mapVaStatusToParsed, pollPendingBrickVaRequests } from "../../_shared/brick/pollPendingVa.ts";
import { processBrickVaStatusUpdate } from "../../_shared/brick/webhooks/handleVaCallback.ts";

export async function handleBrickGetVaStatus(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const brickPaymentRequestId = body.brickPaymentRequestId
    ? String(body.brickPaymentRequestId)
    : null;
  const vaId = body.vaId ? String(body.vaId) : null;
  const processUpdate = body.processUpdate === true;

  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET.",
    }, 503);
  }

  let req: Record<string, unknown> | null = null;

  if (brickPaymentRequestId) {
    const { data, error } = await admin
      .from("brick_payment_requests")
      .select("*")
      .eq("id", brickPaymentRequestId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return brickJson({ error: error.message }, 500);
    req = data ?? null;
  } else if (body.sales_activity_payment_id) {
    const sapId = String(body.sales_activity_payment_id);
    const { data, error } = await admin
      .from("brick_payment_requests")
      .select("*")
      .eq("sales_activity_payment_id", sapId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return brickJson({ error: error.message }, 500);
    req = data ?? null;
  }

  const resolvedVaId = vaId ?? (req?.brick_va_id ? String(req.brick_va_id) : null);
  if (!resolvedVaId) {
    return brickJson({ error: "vaId or brick_payment_request not found" }, 404);
  }

  try {
    const status = await getBrickCloseVaStatus(env, resolvedVaId);
    let processed: Record<string, unknown> | null = null;

    if (processUpdate) {
      const parsed = mapVaStatusToParsed(status, req ?? undefined);
      processed = await processBrickVaStatusUpdate(admin, parsed);
    }

    return brickJson({
      ok: true,
      status: status.status,
      va: req,
      brickStatus: status,
      processed,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to get VA status";
    return brickJson({ error: message }, 502);
  }
}

export async function handleBrickPollOrgVa(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ polled: number; settled: number; errors: string[] }> {
  const env = readBrickEnv();
  if (!env) return { polled: 0, settled: 0, errors: ["Brick not configured"] };
  return await pollPendingBrickVaRequests(admin, env, organizationId);
}
