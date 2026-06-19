import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { mapXenditAccountStatus } from "../services/createSubAccount.ts";
import { syncAllOrgXenditWallets } from "../services/getBalance.ts";

function extractSubAccountId(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.user_id,
    payload.business_id,
    payload.id,
    (payload.data as Record<string, unknown> | undefined)?.user_id,
    (payload.data as Record<string, unknown> | undefined)?.business_id,
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return null;
}

/** Update xendit_sub_accounts when Xendit sends account status webhooks. */
export async function handleAccountWebhook(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
  env?: XenditEnvConfig,
): Promise<void> {
  const subAccountId = extractSubAccountId(payload);
  if (!subAccountId) return;

  const statusRaw = String(
    payload.status ?? (payload.data as Record<string, unknown> | undefined)?.status ?? "",
  );
  const kycRaw = String(
    payload.kyc_status ??
      (payload.data as Record<string, unknown> | undefined)?.kyc_status ??
      "",
  );

  const mappedStatus = statusRaw ? mapXenditAccountStatus(statusRaw) : null;
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    metadata: {
      last_account_webhook: payload,
      last_account_webhook_at: new Date().toISOString(),
    },
  };
  if (mappedStatus) updates.status = mappedStatus;
  if (kycRaw) updates.kyc_status = kycRaw;

  const { data: rows } = await admin
    .from("xendit_sub_accounts")
    .select("id, organization_id, metadata")
    .eq("xendit_sub_account_id", subAccountId);

  const orgIdsToSync = new Set<string>();

  for (const row of rows ?? []) {
    const prevMeta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    await admin
      .from("xendit_sub_accounts")
      .update({
        ...updates,
        metadata: { ...prevMeta, ...(updates.metadata as Record<string, unknown>) },
      })
      .eq("id", row.id);

    if (mappedStatus === "active" && row.organization_id) {
      orgIdsToSync.add(String(row.organization_id));
    }
  }

  if (env && orgIdsToSync.size > 0) {
    for (const orgId of orgIdsToSync) {
      try {
        await syncAllOrgXenditWallets(admin, orgId, env);
      } catch (e) {
        console.error("syncAllOrgXenditWallets after account webhook:", e);
      }
    }
  }
}

export function isAccountWebhookEvent(eventType: string, payload: Record<string, unknown>): boolean {
  const t = eventType.toLowerCase();
  if (t.includes("account")) return true;
  if (payload.event && String(payload.event).toLowerCase().includes("account")) return true;
  if (payload.business_id && payload.status) return true;
  return false;
}
