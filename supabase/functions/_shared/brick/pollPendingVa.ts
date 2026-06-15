import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { BrickEnv, BrickCloseVaStatus } from "./brickApi.ts";
import { getBrickCloseVaStatus } from "./brickApi.ts";
import type { ParsedBrickVaCallback } from "./webhooks/parseBrickCallback.ts";
import { processBrickVaStatusUpdate } from "./webhooks/handleVaCallback.ts";

export function mapVaStatusToParsed(
  status: BrickCloseVaStatus,
  req?: Record<string, unknown>,
): ParsedBrickVaCallback {
  return {
    eventId: status.paymentId ?? status.id,
    status: status.status,
    amount: status.amount,
    referenceId: status.referenceId ?? (req?.reference_id ? String(req.reference_id) : null),
    paymentId: status.paymentId,
    vaId: status.id,
    bankShortCode: status.bankShortCode,
    accountNo: status.accountNo,
    createdAt: null,
    raw: status.raw,
  };
}

export async function pollPendingBrickVaRequests(
  admin: SupabaseClient,
  env: BrickEnv,
  organizationId: string,
): Promise<{ polled: number; settled: number; errors: string[] }> {
  const { data: pending, error } = await admin
    .from("brick_payment_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "paid"]);

  if (error) {
    return { polled: 0, settled: 0, errors: [error.message] };
  }

  let polled = 0;
  let settled = 0;
  const errors: string[] = [];

  for (const req of pending ?? []) {
    const vaId = req.brick_va_id ? String(req.brick_va_id) : "";
    if (!vaId) continue;

    try {
      polled += 1;
      const status = await getBrickCloseVaStatus(env, vaId);
      const parsed = mapVaStatusToParsed(status, req as Record<string, unknown>);
      const result = await processBrickVaStatusUpdate(admin, parsed);
      if (result.settled) settled += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : "VA poll failed";
      errors.push(`${vaId}: ${message}`);
    }
  }

  return { polled, settled, errors };
}
