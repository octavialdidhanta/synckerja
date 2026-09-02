import { describe, expect, it } from "vitest";
import { isDineInSalesType } from "./isDineInSalesType";

describe("isDineInSalesType", () => {
  it("treats Dine in and unknown labels as dine-in", () => {
    expect(isDineInSalesType("Dine in")).toBe(true);
    expect(isDineInSalesType("VIP")).toBe(true);
    expect(isDineInSalesType(null)).toBe(true);
  });

  it("rejects takeaway, pickup, and delivery", () => {
    expect(isDineInSalesType("Takeaway")).toBe(false);
    expect(isDineInSalesType("Bawa Pulang")).toBe(false);
    expect(isDineInSalesType("Pickup")).toBe(false);
    expect(isDineInSalesType("Delivery")).toBe(false);
  });
});
