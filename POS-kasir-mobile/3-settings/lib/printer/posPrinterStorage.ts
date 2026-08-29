import {
  DEFAULT_POS_PRINTER_OUTLET_SETTINGS,
  DEFAULT_POS_PRINTER_ROLES,
  POS_TICKET_COPIES_MAX,
  POS_TICKET_COPIES_MIN,
  type PosPrinterOutletSettings,
  type PosPrinterRoles,
  type PosSavedPrinter,
} from "./posPrinterTypes";

const STORAGE_PREFIX = "synckerja_pos_printers_";

function storageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

function clampCopies(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_POS_PRINTER_OUTLET_SETTINGS.ticketCopies;
  return Math.min(POS_TICKET_COPIES_MAX, Math.max(POS_TICKET_COPIES_MIN, Math.round(n)));
}

function parseRoles(raw: unknown): PosPrinterRoles {
  const base = { ...DEFAULT_POS_PRINTER_ROLES };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  (Object.keys(base) as (keyof PosPrinterRoles)[]).forEach((key) => {
    if (typeof obj[key] === "boolean") base[key] = obj[key] as boolean;
  });
  // Bluetooth never supports sticker labels
  base.sticker_label = false;
  return base;
}

function parsePrinter(raw: unknown): PosSavedPrinter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.address !== "string") return null;
  const categoryIdsForTicket =
    o.categoryIdsForTicket === "all"
      ? "all"
      : Array.isArray(o.categoryIdsForTicket)
        ? o.categoryIdsForTicket.filter((id): id is string => typeof id === "string")
        : "all";
  return {
    id: o.id,
    address: o.address,
    systemName: typeof o.systemName === "string" ? o.systemName : o.address,
    nickname: typeof o.nickname === "string" ? o.nickname : "",
    transport: "bluetooth",
    roles: parseRoles(o.roles),
    categoryIdsForTicket,
  };
}

export function readPosPrinterSettings(outletId: string): PosPrinterOutletSettings {
  try {
    const raw = localStorage.getItem(storageKey(outletId));
    if (!raw) return { ...DEFAULT_POS_PRINTER_OUTLET_SETTINGS, printers: [] };
    const parsed = JSON.parse(raw) as Partial<PosPrinterOutletSettings>;
    const printers = Array.isArray(parsed.printers)
      ? parsed.printers.map(parsePrinter).filter((p): p is PosSavedPrinter => p != null)
      : [];
    return {
      printers,
      ticketCopies: clampCopies(parsed.ticketCopies),
      printTicketOnPay:
        typeof parsed.printTicketOnPay === "boolean"
          ? parsed.printTicketOnPay
          : DEFAULT_POS_PRINTER_OUTLET_SETTINGS.printTicketOnPay,
      printTicketPerProduct:
        typeof parsed.printTicketPerProduct === "boolean"
          ? parsed.printTicketPerProduct
          : DEFAULT_POS_PRINTER_OUTLET_SETTINGS.printTicketPerProduct,
    };
  } catch {
    return { ...DEFAULT_POS_PRINTER_OUTLET_SETTINGS, printers: [] };
  }
}

export function writePosPrinterSettings(
  outletId: string,
  settings: PosPrinterOutletSettings,
): void {
  try {
    const normalized: PosPrinterOutletSettings = {
      ...settings,
      ticketCopies: clampCopies(settings.ticketCopies),
      printers: settings.printers.map((p) => ({
        ...p,
        transport: "bluetooth",
        roles: { ...p.roles, sticker_label: false },
      })),
    };
    localStorage.setItem(storageKey(outletId), JSON.stringify(normalized));
  } catch {
    /* ignore quota / private mode */
  }
}

export function createPosSavedPrinter(input: {
  address: string;
  systemName: string;
  nickname?: string;
}): PosSavedPrinter {
  return {
    id: crypto.randomUUID(),
    address: input.address,
    systemName: input.systemName || input.address,
    nickname: input.nickname?.trim() || "",
    transport: "bluetooth",
    roles: { ...DEFAULT_POS_PRINTER_ROLES },
    categoryIdsForTicket: "all",
  };
}
