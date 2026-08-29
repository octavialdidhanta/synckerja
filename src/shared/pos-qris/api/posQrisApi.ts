import { invokeXenditApi } from "@/xendit/lib/xenditApi";
import type { PosQrisPaymentRequest } from "../types/posQris.types";

export async function createPosQrisPaymentRequest(
  organizationId: string,
  pendingCheckoutId: string,
): Promise<PosQrisPaymentRequest> {
  const res = await invokeXenditApi<{ ok: boolean; payment_request: PosQrisPaymentRequest }>({
    action: "createPosQrisPayment",
    organization_id: organizationId,
    pending_checkout_id: pendingCheckoutId,
  });
  return res.payment_request;
}

export async function cancelPosQrisPaymentRequest(
  organizationId: string,
  args: { pendingCheckoutId?: string; paymentRequestId?: string; reason?: string },
): Promise<void> {
  await invokeXenditApi<{ ok: boolean }>({
    action: "cancelPosQrisPayment",
    organization_id: organizationId,
    ...(args.pendingCheckoutId ? { pending_checkout_id: args.pendingCheckoutId } : {}),
    ...(args.paymentRequestId ? { payment_request_id: args.paymentRequestId } : {}),
    ...(args.reason ? { reason: args.reason } : {}),
  });
}

/** Sandbox QA only — completes QRIS without scanning an e-wallet app. */
export async function simulatePosQrisPaymentRequest(
  organizationId: string,
  args: { paymentRequestId?: string; pendingCheckoutId?: string },
): Promise<void> {
  await invokeXenditApi<{ ok: boolean }>({
    action: "simulatePosQrisPayment",
    organization_id: organizationId,
    ...(args.paymentRequestId ? { payment_request_id: args.paymentRequestId } : {}),
    ...(args.pendingCheckoutId ? { pending_checkout_id: args.pendingCheckoutId } : {}),
  });
}
