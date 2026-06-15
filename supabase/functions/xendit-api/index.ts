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
import { XENDIT_VA_BANKS } from "../_shared/xendit/xenditTypes.ts";
import { createTenantSubAccount } from "../_shared/xendit/services/createSubAccount.ts";
import { createTenantInvoiceVA } from "../_shared/xendit/services/createInvoiceVa.ts";
import { executeTenantDisbursement } from "../_shared/xendit/services/executeDisbursement.ts";
import {
  executeGatewayWithdrawal,
  listGatewayWithdrawals,
} from "../_shared/xendit/services/executeGatewayWithdrawal.ts";
import { ensureSplitRule } from "../_shared/xendit/services/createSplitRule.ts";
import { verifyXenditCredentials } from "../_shared/xendit/services/verifyXenditCredentials.ts";
import { handleXenditGetBalance, syncOrgXenditWalletBalance } from "../_shared/xendit/services/getBalance.ts";
import { pollPendingXenditDisbursements } from "../_shared/xendit/pollPendingDisbursements.ts";
import { reconcileOrgXenditSubAccount } from "../_shared/xendit/services/reconcileSubAccount.ts";
import {
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
import { readIlumaEnv } from "../_shared/iluma/ilumaEnv.ts";

async function handleGetSettings(admin: ReturnType<typeof createClient>, orgId: string) {
  const env = readXenditEnv();
  let account: Record<string, unknown> | null = null;
  const { data: accountRow } = await admin
    .from("organization_xendit_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  account = (accountRow as Record<string, unknown> | null) ?? null;
  if (env && account) {
    account = await reconcileOrgXenditSubAccount(admin, env, orgId, account);
  }
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
  if (!payoutBank && account?.linked_bank_account_id) {
    const { data: linked } = await admin
      .from("bank_accounts")
      .select(payoutSelect)
      .eq("id", String(account.linked_bank_account_id))
      .maybeSingle();
    payoutBank = (linked as Record<string, unknown> | null) ?? null;
  }
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
    account: account
      ? { ...account, payout_bank: payoutBank ?? null }
      : null,
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
    .from("organization_xendit_accounts")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!existing) {
    const { data: org } = await admin.from("organizations").select("company_name").eq("id", orgId).maybeSingle();
    const { data: owner } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    let email: string | null = null;
    if (owner?.user_id) {
      const { data: profile } = await admin.from("profiles").select("email").eq("user_id", owner.user_id).maybeSingle();
      const candidate = profile?.email ? String(profile.email).trim() : "";
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) email = candidate;
    }
    const { error } = await admin.from("organization_xendit_accounts").insert({
      organization_id: orgId,
      business_name: String(org?.company_name ?? "Organization"),
      email,
      is_enabled: enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
    });
    if (error) return xenditJson({ error: error.message }, 500);
  } else {
    const { error } = await admin.from("organization_xendit_accounts").update({
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

    const callbackToken = req.headers.get("x-callback-token")
      ?? req.headers.get("X-CALLBACK-TOKEN")
      ?? "";

    if (callbackToken && env?.webhookToken && callbackToken === env.webhookToken) {
      if (!env) return xenditJson({ error: "Xendit not configured on server" }, 503);
      return await processXenditWebhook(admin, env, req);
    }

    if (isIlumaWebhookRequest(req)) {
      return await processIlumaWebhook(admin, req);
    }

    if (!env) return xenditJson({ error: "Xendit not configured on server" }, 503);

    const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
    if ("error" in userRes) return userRes.error;

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return xenditJson({ error: "Invalid JSON body" }, 400);
    }

    const organizationId = String(body.organization_id ?? "").trim();
    if (!organizationId) return xenditJson({ error: "Missing organization_id" }, 400);

    const orgForbidden = await requireActiveOrg(admin, userRes.userId, organizationId);
    if (orgForbidden) return orgForbidden;

    const action = String(body.action ?? "").trim();

    const adminActions = new Set([
      "enableXendit",
      "createTenantSubAccount",
      "createTenantInvoiceVA",
      "executeTenantDisbursement",
      "executeGatewayWithdrawal",
      "validateGatewayPayoutBank",
      "ensureSplitRule",
      "verifyCredentials",
    ]);
    if (adminActions.has(action)) {
      const roleForbidden = await requireXenditOrgAdmin(admin, userRes.userId, organizationId);
      if (roleForbidden) return roleForbidden;
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
          type: body.type != null ? String(body.type) : "OWNED",
          linked_bank_account_id:
            body.linked_bank_account_id != null ? String(body.linked_bank_account_id) : null,
          payout_bank_code: body.payout_bank_code != null ? String(body.payout_bank_code) : "",
          payout_account_number:
            body.payout_account_number != null ? String(body.payout_account_number) : "",
          payout_account_holder_name:
            body.payout_account_holder_name != null ? String(body.payout_account_holder_name) : "",
        });
        return xenditJson({ ok: true, sub_account_id: result.subAccountId, account: result.row }, 200);
      }
      case "createTenantInvoiceVA": {
        const row = await createTenantInvoiceVA(admin, env, organizationId, {
          sales_activity_payment_id: String(body.sales_activity_payment_id ?? ""),
          bank_code: String(body.bank_code ?? ""),
          name: body.name != null ? String(body.name) : undefined,
        });
        return xenditJson({ ok: true, va: row }, 200);
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
        const rows = await listGatewayWithdrawals(
          admin,
          organizationId,
          Number(body.limit ?? 10),
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
          await syncOrgXenditWalletBalance(admin, organizationId, env);
        } catch (e) {
          console.error("syncOrgXenditWalletBalance after poll:", e);
        }
        return xenditJson({ ok: true, disbursePoll }, 200);
      }
      default:
        return xenditJson({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("xendit-api:", err);
    return xenditJson({ error: normalizeXenditError(err) }, 500);
  }
});
