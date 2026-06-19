import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import { normalizeXenditError } from "../xenditErrors.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { isInternalXenditOrg } from "../internalOrg.ts";
import { ensureGatewayPayoutBankAccount } from "./gatewayPayoutBankAccount.ts";
import { getOrgKycDocument, orgHasUsableKyc } from "./kycDocuments.ts";
import {
  assertSubAccountEmailAvailable,
  getOrgXenditSettings,
  listOrgSubAccounts,
  SUB_ACCOUNT_EMAIL_EXISTS_CODE,
  type XenditSubAccountRow,
} from "./resolveSubAccount.ts";
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

export function mapXenditAccountStatus(status: string | undefined): string {
  const apiStatus = String(status ?? "").trim().toUpperCase();
  if (apiStatus === "LIVE" || apiStatus === "REGISTERED" || apiStatus === "ACTIVE") return "active";
  if (apiStatus === "SUSPENDED") return "suspended";
  if (apiStatus === "FAILED") return "failed";
  return "pending";
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
    document_upload_status?: string;
    skip_kyc_gate?: boolean;
  },
): Promise<{ subAccountId: string; row: Record<string, unknown> }> {
  const businessName = input.business_name.trim();
  const email = normalizeEmail(input.email);
  const isInternal = isInternalXenditOrg(organizationId);
  const accountType = isInternal
    ? "OWNED"
    : (input.type?.trim() || "MANAGED").toUpperCase() === "OWNED"
    ? "MANAGED"
    : "MANAGED";
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

  const settings = await getOrgXenditSettings(admin, organizationId);
  if (!settings?.is_enabled) {
    throw new Error("Xendit not enabled for this organization");
  }

  if (!isInternal && !input.skip_kyc_gate) {
    const kyc = await getOrgKycDocument(admin, organizationId);
    if (!orgHasUsableKyc(kyc)) {
      throw new Error("Data KYC organisasi belum tersedia. Lengkapi legalitas terlebih dahulu.");
    }
  }

  await assertSubAccountEmailAvailable(admin, organizationId, email);

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
  }).catch((err: unknown) => {
    const msg = normalizeXenditError(err).toLowerCase();
    if (
      msg.includes("email") &&
      (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists") || msg.includes("taken"))
    ) {
      throw new Error(SUB_ACCOUNT_EMAIL_EXISTS_CODE);
    }
    throw err;
  });

  const subAccountId = String(apiRes.user_id ?? apiRes.id ?? "").trim();
  if (!subAccountId) throw new Error("xendit_api: missing sub-account id in response");

  const mappedStatus = mapXenditAccountStatus(apiRes.status);
  const existingRows = await listOrgSubAccounts(admin, organizationId);
  const isPrimary = existingRows.length === 0;

  const docStatus = input.document_upload_status?.trim() ||
    (isInternal ? "not_required" : "pending");

  const payload = {
    organization_id: organizationId,
    xendit_sub_account_id: subAccountId,
    business_name: businessName,
    email,
    account_type: accountType,
    status: mappedStatus,
    linked_bank_account_id: linkedBankAccountId,
    is_primary: isPrimary,
    document_upload_status: docStatus,
    metadata: {
      create_account_response: apiRes,
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505" || String(error.message).includes("xendit_sub_accounts_org_email_key")) {
      throw new Error(SUB_ACCOUNT_EMAIL_EXISTS_CODE);
    }
    throw new Error(error.message);
  }

  return { subAccountId, row: data as Record<string, unknown> };
}

/** @deprecated Use resolvePrimarySubAccount from resolveSubAccount.ts */
export async function resolveOrgSubAccount(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
): Promise<{ subAccountId: string; accountRow: Record<string, unknown> }> {
  const { resolvePrimarySubAccount } = await import("./resolveSubAccount.ts");
  const result = await resolvePrimarySubAccount(admin, env, organizationId);
  return { subAccountId: result.subAccountId, accountRow: result.accountRow };
}

export async function setPrimarySubAccount(
  admin: SupabaseClient,
  organizationId: string,
  subAccountRowId: string,
): Promise<XenditSubAccountRow> {
  const { data: target, error: targetErr } = await admin
    .from("xendit_sub_accounts")
    .select("*")
    .eq("id", subAccountRowId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (targetErr) throw new Error(targetErr.message);
  if (!target) throw new Error("Akun tidak ditemukan");

  await admin
    .from("xendit_sub_accounts")
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);

  const { data, error } = await admin
    .from("xendit_sub_accounts")
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq("id", subAccountRowId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as XenditSubAccountRow;
}
