/** Print job roles a POS printer can handle. */
export type PosPrinterRole =
  | "receipt_bill"
  | "order_ticket"
  | "sticker_label"
  | "queue_number"
  | "shift_recap";

export type PosPrinterTransport = "bluetooth";

export type PosPrinterRoles = Record<PosPrinterRole, boolean>;

export type PosSavedPrinter = {
  id: string;
  address: string;
  systemName: string;
  nickname: string;
  transport: PosPrinterTransport;
  roles: PosPrinterRoles;
  /** Category ids included on order tickets, or `"all"`. */
  categoryIdsForTicket: string[] | "all";
};

export type PosPrinterOutletSettings = {
  printers: PosSavedPrinter[];
  ticketCopies: number;
  printTicketOnPay: boolean;
  printTicketPerProduct: boolean;
};

export type PosBluetoothDevice = {
  address: string;
  name: string;
  bonded?: boolean;
};

export const POS_PRINTER_ROLES: readonly PosPrinterRole[] = [
  "receipt_bill",
  "order_ticket",
  "sticker_label",
  "queue_number",
  "shift_recap",
] as const;

export const DEFAULT_POS_PRINTER_ROLES: PosPrinterRoles = {
  receipt_bill: true,
  order_ticket: true,
  sticker_label: false,
  queue_number: false,
  shift_recap: false,
};

export const DEFAULT_POS_PRINTER_OUTLET_SETTINGS: PosPrinterOutletSettings = {
  printers: [],
  ticketCopies: 1,
  printTicketOnPay: false,
  printTicketPerProduct: false,
};

export const POS_TICKET_COPIES_MIN = 1;
export const POS_TICKET_COPIES_MAX = 5;
