import { describe, expect, it } from "vitest";
import {
  prepareRefundStockDecisionFromPolicy,
} from "./prepareRefundStockDecision";
import { POS_REFUND_WASTE_REASON_REQUIRED } from "./resolveRefundStockPolicy";

describe("prepareRefundStockDecisionFromPolicy", () => {
  it("restores without a reason", () => {
    expect(prepareRefundStockDecisionFromPolicy("restore", null)).toEqual({
      effectiveStockPolicy: "restore",
      skipStockReverse: false,
      ledgerReason: null,
    });
  });

  it("keeps optional restore reason raw", () => {
    expect(prepareRefundStockDecisionFromPolicy("restore", "  guest request ")).toEqual({
      effectiveStockPolicy: "restore",
      skipStockReverse: false,
      ledgerReason: "guest request",
    });
  });

  it("wastes with a valid reason and prefixes the ledger note", () => {
    expect(
      prepareRefundStockDecisionFromPolicy("waste", " already cooked "),
    ).toEqual({
      effectiveStockPolicy: "waste",
      skipStockReverse: true,
      ledgerReason: "Kitchen waste: already cooked",
    });
  });

  it("throws when waste has no valid reason", () => {
    expect(() => prepareRefundStockDecisionFromPolicy("waste", "no")).toThrow(
      POS_REFUND_WASTE_REASON_REQUIRED,
    );
    expect(() => prepareRefundStockDecisionFromPolicy("waste", null)).toThrow(
      POS_REFUND_WASTE_REASON_REQUIRED,
    );
  });
});
