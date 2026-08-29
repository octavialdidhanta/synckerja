import { describe, expect, it } from "vitest";
import { filterTransferRows, groupTransfersByDate, lineKey, mapCatalogTransferRpcError } from "./transferHelpers";
import { buildTransferTimeline } from "./transferHistoryFormat";
import type { StockTransferListRow } from "../types";

const sampleRow = (overrides: Partial<StockTransferListRow>): StockTransferListRow => ({
  id: "1",
  orderNumber: "#100",
  fromOutletId: "a",
  fromOutletName: "Outlet Alpha",
  toOutletId: "b",
  toOutletName: "Outlet Beta",
  itemKind: "product",
  status: "completed",
  lineCount: 1,
  totalQty: 1,
  occurredAt: "2026-08-25T10:00:00.000Z",
  note: null,
  ...overrides,
});

describe("transferHelpers", () => {
  it("builds distinct keys for product, variant, and ingredient lines", () => {
    expect(lineKey({ productId: "p1", variantId: null })).toBe("p:p1");
    expect(lineKey({ productId: "p1", variantId: "v1" })).toBe("v:v1");
    expect(lineKey({ ingredientId: "i1" })).toBe("i:i1");
  });

  it("maps known RPC error codes to user-facing messages", () => {
    expect(mapCatalogTransferRpcError(new Error("catalog_transfer_same_outlet"), "fallback")).toBe(
      "From and To outlets must be different.",
    );
    expect(mapCatalogTransferRpcError(new Error("catalog_stock_insufficient"), "fallback")).toBe(
      "Transfer quantity cannot exceed stock at the source outlet.",
    );
    expect(mapCatalogTransferRpcError(new Error("mystery"), "fallback")).toBe("mystery");
  });

  it("groups transfer rows by date descending", () => {
    const groups = groupTransfersByDate([
      sampleRow({ id: "1", orderNumber: "#1", occurredAt: "2026-08-25T10:00:00.000Z" }),
      sampleRow({
        id: "2",
        orderNumber: "#2",
        fromOutletId: "b",
        fromOutletName: "B",
        toOutletId: "a",
        toOutletName: "A",
        occurredAt: "2026-08-24T10:00:00.000Z",
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows[0].id).toBe("1");
    expect(groups[1].rows[0].id).toBe("2");
  });

  it("filters transfer rows by order number and outlet names", () => {
    const rows = [
      sampleRow({ id: "1", orderNumber: "#100", fromOutletName: "Alpha" }),
      sampleRow({ id: "2", orderNumber: "#200", toOutletName: "Gamma" }),
    ];
    expect(filterTransferRows(rows, "")).toHaveLength(2);
    expect(filterTransferRows(rows, "100")).toHaveLength(1);
    expect(filterTransferRows(rows, "gamma")).toHaveLength(1);
    expect(filterTransferRows(rows, "missing")).toHaveLength(0);
  });

  it("merges workflow events and stock movements into a unified timeline", () => {
    const timeline = buildTransferTimeline(
      [
        {
          id: "e1",
          eventType: "approved",
          actorName: "Alice",
          comment: null,
          occurredAt: "2026-08-25T12:00:00.000Z",
        },
      ],
      [
        {
          id: "m1",
          outletId: "o1",
          direction: "out",
          actorName: "Bob",
          outletName: "Outlet A",
          qtyDelta: -2,
          qtyAfter: 8,
          note: null,
          occurredAt: "2026-08-25T10:00:00.000Z",
        },
      ],
    );

    expect(timeline).toHaveLength(2);
    expect(timeline[0].kind).toBe("event");
    expect(timeline[1].kind).toBe("movement");
  });
});
