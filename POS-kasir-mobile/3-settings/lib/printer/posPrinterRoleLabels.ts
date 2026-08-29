import type { PosPrinterRole } from "./posPrinterTypes";
import { POS_SETTINGS_I18N } from "../posSettingsCopy";

export const POS_PRINTER_ROLE_LABELS: Record<
  PosPrinterRole,
  { key: string; fallback: string; shortKey: string; shortFallback: string }
> = {
  receipt_bill: {
    key: POS_SETTINGS_I18N.printerRoleReceiptBill,
    fallback: "Receipt and Bill",
    shortKey: POS_SETTINGS_I18N.printerRoleShortReceipt,
    shortFallback: "Receipt",
  },
  order_ticket: {
    key: POS_SETTINGS_I18N.printerRoleOrderTicket,
    fallback: "Order Ticket",
    shortKey: POS_SETTINGS_I18N.printerRoleShortTicket,
    shortFallback: "Ticket",
  },
  sticker_label: {
    key: POS_SETTINGS_I18N.printerRoleSticker,
    fallback: "Sticker Label",
    shortKey: POS_SETTINGS_I18N.printerRoleShortSticker,
    shortFallback: "Sticker",
  },
  queue_number: {
    key: POS_SETTINGS_I18N.printerRoleQueue,
    fallback: "Queue Number",
    shortKey: POS_SETTINGS_I18N.printerRoleShortQueue,
    shortFallback: "Queue",
  },
  shift_recap: {
    key: POS_SETTINGS_I18N.printerRoleShift,
    fallback: "Shift Recap",
    shortKey: POS_SETTINGS_I18N.printerRoleShortShift,
    shortFallback: "Shift",
  },
};

export function formatPosPrinterRoleStatus(
  roles: Record<PosPrinterRole, boolean>,
  t: (key: string, fallback: string) => string,
): string {
  const parts: string[] = [];
  const order: PosPrinterRole[] = [
    "receipt_bill",
    "order_ticket",
    "queue_number",
    "shift_recap",
    "sticker_label",
  ];
  for (const role of order) {
    if (!roles[role]) continue;
    const meta = POS_PRINTER_ROLE_LABELS[role];
    parts.push(t(meta.shortKey, meta.shortFallback));
  }
  if (parts.length === 0) {
    return t(POS_SETTINGS_I18N.printerInactive, "Inactive");
  }
  return parts.join(", ");
}

export function posPrinterDisplayName(printer: {
  nickname: string;
  systemName: string;
}): string {
  const nick = printer.nickname.trim();
  return nick || printer.systemName;
}
