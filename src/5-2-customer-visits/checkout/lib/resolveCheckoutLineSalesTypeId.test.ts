import { describe, expect, it } from "vitest";
import { resolveCheckoutLineSalesTypeId } from "./resolveCheckoutLineSalesTypeId";

describe("resolveCheckoutLineSalesTypeId", () => {
  it("prefers line-level sales type", () => {
    expect(
      resolveCheckoutLineSalesTypeId({
        line: { lineSalesTypeId: "line-type" },
        billSalesTypeId: "bill-type",
        channelSalesTypeId: "channel-type",
      }),
    ).toBe("line-type");
  });

  it("falls back to channel integration then bill header", () => {
    expect(
      resolveCheckoutLineSalesTypeId({
        line: { lineSalesTypeId: null },
        billSalesTypeId: "bill-type",
        channelSalesTypeId: "channel-type",
      }),
    ).toBe("channel-type");

    expect(
      resolveCheckoutLineSalesTypeId({
        line: { lineSalesTypeId: null },
        billSalesTypeId: "bill-type",
      }),
    ).toBe("bill-type");
  });
});
