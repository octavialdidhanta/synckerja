import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodePosQrisQrExternalId, decodeXenditExternalId } from "../xenditExternalId.ts";
import { unwrapXenditWebhookPayload } from "./verifyWebhook.ts";

function extractQrExternalId(payload: Record<string, unknown>): string {
  const flat = unwrapXenditWebhookPayload(payload);
  const candidates = [
    flat.external_id,
    flat.reference_id,
    payload.external_id,
    payload.reference_id,
    (payload.qr_code as Record<string, unknown> | undefined)?.external_id,
    (flat.qr_code as Record<string, unknown> | undefined)?.external_id,
  ];
  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function extractQrPaymentId(payload: Record<string, unknown>): string | null {
  const flat = unwrapXenditWebhookPayload(payload);
  const id = flat.id ?? payload.id ?? flat.payment_id ?? payload.payment_id;
  return id != null ? String(id) : null;
}

function extractQrId(payload: Record<string, unknown>): string | null {
  const flat = unwrapXenditWebhookPayload(payload);
  const qrId = flat.qr_id ?? flat.xendit_qr_id ?? (payload.qr_code as Record<string, unknown> | undefined)?.id;
  return qrId != null ? String(qrId) : null;
}

export async function handleQrisPaidWebhook(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const flat = unwrapXenditWebhookPayload(payload);
  const status = String(flat.status ?? payload.status ?? "").trim().toUpperCase();
  if (status && status !== "SUCCEEDED" && status !== "COMPLETED" && status !== "PAID") {
    return;
  }

  const externalId = extractQrExternalId(payload);
  const qrId = extractQrId(payload);
  const paymentId = extractQrPaymentId(payload);

  let paymentRequestId: string | null = null;

  if (externalId) {
    const decodedLegacy = decodeXenditExternalId(externalId);
    const decodedQr = decodePosQrisQrExternalId(externalId);
    const isPosQris =
      decodedLegacy?.kind === "pos_qris" ||
      Boolean(decodedQr) ||
      externalId.startsWith("posqris");

    if (isPosQris) {
      const { data: req } = await admin
        .from("xendit_payment_requests")
        .select("id, status")
        .eq("external_id", externalId)
        .maybeSingle();
      if (req?.id) {
        if (req.status === "paid") return;
        paymentRequestId = req.id;
      }
    }
  }

  if (!paymentRequestId && qrId) {
    const { data: req } = await admin
      .from("xendit_payment_requests")
      .select("id, status")
      .eq("xendit_qr_id", qrId)
      .maybeSingle();
    if (req?.id) {
      if (req.status === "paid") return;
      paymentRequestId = req.id;
    }
  }

  // Xendit dashboard test uses reference_id "testing_id_123" — no matching row is expected.
  if (!paymentRequestId) {
    console.info("qris-webhook: no matching payment request", { externalId, qrId });
    return;
  }

  const { error } = await admin.rpc("apply_xendit_qris_settlement", {
    p_payment_request_id: paymentRequestId,
    p_xendit_payment_id: paymentId,
  });
  if (error) throw new Error(error.message);
}

export async function tryHandleQrisPaidByExternalId(
  admin: SupabaseClient,
  externalId: string,
  paymentId: string | null,
): Promise<boolean> {
  const decoded = decodeXenditExternalId(externalId);
  if (!decoded || decoded.kind !== "pos_qris") return false;
  await handleQrisPaidWebhook(admin, {
    external_id: externalId,
    id: paymentId,
    status: "SUCCEEDED",
    qr_code: { external_id: externalId },
  });
  return true;
}
