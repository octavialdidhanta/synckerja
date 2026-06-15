/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBrickEnv } from "../_shared/brick/brickApi.ts";
import {
  BRICK_OAUTH_RETURN_PATHS,
  brickOAuthJson,
  resolveBrickOAuthWidgetUrl,
} from "../_shared/brick/brickFinancialAuth.ts";
import {
  brickCorsHeaders,
  getUserFromBearer,
  requireActiveOrg,
  requireBrickOrgAdmin,
} from "../_shared/brick/brickAuth.ts";
import { brickTokenEncryptionConfigured, brickTokenEncryptionMissingMessage } from "../_shared/brick/brickConfigCrypto.ts";

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: brickCorsHeaders() });
  }
  if (req.method !== "POST") {
    return brickOAuthJson({ error: "Method not allowed" }, 405);
  }

  const env = readBrickEnv();
  if (!env) {
    return brickOAuthJson({ error: "Brick is not configured on the server" }, 503);
  }

  if (!brickTokenEncryptionConfigured() && !env.useMock) {
    return brickOAuthJson({ error: brickTokenEncryptionMissingMessage() }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return brickOAuthJson({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const userRes = await getUserFromBearer(admin, req.headers.get("Authorization"));
  if ("error" in userRes) return userRes.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return brickOAuthJson({ error: "Invalid JSON body" }, 400);
  }

  const organizationId = String(body.organization_id ?? body.organizationId ?? "").trim();
  const targetType = String(body.target_type ?? body.targetType ?? "").trim() as "bank_account" | "debt";
  const targetId = String(body.target_id ?? body.targetId ?? body.bankAccountId ?? body.debtId ?? "").trim();
  const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
  const appOriginRaw = String(body.app_origin ?? body.appOrigin ?? "").trim().replace(/\/+$/, "");

  if (!organizationId) return brickOAuthJson({ error: "Missing organization_id" }, 400);
  if (targetType !== "bank_account" && targetType !== "debt") {
    return brickOAuthJson({ error: "target_type must be bank_account or debt" }, 400);
  }
  if (!targetId) return brickOAuthJson({ error: "Missing target_id" }, 400);

  const orgErr = await requireActiveOrg(admin, userRes.userId, organizationId);
  if (orgErr) return orgErr;

  const adminErr = await requireBrickOrgAdmin(admin, userRes.userId, organizationId);
  if (adminErr) return adminErr;

  if (targetType === "bank_account") {
    const { data: bank } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!bank) return brickOAuthJson({ error: "Bank account not found" }, 404);
  } else {
    const { data: debt } = await admin
      .from("debts")
      .select("id, debt_type")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!debt) return brickOAuthJson({ error: "Debt not found" }, 404);
    if (String(debt.debt_type) !== "Kartu Kredit") {
      return brickOAuthJson({ error: "Brick OAuth is only for Kartu Kredit debts" }, 400);
    }
  }

  const returnPath = BRICK_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : null;
  const stateToken = randomUrlSafe(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: stateErr } = await admin.from("brick_oauth_states").insert({
    organization_id: organizationId,
    user_id: userRes.userId,
    state_token: stateToken,
    target_type: targetType,
    target_id: targetId,
    expires_at: expiresAt,
    ...(returnPath ? { return_path: returnPath } : {}),
  });
  if (stateErr) {
    console.error("brick-oauth-start state:", stateErr.message);
    return brickOAuthJson({ error: "Failed to start Brick OAuth" }, 500);
  }

  let widgetUrl: string;
  let connectMode: "app_connect" | "brick_widget";
  try {
    ({ widgetUrl, connectMode } = await resolveBrickOAuthWidgetUrl({
      env,
      state: stateToken,
      originOverride: appOriginRaw || undefined,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_failed";
    return brickOAuthJson({ error: msg }, 502);
  }

  return brickOAuthJson({
    widgetUrl,
    state: stateToken,
    targetType,
    targetId,
    connectMode,
  }, 200);
});
