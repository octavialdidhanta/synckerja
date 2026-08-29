import { describe, expect, it } from "vitest";
import type { CatalogGratuity } from "../../gratuity/types";
import { filterGratuitiesForSalesTypeOutlets } from "./filterGratuitiesForSalesTypeOutlets";

function gratuity(
  id: string,
  outletIds: string[],
  overrides: Partial<CatalogGratuity> = {},
): CatalogGratuity {
  return {
    id,
    organization_id: "org-1",
    name: `Gratuity ${id}`,
    amount_percent: 10,
    sort_order: 1,
    is_active: true,
    outlet_ids: outletIds,
    ...overrides,
  };
}

describe("filterGratuitiesForSalesTypeOutlets", () => {
  const outlet1 = "outlet-1";
  const outlet2 = "outlet-2";
  const g1 = gratuity("g1", [outlet1]);
  const g2 = gratuity("g2", [outlet2]);
  const g3 = gratuity("g3", [outlet1, outlet2]);

  it("returns all gratuities when no outlets are selected", () => {
    const result = filterGratuitiesForSalesTypeOutlets([g1, g2, g3], []);
    expect(result.selectable.map((row) => row.id)).toEqual(["g1", "g2", "g3"]);
    expect(result.selectedOutsideOutlets).toEqual([]);
  });

  it("filters selectable gratuities by outlet overlap", () => {
    const result = filterGratuitiesForSalesTypeOutlets([g1, g2, g3], [outlet1]);
    expect(result.selectable.map((row) => row.id)).toEqual(["g1", "g3"]);
    expect(result.selectedOutsideOutlets).toEqual([]);
  });

  it("keeps selected gratuities outside outlets as disabled rows", () => {
    const result = filterGratuitiesForSalesTypeOutlets([g1, g2, g3], [outlet1], ["g2"]);
    expect(result.selectable.map((row) => row.id)).toEqual(["g1", "g3"]);
    expect(result.selectedOutsideOutlets.map((row) => row.id)).toEqual(["g2"]);
  });
});
