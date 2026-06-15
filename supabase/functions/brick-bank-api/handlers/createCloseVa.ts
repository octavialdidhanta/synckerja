import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bankShortCodeMatchesBankName,
  createBrickCloseVa,
  readBrickEnv,
} from "../brickApi.ts";
import { brickJson } from "../brickAuth.ts";
import { encodeSynckerjaExternalId } from "../../_shared/brick/synckerjaExternalId.ts";

const SUPPORTED_BANKS = new Set(["MANDIRI", "BRI", "BCA"]);
const DEFAULT_EXPIRY_MINUTES = 3 * 24 * 60; // 3 days (Brick max 30 days)

export async function handleBrickCreateCloseVa(
  admin: SupabaseClient,
  body: Record<string, unknown>,
): Promise<Response> {
  const organizationId = String(body.organizationId ?? "");
  const sapId = String(body.sales_activity_payment_id ?? body.paymentId ?? "").trim();
  const bankShortCode = String(body.bankShortCode ?? body.bank_short_code ?? "MANDIRI")
    .trim()
    .toUpperCase();

  if (!sapId) {
    return brickJson({ error: "sales_activity_payment_id is required" }, 400);
  }
  if (!SUPPORTED_BANKS.has(bankShortCode)) {
    return brickJson({ error: "Unsupported bank. Use MANDIRI, BRI, or BCA." }, 400);
  }

  const env = readBrickEnv();
  if (!env) {
    return brickJson({
      error: "Brick is not configured. Set BRICK_CLIENT_ID and BRICK_CLIENT_SECRET (or BRICK_USE_MOCK=true).",
    }, 503);
  }

  const { data: sap, error: sapErr } = await admin
    .from("sales_activity_payments")
    .select("id, organization_id, payment_amount, sales_activity_id, transfer_verification_status, created_by")
    .eq("id", sapId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (sapErr) return brickJson({ error: sapErr.message }, 500);
  if (!sap) return brickJson({ error: "Sales activity payment not found" }, 404);
  if (sap.transfer_verification_status === "approved") {
    return brickJson({ error: "Payment already verified/paid" }, 400);
  }

  const { data: activeVa } = await admin
    .from("brick_payment_requests")
    .select("id")
    .eq("sales_activity_payment_id", sapId)
    .in("status", ["pending", "paid"])
    .maybeSingle();
  if (activeVa?.id) {
    return brickJson({ error: "Active Brick VA already exists for this payment" }, 400);
  }

  const { data: linkedAccounts } = await admin
    .from("bank_accounts")
    .select("id, bank_name, brick_link_status")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brick_link_status", "linked");

  const hasLinkedBank = (linkedAccounts ?? []).some((a) =>
    bankShortCodeMatchesBankName(bankShortCode, a.bank_name ? String(a.bank_name) : null),
  );
  if (!hasLinkedBank) {
    return brickJson({
      error: `No linked Brick account for ${bankShortCode}. Link a ${bankShortCode} bank account first.`,
    }, 400);
  }

  const { data: sa } = await admin
    .from("sales_activities")
    .select("client_name")
    .eq("id", sap.sales_activity_id)
    .maybeSingle();

  const displayName = String(body.displayName ?? body.name ?? sa?.client_name ?? "Customer")
    .trim()
    .slice(0, 24);
  const referenceId = encodeSynckerjaExternalId("sap", organizationId, sapId);
  const expiryMinutes = Number(body.expiryMinutes ?? body.expiredAtMinutes ?? DEFAULT_EXPIRY_MINUTES);
  const expiresAt = new Date(Date.now() + Math.max(60, expiryMinutes) * 60 * 1000);
  const amount = Math.floor(Number(sap.payment_amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return brickJson({ error: "Invalid payment amount" }, 400);
  }

  try {
    const va = await createBrickCloseVa(env, {
      amount,
      bankShortCode,
      referenceId,
      displayName,
      description: `Piutang ${sapId.slice(0, 8)}`,
      expiryMinutes,
    });

    const { data: row, error: insErr } = await admin
      .from("brick_payment_requests")
      .insert({
        organization_id: organizationId,
        sales_activity_payment_id: sapId,
        reference_id: referenceId,
        brick_va_id: va.id,
        bank_short_code: bankShortCode,
        account_no: va.accountNo,
        expected_amount: amount,
        status: "pending",
        expires_at: va.expiredAt ?? expiresAt.toISOString(),
        raw_response: va.raw,
      })
      .select("*")
      .single();

    if (insErr) return brickJson({ error: insErr.message }, 500);

    return brickJson({
      ok: true,
      va: row,
      warning: bankShortCode === "BCA"
        ? "BCA VA simulate may be unreliable in Brick sandbox; prefer Mandiri or BRI for QA."
        : undefined,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create Brick VA";
    return brickJson({ error: message }, 502);
  }
}
