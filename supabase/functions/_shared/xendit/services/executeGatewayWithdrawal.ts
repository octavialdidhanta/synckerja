import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { readMinDisbursementAmount, readWithdrawalPlatformFee } from "../xenditEnv.ts";
import { resolveOrgSubAccount } from "./createSubAccount.ts";
import { fetchXenditWalletBalance, syncOrgXenditWalletBalance } from "./getBalance.ts";
import { disburseSingle, mapBankNameToCode } from "./executeDisbursement.ts";
import { assertGatewayPayoutValidated } from "./validateGatewayPayoutBank.ts";

async function resolveWithdrawalPlatformFee(
  admin: SupabaseClient,
  env: XenditEnvConfig,
): Promise<number> {
  const { data: config } = await admin
    .from("xendit_platform_config")
    .select("flat_fee_amount")
    .eq("id", 1)
    .maybeSingle();
  const fromDb = config?.flat_fee_amount != null ? Number(config.flat_fee_amount) : env.flatFeeAmount;
  return readWithdrawalPlatformFee(fromDb);
}

export async function finalizeGatewayWithdrawal(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  disbursementId: string,
  organizationId: string,
): Promise<void> {
  const { error } = await admin.rpc("apply_xendit_gateway_withdrawal_settlement", {
    p_disbursement_id: disbursementId,
  });
  if (error) throw new Error(error.message);
  try {
    await syncOrgXenditWalletBalance(admin, organizationId, env);
  } catch (e) {
    console.error("syncOrgXenditWalletBalance after gateway withdrawal:", e);
  }
}

export async function executeGatewayWithdrawal(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  userId: string,
  amountInput: number,
): Promise<Record<string, unknown>> {
  const gross = Math.floor(Number(amountInput));
  const minNet = readMinDisbursementAmount();
  const platformFee = await resolveWithdrawalPlatformFee(admin, env);
  const net = gross - platformFee;

  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error("Invalid withdrawal amount");
  }
  if (net < minNet) {
    throw new Error(
      `Minimum withdrawal is Rp ${minNet.toLocaleString("id-ID")} after platform fee (Rp ${platformFee.toLocaleString("id-ID")}). Enter at least Rp ${(minNet + platformFee).toLocaleString("id-ID")}.`,
    );
  }

  const { data: acct } = await admin
    .from("organization_xendit_accounts")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!acct?.is_enabled) throw new Error("Xendit not enabled for this organization");

  const { subAccountId } = await resolveOrgSubAccount(admin, env, organizationId);

  const { data: processing } = await admin
    .from("xendit_gateway_withdrawals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "processing")
    .maybeSingle();
  if (processing?.id) {
    throw new Error("Another gateway withdrawal is still processing. Please wait and refresh.");
  }

  const { data: payoutBank, error: bankErr } = await admin
    .from("bank_accounts")
    .select(
      "id, bank_name, account_number, account_holder, gateway_payout_bank_code, is_active, use_for_gateway_payout, gateway_payout_validation_status, gateway_payout_validation_fingerprint, gateway_payout_is_normal_account, gateway_payout_validated_at",
    )
    .eq("organization_id", organizationId)
    .eq("use_for_gateway_payout", true)
    .maybeSingle();
  if (bankErr) throw new Error(bankErr.message);
  if (!payoutBank?.id || !payoutBank.is_active) {
    throw new Error("No active gateway payout bank account configured for this organization");
  }

  await assertGatewayPayoutValidated(payoutBank as Record<string, unknown>);

  const bankCode = String(
    payoutBank.gateway_payout_bank_code?.trim() ||
      mapBankNameToCode(String(payoutBank.bank_name ?? "")),
  ).trim().toUpperCase();
  const accountNumber = String(payoutBank.account_number ?? "").trim();
  const accountHolder = String(payoutBank.account_holder ?? "").trim();
  if (!bankCode || !accountNumber || !accountHolder) {
    throw new Error("Gateway payout bank is missing account details");
  }

  const bankSnapshot = {
    bank_code: bankCode,
    bank_name: String(payoutBank.bank_name ?? ""),
    account_number: accountNumber,
    account_holder: accountHolder,
  };

  const liveBalance = await fetchXenditWalletBalance(env, subAccountId);
  if (gross > liveBalance.usableBalance) {
    throw new Error(
      `Insufficient Xendit CASH balance (available Rp ${Math.floor(liveBalance.usableBalance).toLocaleString("id-ID")})`,
    );
  }

  const { data: withdrawal, error: insErr } = await admin
    .from("xendit_gateway_withdrawals")
    .insert({
      organization_id: organizationId,
      bank_account_id: payoutBank.id,
      sub_account_id: subAccountId,
      amount: gross,
      platform_fee_amount: platformFee,
      net_amount: net,
      bank_snapshot: bankSnapshot,
      status: "pending",
      initiated_by: userId,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  const withdrawalId = String(withdrawal.id);

  try {
    const disburseRow = await disburseSingle(admin, env, organizationId, userId, subAccountId, {
      source_type: "gateway_withdrawal",
      source_id: withdrawalId,
      bank_code: bankCode,
      account_holder_name: accountHolder,
      account_number: accountNumber,
      amount: net,
      description: `Gateway withdrawal to ${bankCode}`,
    });

    const disburseStatus = String(disburseRow.status ?? "processing");
    const disburseId = String(disburseRow.id);

    await admin
      .from("xendit_gateway_withdrawals")
      .update({
        status: disburseStatus === "completed"
          ? "processing"
          : disburseStatus === "failed"
          ? "failed"
          : "processing",
        xendit_disbursement_id: disburseId,
        failure_message: disburseStatus === "failed"
          ? String(disburseRow.failure_message ?? "Disbursement failed")
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    if (disburseStatus === "completed") {
      await finalizeGatewayWithdrawal(admin, env, disburseId, organizationId);
    } else if (disburseStatus === "failed") {
      throw new Error(String(disburseRow.failure_message ?? "Xendit disbursement failed"));
    }

    const { data: finalRow } = await admin
      .from("xendit_gateway_withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .maybeSingle();

    return {
      withdrawal: finalRow ?? withdrawal,
      disbursement: disburseRow,
      platform_fee_amount: platformFee,
      net_amount: net,
      gross_amount: gross,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("xendit_gateway_withdrawals")
      .update({
        status: "failed",
        failure_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);
    throw e;
  }
}

function formatBankDestination(
  snapshot: Record<string, unknown> | null,
  bankAccount: Record<string, unknown> | null,
): string {
  const snap = snapshot ?? {};
  const code = String(snap.bank_code ?? bankAccount?.gateway_payout_bank_code ?? bankAccount?.bank_name ?? "").trim();
  const num = String(snap.account_number ?? bankAccount?.account_number ?? "").trim();
  const holder = String(snap.account_holder ?? bankAccount?.account_holder ?? "").trim();
  const parts = [code, num, holder].filter(Boolean);
  return parts.join(" · ") || "—";
}

export async function listGatewayWithdrawals(
  admin: SupabaseClient,
  organizationId: string,
  limit = 10,
): Promise<Record<string, unknown>[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const { data, error } = await admin
    .from("xendit_gateway_withdrawals")
    .select(
      `
      id,
      amount,
      platform_fee_amount,
      net_amount,
      bank_snapshot,
      status,
      failure_message,
      settled_at,
      created_at,
      updated_at,
      xendit_disbursement_id,
      bank_account_id,
      initiated_by,
      bank_account:bank_accounts(
        id,
        bank_name,
        account_number,
        account_holder,
        gateway_payout_bank_code
      )
    `,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [...new Set(
    rows.map((r) => r.initiated_by).filter((id): id is string => typeof id === "string" && id.length > 0),
  )];

  const nameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      const label = String(p.full_name ?? "").trim() || String(p.email ?? "").trim() || String(p.user_id);
      nameByUserId.set(String(p.user_id), label);
    }
  }

  return rows.map((row) => {
    const bankAccount = row.bank_account as Record<string, unknown> | null;
    const snapshot = row.bank_snapshot as Record<string, unknown> | null;
    const initiatedBy = row.initiated_by != null ? String(row.initiated_by) : null;
    return {
      ...row,
      bank_destination: formatBankDestination(snapshot, bankAccount),
      initiated_by_name: initiatedBy ? (nameByUserId.get(initiatedBy) ?? null) : null,
    };
  });
}
