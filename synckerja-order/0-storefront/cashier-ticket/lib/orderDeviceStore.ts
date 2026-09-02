export type StoredCashierTicket = {
  id: string;
  storeCode: string;
  claimToken: string;
  pendingCheckoutId: string;
  sessionId: string;
  tableNumber: string;
  storeName: string;
  grandTotal: number;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "claimed" | "paid" | "expired" | "cancelled";
  fulfillment?: "dine_in" | "takeaway";
};

const STORAGE_KEY = "synckerja_order_device_v1";

type DeviceStore = {
  deviceId: string;
  tickets: StoredCashierTicket[];
};

/** Works on HTTP LAN dev where `crypto.randomUUID` is unavailable (non-secure context). */
export function newOrderDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readStore(): DeviceStore {
  if (typeof window === "undefined") {
    return { deviceId: "ssr", tickets: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { deviceId: newOrderDeviceId(), tickets: [] };
    const parsed = JSON.parse(raw) as DeviceStore;
    if (!parsed.deviceId || !Array.isArray(parsed.tickets)) {
      return { deviceId: newOrderDeviceId(), tickets: [] };
    }
    return parsed;
  } catch {
    return { deviceId: newOrderDeviceId(), tickets: [] };
  }
}

function writeStore(store: DeviceStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getOrderDeviceId(): string {
  const store = readStore();
  if (!store.deviceId) {
    store.deviceId = newOrderDeviceId();
    writeStore(store);
  }
  return store.deviceId;
}

export function saveCashierTicket(ticket: StoredCashierTicket) {
  const store = readStore();
  const next = store.tickets.filter((row) => row.claimToken !== ticket.claimToken);
  next.unshift(ticket);
  writeStore({ ...store, tickets: next.slice(0, 50) });
}

export function listCashierTickets(storeCode?: string): StoredCashierTicket[] {
  const tickets = readStore().tickets;
  if (!storeCode) return tickets;
  return tickets.filter((row) => row.storeCode === storeCode);
}

export function updateCashierTicketStatus(
  claimToken: string,
  status: StoredCashierTicket["status"],
) {
  const store = readStore();
  const tickets = store.tickets.map((row) =>
    row.claimToken === claimToken ? { ...row, status } : row,
  );
  writeStore({ ...store, tickets });
}

export function updateCashierTicketTotals(claimToken: string, grandTotal: number) {
  const store = readStore();
  const tickets = store.tickets.map((row) =>
    row.claimToken === claimToken ? { ...row, grandTotal } : row,
  );
  writeStore({ ...store, tickets });
}

export function findCashierTicket(claimToken: string): StoredCashierTicket | null {
  return readStore().tickets.find((row) => row.claimToken === claimToken) ?? null;
}
