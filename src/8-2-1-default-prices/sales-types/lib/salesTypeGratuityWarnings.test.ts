import { describe, expect, it } from "vitest";
import type { CatalogSalesType } from "../types";
import {
  listSalesTypesMissingGratuity,
  salesTypeMissingGratuity,
} from "./salesTypeGratuityWarnings";

function salesType(
  id: string,
  gratuityIds: string[],
  isActive = true,
): CatalogSalesType {
  return {
    id,
    organization_id: "org-1",
    name: `Type ${id}`,
    sort_order: 1,
    is_active: isActive,
    outlet_ids: ["outlet-1"],
    gratuity_ids: gratuityIds,
  };
}

describe("salesTypeGratuityWarnings", () => {
  it("returns empty when gratuity is disabled for the org", () => {
    expect(listSalesTypesMissingGratuity([salesType("dine-in", [])], false)).toEqual([]);
  });

  it("flags active sales types without gratuity links", () => {
    const warnings = listSalesTypesMissingGratuity(
      [salesType("dine-in", []), salesType("takeaway", ["g1"])],
      true,
    );
    expect(warnings).toEqual([{ salesTypeId: "dine-in", salesTypeName: "Type dine-in" }]);
  });

  it("ignores inactive sales types", () => {
    const warnings = listSalesTypesMissingGratuity([salesType("dine-in", [], false)], true);
    expect(warnings).toEqual([]);
  });

  it("salesTypeMissingGratuity mirrors row-level check", () => {
    expect(salesTypeMissingGratuity(salesType("dine-in", []), true)).toBe(true);
    expect(salesTypeMissingGratuity(salesType("dine-in", ["g1"]), true)).toBe(false);
    expect(salesTypeMissingGratuity(salesType("dine-in", []), false)).toBe(false);
  });
});
