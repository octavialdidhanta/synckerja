/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getUserFromBearer,
  requireActiveOrg,
  requireXenditOrgAdmin,
  xenditCorsHeaders,
  xenditJson,
} from "../_shared/xendit/xenditAuth.ts";
import { readXenditEnv, readWithdrawalPlatformFee } from "../_shared/xendit/xenditEnv.ts";
import { normalizeXenditError } from "../_shared/xendit/xenditErrors.ts";
import { SUB_ACCOUNT_EMAIL_EXISTS_CODE } from "../_shared/xendit/services/resolveSubAccount.ts";
import { XENDIT_VA_BANKS } from "../_shared/xendit/xenditTypes.ts";
import { createTenantSubAccount, setPrimarySubAccount } from "../_shared/xendit/services/createSubAccount.ts";
import { createTenantInvoiceVA } from "../_shared/xendit/services/createInvoiceVa.ts";
import { createPosQrisPayment } from "../_shared/xendit/services/createPosQris.ts";
import { cancelPosQrisPayment } from "../_shared/xendit/services/cancelPosQris.ts";
import { simulatePosQrisPayment } from "../_shared/xendit/services/simulatePosQris.ts";
import { executeTenantDisbursement } from "../_shared/xendit/services/executeDisbursement.ts";
import {
  executeGatewayWithdrawal,
  listGatewayWithdrawals,
} from "../_shared/xendit/services/executeGatewayWithdrawal.ts";
import { ensureSplitRule } from "../_shared/xendit/services/createSplitRule.ts";
import { verifyXenditCredentials } from "../_shared/xendit/services/verifyXenditCredentials.ts";
import { handleXenditGetBalance, syncAllOrgXenditWallets } from "../_shared/xendit/services/getBalance.ts";
import { pollPendingXenditDisbursements } from "../_shared/xendit/pollPendingDisbursements.ts";
import { getOrgKycDocument } from "../_shared/xendit/services/kycDocuments.ts";
import { listSubAccountsForOrg } from "../_shared/xendit/services/listSubAccounts.ts";
import { requestSubAccount } from "../_shared/xendit/services/requestSubAccount.ts";
import { retrySubAccountDocuments } from "../_shared/xendit/services/retrySubAccountDocuments.ts";
import { getPrimarySubAccount } from "../_shared/xendit/services/resolveSubAccount.ts";
import { submitKycAndCreate, updateKycAndRetryDocuments, uploadKycForManagedSubAccount } from "../_shared/xendit/services/submitKycAndCreate.ts";
import { parseFullKycFromBody, parsePartialKycFromBody } from "../_shared/xendit/services/kycApiBody.ts";
import { isInternalXenditOrg } from "../_shared/xendit/internalOrg.ts";
import {
  isXenditWebhookRequest,
  processXenditWebhook,
} from "../_shared/xendit/webhooks/processXenditWebhook.ts";
import {
  isIlumaWebhookRequest,
  processIlumaWebhook,
} from "../_shared/iluma/processIlumaWebhook.ts";
import {
  getGatewayPayoutValidation,
  validateGatewayPayoutBank,
} from "../_shared/xendit/services/validateGatewayPayoutBank.ts";
import { requireAal2FromBearer } from "../_shared/auth/requireAal2.ts";
import { readIlumaEnv } from "../_shared/iluma/ilumaEnv.ts";
import {
  executePayrollEscrowTransfer,
  getPayrollEscrowSettingsForOrg,
  updatePayrollEscrowSettingsForOrg,
} from "../_shared/xendit/services/executePayrollEscrowTransfer.ts";
import {
  getPayrollExpenseSettingsForOrg,
  updatePayrollExpenseSettingsForOrg,
} from "../_shared/payroll/executePayrollThpExpensePost.ts";

async function buildLegacyAccountShape(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  settings: Record<string, unknown> | null,
  primarySubAccount: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!settings) return null;
  const payoutSelect =
    "id, name, bank_name, account_number, account_holder, gateway_payout_bank_code, use_for_gateway_payout, gateway_payout_validation_status, gateway_payout_validated_holder, gateway_payout_validation_id, gateway_payout_validated_at, gateway_payout_is_normal_account, gateway_payout_validation_error";
  let payoutBank: Record<string, unknown> | null = null;
  const { data: payoutRow } = await admin
    .from("bank_accounts")
    .select(payoutSelect)
    .eq("organization_id", orgId)
    .eq("use_for_gateway_payout", true)
    .maybeSingle();
  payoutBank = (payoutRow as Record<string, unknown> | null) ?? null;
  if (!payoutBank && primarySubAccount?.linked_bank_account_id) {
    const { data: linked } = await admin
      .from("bank_accounts")
      .select(payoutSelect)
      .eq("id", String(primarySubAccount.linked_bank_account_id))
      .maybeSingle();
    payoutBank = (linked as Record<string, unknown> | null) ?? null;
  }

  if (!primarySubAccount) {
    return {
      organization_id: orgId,
      is_enabled: settings.is_enabled,
      enabled_at: settings.enabled_at,
      payout_bank: payoutBank,
    };
  }

  return {
    ...primarySubAccount,
    organization_id: orgId,
    is_enabled: settings.is_enabled,
    enabled_at: settings.enabled_at,
    payout_bank: payoutBank,
  };
}

async function handleGetSettings(admin: ReturnType<typeof createClient>, orgId: string) {
  const env = readXenditEnv();
  const { data: settingsRow } = await admin
    .from("organization_xendit_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  const settings = (settingsRow as Record<string, unknown> | null) ?? null;

  const subAccounts = env
    ? await listSubAccountsForOrg(admin, env, orgId, true)
    : await listSubAccountsForOrg(admin, null, orgId, false);

  const primarySubAccount =
    subAccounts.find((row) => row.is_primary === true) ??
    subAccounts[0] ??
    null;

  const account = await buildLegacyAccountShape(admin, orgId, settings, primarySubAccount);
  const kyc = await getOrgKycDocument(admin, orgId);

  const { data: config } = await admin
    .from("xendit_platform_config")
    .select("flat_fee_amount, split_rule_id, va_expiration_days")
    .eq("id", 1)
    .maybeSingle();
  const withdrawalPlatformFee = readWithdrawalPlatformFee(
    config?.flat_fee_amount != null
      ? Math.max(0, Math.floor(Number(config.flat_fee_amount)))
      : (env?.flatFeeAmount ?? 2500),
  );
  return xenditJson({
    serverConfigured: Boolean(env),
    isSandbox: env?.isSandbox ?? true,
    keyKind: env?.keyKind ?? "unknown",
    publicKey: env?.publicKey ?? null,
    account,
    primarySubAccount,
    subAccounts,
    kyc,
    isInternalOrg: isInternalXenditOrg(orgId),
    platformConfig: config ?? null,
    withdrawalPlatformFee,
    ilumaConfigured: Boolean(readIlumaEnv()),
    platformSplitReady: Boolean(config?.split_rule_id) || (config?.flat_fee_amount != null && Number(config.flat_fee_amount) <= 0),
    vaBanks: XENDIT_VA_BANKS,
  }, 200);
}

async function handleEnableXendit(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  body: Record<string, unknown>,
) {
  const enabled = body.enabled !== false;
  const { data: existing } = await admin
    .from("organization_xendit_settings")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin.from("organization_xendit_settings").insert({
      organization_id: orgId,
      is_enabled: enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
    });
    if (error) return xenditJson({ error: error.message }, 500);
  } else {
    const { error } = await admin.from("organization_xendit_settings").update({
      is_enabled: enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("organization_id", orgId);
    if (error) return xenditJson({ error: error.message }, 500);
  }
  return xenditJson({ ok: true, enabled }, 200);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: xenditCorsHeaders });
    }
    if (req.method !== "POST") {
      return xenditJson({ error: "Method not allowed" }, 405);
    }

    const env = readXenditEnv();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return xenditJson({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Xendit webhooks: header x-callback-token (verified inside processXenditWebhook).
    if (isXenditWebhookRequest(req)) {
      if (!env) return xenditJson({ error: "Xendit not configured on server" }, 503);
      return await processXenditWebhook(admin, env, req);
    }

    if (isIlumaWebhookRequest(req)) {
      return await processIlumaWebhook(admin, req);
    }

    if (!env) return xenditJson({ error: "Xendit not configured on server" }, 503);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return xenditJson({ error: "Invalid JSON body" }, 400);
    }

    const actionEarly = String(body.action ?? "").trim();
    if (actionEarly === "createPublicOrderQris") {
      const code = String(body.public_code ?? "").trim().toLowerCase();
      const pendingId = String(body.pending_checkout_id ?? "").trim();
      if (!/^[a-z0-9]{6}$/.test(code) || !pendingId) {
        return xenditJson({ error: "Missing public_code or pending_checkout_id" }, 400);
      }
      const { data: outlet } = await admin
        .from("pos_outlets")
        .select("id, organization_id, public_code, is_deleted, is_active")
        .eq("public_code", code)
        .eq("is_deleted", false)
        .eq("is_active", true)
        .maybeSingle();
      if (!outlet) return xenditJson({ error: "not_found" }, 404);
      const { data: pending } = await admin
        .from("pos_pending_checkouts")
        .select("id, organization_id, pos_outlet_id, status")
        .eq("id", pendingId)
        .maybeSingle();
      if (
        !pending
        || pending.organization_id !== outlet.organization_id
        || pending.pos_outlet_id !== outlet.id
      ) {
        return xenditJson({ error: "forbidden" }, 403);
      }
      const row = await createPosQrisPayment(admin, env, String(outlet.organization_id), {
        pending_checkout_id: pendingId,
      });
      return xenditJson({ ok: true, payment_request: row }, 200);
    }

    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return xenditJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const action = String(body.action ?? "").trim();

    const adminActions = new Set([
      "enableXendit",
      "createTenantSubAccount",
      "requestSubAccount",
      "submitKycAndCreate",
      "updateKycAndRetryDocuments",
      "retrySubAccountDocuments",
      "setPrimarySubAccount",
      "createTenantInvoiceVA",
      "executeTenantDisbursement",
      "executeGatewayWithdrawal",
      "validateGatewayPayoutBank",
      "ensureSplitRule",
      "verifyCredentials",
      "updatePayrollEscrowSettings",
      "retryPayrollEscrowTransfer",
      "updatePayrollExpenseSettings",
    ]);
    if (adminActions.has(action)) {
      const roleForbidden = await requireXenditOrgAdmin(admin, userRes.userId, organizationId);
      if (roleForbidden) return roleForbidden;
    }

    const mfaRequiredActions = new Set([
      "executeTenantDisbursement",
      "executeGatewayWithdrawal",
      "setPrimarySubAccount",
      "submitKycAndCreate",
      "createTenantSubAccount",
      "validateGatewayPayoutBank",
      "enableXendit",
      "updatePayrollEscrowSettings",
      "retryPayrollEscrowTransfer",
      "updatePayrollExpenseSettings",
    ]);
    if (mfaRequiredActions.has(action)) {
      const mfaForbidden = requireAal2FromBearer(req.headers.get("Authorization"), xenditJson);
      if (mfaForbidden) return mfaForbidden;
    }

    switch (action) {
      case "getSettings":
        return handleGetSettings(admin, organizationId);
      case "enableXendit":
        return handleEnableXendit(admin, organizationId, body);
      case "createTenantSubAccount": {
        const result = await createTenantSubAccount(admin, env, organizationId, userRes.userId, {
          business_name: String(body.business_name ?? ""),
          email: String(body.email ?? ""),
          type: body.type != null ? String(body.type) : undefined,
          linked_bank_account_id:
            body.linked_bank_account_id != null ? String(body.linked_bank_account_id) : null,
          payout_bank_code: body.payout_bank_code != null ? String(body.payout_bank_code) : "",
          payout_account_number:
            body.payout_account_number != null ? String(body.payout_account_number) : "",
          payout_account_holder_name:
            body.payout_account_holder_name != null ? String(body.payout_account_holder_name) : "",
        });

        const accountRow = result.row as Record<string, unknown>;
        const accountType = String(accountRow.account_type ?? "MANAGED").toUpperCase();
        if (!isInternalXenditOrg(organizationId) && accountType === "MANAGED") {
          const upload = await uploadKycForManagedSubAccount(
            admin,
            env,
            organizationId,
            String(accountRow.id),
            result.subAccountId,
            accountRow,
          );
          try {
            await syncAllOrgXenditWallets(admin, organizationId, env);
          } catch (e) {
            console.error("syncAllOrgXenditWallets after create:", e);
          }
          return xenditJson({
            ok: true,
            sub_account_id: result.subAccountId,
            account: upload.row,
            document_upload_ok: upload.document_upload_ok,
            document_upload_error: upload.document_upload_error ?? null,
          }, 200);
        }

        try {
          await syncAllOrgXenditWallets(admin, organizationId, env);
        } catch (e) {
          console.error("syncAllOrgXenditWallets after create:", e);
        }
        return xenditJson({ ok: true, sub_account_id: result.subAccountId, account: result.row }, 200);
      }
      case "requestSubAccount": {
        const gate = await requestSubAccount(admin, organizationId, {
          isSandbox: env.isSandbox,
        });
        return xenditJson({ ok: true, ...gate }, 200);
      }
      case "submitKycAndCreate": {
        const result = await submitKycAndCreate(admin, env, organizationId, userRes.userId, {
          business_name: String(body.business_name ?? ""),
          email: String(body.email ?? ""),
          linked_bank_account_id:
            body.linked_bank_account_id != null ? String(body.linked_bank_account_id) : null,
          payout_bank_code: String(body.payout_bank_code ?? ""),
          payout_account_number: String(body.payout_account_number ?? ""),
          payout_account_holder_name: String(body.payout_account_holder_name ?? ""),
          kyc: parseFullKycFromBody(body),
        });
        try {
          await syncAllOrgXenditWallets(admin, organizationId, env);
        } catch (e) {
          console.error("syncAllOrgXenditWallets after KYC create:", e);
        }
        return xenditJson({ ok: true, ...result }, 200);
      }
      case "updateKycAndRetryDocuments": {
        const result = await updateKycAndRetryDocuments(admin, env, organizationId, userRes.userId, {
          sub_account_row_id: String(body.sub_account_row_id ?? ""),
          kyc: parsePartialKycFromBody(body),
        });
        return xenditJson({ ok: result.ok, ...result }, 200);
      }
      case "retrySubAccountDocuments": {
        const result = await retrySubAccountDocuments(
          admin,
          env,
          organizationId,
          String(body.sub_account_row_id ?? ""),
        );
        return xenditJson({ ok: result.ok, ...result }, 200);
      }
      case "setPrimarySubAccount": {
        const row = await setPrimarySubAccount(
          admin,
          organizationId,
          String(body.sub_account_row_id ?? ""),
        );
        try {
          await syncAllOrgXenditWallets(admin, organizationId, env);
        } catch (e) {
          console.error("syncAllOrgXenditWallets after setPrimary:", e);
        }
        return xenditJson({ ok: true, sub_account: row }, 200);
      }
      case "listSubAccounts": {
        const rows = await listSubAccountsForOrg(admin, env, organizationId, true);
        const primary = await getPrimarySubAccount(admin, organizationId);
        return xenditJson({ ok: true, subAccounts: rows, primarySubAccount: primary }, 200);
      }
      case "createTenantInvoiceVA": {
        const row = await createTenantInvoiceVA(admin, env, organizationId, {
          sales_activity_payment_id: String(body.sales_activity_payment_id ?? ""),
          bank_code: String(body.bank_code ?? ""),
          name: body.name != null ? String(body.name) : undefined,
        });
        return xenditJson({ ok: true, va: row }, 200);
      }
      case "createPosQrisPayment": {
        const row = await createPosQrisPayment(admin, env, organizationId, {
          pending_checkout_id: String(body.pending_checkout_id ?? ""),
        });
        return xenditJson({ ok: true, payment_request: row }, 200);
      }
      case "cancelPosQrisPayment": {
        const result = await cancelPosQrisPayment(admin, env, organizationId, {
          pending_checkout_id: body.pending_checkout_id != null
            ? String(body.pending_checkout_id)
            : undefined,
          payment_request_id: body.payment_request_id != null
            ? String(body.payment_request_id)
            : undefined,
          reason: body.reason != null ? String(body.reason) : undefined,
        });
        return xenditJson(result, 200);
      }
      case "simulatePosQrisPayment": {
        const result = await simulatePosQrisPayment(admin, env, organizationId, {
          payment_request_id: body.payment_request_id != null
            ? String(body.payment_request_id)
            : undefined,
          pending_checkout_id: body.pending_checkout_id != null
            ? String(body.pending_checkout_id)
            : undefined,
        });
        return xenditJson(result, 200);
      }
      case "listVaBanks":
        return xenditJson({ banks: XENDIT_VA_BANKS }, 200);
      case "executeTenantDisbursement": {
        const result = await executeTenantDisbursement(
          admin,
          env,
          organizationId,
          userRes.userId,
          body,
        );
        return xenditJson({ ok: true, ...result }, 200);
      }
      case "executeGatewayWithdrawal": {
        const result = await executeGatewayWithdrawal(
          admin,
          env,
          organizationId,
          userRes.userId,
          Number(body.amount),
        );
        return xenditJson({ ok: true, ...result }, 200);
      }
      case "listGatewayWithdrawals": {
        const subAccountFilter =
          body.sub_account_id != null ? String(body.sub_account_id) : null;
        const rows = await listGatewayWithdrawals(
          admin,
          organizationId,
          Number(body.limit ?? 10),
          subAccountFilter,
        );
        return xenditJson({ ok: true, withdrawals: rows }, 200);
      }
      case "validateGatewayPayoutBank": {
        const result = await validateGatewayPayoutBank(admin, organizationId, userRes.userId, {
          bankAccountId: body.bank_account_id != null ? String(body.bank_account_id) : null,
          bankCode: body.bank_code != null ? String(body.bank_code) : undefined,
          accountNumber: body.account_number != null ? String(body.account_number) : undefined,
          accountHolder: body.account_holder != null ? String(body.account_holder) : undefined,
          enablePayout: body.enable_payout === true,
        });
        return xenditJson(result, 200);
      }
      case "getGatewayPayoutValidation": {
        const result = await getGatewayPayoutValidation(
          admin,
          organizationId,
          body.bank_account_id != null ? String(body.bank_account_id) : null,
        );
        return xenditJson(result, 200);
      }
      case "ensureSplitRule": {
        const cfg = await ensureSplitRule(admin, env);
        return xenditJson({ ok: true, ...cfg, platformSplitReady: cfg.ready }, 200);
      }
      case "verifyCredentials": {
        const result = await verifyXenditCredentials(env);
        return xenditJson({ ok: result.ok, ...result }, result.ok ? 200 : 200);
      }
      case "getBalance": {
        const disbursePoll = await pollPendingXenditDisbursements(admin, env, organizationId);
        const balanceResponse = await handleXenditGetBalance(admin, env, organizationId, xenditJson);
        const balanceBody = await balanceResponse.clone().json();
        return xenditJson({ ...balanceBody, disbursePoll }, balanceResponse.status);
      }
      case "pollOrgDisbursements": {
        const disbursePoll = await pollPendingXenditDisbursements(admin, env, organizationId);
        try {
          await syncAllOrgXenditWallets(admin, organizationId, env);
        } catch (e) {
          console.error("syncAllOrgXenditWallets after poll:", e);
        }
        return xenditJson({ ok: true, disbursePoll }, 200);
      }
      case "getPayrollEscrowSettings": {
        const settings = await getPayrollEscrowSettingsForOrg(admin, organizationId);
        return xenditJson({ ok: true, settings }, 200);
      }
      case "updatePayrollEscrowSettings": {
        const settings = await updatePayrollEscrowSettingsForOrg(admin, organizationId, userRes.userId, {
          ...(body.is_enabled !== undefined ? { is_enabled: body.is_enabled === true } : {}),
          ...(body.escrow_sub_account_row_id !== undefined
            ? {
                escrow_sub_account_row_id:
                  body.escrow_sub_account_row_id != null
                    ? String(body.escrow_sub_account_row_id)
                    : null,
              }
            : {}),
          ...(body.require_xendit_disburse !== undefined
            ? { require_xendit_disburse: body.require_xendit_disburse !== false }
            : {}),
        });
        return xenditJson({ ok: true, settings }, 200);
      }
      case "retryPayrollEscrowTransfer": {
        const runId = String(body.payroll_run_id ?? "").trim();
        if (!runId) return xenditJson({ error: "Missing payroll_run_id" }, 400);
        const result = await executePayrollEscrowTransfer(admin, env, runId, {
          actorUserId: userRes.userId,
          forceRetry: true,
        });
        return xenditJson({ ok: result.ok, ...result }, result.ok ? 200 : 200);
      }
      case "getPayrollExpenseSettings": {
        const settings = await getPayrollExpenseSettingsForOrg(admin, organizationId);
        return xenditJson({ ok: true, settings }, 200);
      }
      case "updatePayrollExpenseSettings": {
        const settings = await updatePayrollExpenseSettingsForOrg(admin, organizationId, userRes.userId, {
          ...(body.is_enabled !== undefined ? { is_enabled: body.is_enabled === true } : {}),
          ...(body.expense_type_name !== undefined
            ? { expense_type_name: String(body.expense_type_name) }
            : {}),
          ...(body.expense_category_name !== undefined
            ? { expense_category_name: String(body.expense_category_name) }
            : {}),
          ...(body.department !== undefined ? { department: String(body.department) } : {}),
        });
        return xenditJson({ ok: true, settings }, 200);
      }
      default:
        return xenditJson({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("xendit-api:", err);
    const message = normalizeXenditError(err);
    if (message === SUB_ACCOUNT_EMAIL_EXISTS_CODE) {
      return xenditJson(
        { error: SUB_ACCOUNT_EMAIL_EXISTS_CODE, code: SUB_ACCOUNT_EMAIL_EXISTS_CODE },
        409,
      );
    }
    return xenditJson({ error: message }, 500);
  }
});
