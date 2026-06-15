import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import { encodeXenditExternalId } from "../xenditExternalId.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { resolveOrgSubAccount } from "./createSubAccount.ts";
import { requirePlatformSplitRule } from "./createSplitRule.ts";

type CreateVaResponse = {
  id?: string;
  external_id?: string;
  account_number?: string;
  bank_code?: string;
  expiration_date?: string;
  status?: string;
};

export async function createTenantInvoiceVA(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  input: {
    sales_activity_payment_id: string;
    bank_code: string;
    name?: string;
  },
): Promise<Record<string, unknown>> {
  const sapId = input.sales_activity_payment_id.trim();
  const bankCode = input.bank_code.trim().toUpperCase();
  if (!sapId || !bankCode) throw new Error("Missing sales_activity_payment_id or bank_code");

  const { data: acct } = await admin
    .from("organization_xendit_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!acct?.is_enabled) throw new Error("Xendit not enabled for this organization");

  const { subAccountId } = await resolveOrgSubAccount(admin, env, organizationId);

  const { data: sap, error: sapErr } = await admin
    .from("sales_activity_payments")
    .select("id, organization_id, payment_amount, sales_activity_id, transfer_verification_status")
    .eq("id", sapId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (sapErr) throw new Error(sapErr.message);
  if (!sap) throw new Error("Sales activity payment not found");
  if (sap.transfer_verification_status === "approved") {
    throw new Error("Payment already verified/paid");
  }

  const { data: activeVa } = await admin
    .from("xendit_payment_requests")
    .select("id")
    .eq("sales_activity_payment_id", sapId)
    .eq("status", "pending")
    .maybeSingle();
  if (activeVa?.id) throw new Error("Active VA already exists for this payment");

  const { data: sa } = await admin
    .from("sales_activities")
    .select("client_name")
    .eq("id", sap.sales_activity_id)
    .maybeSingle();

  const { splitRuleId, flatFeeAmount } = await requirePlatformSplitRule(admin, env);
  const grossAmount = Math.floor(Number(sap.payment_amount));
  if (flatFeeAmount > 0 && grossAmount <= flatFeeAmount) {
    throw new Error(
      `Payment amount must be greater than platform fee (Rp ${flatFeeAmount.toLocaleString("id-ID")})`,
    );
  }

  const externalId = encodeXenditExternalId("sap", organizationId, sapId);
  const expirationDays = await getVaExpirationDays(admin);
  const expiresAt = new Date(Date.now() + expirationDays * 86_400_000);

  const vaBody: Record<string, unknown> = {
    external_id: externalId,
    bank_code: bankCode,
    name: (input.name?.trim() || sa?.client_name || "Customer").slice(0, 100),
    is_closed: true,
    expected_amount: grossAmount,
    expiration_date: expiresAt.toISOString(),
  };
  // BCA (and several ID banks) reject `description` on closed VA — track via external_id only.

  const vaRes = await xenditRequest<CreateVaResponse>(env.secretKey, {
    method: "POST",
    path: "/callback_virtual_accounts",
    forUserId: subAccountId,
    withSplitRule: flatFeeAmount > 0 ? splitRuleId : null,
    idempotencyKey: externalId,
    body: vaBody,
  });

  const platformFeeStatus = flatFeeAmount > 0 ? "pending" : "not_applicable";

  const { data: row, error: insErr } = await admin
    .from("xendit_payment_requests")
    .insert({
      organization_id: organizationId,
      sales_activity_payment_id: sapId,
      sub_account_id: subAccountId,
      external_id: externalId,
      xendit_va_id: vaRes.id != null ? String(vaRes.id) : null,
      bank_code: bankCode,
      account_number: vaRes.account_number != null ? String(vaRes.account_number) : null,
      expected_amount: sap.payment_amount,
      platform_fee_amount: flatFeeAmount,
      split_rule_id: flatFeeAmount > 0 ? splitRuleId : null,
      platform_fee_status: platformFeeStatus,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      raw_response: vaRes,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  return row as Record<string, unknown>;
}

async function getVaExpirationDays(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.from("xendit_platform_config").select("va_expiration_days").eq("id", 1).maybeSingle();
  const days = Number(data?.va_expiration_days);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : 3;
}
