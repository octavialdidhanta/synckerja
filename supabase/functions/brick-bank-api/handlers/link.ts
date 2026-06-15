import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readBrickEnv } from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import {
  BRICK_OAUTH_RETURN_PATHS,
  resolveBrickOAuthWidgetUrl,
} from "../../_shared/brick/brickFinancialAuth.ts";
import { unlinkBrickTarget } from "../../_shared/brick/brickConnectionService.ts";
import { brickTokenEncryptionConfigured, brickTokenEncryptionMissingMessage } from "../../_shared/brick/brickConfigCrypto.ts";

type LinkAction = "link" | "unlink" | "status" | "oauthStart";

function randomUrlSafe(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function handleBrickAccountLink(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  userId?: string,
): Promise<Response> {
  const action = String(body.action ?? "link") as LinkAction;
  const organizationId = String(body.organizationId ?? "");
  const targetType = (String(body.targetType ?? body.target_type ?? "bank_account").trim()) as
    | "bank_account"
    | "debt";
  const bankAccountId = body.bankAccountId ? String(body.bankAccountId) : "";
  const debtId = body.debtId ? String(body.debtId) : "";
  const targetId = targetType === "debt"
    ? debtId
    : bankAccountId;

  if (!targetId) {
    return brickJson({ error: "target id is required (bankAccountId or debtId)" }, 400);
  }

  if (action === "unlink") {
    await unlinkBrickTarget(admin, { organizationId, targetType, targetId });
    return brickJson({
      ok: true,
      targetType,
      targetId,
      brickLinkStatus: "unlinked",
      ...(targetType === "bank_account" ? { bankAccountId: targetId } : { debtId: targetId }),
    }, 200);
  }

  if (action === "status") {
    if (targetType === "bank_account") {
      const { data: bankAccount } = await admin
        .from("bank_accounts")
        .select("brick_link_status, brick_aggregated_account_id, brick_connection_id")
        .eq("id", targetId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!bankAccount) return brickJson({ error: "Bank account not found" }, 404);
      return brickJson({
        ok: true,
        targetType,
        bankAccountId: targetId,
        brickLinkStatus: bankAccount.brick_link_status,
        brickAggregatedAccountId: bankAccount.brick_aggregated_account_id,
        brickConnectionId: bankAccount.brick_connection_id,
      }, 200);
    }

    const { data: debt } = await admin
      .from("debts")
      .select("brick_link_status, brick_aggregated_account_id, brick_connection_id")
      .eq("id", targetId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!debt) return brickJson({ error: "Debt not found" }, 404);
    return brickJson({
      ok: true,
      targetType,
      debtId: targetId,
      brickLinkStatus: debt.brick_link_status,
      brickAggregatedAccountId: debt.brick_aggregated_account_id,
      brickConnectionId: debt.brick_connection_id,
    }, 200);
  }

  if (action === "link" || action === "oauthStart") {
    const env = readBrickEnv();
    if (!env) {
      return brickJson({
        error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
      }, 503);
    }
    if (!brickTokenEncryptionConfigured() && !env.useMock) {
      return brickJson({ error: brickTokenEncryptionMissingMessage() }, 503);
    }
    if (!userId) return brickJson({ error: "Unauthorized" }, 401);

    if (targetType === "bank_account") {
      const { data: bankAccount } = await admin
        .from("bank_accounts")
        .select("id")
        .eq("id", targetId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!bankAccount) return brickJson({ error: "Bank account not found" }, 404);
    } else {
      const { data: debt } = await admin
        .from("debts")
        .select("id, debt_type")
        .eq("id", targetId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!debt) return brickJson({ error: "Debt not found" }, 404);
      if (String(debt.debt_type) !== "Kartu Kredit") {
        return brickJson({ error: "Brick OAuth is only for Kartu Kredit debts" }, 400);
      }
    }

    const returnPathRaw = body.return_path != null ? String(body.return_path).trim() : "";
    const returnPath = BRICK_OAUTH_RETURN_PATHS.has(returnPathRaw) ? returnPathRaw : (
      targetType === "debt" ? "/expenses/debt" : "/incomes/transaction"
    );

    const stateToken = randomUrlSafe(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: stateErr } = await admin.from("brick_oauth_states").insert({
      organization_id: organizationId,
      user_id: userId,
      state_token: stateToken,
      target_type: targetType,
      target_id: targetId,
      return_path: returnPath,
      expires_at: expiresAt,
    });
    if (stateErr) return brickJson({ error: stateErr.message }, 500);

    if (targetType === "bank_account") {
      await admin
        .from("bank_accounts")
        .update({ brick_link_status: "pending", brick_last_sync_error: null })
        .eq("id", targetId);
    } else {
      await admin
        .from("debts")
        .update({ brick_link_status: "pending", brick_last_sync_error: null })
        .eq("id", targetId);
    }

    const appOrigin = String(body.app_origin ?? body.appOrigin ?? "").trim().replace(/\/+$/, "") ||
      undefined;

    let widgetUrl: string;
    try {
      ({ widgetUrl } = await resolveBrickOAuthWidgetUrl({
        env,
        state: stateToken,
        originOverride: appOrigin,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to obtain Brick public access token";
      return brickJson({ error: msg }, 502);
    }

    return brickJson({
      ok: true,
      widgetUrl,
      state: stateToken,
      targetType,
      targetId,
      ...(targetType === "bank_account" ? { bankAccountId: targetId } : { debtId: targetId }),
      message: "Open Brick Widget to complete OAuth link",
    }, 200);
  }

  return brickJson({ error: "Unknown link action" }, 400);
}
