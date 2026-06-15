/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  readBrickEnv,
  resolveBankShortCode,
  validateBrickBankAccount,
} from "./brickApi.ts";
import {
  brickCorsHeaders,
  brickJson,
  getUserFromBearer,
  requireActiveOrg,
  requireBrickOrgAdmin,
} from "./brickAuth.ts";

type LinkAction = "link" | "unlink" | "status";

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

  const orgErr = await requireActiveOrg(admin, userRes.userId, String(body.organizationId ?? ""));
  if (orgErr) return orgErr;

  const organizationId = String(body.organizationId ?? "");
  const adminErr = await requireBrickOrgAdmin(admin, userRes.userId, organizationId);
  if (adminErr) return adminErr;

  const action = String(body.action ?? "link") as LinkAction;
  const bankAccountId = String(body.bankAccountId ?? "");

  if (!bankAccountId) {
    return brickJson({ error: "bankAccountId is required" }, 400);
  }

  const { data: bankAccount, error: baErr } = await admin
    .from("bank_accounts")
    .select("id, organization_id, account_number, bank_name, account_holder, brick_link_status, brick_account_id")
    .eq("id", bankAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (baErr) return brickJson({ error: baErr.message }, 500);
  if (!bankAccount) return brickJson({ error: "Bank account not found" }, 404);

  if (action === "unlink") {
    const { error } = await admin.rpc("unlink_bank_account_brick", {
      p_bank_account_id: bankAccountId,
    });
    if (error) return brickJson({ error: error.message }, 500);
    return brickJson({ ok: true, bankAccountId, brickLinkStatus: "unlinked" }, 200);
  }

  if (action === "status") {
    return brickJson({
      ok: true,
      bankAccountId,
      brickLinkStatus: bankAccount.brick_link_status,
      brickAccountId: bankAccount.brick_account_id,
    }, 200);
  }

  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  const accountNumber = String(bankAccount.account_number ?? "").trim();
  const bankShortCode = resolveBankShortCode(bankAccount.bank_name);
  if (!accountNumber || !bankShortCode) {
    return brickJson({
      error: "Bank account must have account_number and recognizable bank_name (Mandiri, BCA, BRI, etc.)",
    }, 400);
  }

  await admin
    .from("bank_accounts")
    .update({ brick_link_status: "pending", brick_last_sync_error: null })
    .eq("id", bankAccountId);

  try {
    const validation = await validateBrickBankAccount(env, accountNumber, bankShortCode);
    const brickAccountId = validation.activityId;

    const { error: updErr } = await admin
      .from("bank_accounts")
      .update({
        brick_account_id: brickAccountId,
        brick_link_status: "linked",
        brick_last_sync_error: null,
        account_holder: bankAccount.account_holder ?? validation.accountName ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankAccountId);

    if (updErr) return brickJson({ error: updErr.message }, 500);

    return brickJson({
      ok: true,
      bankAccountId,
      brickAccountId,
      brickLinkStatus: "linked",
      accountName: validation.accountName,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Brick link failed";
    await admin
      .from("bank_accounts")
      .update({
        brick_link_status: "error",
        brick_last_sync_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankAccountId);
    return brickJson({ error: message }, 502);
  }
});
