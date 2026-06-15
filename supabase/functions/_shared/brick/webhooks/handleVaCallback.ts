import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bankShortCodeMatchesBankName } from "../brickApi.ts";
import { decodeSynckerjaExternalId } from "../synckerjaExternalId.ts";
import type { ParsedBrickVaCallback } from "./parseBrickCallback.ts";

export async function processBrickVaStatusUpdate(
  admin: SupabaseClient,
  parsed: ParsedBrickVaCallback,
): Promise<{ ok: boolean; linked: boolean; settled: boolean }> {
  let brickRequest: Record<string, unknown> | null = null;

  if (parsed.referenceId) {
    const { data } = await admin
      .from("brick_payment_requests")
      .select("*")
      .eq("reference_id", parsed.referenceId)
      .maybeSingle();
    brickRequest = data ?? null;
  }

  if (!brickRequest && parsed.paymentId) {
    const { data } = await admin
      .from("brick_payment_requests")
      .select("*")
      .eq("brick_payment_id", parsed.paymentId)
      .maybeSingle();
    brickRequest = data ?? null;
  }

  if (!brickRequest && parsed.vaId) {
    const { data } = await admin
      .from("brick_payment_requests")
      .select("*")
      .eq("brick_va_id", parsed.vaId)
      .maybeSingle();
    brickRequest = data ?? null;
  }

  let organizationId: string | null = brickRequest
    ? String(brickRequest.organization_id)
    : null;

  if (!organizationId && parsed.referenceId) {
    const decoded = decodeSynckerjaExternalId(parsed.referenceId);
    if (decoded) organizationId = decoded.organizationId;
  }

  if (!organizationId) {
    return { ok: false, linked: false, settled: false };
  }

  const bankShortCode = parsed.bankShortCode ??
    (brickRequest ? String(brickRequest.bank_short_code) : null);

  const { data: bankId, error: bankErr } = await admin.rpc("resolve_brick_va_bank_account_id", {
    p_organization_id: organizationId,
    p_bank_short_code: bankShortCode ?? "MANDIRI",
  });
  if (bankErr || !bankId) {
    console.error("resolve_brick_va_bank_account_id:", bankErr?.message);
    return { ok: false, linked: Boolean(brickRequest), settled: false };
  }

  const externalId = parsed.paymentId ?? parsed.vaId ?? parsed.eventId;
  const amount = parsed.amount > 0
    ? parsed.amount
    : brickRequest
      ? Number(brickRequest.expected_amount)
      : 0;

  if (amount > 0 && (parsed.status === "paid" || parsed.status === "completed")) {
    const { error: upsertErr } = await admin.rpc("upsert_bank_statement_from_brick_callback", {
      p_organization_id: organizationId,
      p_bank_account_id: bankId,
      p_external_id: externalId,
      p_transaction_date: parsed.createdAt ?? new Date().toISOString(),
      p_amount: amount,
      p_description: `Brick VA ${parsed.status}`,
      p_reference: parsed.referenceId,
      p_raw_payload: parsed.raw,
    });
    if (upsertErr) {
      console.error("upsert_bank_statement_from_brick_callback:", upsertErr.message);
    }

    await admin.rpc("run_bank_mutation_match_for_org", {
      p_organization_id: organizationId,
    });
  }

  if (!brickRequest?.id) {
    return { ok: true, linked: false, settled: false };
  }

  const reqId = String(brickRequest.id);

  if (parsed.status === "paid") {
    await admin.rpc("mark_brick_payment_request_paid", {
      p_brick_payment_request_id: reqId,
      p_brick_payment_id: parsed.paymentId,
    });
    return { ok: true, linked: true, settled: false };
  }

  if (parsed.status === "completed") {
    const { error } = await admin.rpc("apply_brick_va_settlement", {
      p_brick_payment_request_id: reqId,
      p_brick_payment_id: parsed.paymentId,
    });
    if (error) {
      console.error("apply_brick_va_settlement:", error.message);
      return { ok: false, linked: true, settled: false };
    }
    return { ok: true, linked: true, settled: true };
  }

  if (parsed.status === "expired") {
    await admin
      .from("brick_payment_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", reqId);
  }

  return { ok: true, linked: true, settled: false };
}

export async function pickPrimaryVaBankAccountIds(
  admin: SupabaseClient,
  organizationId: string,
  accounts: Array<{ id: string; bank_name: string | null; use_for_omnichannel_income?: boolean }>,
): Promise<Set<string>> {
  const primaryIds = new Set<string>();
  const byBank = new Map<string, Array<{ id: string; omnichannel: boolean; created: number }>>();

  for (const account of accounts) {
    const code = resolveBankCodeKey(account.bank_name);
    if (!code) continue;
    const list = byBank.get(code) ?? [];
    list.push({
      id: String(account.id),
      omnichannel: Boolean(account.use_for_omnichannel_income),
      created: 0,
    });
    byBank.set(code, list);
  }

  for (const [, list] of byBank) {
    const omnichannel = list.find((a) => a.omnichannel);
    if (omnichannel) {
      primaryIds.add(omnichannel.id);
      continue;
    }
    if (list.length === 1) {
      primaryIds.add(list[0].id);
    }
  }

  return primaryIds;
}

function resolveBankCodeKey(bankName: string | null): string | null {
  if (!bankName) return null;
  const n = bankName.toLowerCase();
  if (n.includes("mandiri")) return "MANDIRI";
  if (n.includes("bri")) return "BRI";
  if (n.includes("bca")) return "BCA";
  if (n.includes("bni")) return "BNI";
  return bankName.toUpperCase();
}

export function accountMatchesBrickBank(
  bankShortCode: string | null,
  bankName: string | null,
): boolean {
  if (!bankShortCode) return true;
  return bankShortCodeMatchesBankName(bankShortCode, bankName);
}
