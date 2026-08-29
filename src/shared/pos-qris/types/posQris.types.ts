export type PosQrisPaymentRequestStatus = "pending" | "paid" | "expired" | "failed";

export type PosQrisPaymentRequest = {
  id: string;
  organization_id: string;
  payment_type: "qris";
  pos_pending_checkout_id: string | null;
  sales_activity_id: string | null;
  expected_amount: number;
  platform_fee_amount?: number;
  status: PosQrisPaymentRequestStatus;
  qr_string: string | null;
  expires_at: string | null;
  paid_at?: string | null;
  external_id: string;
};

export type PosPendingCheckoutStatus =
  | "pending"
  | "paid"
  | "cancelled"
  | "expired"
  | "finalizing"
  | "failed";

export type PosPendingCheckout = {
  id: string;
  organization_id: string;
  status: PosPendingCheckoutStatus;
  sales_activity_id: string | null;
  xendit_payment_request_id: string | null;
  expires_at: string;
};

export type PosQrisCreateResult = {
  ok: boolean;
  pending_checkout_id: string;
  expires_at: string;
  payment_request: PosQrisPaymentRequest;
};

export const POS_QRIS_MIN_AMOUNT = 1500;
export const POS_QRIS_MAX_AMOUNT = 10_000_000;
export const POS_QRIS_EXPIRY_MINUTES = 15;
