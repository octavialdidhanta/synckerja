const ERROR_I18N: Record<string, string> = {
  pos_qris_amount_too_low: "pos.payment.qris.errors.amountTooLow",
  pos_qris_amount_too_high: "pos.payment.qris.errors.amountTooHigh",
  pos_qris_pending_exists: "pos.payment.qris.errors.pendingExists",
  pos_qris_simulate_sandbox_only: "pos.payment.qris.errors.simulateSandboxOnly",
  xendit_not_enabled: "pos.payment.qris.errors.xenditNotEnabled",
  store_checkout_omnichannel_bank_missing: "pos.payment.qris.errors.bankMissing",
  "Xendit not enabled for this organization": "pos.payment.qris.errors.xenditNotEnabled",
  "Pending checkout not found": "pos.payment.qris.errors.pendingNotFound",
  "Pending checkout expired": "pos.payment.qris.errors.expired",
};

export function mapPosQrisErrorKey(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "pos.payment.qris.errors.generic";
  return ERROR_I18N[message] ?? ERROR_I18N[message.split(":")[0]?.trim() ?? ""] ?? "pos.payment.qris.errors.generic";
}

export function mapPosQrisErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
