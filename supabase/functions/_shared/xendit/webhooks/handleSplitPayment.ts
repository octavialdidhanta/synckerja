import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeSplitStatus(status: unknown): "completed" | "failed" | null {
  const value = String(status ?? "").trim().toUpperCase();
  if (value === "COMPLETED" || value === "SUCCEEDED" || value === "SUCCESS") return "completed";
  if (value === "FAILED" || value === "FAILURE") return "failed";
  return null;
}

export async function handleSplitPaymentWebhook(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const data = (payload.data && typeof payload.data === "object"
    ? payload.data
    : payload) as Record<string, unknown>;

  const paymentId = data.payment_id != null ? String(data.payment_id).trim() : "";
  const splitPaymentId = data.id != null ? String(data.id).trim() : "";
  const status = normalizeSplitStatus(data.status);
  if (!paymentId || !status) return;

  const { data: req } = await admin
    .from("xendit_payment_requests")
    .select("id, platform_fee_status")
    .eq("xendit_payment_id", paymentId)
    .maybeSingle();

  if (!req?.id) {
    console.info(`xendit split.payment: no payment request for payment_id ${paymentId}`);
    return;
  }

  if (req.platform_fee_status === "completed" || req.platform_fee_status === "not_applicable") {
    return;
  }

  const { error } = await admin
    .from("xendit_payment_requests")
    .update({
      platform_fee_status: status,
      platform_fee_split_payment_id: splitPaymentId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);

  if (error) throw new Error(error.message);
}
