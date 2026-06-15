import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { ensureGatewayPayoutBankAccount } from "./gatewayPayoutBankAccount.ts";
import { reconcileOrgXenditSubAccount } from "./reconcileSubAccount.ts";
import { validateGatewayPayoutBank } from "./validateGatewayPayoutBank.ts";

type CreateAccountResponse = {
  id?: string;
  user_id?: string;
  status?: string;
};

function isValidEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  if (normalized.endsWith(".local")) return false;
  if (normalized.endsWith("@example.com") || normalized.endsWith("@test.com")) return false;
  return true;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function createTenantSubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  input: {
    business_name: string;
    email: string;
    type?: string;
    linked_bank_account_id?: string | null;
    payout_bank_code?: string;
    payout_account_number?: string;
    payout_account_holder_name?: string;
  },
): Promise<{ subAccountId: string; row: Record<string, unknown> }> {
  const businessName = input.business_name.trim();
  const email = normalizeEmail(input.email);
  const accountType = (input.type?.trim() || "OWNED").toUpperCase();
  const payoutBankCode = String(input.payout_bank_code ?? "").trim();
  const payoutAccountNumber = String(input.payout_account_number ?? "").trim();
  const payoutAccountHolder = String(input.payout_account_holder_name ?? "").trim();

  if (!businessName || !email) {
    throw new Error("Missing business_name or email");
  }
  if (!isValidEmail(email)) {
    throw new Error("email must be a valid email");
  }
  if (!payoutBankCode || !payoutAccountNumber || !payoutAccountHolder) {
    throw new Error("Missing payout bank details");
  }

  const { data: existingRow, error: existingErr } = await admin
    .from("organization_xendit_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);

  let existing = (existingRow as Record<string, unknown> | null) ?? null;
  if (existing?.xendit_sub_account_id) {
    existing = await reconcileOrgXenditSubAccount(admin, env, organizationId, existing);
  }
  if (existing?.xendit_sub_account_id) {
    return {
      subAccountId: String(existing.xendit_sub_account_id),
      row: existing,
    };
  }

  const linkedBankAccountId = await ensureGatewayPayoutBankAccount(admin, organizationId, {
    linkedBankAccountId: input.linked_bank_account_id
      ? String(input.linked_bank_account_id).trim()
      : null,
    payoutBankCode,
    payoutAccountNumber,
    payoutAccountHolder,
    businessName,
  });

  await validateGatewayPayoutBank(admin, organizationId, userId, {
    bankAccountId: linkedBankAccountId,
    bankCode: payoutBankCode,
    accountNumber: payoutAccountNumber,
    accountHolder: payoutAccountHolder,
    enablePayout: true,
  });

  const apiRes = await xenditRequest<CreateAccountResponse>(env.secretKey, {
    method: "POST",
    path: "/v2/accounts",
    body: {
      email,
      type: accountType,
      public_profile: { business_name: businessName },
    },
  });

  const subAccountId = String(apiRes.user_id ?? apiRes.id ?? "").trim();
  if (!subAccountId) throw new Error("xendit_api: missing sub-account id in response");

  const apiStatus = String(apiRes.status ?? "").trim().toUpperCase();
  const mappedStatus =
    apiStatus === "LIVE" || apiStatus === "REGISTERED" || apiStatus === "ACTIVE"
      ? "active"
      : apiStatus === "SUSPENDED"
      ? "suspended"
      : apiStatus === "FAILED"
      ? "failed"
      : "pending";
  const payload = {
    organization_id: organizationId,
    xendit_sub_account_id: subAccountId,
    business_name: businessName,
    email,
    account_type: accountType,
    status: mappedStatus,
    linked_bank_account_id: linkedBankAccountId,
    metadata: {
      ...(existing?.metadata as Record<string, unknown> | undefined),
      create_account_response: apiRes,
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("organization_xendit_accounts")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return { subAccountId, row: data as Record<string, unknown> };
}

export async function resolveOrgSubAccount(
  admin: SupabaseClient,
  _env: XenditEnvConfig,
  organizationId: string,
): Promise<{ subAccountId: string; accountRow: Record<string, unknown> }> {
  const { data: existing, error } = await admin
    .from("organization_xendit_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.xendit_sub_account_id) {
    return {
      subAccountId: String(existing.xendit_sub_account_id),
      accountRow: existing as Record<string, unknown>,
    };
  }
  throw new Error(
    "Xendit sub-account belum dibuat. Buat sub-account di halaman Perbankan Xendit terlebih dahulu.",
  );
}
