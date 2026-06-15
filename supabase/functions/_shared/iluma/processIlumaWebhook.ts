import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readIlumaEnv } from "./ilumaEnv.ts";
import { xenditJson } from "../xendit/xenditAuth.ts";
import type { IlumaBankValidationResult } from "./validateBankAccount.ts";
import {
  applyValidationResultToBankAccount,
  type GatewayPayoutValidationStatus,
} from "../xendit/services/validateGatewayPayoutBank.ts";

export function isIlumaWebhookRequest(req: Request): boolean {
  const env = readIlumaEnv();
  if (!env?.webhookToken) return false;
  const token = req.headers.get("x-callback-token")
    ?? req.headers.get("X-CALLBACK-TOKEN")
    ?? req.headers.get("x-iluma-callback-token")
    ?? "";
  return token.trim() === env.webhookToken;
}

function parseWebhookPayload(payload: Record<string, unknown>): IlumaBankValidationResult | null {
  const id = payload.id != null ? String(payload.id) : "";
  const status = payload.status != null ? String(payload.status).toUpperCase() : "";
  if (!id || !status) return null;
  const nameMatch = payload.name_matching_result != null
    ? String(payload.name_matching_result).toUpperCase()
    : null;
  const isNormal = payload.is_normal_account;
  return {
    id,
    status: status as IlumaBankValidationResult["status"],
    bank_code: String(payload.bank_code ?? ""),
    bank_account_number: String(payload.bank_account_number ?? ""),
    name_matching_result: nameMatch as IlumaBankValidationResult["name_matching_result"],
    is_normal_account: isNormal === true || isNormal === "true"
      ? true
      : isNormal === false || isNormal === "false"
      ? false
      : null,
    failure_reason: payload.failure_reason != null ? String(payload.failure_reason) : null,
    result: (payload.result as Record<string, unknown> | undefined) ?? null,
    raw: payload,
  };
}

export async function processIlumaWebhook(
  admin: SupabaseClient,
  req: Request,
): Promise<Response> {
  const env = readIlumaEnv();
  if (env?.webhookToken) {
    const token = req.headers.get("x-callback-token")
      ?? req.headers.get("X-CALLBACK-TOKEN")
      ?? req.headers.get("x-iluma-callback-token")
      ?? "";
    if (token.trim() !== env.webhookToken) {
      return xenditJson({ error: "Invalid Iluma webhook token" }, 401);
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return xenditJson({ error: "Invalid JSON" }, 400);
  }

  const result = parseWebhookPayload(payload);
  if (!result) {
    return xenditJson({ ok: true, ignored: true }, 200);
  }

  const referenceId = payload.reference_id != null ? String(payload.reference_id) : "";
  let bankAccountId: string | null = null;
  let organizationId: string | null = null;

  if (referenceId.startsWith("synckerja:")) {
    const parts = referenceId.split(":");
    if (parts.length >= 3) {
      organizationId = parts[1];
      bankAccountId = parts[2];
    }
  }

  if (!bankAccountId) {
    const { data: byIlumaId } = await admin
      .from("bank_accounts")
      .select("id, organization_id, gateway_payout_bank_code, bank_name, account_number, account_holder")
      .eq("gateway_payout_validation_id", result.id)
      .maybeSingle();
    if (byIlumaId) {
      bankAccountId = String(byIlumaId.id);
      organizationId = String(byIlumaId.organization_id);
    }
  }

  if (!bankAccountId || !organizationId) {
    return xenditJson({ ok: true, unmatched: true }, 200);
  }

  const { data: bankRow } = await admin
    .from("bank_accounts")
    .select("gateway_payout_bank_code, bank_name, account_number, account_holder")
    .eq("id", bankAccountId)
    .maybeSingle();

  if (!bankRow) {
    return xenditJson({ ok: true, bank_not_found: true }, 200);
  }

  const bankCode = String(bankRow.gateway_payout_bank_code ?? bankRow.bank_name ?? "");
  const accountNumber = String(bankRow.account_number ?? "");
  const accountHolder = String(bankRow.account_holder ?? "");

  const validationStatus = await applyValidationResultToBankAccount(
    admin,
    bankAccountId,
    organizationId,
    bankCode,
    accountNumber,
    accountHolder,
    result,
    null,
    { enablePayout: false },
  );

  return xenditJson({
    ok: true,
    bank_account_id: bankAccountId,
    validation_status: validationStatus.validationStatus as GatewayPayoutValidationStatus,
  }, 200);
}
