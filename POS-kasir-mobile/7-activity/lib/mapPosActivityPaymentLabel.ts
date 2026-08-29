import type { PosActivityPaymentMethod } from "./posActivityTypes";
import { POS_ACTIVITY_I18N } from "./posActivityCopy";

export function mapPosActivityPaymentLabel(
  method: PosActivityPaymentMethod | null | undefined,
  t: (key: string, fallback: string) => string,
): string {
  if (method === "cash") return t(POS_ACTIVITY_I18N.methodCash, "Cash");
  if (method === "bank_transfer") {
    return t(POS_ACTIVITY_I18N.methodTransfer, "Bank transfer");
  }
  if (method === "e_wallet") {
    return t(POS_ACTIVITY_I18N.methodEwallet, "E-wallet");
  }
  if (method) return String(method);
  return t(POS_ACTIVITY_I18N.dash, "—");
}
