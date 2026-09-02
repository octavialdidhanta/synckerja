import { describe, expect, it } from "vitest";
import { parseCashierTicketCart } from "./parseCashierTicketCart";

describe("parseCashierTicketCart", () => {
  it("returns empty for invalid input", () => {
    expect(parseCashierTicketCart(null)).toEqual([]);
    expect(parseCashierTicketCart({})).toEqual([]);
  });

  it("parses a plain product line", () => {
    expect(
      parseCashierTicketCart([
        {
          lineKey: "abc",
          catalogId: "prod-1",
          kind: "product",
          serviceName: "Nasi Telur",
          quantity: 2,
          unitPrice: 15000,
        },
      ]),
    ).toEqual([
      {
        lineKey: "abc",
        catalogId: "prod-1",
        kind: "product",
        serviceName: "Nasi Telur",
        quantity: 2,
        unitPrice: 15000,
        variantName: null,
        modifiers: [],
        kitchenNote: null,
      },
    ]);
  });

  it("parses modifiers and kitchen note", () => {
    const lines = parseCashierTicketCart([
      {
        serviceName: "Kopi",
        quantity: 1,
        unitPrice: 18000,
        variantName: "Hot",
        kitchenNote: "Less sugar",
        modifiers: [{ name: "Extra shot", extraPrice: 5000, quantity: 1 }],
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.variantName).toBe("Hot");
    expect(lines[0]?.kitchenNote).toBe("Less sugar");
    expect(lines[0]?.modifiers).toEqual([
      { optionId: "Extra shot", name: "Extra shot", extraPrice: 5000, quantity: 1 },
    ]);
  });
});
