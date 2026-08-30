import { describe, expect, it } from "vitest";
import {
  countTicketsBySalesTypeBucket,
  resolveKitchenSalesTypeBucket,
} from "./kitchenSalesTypeBucket";

describe("resolveKitchenSalesTypeBucket", () => {
  it("maps known labels", () => {
    expect(resolveKitchenSalesTypeBucket("Dine in")).toBe("dine_in");
    expect(resolveKitchenSalesTypeBucket("Takeaway")).toBe("takeaway");
    expect(resolveKitchenSalesTypeBucket("Delivery")).toBe("delivery");
    expect(resolveKitchenSalesTypeBucket("Pickup")).toBe("pickup");
    expect(resolveKitchenSalesTypeBucket("Bawa Pulang")).toBe("takeaway");
  });

  it("defaults unknown to dine_in", () => {
    expect(resolveKitchenSalesTypeBucket(null)).toBe("dine_in");
    expect(resolveKitchenSalesTypeBucket("VIP")).toBe("dine_in");
  });
});

describe("countTicketsBySalesTypeBucket", () => {
  it("counts per bucket", () => {
    expect(
      countTicketsBySalesTypeBucket([
        { sales_type_label: "Dine in" },
        { sales_type_label: "Dine in" },
        { sales_type_label: "Pickup" },
      ]),
    ).toEqual({ dine_in: 2, takeaway: 0, delivery: 0, pickup: 1 });
  });
});
