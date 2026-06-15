import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBrickDisbursementStatus, readBrickEnv } from "../../_shared/brick/brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import {
  mapDisbursementStatusToParsed,
  processBrickDisbursementStatusUpdate,
} from "../../_shared/brick/webhooks/handleDisbursementCallback.ts";
import { pollPendingBrickDisbursements } from "../../_shared/brick/pollPendingDisbursements.ts";

export async function handleBrickGetDisbursementStatus(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const brickDisbursementId = body.brickDisbursementId ? String(body.brickDisbursementId) : "";
  const referenceId = body.referenceId ? String(body.referenceId) : "";
  const processUpdate = Boolean(body.processUpdate);

  const env = readBrickEnv();
  if (!env) {
    return brickJson({ error: "Brick is not configured" }, 503);
  }

  let row: Record<string, unknown> | null = null;
  if (brickDisbursementId) {
    const { data } = await admin
      .from("brick_disbursements")
      .select("*")
      .eq("id", brickDisbursementId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    row = data ?? null;
  } else if (referenceId) {
    const { data } = await admin
      .from("brick_disbursements")
      .select("*")
      .eq("reference_id", referenceId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    row = data ?? null;
  }

  if (!row) {
    return brickJson({ error: "Brick disbursement not found" }, 404);
  }

  const apiReferenceId = String(row.reference_id ?? referenceId);
  const apiDisbursementId = row.brick_disbursement_id ? String(row.brick_disbursement_id) : "";

  try {
    const status = await getBrickDisbursementStatus(env, {
      referenceId: apiReferenceId,
      disbursementId: apiDisbursementId || undefined,
    });

    let processed: { ok: boolean; completed: boolean } | undefined;
    if (processUpdate) {
      const parsed = mapDisbursementStatusToParsed(status);
      processed = await processBrickDisbursementStatusUpdate(admin, parsed);
    }

    const { data: refreshed } = await admin
      .from("brick_disbursements")
      .select("*")
      .eq("id", row.id)
      .maybeSingle();

    return brickJson({
      ok: true,
      status: status.status,
      disbursement: refreshed ?? row,
      processed,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Status check failed";
    return brickJson({
      ok: false,
      error: message,
      disbursement: row,
    }, 200);
  }
}

export async function handleBrickPollOrgDisbursements(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ polled: number; completed: number; errors: string[] }> {
  const env = readBrickEnv();
  if (!env) return { polled: 0, completed: 0, errors: ["Brick not configured"] };

  return pollPendingBrickDisbursements(admin, env, organizationId);
}
