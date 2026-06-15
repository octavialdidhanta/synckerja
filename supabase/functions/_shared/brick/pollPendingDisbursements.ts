import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BrickEnv } from "./brickApi.ts";
import { getBrickDisbursementStatus } from "./brickApi.ts";
import {
  mapDisbursementStatusToParsed,
  processBrickDisbursementStatusUpdate,
} from "./webhooks/handleDisbursementCallback.ts";

export async function pollPendingBrickDisbursements(
  admin: SupabaseClient,
  env: BrickEnv,
  organizationId: string,
): Promise<{ polled: number; completed: number; errors: string[]; reconciled: { resetToPending: number; markedPaid: number } }> {
  const { data: pending, error } = await admin
    .from("brick_disbursements")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "processing"]);

  if (error) {
    return { polled: 0, completed: 0, errors: [error.message], reconciled: { resetToPending: 0, markedPaid: 0 } };
  }

  let polled = 0;
  let completed = 0;
  const errors: string[] = [];

  for (const row of pending ?? []) {
    const referenceId = row.reference_id ? String(row.reference_id) : "";
    const disbursementId = row.brick_disbursement_id ? String(row.brick_disbursement_id) : "";
    if (!referenceId && !disbursementId) continue;

    try {
      polled += 1;
      const status = await getBrickDisbursementStatus(env, {
        referenceId: referenceId || undefined,
        disbursementId: disbursementId || undefined,
      });
      const parsed = mapDisbursementStatusToParsed(status);
      const result = await processBrickDisbursementStatusUpdate(admin, parsed);
      if (result.completed) completed += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Disbursement poll failed";
      errors.push(`${referenceId || disbursementId}: ${message}`);
    }
  }

  const reconciled = await reconcileBrickPurchaseRequestPaymentStatus(admin, organizationId);

  return { polled, completed, errors, reconciled };
}

/** Fix purchase_requests stuck in processing after brick_disbursements already failed/completed. */
async function reconcileBrickPurchaseRequestPaymentStatus(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ resetToPending: number; markedPaid: number }> {
  let resetToPending = 0;
  let markedPaid = 0;

  const { data: stuckProcessing } = await admin
    .from("purchase_requests")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("payment_status", "processing")
    .is("paid_at", null);

  for (const pr of stuckProcessing ?? []) {
    const prId = String(pr.id);
    const { data: disbursements } = await admin
      .from("brick_disbursements")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("source_type", "purchase_request")
      .eq("source_id", prId);

    const statuses = (disbursements ?? []).map((d) => String(d.status));
    const hasActive = statuses.some((s) => s === "pending" || s === "processing");
    const hasCompleted = statuses.includes("completed");
    const hasFailed = statuses.includes("failed");

    if (hasCompleted && !hasActive) {
      const { error } = await admin.from("purchase_requests").update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", prId);
      if (!error) markedPaid += 1;
      continue;
    }

    if (hasFailed && !hasActive && !hasCompleted) {
      const { error } = await admin.from("purchase_requests").update({
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      }).eq("id", prId);
      if (!error) resetToPending += 1;
    }
  }

  return { resetToPending, markedPaid };
}
