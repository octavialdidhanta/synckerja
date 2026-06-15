import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncOrgBrickWalletBalance } from "../../brick-bank-api/handlers/getBalance.ts";
import { readBrickEnv } from "../brick/brickApi.ts";
import { syncOrgXenditWalletBalance } from "../xendit/services/getBalance.ts";
import { readXenditEnv } from "../xendit/xenditEnv.ts";

export async function finalizePurchaseRequestGatewayPayment(
  admin: SupabaseClient,
  purchaseRequestId: string,
): Promise<{ ok: boolean; expenseId?: string; skipped?: boolean; reason?: string }> {
  const { data, error } = await admin.rpc("finalize_purchase_request_gateway_payment", {
    p_purchase_request_id: purchaseRequestId,
  });
  if (error) {
    if (error.message.includes("not_gateway_payment")) {
      return { ok: true, skipped: true, reason: "not_gateway_payment" };
    }
    throw error;
  }

  const result = data as {
    ok?: boolean;
    expense_id?: string;
    organization_id?: string;
    gateway_wallet_provider?: string;
    skipped?: boolean;
    reason?: string;
  };

  if (result.skipped) {
    return { ok: true, skipped: true, reason: result.reason };
  }

  const organizationId = String(result.organization_id ?? "");
  const provider = String(result.gateway_wallet_provider ?? "");

  if (organizationId && provider === "xendit") {
    const env = readXenditEnv();
    if (env) {
      try {
        await syncOrgXenditWalletBalance(admin, organizationId, env);
      } catch (e) {
        console.error("syncOrgXenditWalletBalance after finalize:", e);
      }
    }
  }

  if (organizationId && provider === "brick") {
    const env = readBrickEnv();
    if (env) {
      try {
        await syncOrgBrickWalletBalance(admin, organizationId, env);
      } catch (e) {
        console.error("syncOrgBrickWalletBalance after finalize:", e);
      }
    }
  }

  return {
    ok: true,
    expenseId: result.expense_id ? String(result.expense_id) : undefined,
  };
}
