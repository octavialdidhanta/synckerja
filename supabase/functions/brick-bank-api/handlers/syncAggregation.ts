import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptBrickToken } from "../../_shared/brick/brickConfigCrypto.ts";
import {
  fetchBrickAccountBalance,
  fetchBrickAccountTransactions,
  formatYmd,
} from "../../_shared/brick/aggregationApi.ts";
import { readBrickEnv } from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import { handleBrickPollOrgVa } from "./getVaStatus.ts";
import { handleBrickPollOrgDisbursements } from "./getDisbursementStatus.ts";
import { syncOrgBrickWalletBalance } from "./getBalance.ts";
import { readXenditEnv } from "../../_shared/xendit/xenditEnv.ts";
import { pollPendingXenditDisbursements } from "../../_shared/xendit/pollPendingDisbursements.ts";
import { syncOrgXenditWalletBalance } from "../../_shared/xendit/services/getBalance.ts";

const FIRST_SYNC_DAYS = 30;

async function resolveUserAccessToken(
  admin: SupabaseClient,
  connectionId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("brick_financial_connections")
    .select("access_token_enc, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!data?.access_token_enc || data.status !== "active") return null;
  try {
    return await decryptBrickToken(String(data.access_token_enc));
  } catch {
    return null;
  }
}

export async function handleBrickSyncAggregation(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  const bankAccountIdFilter = body.bankAccountId ? String(body.bankAccountId) : null;
  const debtIdFilter = body.debtId ? String(body.debtId) : null;

  const vaPoll = await handleBrickPollOrgVa(admin, organizationId);
  const disbursePoll = await handleBrickPollOrgDisbursements(admin, organizationId);

  const xenditEnv = readXenditEnv();
  const xenditDisbursePoll = xenditEnv
    ? await pollPendingXenditDisbursements(admin, xenditEnv, organizationId)
    : { polled: 0, completed: 0, errors: [] as string[] };
  if (xenditEnv) {
    try {
      await syncOrgXenditWalletBalance(admin, organizationId, xenditEnv);
    } catch (e) {
      console.error("syncOrgXenditWalletBalance during bank sync:", e);
    }
  }

  let bankQuery = admin
    .from("bank_accounts")
    .select("id, name, account_number, bank_name, brick_connection_id, brick_aggregated_account_id, brick_last_sync_at, brick_link_status")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brick_link_status", "linked")
    .not("brick_connection_id", "is", null);

  if (bankAccountIdFilter) bankQuery = bankQuery.eq("id", bankAccountIdFilter);

  const { data: bankAccounts, error: bankErr } = await bankQuery;
  if (bankErr) return brickJson({ error: bankErr.message }, 500);

  let debtQuery = admin
    .from("debts")
    .select("id, debt_name, debt_type, brick_connection_id, brick_aggregated_account_id, brick_last_sync_at, brick_link_status, brick_auto_import")
    .eq("organization_id", organizationId)
    .eq("debt_type", "Kartu Kredit")
    .eq("brick_link_status", "linked")
    .not("brick_connection_id", "is", null);

  if (debtIdFilter) debtQuery = debtQuery.eq("id", debtIdFilter);

  const { data: creditDebts, error: debtErr } = await debtQuery;
  if (debtErr) return brickJson({ error: debtErr.message }, 500);

  const now = new Date();
  const endDate = formatYmd(now);
  const globalStart = new Date(now);
  globalStart.setDate(globalStart.getDate() - FIRST_SYNC_DAYS);

  let totalNewBankLines = 0;
  let totalNewDebtLines = 0;
  let totalImportedExpenses = 0;
  const errors: Array<{ targetId: string; name: string; error: string; targetType: string }> = [];

  for (const account of bankAccounts ?? []) {
    const connectionId = String(account.brick_connection_id);
    const aggregatedAccountId = String(account.brick_aggregated_account_id ?? "");
    const userToken = await resolveUserAccessToken(admin, connectionId);
    if (!userToken) {
      errors.push({
        targetId: String(account.id),
        name: String(account.name ?? ""),
        error: "Brick OAuth token unavailable — re-link required",
        targetType: "bank_account",
      });
      continue;
    }

    const lastSync = account.brick_last_sync_at ? new Date(String(account.brick_last_sync_at)) : null;
    const start = lastSync
      ? new Date(lastSync.getTime() - 24 * 60 * 60 * 1000)
      : globalStart;

    try {
      const [transactions, balance] = await Promise.all([
        fetchBrickAccountTransactions(
          userToken,
          aggregatedAccountId,
          "BANK",
          formatYmd(start),
          endDate,
        ),
        fetchBrickAccountBalance(userToken, aggregatedAccountId),
      ]);

      let accountNew = 0;
      for (const tx of transactions) {
        const { data: existing } = await admin
          .from("bank_statement_lines")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("external_id", tx.externalId)
          .maybeSingle();
        if (existing?.id) continue;

        const { error: insErr } = await admin.from("bank_statement_lines").insert({
          organization_id: organizationId,
          bank_account_id: account.id,
          external_id: tx.externalId,
          transaction_date: tx.transactionDate,
          amount: tx.amount,
          direction: tx.direction,
          description: tx.description,
          reference: tx.reference,
          counterparty_name: tx.merchantName,
          raw_payload: tx.raw,
          origin: "brick_sync",
          synced_at: new Date().toISOString(),
        });
        if (!insErr) accountNew += 1;
      }

      totalNewBankLines += accountNew;
      await admin
        .from("bank_accounts")
        .update({
          brick_last_sync_at: new Date().toISOString(),
          brick_last_sync_error: null,
          bank_statement_balance: balance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);

      await admin
        .from("brick_financial_connections")
        .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
        .eq("id", connectionId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Bank aggregation sync failed";
      errors.push({
        targetId: String(account.id),
        name: String(account.name ?? ""),
        error: message,
        targetType: "bank_account",
      });
      await admin
        .from("bank_accounts")
        .update({ brick_last_sync_error: message })
        .eq("id", account.id);
    }
  }

  for (const debt of creditDebts ?? []) {
    const connectionId = String(debt.brick_connection_id);
    const aggregatedAccountId = String(debt.brick_aggregated_account_id ?? "");
    const userToken = await resolveUserAccessToken(admin, connectionId);
    if (!userToken) {
      errors.push({
        targetId: String(debt.id),
        name: String(debt.debt_name ?? ""),
        error: "Brick OAuth token unavailable — re-link required",
        targetType: "debt",
      });
      continue;
    }

    const lastSync = debt.brick_last_sync_at ? new Date(String(debt.brick_last_sync_at)) : null;
    const start = lastSync
      ? new Date(lastSync.getTime() - 24 * 60 * 60 * 1000)
      : globalStart;

    try {
      const transactions = await fetchBrickAccountTransactions(
        userToken,
        aggregatedAccountId,
        "CREDIT_CARD",
        formatYmd(start),
        endDate,
      );

      let debtNew = 0;
      let imported = 0;

      for (const tx of transactions) {
        const { data: existing } = await admin
          .from("debt_statement_lines")
          .select("id, import_status")
          .eq("organization_id", organizationId)
          .eq("external_id", tx.externalId)
          .maybeSingle();

        let lineId = existing?.id ? String(existing.id) : null;

        if (!lineId) {
          const { data: inserted, error: insErr } = await admin
            .from("debt_statement_lines")
            .insert({
              organization_id: organizationId,
              debt_id: debt.id,
              external_id: tx.externalId,
              transaction_date: tx.transactionDate,
              amount: tx.amount,
              direction: tx.direction,
              description: tx.description,
              merchant_name: tx.merchantName,
              reference: tx.reference,
              import_status: tx.direction === "debit" ? "pending" : "skipped",
              raw_payload: tx.raw,
              synced_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (insErr) continue;
          lineId = inserted?.id ? String(inserted.id) : null;
          debtNew += 1;
        }

        if (tx.direction === "debit" && lineId && debt.brick_auto_import !== false) {
          const { data: rpcResult, error: rpcErr } = await admin.rpc(
            "create_expense_from_brick_debt_line",
            { p_line_id: lineId },
          );
          if (!rpcErr && rpcResult && (rpcResult as { ok?: boolean }).ok) {
            if (!(rpcResult as { skipped?: boolean }).skipped) imported += 1;
          }
        }
      }

      totalNewDebtLines += debtNew;
      totalImportedExpenses += imported;

      await admin
        .from("debts")
        .update({
          brick_last_sync_at: new Date().toISOString(),
          brick_last_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", debt.id);

      await admin
        .from("brick_financial_connections")
        .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
        .eq("id", connectionId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Credit card aggregation sync failed";
      errors.push({
        targetId: String(debt.id),
        name: String(debt.debt_name ?? ""),
        error: message,
        targetType: "debt",
      });
      await admin.from("debts").update({ brick_last_sync_error: message }).eq("id", debt.id);
    }
  }

  let suggestedMatches = 0;
  let expenseMatches = 0;
  if ((bankAccounts?.length ?? 0) > 0) {
    try {
      const { data: matchResult, error: matchErr } = await admin.rpc(
        "run_bank_mutation_match_for_org",
        { p_organization_id: organizationId },
      );
      if (!matchErr) {
        suggestedMatches = Number(
          (matchResult as { suggested_inserted?: number })?.suggested_inserted ?? 0,
        );
      }
    } catch {
      // non-blocking
    }

    try {
      const { data: expenseMatchResult, error: expenseMatchErr } = await admin.rpc(
        "run_bank_expense_mutation_match_for_org",
        { p_organization_id: organizationId },
      );
      if (!expenseMatchErr) {
        expenseMatches = Number(
          (expenseMatchResult as { suggested_inserted?: number })?.suggested_inserted ?? 0,
        ) + Number(
          (expenseMatchResult as { confirmed_inserted?: number })?.confirmed_inserted ?? 0,
        );
      }
    } catch {
      // non-blocking
    }
  }

  const walletSync = await syncOrgBrickWalletBalance(admin, organizationId, env);

  return brickJson({
    ok: true,
    accounts: bankAccounts?.length ?? 0,
    creditCards: creditDebts?.length ?? 0,
    newLines: totalNewBankLines,
    newDebtLines: totalNewDebtLines,
    importedExpenses: totalImportedExpenses,
    suggestedMatches,
    expenseMatches,
    vaPoll,
    disbursePoll,
    xenditDisbursePoll,
    walletSync,
    errors: [
      ...errors.map((e) => ({
        bankAccountId: e.targetType === "bank_account" ? e.targetId : "",
        debtId: e.targetType === "debt" ? e.targetId : "",
        name: e.name,
        error: e.error,
      })),
      ...vaPoll.errors.map((err) => ({ bankAccountId: "", name: "va-poll", error: err })),
      ...disbursePoll.errors.map((err) => ({ bankAccountId: "", name: "disburse-poll", error: err })),
      ...xenditDisbursePoll.errors.map((err) => ({ bankAccountId: "", name: "xendit-disburse-poll", error: err })),
    ],
    message:
      (bankAccounts?.length ?? 0) === 0 && (creditDebts?.length ?? 0) === 0
        ? "No OAuth-linked bank accounts or credit cards to sync"
        : undefined,
  }, 200);
}
