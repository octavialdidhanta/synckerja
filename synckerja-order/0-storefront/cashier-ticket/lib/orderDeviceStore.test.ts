import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findCashierTicket,
  listCashierTickets,
  newOrderDeviceId,
  saveCashierTicket,
  updateCashierTicketStatus,
} from "./orderDeviceStore";

const sample = {
  id: "t1",
  storeCode: "H5GTAA",
  claimToken: "ABC1234567",
  pendingCheckoutId: "p1",
  sessionId: "s1",
  tableNumber: "meja 11",
  storeName: "Taman Cibodas",
  grandTotal: 15730,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  status: "pending" as const,
};

describe("orderDeviceStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and lists tickets per store", () => {
    saveCashierTicket(sample);
    expect(listCashierTickets("H5GTAA")).toHaveLength(1);
    expect(listCashierTickets("OTHER")).toHaveLength(0);
    expect(findCashierTicket("ABC1234567")?.grandTotal).toBe(15730);
  });

  it("updates ticket status", () => {
    saveCashierTicket(sample);
    updateCashierTicketStatus("ABC1234567", "paid");
    expect(findCashierTicket("ABC1234567")?.status).toBe("paid");
  });

  it("generates device id without crypto.randomUUID", () => {
    const original = globalThis.crypto?.randomUUID;
    vi.stubGlobal("crypto", { randomUUID: undefined });
    expect(newOrderDeviceId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    if (original) {
      vi.stubGlobal("crypto", { randomUUID: original });
    } else {
      vi.unstubAllGlobals();
    }
  });
});
