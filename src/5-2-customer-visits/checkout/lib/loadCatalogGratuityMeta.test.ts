import { describe, expect, it } from "vitest";
import {
  buildGratuityRateLabel,
  resolveCatalogGratuityMeta,
  type CatalogGratuityMeta,
} from "./loadCatalogGratuityMeta";

describe("loadCatalogGratuityMeta", () => {
  const serviceFeeMeta: CatalogGratuityMeta = {
    gratuityId: "c1a7c952-6b96-4fd8-83f4-a4a64b2ce633",
    name: "Service Fee",
    amountPercent: 10,
    sortOrder: 1,
  };

  const meta = new Map<string, CatalogGratuityMeta>([
    ["service fee::10", serviceFeeMeta],
  ]);

  it("buildGratuityRateLabel formats whole and fractional percents", () => {
    expect(buildGratuityRateLabel(10)).toBe("10%");
    expect(buildGratuityRateLabel(5.5)).toBe("5.50%");
    expect(buildGratuityRateLabel(0)).toBe("—");
  });

  it("resolveCatalogGratuityMeta matches name and percent case-insensitively", () => {
    expect(
      resolveCatalogGratuityMeta({
        gratuityMeta: meta,
        name: "Service Fee",
        amountPercent: 10,
      }),
    ).toEqual(serviceFeeMeta);
    expect(
      resolveCatalogGratuityMeta({
        gratuityMeta: meta,
        name: " service fee ",
        amountPercent: 10,
      }),
    ).toEqual(serviceFeeMeta);
  });

  it("resolveCatalogGratuityMeta returns null when no catalog match exists", () => {
    expect(
      resolveCatalogGratuityMeta({
        gratuityMeta: meta,
        name: "Unknown / Legacy",
        amountPercent: 0,
      }),
    ).toBeNull();
  });
});
