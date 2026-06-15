import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeXenditExternalId } from "../xenditExternalId.ts";

export async function handleVaPaidWebhook(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const externalId = String(payload.external_id ?? "").trim();
  if (!externalId) throw new Error("Missing external_id in VA webhook");

  const { data: req } = await admin
    .from("xendit_payment_requests")
    .select("id, status")
    .eq("external_id", externalId)
    .maybeSingle();
  if (!req?.id) throw new Error(`No payment request for external_id ${externalId}`);
  if (req.status === "paid") return;

  const paymentId = payload.payment_id != null ? String(payload.payment_id) : null;
  const { error } = await admin.rpc("apply_xendit_va_settlement", {
    p_payment_request_id: req.id,
    p_xendit_payment_id: paymentId,
  });
  if (error) throw new Error(error.message);
}

export async function tryHandleVaPaidByExternalId(
  admin: SupabaseClient,
  externalId: string,
  paymentId: string | null,
): Promise<boolean> {
  const decoded = decodeXenditExternalId(externalId);
  if (!decoded || decoded.kind !== "sap") return false;
  await handleVaPaidWebhook(admin, { external_id: externalId, payment_id: paymentId });
  return true;
}
