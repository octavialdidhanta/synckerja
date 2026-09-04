import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { readPosPrinterSettings } from "./posPrinterStorage";

/** Deep-link into Settings → Hardware → Printer. */
export function posPrinterSettingsPath(): string {
  return `${POS_AUTH_PATHS.settings}?section=printer`;
}

/** True when this outlet has at least one printer with Receipt/Bill enabled. */
export function outletHasReceiptBillPrinter(outletId: string | null | undefined): boolean {
  const id = outletId?.trim();
  if (!id) return false;
  return readPosPrinterSettings(id).printers.some((p) => p.roles.receipt_bill);
}
