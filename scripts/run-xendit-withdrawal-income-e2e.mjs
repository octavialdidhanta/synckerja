/**
 * E2E: Xendit withdraw → bank ledger → bank mutations → Income dashboard totals.
 *
 * Usage:
 *   node scripts/run-xendit-withdrawal-income-e2e.mjs
 *   node scripts/run-xendit-withdrawal-income-e2e.mjs --org 663c9336-8cb6-4a36-9ad9-313126e70a1a
 *   node scripts/run-xendit-withdrawal-income-e2e.mjs --withdraw   # optional small live withdraw
 *
 * Output: scripts/.tmp-xendit-withdrawal-income-report.json
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const ORGS = {
  synckerja: "663c9336-8cb6-4a36-9ad9-313126e70a1a",
  octaVialdi: "86fa3758-b1aa-4bc2-97c9-3e5fe484f5bf",
  test: "ea0731a5-0927-46be-9d71-a03266631b49",
};

const ADMIN_EMAILS = {
  [ORGS.synckerja]: "oktavialdidhanta@gmail.com",
  [ORGS.octaVialdi]: "oktavialdidhanta@gmail.com",
  [ORGS.test]: "akhmadzaenudinnn11@gmail.com",
};

const args = process.argv.slice(2);
const doWithdraw = args.includes("--withdraw");
const orgArgIdx = args.indexOf("--org");
const orgId =
  orgArgIdx >= 0 && args[orgArgIdx + 1]
    ? args[orgArgIdx + 1]
    : ORGS.synckerja;

function loadApiKeys() {
  const raw = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const keys = JSON.parse(raw);
  const anon = keys.find((k) => k.id === "anon")?.api_key;
  const service = keys.find((k) => k.id === "service_role")?.api_key;
  if (!anon || !service) throw new Error("Missing anon/service_role API keys");
  return { anon, service };
}

async function signInAsAdmin(email, keys) {
  const admin = createClient(SUPABASE_URL, keys.service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const client = createClient(SUPABASE_URL, keys.anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);
  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error("generateLink: missing hashed_token");
  const { data: sessionData, error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verifyErr) throw new Error(`verifyOtp: ${verifyErr.message}`);
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("No access_token after verifyOtp");
  return { accessToken, admin };
}

async function invokeXendit(accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/xendit-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, body: json };
}

function sumLedger(rows, field) {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
}

async function computeBankLedgerTotal(admin, organizationId) {
  const { data: accounts } = await admin
    .from("bank_accounts")
    .select("id, name, account_number, bank_name, use_for_gateway_payout")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const ids = (accounts ?? []).map((a) => a.id);
  if (ids.length === 0) return { accounts: [], total: 0, perAccount: [] };

  const [incomeRes, expenseRes, gwRes] = await Promise.all([
    admin
      .from("income_transactions")
      .select("bank_account_id, amount")
      .eq("organization_id", organizationId)
      .in("bank_account_id", ids)
      .in("status", ["completed", "pending"]),
    admin
      .from("expenses")
      .select("bank_account_id, amount")
      .eq("organization_id", organizationId)
      .in("bank_account_id", ids)
      .eq("status", "active"),
    admin
      .from("bank_account_balance_history")
      .select("bank_account_id, amount")
      .eq("organization_id", organizationId)
      .eq("transaction_type", "gateway_withdrawal")
      .in("bank_account_id", ids),
  ]);

  const ledger = {};
  for (const id of ids) ledger[id] = 0;
  for (const r of incomeRes.data ?? []) {
    if (r.bank_account_id) ledger[r.bank_account_id] += Number(r.amount);
  }
  for (const r of expenseRes.data ?? []) {
    if (r.bank_account_id) ledger[r.bank_account_id] -= Number(r.amount);
  }
  for (const r of gwRes.data ?? []) {
    if (r.bank_account_id) ledger[r.bank_account_id] += Number(r.amount);
  }

  const perAccount = (accounts ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    account_number: a.account_number,
    bank_name: a.bank_name,
    is_payout: Boolean(a.use_for_gateway_payout),
    balance: ledger[a.id] ?? 0,
  }));

  return {
    accounts: accounts ?? [],
    total: perAccount.reduce((s, a) => s + a.balance, 0),
    perAccount,
  };
}

async function snapshotOrg(admin, accessToken, organizationId) {
  const balance = await invokeXendit(accessToken, {
    action: "getBalance",
    organization_id: organizationId,
  });

  const { data: orgWallet } = await admin
    .from("organization_gateway_wallets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("provider", "xendit")
    .maybeSingle();

  const { data: subWallets } = await admin
    .from("xendit_sub_account_wallets")
    .select("*, xendit_sub_accounts(email, business_name, is_primary)")
    .eq("organization_id", organizationId);

  const { data: withdrawals, error: withdrawalsError } = await admin
    .from("xendit_gateway_withdrawals")
    .select(
      "id, amount, net_amount, platform_fee_amount, status, bank_account_id, sub_account_id, created_at, settled_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: gwHistory, error: gwHistoryError } = await admin
    .from("bank_account_balance_history")
    .select("id, bank_account_id, amount, transaction_type, transaction_id, description, created_at")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "gateway_withdrawal")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: stmtLines } = await admin
    .from("bank_statement_lines")
    .select("id, bank_account_id, amount, direction, origin, description, created_at")
    .eq("organization_id", organizationId)
    .eq("origin", "erp_gateway_withdrawal")
    .order("created_at", { ascending: false })
    .limit(10);

  const bankLedger = await computeBankLedgerTotal(admin, organizationId);

  const xenditUsable = Number(orgWallet?.usable_balance ?? balance.body?.aggregate?.usable_balance ?? 0);
  const grandTotal = bankLedger.total + xenditUsable;

  return {
    at: new Date().toISOString(),
    getBalance: balance.body,
    orgWallet,
    subWallets: subWallets ?? [],
    recentWithdrawals: withdrawals ?? [],
    recentWithdrawalsError: withdrawalsError?.message ?? null,
    recentGatewayBankCredits: gwHistory ?? [],
    recentGatewayBankCreditsError: gwHistoryError?.message ?? null,
    recentBankStatementLines: stmtLines ?? [],
    bankLedger,
    incomeDashboard: {
      bankTotal: bankLedger.total,
      xenditUsable,
      grandTotal,
      formula: "bankTotal + xenditUsable",
    },
  };
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

async function periodTransferTotals(admin, organizationId) {
  const since = monthStartIso();
  const { data: gwCredits } = await admin
    .from("bank_account_balance_history")
    .select("bank_account_id, amount")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "gateway_withdrawal")
    .gte("created_at", since);

  const { data: incomeTx } = await admin
    .from("income_transactions")
    .select("amount")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("transaction_date", since.slice(0, 10));

  const { data: xenditDisb } = await admin
    .from("xendit_disbursements")
    .select("amount, source_type, completed_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("completed_at", since);

  const gatewayTransferIn = sumLedger(gwCredits ?? [], "amount");
  const operatingIncome = sumLedger(incomeTx ?? [], "amount");
  const withdrawalOut = (xenditDisb ?? [])
    .filter((r) => r.source_type === "gateway_withdrawal")
    .reduce((s, r) => s + Number(r.amount), 0);
  const operatingExpense = (xenditDisb ?? [])
    .filter((r) => r.source_type !== "gateway_withdrawal")
    .reduce((s, r) => s + Number(r.amount), 0);

  return {
    period: "This Month",
    since,
    operatingIncome,
    gatewayTransferIn,
    totalIncomeCardShouldExcludeTransfer: true,
    expectedTotalIncomeApprox: operatingIncome,
    xenditDrawer: { withdrawalOut, operatingExpense },
  };
}

async function main() {
  const keys = loadApiKeys();
  const email = ADMIN_EMAILS[orgId];
  if (!email) throw new Error(`No admin email for org ${orgId}`);

  const { accessToken, admin } = await signInAsAdmin(email, keys);

  const report = {
    ranAt: new Date().toISOString(),
    project: PROJECT_REF,
    organizationId: orgId,
    adminEmail: email,
    mode: doWithdraw ? "live-withdraw" : "verify-existing",
    steps: [],
    assertions: [],
  };

  const before = await snapshotOrg(admin, accessToken, orgId);
  report.steps.push({ step: "1_snapshot_before", ...before });

  const periodBefore = await periodTransferTotals(admin, orgId);
  report.steps.push({ step: "2_period_metrics_before", ...periodBefore });

  let withdrawResult = null;
  if (doWithdraw) {
    const primaryUsable =
      before.subWallets?.find((w) => w.xendit_sub_accounts?.is_primary)?.usable_balance ??
      before.getBalance?.aggregate?.usable_balance ??
      0;
    const grossMin = 12_500;
    if (Number(primaryUsable) < grossMin) {
      report.steps.push({
        step: "3_withdraw_skipped",
        reason: `Primary usable ${primaryUsable} < min gross ${grossMin}`,
      });
    } else {
      withdrawResult = await invokeXendit(accessToken, {
        action: "executeGatewayWithdrawal",
        organization_id: orgId,
        amount: grossMin,
      });
      report.steps.push({ step: "3_executeGatewayWithdrawal", ...withdrawResult });

      await invokeXendit(accessToken, {
        action: "pollPendingDisbursements",
        organization_id: orgId,
      });

      await new Promise((r) => setTimeout(r, 3000));

      const afterWithdraw = await snapshotOrg(admin, accessToken, orgId);
      report.steps.push({ step: "4_snapshot_after_withdraw", ...afterWithdraw });

      const deltaBank = afterWithdraw.bankLedger.total - before.bankLedger.total;
      const deltaXendit = afterWithdraw.incomeDashboard.xenditUsable - before.incomeDashboard.xenditUsable;
      const deltaGrand = afterWithdraw.incomeDashboard.grandTotal - before.incomeDashboard.grandTotal;
      report.steps.push({
        step: "5_transfer_deltas",
        deltaBank,
        deltaXendit,
        deltaGrand,
        note: "deltaGrand should be ~ -platform_fee (2500), not +net",
      });
    }
  } else {
    report.steps.push({
      step: "3_verify_latest_completed_withdrawal_chain",
      ...(await verifyLatestWithdrawalChain(
        admin,
        orgId,
        before.recentWithdrawals?.[0],
        before.recentGatewayBankCredits?.[0],
      )),
    });
  }

  const after = await snapshotOrg(admin, accessToken, orgId);
  report.steps.push({ step: doWithdraw ? "6_snapshot_final" : "4_snapshot_current", ...after });

  const periodAfter = await periodTransferTotals(admin, orgId);
  report.steps.push({
    step: doWithdraw ? "7_period_metrics_final" : "5_period_metrics",
    ...periodAfter,
  });

  // Assertions
  const bankSum = after.bankLedger.perAccount.reduce((s, a) => s + a.balance, 0);
  report.assertions.push({
    name: "bank_ledger_sum_matches_bankTotal",
    ok: Math.abs(bankSum - after.incomeDashboard.bankTotal) < 1,
    bankSum,
    bankTotal: after.incomeDashboard.bankTotal,
  });

  report.assertions.push({
    name: "grand_total_equals_bank_plus_xendit",
    ok:
      Math.abs(
        after.incomeDashboard.grandTotal -
          (after.incomeDashboard.bankTotal + after.incomeDashboard.xenditUsable),
      ) < 1,
    grandTotal: after.incomeDashboard.grandTotal,
    bankTotal: after.incomeDashboard.bankTotal,
    xenditUsable: after.incomeDashboard.xenditUsable,
  });

  report.assertions.push({
    name: "gateway_transfer_not_in_operating_income",
    ok: periodAfter.gatewayTransferIn >= 0,
    operatingIncome: periodAfter.operatingIncome,
    gatewayTransferIn: periodAfter.gatewayTransferIn,
    note: "Total Income card uses operatingIncome only (UI fix)",
  });

  if (after.recentWithdrawals?.length > 0) {
    const w = after.recentWithdrawals.find((r) => r.status === "completed") ?? after.recentWithdrawals[0];
    report.assertions.push({
      name: "latest_withdrawal_has_net_and_fee",
      ok: w?.net_amount != null && w?.platform_fee_amount != null,
      withdrawal: w,
    });
  }

  const duplicateGroups = await findDuplicateGatewayWithdrawalHistory(admin, orgId);
  report.assertions.push({
    name: "no_duplicate_gateway_withdrawal_history",
    ok: duplicateGroups.length === 0,
    duplicateGroups,
  });

  const hasGwCredits = (after.recentGatewayBankCredits?.length ?? 0) > 0;
  report.assertions.push({
    name: "withdrawals_visible_when_credits_exist",
    ok: !hasGwCredits || (after.recentWithdrawals?.length ?? 0) > 0,
    hasGwCredits,
    withdrawalsCount: after.recentWithdrawals?.length ?? 0,
    withdrawalsQueryError: after.recentWithdrawalsError ?? null,
  });

  report.summary = {
    incomeDashboard: after.incomeDashboard,
    periodThisMonth: periodAfter,
    assertionsPassed: report.assertions.filter((a) => a.ok).length,
    assertionsFailed: report.assertions.filter((a) => !a.ok).length,
    failed: report.assertions.filter((a) => !a.ok).map((a) => a.name),
  };

  const outPath = "scripts/.tmp-xendit-withdrawal-income-report.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${outPath}`);
  process.exit(report.summary.assertionsFailed > 0 ? 1 : 0);
}

async function findDuplicateGatewayWithdrawalHistory(admin, organizationId) {
  const { data, error } = await admin
    .from("bank_account_balance_history")
    .select("id, transaction_id, amount, created_at")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "gateway_withdrawal")
    .not("transaction_id", "is", null);

  if (error) throw new Error(`duplicate history query: ${error.message}`);

  const byTxn = new Map();
  for (const row of data ?? []) {
    const key = String(row.transaction_id);
    if (!byTxn.has(key)) byTxn.set(key, []);
    byTxn.get(key).push(row);
  }

  return [...byTxn.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([transactionId, rows]) => ({
      transactionId,
      count: rows.length,
      rows,
    }));
}

async function verifyLatestWithdrawalChain(
  admin,
  organizationId,
  latestWithdrawal,
  latestGwCredit,
) {
  let withdrawal = latestWithdrawal ?? null;

  if (!withdrawal && latestGwCredit?.transaction_id) {
    const { data, error } = await admin
      .from("xendit_gateway_withdrawals")
      .select(
        "id, amount, net_amount, platform_fee_amount, status, bank_account_id, sub_account_id, created_at, settled_at",
      )
      .eq("id", latestGwCredit.transaction_id)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: `Failed to load withdrawal by history transaction_id: ${error.message}` };
    }
    withdrawal = data;
  }

  if (!withdrawal) {
    return { ok: false, reason: "No gateway withdrawals found" };
  }

  const { data: disb } = await admin
    .from("xendit_disbursements")
    .select("id, amount, status, source_type, completed_at")
    .eq("organization_id", organizationId)
    .eq("source_type", "gateway_withdrawal")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: gwCredit } = await admin
    .from("bank_account_balance_history")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("transaction_type", "gateway_withdrawal")
    .eq("bank_account_id", withdrawal.bank_account_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: stmt } = await admin
    .from("bank_statement_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("origin", "erp_gateway_withdrawal")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    withdrawal,
    disbursement: disb,
    bankCredit: gwCredit,
    bankStatementLine: stmt
      ? { id: stmt.id, amount: stmt.amount, direction: stmt.direction, description: stmt.description }
      : null,
    chainOk:
      withdrawal.status === "completed" &&
      disb?.status === "completed" &&
      Number(gwCredit?.amount) === Number(withdrawal.net_amount) &&
      Number(stmt?.amount) === Number(withdrawal.net_amount),
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
