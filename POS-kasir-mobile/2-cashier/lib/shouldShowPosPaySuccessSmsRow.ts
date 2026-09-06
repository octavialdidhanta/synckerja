import { posMemberPhoneLocalDigits } from "./posCashierCustomer";

/** SMS receipt row on pay success: only when outlet allows SMS and a phone is available. */
export function shouldShowPosPaySuccessSmsRow(args: {
  shareViaSms: boolean;
  customerPhone?: string | null;
  phoneLocal?: string | null;
}): boolean {
  if (!args.shareViaSms) return false;
  const fromCustomer = posMemberPhoneLocalDigits(args.customerPhone);
  const fromField = String(args.phoneLocal ?? "").replace(/\D/g, "");
  const digits = fromCustomer.length >= 8 ? fromCustomer : fromField;
  return digits.length >= 8 && digits.length <= 15;
}
