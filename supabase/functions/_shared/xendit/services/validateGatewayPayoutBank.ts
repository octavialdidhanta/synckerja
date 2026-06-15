import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readIlumaEnv } from "../../iluma/ilumaEnv.ts";
import {
  extractValidatedHolderName,
  type IlumaBankValidationResult,
  validateBankAccountWithPoll,
} from "../../iluma/validateBankAccount.ts";
import {
  mapToIlumaBankCode,
  normalizeAccountHolder,
  normalizeBankAccountNumber,
} from "../../iluma/ilumaBankCodes.ts";

export type GatewayPayoutValidationStatus =
  | "none"
  | "pending"
  | "match"
  | "not_match"
  | "unclear"
  | "failed"
  | "error"
  | "stale";

export function buildFingerprintPayload(
  bankCode: string,
  accountNumber: string,
  accountHolder: string,
): string {
  return [
    bankCode.trim().toLowerCase(),
    normalizeBankAccountNumber(accountNumber),
    normalizeAccountHolder(accountHolder),
  ].join("|");
}

export async function hashGatewayPayoutFingerprint(
  bankCode: string,
  accountNumber: string,
  accountHolder: string,
): Promise<string> {
  const payload = buildFingerprintPayload(
    mapToIlumaBankCode(bankCode),
    accountNumber,
    accountHolder,
  );
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function computeGatewayPayoutFingerprint(
  bankCode: string,
  accountNumber: string,
  accountHolder: string,
): string {
  return buildFingerprintPayload(
    mapToIlumaBankCode(bankCode),
    accountNumber,
    accountHolder,
  );
}

export function mapIlumaToValidationStatus(
  result: IlumaBankValidationResult,
): GatewayPayoutValidationStatus {
  if (result.status === "FAILED") return "failed";
  if (result.status === "PENDING") return "pending";
  if (result.is_normal_account === false) return "failed";
  const match = result.name_matching_result;
  if (match === "MATCH") return "match";
  if (match === "UNCLEAR") return "unclear";
  if (match === "NOT_MATCH") return "not_match";
  return "error";
}

export async function assertGatewayPayoutValidated(
  bank: Record<string, unknown>,
): Promise<void> {
  const status = String(bank.gateway_payout_validation_status ?? "none");
  if (status !== "match") {
    throw new Error(
      `Gateway payout bank is not validated (status: ${status}). Re-validate the bank account before withdrawing.`,
    );
  }
  if (bank.gateway_payout_is_normal_account !== true) {
    throw new Error("Gateway payout bank is not a normal bank account (virtual accounts are not allowed).");
  }
  const bankCode = String(bank.gateway_payout_bank_code ?? bank.bank_name ?? "");
  const accountNumber = String(bank.account_number ?? "");
  const accountHolder = String(bank.account_holder ?? "");
  const expectedFp = await hashGatewayPayoutFingerprint(bankCode, accountNumber, accountHolder);
  const storedFp = String(bank.gateway_payout_validation_fingerprint ?? "");
  if (!storedFp || storedFp !== expectedFp) {
    throw new Error("Gateway payout bank details changed since last validation. Please re-validate.");
  }
}

async function insertAuditRow(
  admin: SupabaseClient,
  params: {
    organizationId: string;
    bankAccountId: string;
    ilumaRequestId: string | null;
    bankCode: string;
    accountNumber: string;
    givenName: string;
    status: string;
    nameMatchingResult: string | null;
    failureReason: string | null;
    isNormalAccount: boolean | null;
    rawResponse: Record<string, unknown>;
    initiatedBy: string | null;
    completedAt: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("gateway_payout_bank_validations").insert({
    organization_id: params.organizationId,
    bank_account_id: params.bankAccountId,
    iluma_request_id: params.ilumaRequestId,
    bank_code: params.bankCode,
    account_number: params.accountNumber,
    given_name: params.givenName,
    status: params.status,
    name_matching_result: params.nameMatchingResult,
    failure_reason: params.failureReason,
    is_normal_account: params.isNormalAccount,
    raw_response: params.rawResponse,
    initiated_by: params.initiatedBy,
    completed_at: params.completedAt,
  });
  if (error) console.error("gateway_payout_bank_validations insert:", error.message);
}

export async function applyValidationResultToBankAccount(
  admin: SupabaseClient,
  bankAccountId: string,
  organizationId: string,
  bankCode: string,
  accountNumber: string,
  accountHolder: string,
  result: IlumaBankValidationResult,
  initiatedBy: string | null,
  options?: { enablePayout?: boolean },
): Promise<{
  validationStatus: GatewayPayoutValidationStatus;
  validatedHolder: string | null;
  ilumaRequestId: string;
}> {
  const validationStatus = mapIlumaToValidationStatus(result);
  const validatedHolder = extractValidatedHolderName(result);
  const ilumaBankCode = mapToIlumaBankCode(bankCode);
  const normalizedNumber = normalizeBankAccountNumber(accountNumber) || accountNumber.trim();
  const normalizedHolder = normalizeAccountHolder(accountHolder);
  const fingerprint = validationStatus === "match"
    ? await hashGatewayPayoutFingerprint(ilumaBankCode, normalizedNumber, normalizedHolder)
    : null;
  const now = new Date().toISOString();
  const errorMessage = validationStatus === "match"
    ? null
    : result.failure_reason
    ?? (validationStatus === "unclear"
      ? "Account holder name is unclear — does not meet MATCH threshold"
      : validationStatus === "not_match"
      ? "Account holder name does not match bank records"
      : validationStatus === "failed"
      ? "Bank account not found or validation failed"
      : validationStatus === "pending"
      ? "Validation still pending"
      : "Bank validation error");

  const updatePayload: Record<string, unknown> = {
    gateway_payout_bank_code: ilumaBankCode,
    account_number: normalizedNumber,
    account_holder: normalizedHolder,
    gateway_payout_validation_status: validationStatus,
    gateway_payout_validated_holder: validatedHolder,
    gateway_payout_validation_id: result.id,
    gateway_payout_validated_at: validationStatus === "match" ? now : null,
    gateway_payout_validation_fingerprint: fingerprint,
    gateway_payout_is_normal_account: result.is_normal_account,
    gateway_payout_validation_error: errorMessage,
    updated_at: now,
  };

  if (options?.enablePayout === true && validationStatus === "match") {
    await admin
      .from("bank_accounts")
      .update({ use_for_gateway_payout: false })
      .eq("organization_id", organizationId);
    updatePayload.use_for_gateway_payout = true;
  }

  const { error: updErr } = await admin
    .from("bank_accounts")
    .update(updatePayload)
    .eq("id", bankAccountId)
    .eq("organization_id", organizationId);
  if (updErr) throw new Error(updErr.message);

  await insertAuditRow(admin, {
    organizationId,
    bankAccountId,
    ilumaRequestId: result.id,
    bankCode: mapToIlumaBankCode(bankCode),
    accountNumber: normalizeBankAccountNumber(accountNumber),
    givenName: normalizeAccountHolder(accountHolder),
    status: result.status,
    nameMatchingResult: result.name_matching_result ?? null,
    failureReason: result.failure_reason ?? errorMessage,
    isNormalAccount: result.is_normal_account ?? null,
    rawResponse: result.raw,
    initiatedBy,
    completedAt: result.status !== "PENDING" ? now : null,
  });

  return {
    validationStatus,
    validatedHolder,
    ilumaRequestId: result.id,
  };
}

export async function validateGatewayPayoutBank(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  input: {
    bankAccountId?: string | null;
    bankCode?: string;
    accountNumber?: string;
    accountHolder?: string;
    enablePayout?: boolean;
  },
): Promise<Record<string, unknown>> {
  const ilumaEnv = readIlumaEnv();
  if (!ilumaEnv) {
    throw new Error(
      "Iluma is not configured. Set ILUMA_API_KEY (or ILUMA_USE_MOCK=true for sandbox QA).",
    );
  }

  let bankAccountId = input.bankAccountId?.trim() ?? "";
  let bankCode = input.bankCode?.trim() ?? "";
  let accountNumber = input.accountNumber?.trim() ?? "";
  let accountHolder = input.accountHolder?.trim() ?? "";

  if (bankAccountId) {
    const { data: row, error } = await admin
      .from("bank_accounts")
      .select("*")
      .eq("id", bankAccountId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Bank account not found");
    bankCode = bankCode || String(row.gateway_payout_bank_code ?? row.bank_name ?? "");
    accountNumber = accountNumber || String(row.account_number ?? "");
    accountHolder = accountHolder || String(row.account_holder ?? "");
  } else {
    const { data: payoutRow } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("use_for_gateway_payout", true)
      .maybeSingle();
    if (payoutRow?.id) bankAccountId = String(payoutRow.id);
  }

  if (!bankCode || !accountNumber || !accountHolder) {
    throw new Error("Missing bank code, account number, or account holder");
  }

  if (!bankAccountId) {
    const { data: created, error: insErr } = await admin
      .from("bank_accounts")
      .insert({
        organization_id: organizationId,
        name: "Gateway payout (pending validation)",
        bank_name: mapToIlumaBankCode(bankCode),
        account_number: accountNumber,
        account_holder: accountHolder,
        gateway_payout_bank_code: mapToIlumaBankCode(bankCode),
        use_for_gateway_payout: false,
        gateway_payout_validation_status: "pending",
        is_active: true,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    bankAccountId = String(created.id);
  } else {
    await admin
      .from("bank_accounts")
      .update({
        gateway_payout_validation_status: "pending",
        gateway_payout_validation_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankAccountId);
  }

  let result: IlumaBankValidationResult;
  try {
    result = await validateBankAccountWithPoll(ilumaEnv, {
      bankCode,
      accountNumber,
      givenName: accountHolder,
      referenceId: `synckerja:${organizationId}:${bankAccountId}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("bank_accounts")
      .update({
        gateway_payout_validation_status: "error",
        gateway_payout_validation_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankAccountId);
    throw e;
  }

  const applied = await applyValidationResultToBankAccount(
    admin,
    bankAccountId,
    organizationId,
    bankCode,
    accountNumber,
    accountHolder,
    result,
    userId,
    { enablePayout: input.enablePayout === true },
  );

  if (applied.validationStatus !== "match") {
    const msg = result.failure_reason
      ?? `Bank validation did not pass (status: ${applied.validationStatus})`;
    throw new Error(msg);
  }

  const { data: bankRow } = await admin
    .from("bank_accounts")
    .select("*")
    .eq("id", bankAccountId)
    .maybeSingle();

  return {
    ok: true,
    bank_account_id: bankAccountId,
    validation_status: applied.validationStatus,
    validated_holder: applied.validatedHolder,
    iluma_request_id: applied.ilumaRequestId,
    bank_account: bankRow,
  };
}

export async function getGatewayPayoutValidation(
  admin: SupabaseClient,
  organizationId: string,
  bankAccountId?: string | null,
): Promise<Record<string, unknown>> {
  let query = admin
    .from("bank_accounts")
    .select(
      "id, bank_name, account_number, account_holder, gateway_payout_bank_code, use_for_gateway_payout, gateway_payout_validation_status, gateway_payout_validated_holder, gateway_payout_validation_id, gateway_payout_validated_at, gateway_payout_is_normal_account, gateway_payout_validation_error",
    )
    .eq("organization_id", organizationId);

  if (bankAccountId) {
    query = query.eq("id", bankAccountId);
  } else {
    query = query.eq("use_for_gateway_payout", true);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);

  return { ok: true, bank_account: data ?? null };
}
