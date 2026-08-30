import { describe, expect, it } from "vitest";
import { isDefaultCatalogSalesTypeName } from "./defaultCatalogSalesTypes";

describe("isDefaultCatalogSalesTypeName", () => {
  it("matches canonical and aliases", () => {
    expect(isDefaultCatalogSalesTypeName("Dine In")).toBe(true);
    expect(isDefaultCatalogSalesTypeName("Dine in")).toBe(true);
    expect(isDefaultCatalogSalesTypeName("Takeaway")).toBe(true);
    expect(isDefaultCatalogSalesTypeName("Delivery")).toBe(true);
    expect(isDefaultCatalogSalesTypeName("Pickup")).toBe(true);
  });

  it("rejects custom names", () => {
    expect(isDefaultCatalogSalesTypeName("VIP")).toBe(false);
    expect(isDefaultCatalogSalesTypeName(null)).toBe(false);
  });
});
