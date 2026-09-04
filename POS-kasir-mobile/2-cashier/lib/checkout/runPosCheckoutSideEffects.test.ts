import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { createPosCheckoutPrintLock } from "./posCheckoutPrintLock";
import { runPosCheckoutSideEffects } from "./runPosCheckoutSideEffects";

const mockPrintTickets = vi.fn();
const mockPrintReceipt = vi.fn();
const mockPrefs = vi.fn();

vi.mock("@/pos-mobile/shared/printing/posPrintService", () => ({
  printPosOrderTickets: (...args: unknown[]) => mockPrintTickets(...args),
  printPosReceiptBill: (...args: unknown[]) => mockPrintReceipt(...args),
  getPosTicketPrintPrefs: (...args: unknown[]) => mockPrefs(...args),
}));

const totals = {
  subtotal: 1000,
  tax: 0,
  service: 0,
  grandTotal: 1000,
} as CatalogCheckoutTotals;

const line = {
  catalogId: "p1",
  quantity: 1,
  serviceName: "Nasi",
} as CustomerVisitCartLine;

describe("runPosCheckoutSideEffects", () => {
  beforeEach(() => {
    mockPrintTickets.mockReset();
    mockPrintReceipt.mockReset();
    mockPrefs.mockReset();
    mockPrefs.mockReturnValue({ hasReceiptPrinter: true });
    mockPrintTickets.mockResolvedValue(undefined);
    mockPrintReceipt.mockResolvedValue(undefined);
  });

  const run = (overrides: Partial<Parameters<typeof runPosCheckoutSideEffects>[0]> = {}) =>
    runPosCheckoutSideEffects({
      outletId: "out-1",
      outletName: "Outlet",
      cartLines: [line],
      kitchenPrintLines: [line],
      receipt: { lines: [line], checkoutTotals: totals, customerName: "Ada" },
      printLock: createPosCheckoutPrintLock(),
      receiptKey: "out-1:act-1",
      ...overrides,
    });

  it("prints kitchen tickets then the receipt in that order", async () => {
    const order: string[] = [];
    mockPrintTickets.mockImplementation(async () => {
      order.push("kitchen");
    });
    mockPrintReceipt.mockImplementation(async () => {
      order.push("receipt");
    });

    await run();
    expect(order).toEqual(["kitchen", "receipt"]);
  });

  it("still prints the receipt when kitchen ticket print fails", async () => {
    const onKitchenPrintError = vi.fn();
    mockPrintTickets.mockRejectedValue(new Error("printer_down"));

    await run({ onKitchenPrintError });

    expect(onKitchenPrintError).toHaveBeenCalledTimes(1);
    expect(mockPrintReceipt).toHaveBeenCalledTimes(1);
  });

  it("skips receipt print when no receipt printer is assigned", async () => {
    mockPrefs.mockReturnValue({ hasReceiptPrinter: false });
    await run();
    expect(mockPrintTickets).toHaveBeenCalledTimes(1);
    expect(mockPrintReceipt).not.toHaveBeenCalled();
  });

  it("skips kitchen print when there are no pending ticket lines, and still prints", async () => {
    await run({ kitchenPrintLines: [] });
    expect(mockPrintTickets).not.toHaveBeenCalled();
    expect(mockPrintReceipt).toHaveBeenCalledTimes(1);
  });

  it("does not reprint when the lock already marked the receipt ok", async () => {
    const printLock = createPosCheckoutPrintLock();
    printLock.markReceipt("out-1:act-1", true);
    await run({ printLock, kitchenPrintLines: [] });
    expect(mockPrintReceipt).not.toHaveBeenCalled();
  });
});
