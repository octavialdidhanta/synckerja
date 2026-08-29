import { supabase } from "@/shared/lib/supabaseClient";

export type PosRefundStoreCheckoutArgs = {
  activityId: string;
  reason?: string | null;
  shiftId?: string | null;
  reverseId?: string | null;
};

export type PosRefundStoreCheckoutResult = {
  ok: boolean;
  refund_id?: string;
  activity_id?: string;
  amount?: number;
  reverse_id?: string;
};

/** Soft-refund ledger RPC (income reverse + mark activity refunded). Stock reverse stays on client. */
export async function posRefundStoreCheckout(
  args: PosRefundStoreCheckoutArgs,
): Promise<PosRefundStoreCheckoutResult> {
  const { data, error } = await supabase.rpc("pos_refund_store_checkout", {
    p_activity_id: args.activityId,
    p_reason: args.reason ?? null,
    p_shift_id: args.shiftId ?? null,
    p_reverse_id: args.reverseId ?? null,
  });
  if (error) throw error;
  return (data ?? { ok: true }) as PosRefundStoreCheckoutResult;
}
