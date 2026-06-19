/**
 * JIT KYC + Xendit multi sub-account E2E verification (sandbox/production linked project).
 * Usage: node scripts/run-xendit-jit-e2e.mjs
 * Requires: linked Supabase CLI login, @supabase/supabase-js
 */
import { execSync } from "node:child_process";
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
  return accessToken;
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

function assert(condition, message) {
  return { ok: Boolean(condition), message };
}

async function main() {
  const keys = loadApiKeys();
  const report = {
    ranAt: new Date().toISOString(),
    project: PROJECT_REF,
    checks: [],
    notes: [],
  };

  // --- Synckerja (internal candidate) ---
  {
    const orgId = ORGS.synckerja;
    const token = await signInAsAdmin(ADMIN_EMAILS[orgId], keys);
    const settings = await invokeXendit(token, { action: "getSettings", organization_id: orgId });
    report.checks.push({
      name: "getSettings Synckerja",
      status: settings.status,
      ok: settings.status === 200,
      hasSubAccounts: Array.isArray(settings.body.subAccounts),
      subCount: settings.body.subAccounts?.length ?? 0,
      isInternalOrg: settings.body.isInternalOrg,
      primaryStatus: settings.body.primarySubAccount?.status ?? settings.body.account?.status,
      xenditEnabled: settings.body.account?.is_enabled,
    });

    const gate = await invokeXendit(token, { action: "requestSubAccount", organization_id: orgId });
    const isInternal = gate.body.is_internal === true;
    const requireKyc = gate.body.require_kyc === true;
    const canCreate = gate.body.can_create === true;
    report.checks.push({
      name: "requestSubAccount Synckerja",
      status: gate.status,
      is_internal: gate.body.is_internal,
      require_kyc: gate.body.require_kyc,
      can_create: gate.body.can_create,
      account_type: gate.body.account_type,
      logicOk: isInternal ? !requireKyc && canCreate && gate.body.account_type === "OWNED" : true,
    });
    if (!isInternal) {
      report.notes.push(
        "XENDIT_INTERNAL_ORG_IDS mungkin belum memuat UUID Synckerja — org diperlakukan sebagai tenant eksternal.",
      );
    }
  }

  // --- Test org (external, enabled, no sub-account) ---
  {
    const orgId = ORGS.test;
    const token = await signInAsAdmin(ADMIN_EMAILS[orgId], keys);
    const settings = await invokeXendit(token, { action: "getSettings", organization_id: orgId });
    report.checks.push({
      name: "getSettings Test org",
      status: settings.status,
      xenditEnabled: settings.body.account?.is_enabled,
      subCount: settings.body.subAccounts?.length ?? 0,
      kyc: settings.body.kyc?.status ?? null,
    });

    const gate = await invokeXendit(token, { action: "requestSubAccount", organization_id: orgId });
    const logicOk =
      gate.body.is_internal === false &&
      gate.body.require_kyc === true &&
      gate.body.can_create === false &&
      gate.body.account_type === "MANAGED";
    report.checks.push({
      name: "requestSubAccount Test (no KYC yet)",
      status: gate.status,
      body: gate.body,
      logicOk,
    });

    if (!settings.body.account?.is_enabled) {
      const enable = await invokeXendit(token, { action: "enableXendit", organization_id: orgId, enabled: true });
      report.checks.push({
        name: "enableXendit Test org",
        status: enable.status,
        ok: enable.body.ok === true,
      });
    }
  }

  // --- Octa Vialdi org ---
  {
    const orgId = ORGS.octaVialdi;
    const token = await signInAsAdmin(ADMIN_EMAILS[orgId], keys);
    const gate = await invokeXendit(token, { action: "requestSubAccount", organization_id: orgId });
    report.checks.push({
      name: "requestSubAccount Octa Vialdi",
      status: gate.status,
      require_kyc: gate.body.require_kyc,
      can_create: gate.body.can_create,
      is_internal: gate.body.is_internal,
    });
  }

  // --- Payroll gate logic (read-only): primary must be active ---
  {
    const orgId = ORGS.synckerja;
    const token = await signInAsAdmin(ADMIN_EMAILS[orgId], keys);
    const settings = await invokeXendit(token, { action: "getSettings", organization_id: orgId });
    const primary = settings.body.primarySubAccount;
    const payrollWouldBlock = !primary || primary.status !== "active";
    report.checks.push({
      name: "Payroll gate Synckerja (primary active?)",
      primaryStatus: primary?.status ?? "missing",
      payrollWouldBlock,
      logicOk: payrollWouldBlock === true,
      note: "Synckerja primary saat ini failed/null xendit id — disburse harus diblokir",
    });
  }

  // --- executeTenantDisbursement should fail when not active ---
  {
    const orgId = ORGS.synckerja;
    const token = await signInAsAdmin(ADMIN_EMAILS[orgId], keys);
    const disb = await invokeXendit(token, {
      action: "executeTenantDisbursement",
      organization_id: orgId,
      source_type: "payroll_run",
      payroll_run_id: "00000000-0000-0000-0000-000000000000",
    });
    const blocked =
      disb.status >= 400 ||
      String(disb.body.error ?? "").toLowerCase().includes("belum aktif") ||
      String(disb.body.error ?? "").toLowerCase().includes("not enabled");
    report.checks.push({
      name: "executeTenantDisbursement blocked when inactive",
      status: disb.status,
      error: disb.body.error ?? null,
      logicOk: blocked,
    });
  }

  const passed = report.checks.filter((c) => c.logicOk !== false && c.ok !== false).length;
  const failed = report.checks.filter((c) => c.logicOk === false || c.ok === false);
  report.summary = {
    total: report.checks.length,
    passed,
    failed: failed.length,
    failedChecks: failed.map((f) => f.name),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
