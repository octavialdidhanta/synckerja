import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { xenditRequest } from "../xenditClient.ts";
import { encodePosQrisQrExternalId } from "../xenditExternalId.ts";
import type { XenditEnvConfig } from "../xenditEnv.ts";
import { resolvePrimarySubAccount } from "./resolveSubAccount.ts";
import { getPlatformFlatFee } from "./createSplitRule.ts";

type CreateQrResponse = {
  id?: string;
  external_id?: string;
  qr_string?: string;
  amount?: number;
  type?: string;
  status?: string;
  expires_at?: string;
};

function readWebhookCallbackUrl(): string {
  const base = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/functions/v1/xendit-api`;
}

export async function createPosQrisPayment(
  admin: SupabaseClient,
  env: XenditEnvConfig,
  organizationId: string,
  input: {
    pending_checkout_id: string;
  },
): Promise<Record<string, unknown>> {
  const pendingId = input.pending_checkout_id.trim();
  if (!pendingId) throw new Error("Missing pending_checkout_id");

  const { data: settings } = await admin
    .from("organization_xendit_settings")
    .select("is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!settings?.is_enabled) throw new Error("Xendit not enabled for this organization");

  const { subAccountId } = await resolvePrimarySubAccount(admin, env, organizationId);

  const { data: pending, error: pendingErr } = await admin
    .from("pos_pending_checkouts")
    .select("id, organization_id, status, expires_at, payload")
    .eq("id", pendingId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (pendingErr) throw new Error(pendingErr.message);
  if (!pending) throw new Error("Pending checkout not found");
  if (pending.status !== "pending") throw new Error("Pending checkout is not active");
  if (pending.expires_at && new Date(String(pending.expires_at)).getTime() <= Date.now()) {
    throw new Error("Pending checkout expired");
  }

  const payload = pending.payload as Record<string, unknown> | null;
  const checkoutTotals = payload?.checkoutTotals as Record<string, unknown> | undefined;
  const grossAmount = Math.floor(Number(checkoutTotals?.grandTotal ?? 0));
  if (grossAmount < 1500) throw new Error("pos_qris_amount_too_low");
  if (grossAmount > 10_000_000) throw new Error("pos_qris_amount_too_high");

  const { data: activeQr } = await admin
    .from("xendit_payment_requests")
    .select("id, qr_string, expires_at, status")
    .eq("pos_pending_checkout_id", pendingId)
    .eq("status", "pending")
    .maybeSingle();
  if (activeQr?.id) {
    return activeQr as Record<string, unknown>;
  }

  const flatFeeAmount = await getPlatformFlatFee(admin, env);
  if (flatFeeAmount > 0 && grossAmount <= flatFeeAmount) {
    throw new Error(
      `Payment amount must be greater than platform fee (Rp ${flatFeeAmount.toLocaleString("id-ID")})`,
    );
  }

  // QR API rejects external_id with `:`, `-`, `_`. Platform fee is netted in apply_xendit_qris_settlement.
  // QRIS channel often rejects custom expires_at on create — keep 60s locally and expire via cancel RPC.
  const POS_QRIS_TTL_MS = 60_000;
  const externalId = encodePosQrisQrExternalId(organizationId, pendingId);
  const expiresAt = new Date(Date.now() + POS_QRIS_TTL_MS);
  const callbackUrl = readWebhookCallbackUrl();

  const qrBody: Record<string, unknown> = {
    external_id: externalId,
    type: "DYNAMIC",
    amount: grossAmount,
    ...(callbackUrl ? { callback_url: callbackUrl } : {}),
  };

  const qrRes = await xenditRequest<CreateQrResponse>(env.secretKey, {
    method: "POST",
    path: "/qr_codes",
    forUserId: subAccountId,
    idempotencyKey: externalId,
    body: qrBody,
  });

  const platformFeeStatus = flatFeeAmount > 0 ? "pending" : "not_applicable";

  const { data: row, error: insErr } = await admin
    .from("xendit_payment_requests")
    .insert({
      organization_id: organizationId,
      payment_type: "qris",
      sales_activity_payment_id: null,
      pos_pending_checkout_id: pendingId,
      sub_account_id: subAccountId,
      external_id: externalId,
      bank_code: "QRIS",
      expected_amount: grossAmount,
      platform_fee_amount: flatFeeAmount,
      split_rule_id: null,
      platform_fee_status: platformFeeStatus,
      status: "pending",
      xendit_qr_id: qrRes.id != null ? String(qrRes.id) : null,
      qr_string: qrRes.qr_string != null ? String(qrRes.qr_string) : null,
      expires_at: expiresAt.toISOString(),
      raw_response: qrRes,
    })
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);

  await admin
    .from("pos_pending_checkouts")
    .update({
      xendit_payment_request_id: row.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pendingId);

  return row as Record<string, unknown>;
}
