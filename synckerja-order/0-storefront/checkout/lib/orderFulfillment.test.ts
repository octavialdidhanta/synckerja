import { describe, expect, it } from "vitest";
import {
  orderFulfillmentLabelKey,
  parseOrderFulfillment,
  resolveOrderFulfillment,
} from "./orderFulfillment";

describe("parseOrderFulfillment", () => {
  it("maps takeaway variants", () => {
    expect(parseOrderFulfillment("takeaway")).toBe("takeaway");
    expect(parseOrderFulfillment("Take_Away")).toBe("takeaway");
    expect(parseOrderFulfillment("take-away")).toBe("takeaway");
  });

  it("defaults to dine_in", () => {
    expect(parseOrderFulfillment("dine_in")).toBe("dine_in");
    expect(parseOrderFulfillment(null)).toBe("dine_in");
    expect(parseOrderFulfillment("pickup")).toBe("dine_in");
  });
});

describe("resolveOrderFulfillment", () => {
  it("forces dine_in when pickup disabled", () => {
    expect(
      resolveOrderFulfillment({ pickupEnabled: false, selected: "takeaway" }),
    ).toBe("dine_in");
  });

  it("allows takeaway when pickup enabled", () => {
    expect(
      resolveOrderFulfillment({ pickupEnabled: true, selected: "takeaway" }),
    ).toBe("takeaway");
  });
});

describe("orderFulfillmentLabelKey", () => {
  it("returns copy keys", () => {
    expect(orderFulfillmentLabelKey("dine_in")).toBe("dineIn");
    expect(orderFulfillmentLabelKey("takeaway")).toBe("takeAway");
  });
});
