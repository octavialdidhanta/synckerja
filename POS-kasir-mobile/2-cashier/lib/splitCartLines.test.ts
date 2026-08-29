import { describe, expect, it } from "vitest";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  buildFullCartSelection,
  hasAnySplitSelection,
  splitCartLinesByQty,
} from "./splitCartLines";

function line(
  overrides: Partial<CustomerVisitCartLine> &
    Pick<CustomerVisitCartLine, "lineKey" | "catalogId" | "quantity">,
): CustomerVisitCartLine {
  return {
    kind: "product",
    serviceId: null,
    subServiceId: null,
    serviceName: "Item",
    subServiceName: null,
    unitPrice: 10000,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    ...overrides,
  };
}

describe("buildFullCartSelection", () => {
  it("keys selection by lineKey, not catalogId", () => {
    const lines = [
      line({ lineKey: "plain:prod-a", catalogId: "prod-a", quantity: 2 }),
      line({
        lineKey: "prod-a|var1||",
        catalogId: "prod-a",
        quantity: 1,
        variantId: "var1",
        variantName: "Large",
      }),
    ];
    const selection = buildFullCartSelection(lines);
    expect([...selection.keys()]).toEqual(["plain:prod-a", "prod-a|var1||"]);
    expect(selection.get("plain:prod-a")).toBe(2);
    expect(selection.get("prod-a|var1||")).toBe(1);
    expect(selection.has("prod-a")).toBe(false);
  });
});

describe("splitCartLinesByQty with full-cart selection", () => {
  it("includes plain product lineKey plain:id at full qty", () => {
    const lines = [
      line({ lineKey: "plain:ayam-geprek", catalogId: "ayam-geprek", quantity: 3, unitPrice: 21978 }),
    ];
    const selection = buildFullCartSelection(lines);
    const { splitLines, remainderLines } = splitCartLinesByQty(lines, selection);
    expect(splitLines).toHaveLength(1);
    expect(splitLines[0]?.quantity).toBe(3);
    expect(remainderLines).toHaveLength(0);
  });

  it("includes customized fingerprint lineKey", () => {
    const lines = [
      line({
        lineKey: "prod-x|v1|mod-a|",
        catalogId: "prod-x",
        quantity: 1,
        variantId: "v1",
        modifiers: [{ optionId: "mod-a", name: "Extra", extraPrice: 2000 }],
      }),
    ];
    const selection = buildFullCartSelection(lines);
    const { splitLines, remainderLines } = splitCartLinesByQty(lines, selection);
    expect(splitLines).toEqual(lines);
    expect(remainderLines).toHaveLength(0);
  });

  it("includes two lines with same catalogId but different lineKeys", () => {
    const lines = [
      line({ lineKey: "plain:same", catalogId: "same", quantity: 1 }),
      line({
        lineKey: "same|v2||",
        catalogId: "same",
        quantity: 2,
        variantId: "v2",
      }),
    ];
    const selection = buildFullCartSelection(lines);
    const { splitLines, remainderLines } = splitCartLinesByQty(lines, selection);
    expect(splitLines).toHaveLength(2);
    expect(splitLines.map((l) => l.lineKey).sort()).toEqual(["plain:same", "same|v2||"]);
    expect(remainderLines).toHaveLength(0);
  });

  it("misses when selection is keyed by catalogId (regression guard)", () => {
    const lines = [
      line({ lineKey: "plain:ayam-geprek", catalogId: "ayam-geprek", quantity: 1 }),
    ];
    const buggy = new Map<string, number>([["ayam-geprek", 1]]);
    const { splitLines, remainderLines } = splitCartLinesByQty(lines, buggy);
    expect(splitLines).toHaveLength(0);
    expect(remainderLines).toHaveLength(1);
  });
});

describe("splitCartLinesByQty partial selection", () => {
  it("splits qty by lineKey and leaves remainder", () => {
    const lines = [
      line({ lineKey: "plain:a", catalogId: "a", quantity: 5 }),
    ];
    const selection = new Map<string, number>([["plain:a", 2]]);
    const { splitLines, remainderLines } = splitCartLinesByQty(lines, selection);
    expect(splitLines).toEqual([{ ...lines[0]!, quantity: 2 }]);
    expect(remainderLines).toEqual([{ ...lines[0]!, quantity: 3 }]);
  });

  it("hasAnySplitSelection is false when all qty are zero", () => {
    expect(hasAnySplitSelection(new Map([["plain:a", 0]]))).toBe(false);
    expect(hasAnySplitSelection(new Map([["plain:a", 1]]))).toBe(true);
  });
});
