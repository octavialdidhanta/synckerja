/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchBrickLedgerTransactions,
  filterTransactionsForAccount,
  formatYmd,
  readBrickEnv,
} from "./brickApi.ts";
import {
  brickCorsHeaders,
  brickJson,
  checkBrickSyncRateLimit,
  getUserFromBearer,
  requireActiveOrg,
  requireBrickOrgAdmin,
} from "./brickAuth.ts";

const FIRST_SYNC_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: brickCorsHeaders() });
  }

  if (req.method !== "POST") {
    return brickJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceKey);

  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return brickJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organizationId ?? "");
  const orgErr = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgErr) return orgErr;

  const adminErr = await requireBrickOrgAdmin(admin, userRes.userId, organizationId);
  if (adminErr) return adminErr;

  const rateErr = await checkBrickSyncRateLimit(admin, organizationId);
  if (rateErr) return rateErr;

  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  const bankAccountIdFilter = body.bankAccountId ? String(body.bankAccountId) : null;

  let accountsQuery = admin
    .from("bank_accounts")
    .select("id, account_number, bank_name, brick_last_sync_at, brick_link_status, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brick_link_status", "linked");

  if (bankAccountIdFilter) {
    accountsQuery = accountsQuery.eq("id", bankAccountIdFilter);
  }

  const { data: accounts, error: accErr } = await accountsQuery;
  if (accErr) return brickJson({ error: accErr.message }, 500);

  if (!accounts?.length) {
    return brickJson({
      ok: true,
      accounts: 0,
      newLines: 0,
      suggestedMatches: 0,
      errors: [],
      message: "No linked bank accounts to sync",
    }, 200);
  }

  const now = new Date();
  const endDate = formatYmd(now);
  let totalNewLines = 0;
  const errors: Array<{ bankAccountId: string; name: string; error: string }> = [];

  for (const account of accounts) {
    const lastSync = account.brick_last_sync_at
      ? new Date(String(account.brick_last_sync_at))
      : null;
    const start = new Date(now);
    if (lastSync) {
      start.setTime(lastSync.getTime() - 24 * 60 * 60 * 1000);
    } else {
      start.setDate(start.getDate() - FIRST_SYNC_DAYS);
    }
    const startDate = formatYmd(start);

    try {
      const ledger = await fetchBrickLedgerTransactions(env, startDate, endDate);
      const filtered = filterTransactionsForAccount(
        ledger,
        account.account_number ? String(account.account_number) : null,
        account.bank_name ? String(account.bank_name) : null,
      );

      let accountNew = 0;
      for (const tx of filtered) {
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
          counterparty_name: tx.counterpartyName,
          raw_payload: tx.raw,
          origin: "brick_sync",
          synced_at: new Date().toISOString(),
        });

        if (insErr) {
          if (!insErr.message.includes("duplicate")) {
            throw new Error(insErr.message);
          }
        } else {
          accountNew += 1;
        }
      }

      totalNewLines += accountNew;

      const credits = filtered.filter((t) => t.direction === "credit");
      const statementBalance = credits.reduce((sum, t) => sum + t.amount, 0);

      await admin
        .from("bank_accounts")
        .update({
          brick_last_sync_at: new Date().toISOString(),
          brick_last_sync_error: null,
          bank_statement_balance: statementBalance > 0 ? statementBalance : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      errors.push({
        bankAccountId: String(account.id),
        name: String(account.name ?? ""),
        error: message,
      });
      await admin
        .from("bank_accounts")
        .update({
          brick_last_sync_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    }
  }

  const { data: matchResult, error: matchErr } = await admin.rpc("run_bank_mutation_match_for_org", {
    p_organization_id: organizationId,
  });

  if (matchErr) {
    errors.push({ bankAccountId: "", name: "matching", error: matchErr.message });
  }

  try {
    await admin.rpc("run_bank_expense_mutation_match_for_org", {
      p_organization_id: organizationId,
    });
  } catch {
    // non-blocking
  }

  const suggestedMatches = Number(
    (matchResult as { suggested_inserted?: number })?.suggested_inserted ?? 0,
  );

  return brickJson({
    ok: true,
    accounts: accounts.length,
    newLines: totalNewLines,
    suggestedMatches,
    errors,
  }, 200);
});
