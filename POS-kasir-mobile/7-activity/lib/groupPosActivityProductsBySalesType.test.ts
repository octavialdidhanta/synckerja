import { describe, expect, it } from "vitest";
import { groupPosActivityProductsBySalesType } from "./groupPosActivityProductsBySalesType";
import {
  salesTypeBadgeInitials,
  stripSalesTypeFromSubServiceName,
} from "./salesTypeBadgeInitials";
import type { PosActivityDetail } from "./posActivityTypes";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

describe("salesTypeBadgeInitials", () => {
  it("uses last word badge initials", () => {
    expect(salesTypeBadgeInitials("Dine In")).toBe("In");
    expect(salesTypeBadgeInitials("Take Away")).toBe("Ay");
    expect(salesTypeBadgeInitials("Delivery")).toBe("Dy");
  });
});

describe("stripSalesTypeFromSubServiceName", () => {
  it("removes matching sales type segment", () => {
    expect(
      stripSalesTypeFromSubServiceName("Level 2 · Take Away", "Take Away"),
    ).toBe("Level 2");
  });
});

describe("groupPosActivityProductsBySalesType", () => {
  const detail: Pick<PosActivityDetail, "catalog_sales_type_id" | "items"> = {
    catalog_sales_type_id: "st-dine",
    items: [
      {
        id: "i1",
        service_name: "Nasi Telur",
        sub_service_name: "porsi",
        quantity: 1,
        unit_price: 15000,
        total_price: 15000,
      },
    ],
  };

  it("falls back to bill-level group when no cart snapshot", () => {
    const nameById = new Map([["st-dine", "Dine In"]]);
    const groups = groupPosActivityProductsBySalesType({
      detail,
      cartSnapshot: null,
      salesTypeNameById: nameById,
      unknownSalesTypeLabel: "—",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].salesTypeName).toBe("Dine In");
    expect(groups[0].badge).toBe("In");
    expect(groups[0].lines[0].title).toBe("Nasi Telur");
  });

  it("groups cart lines by per-line sales type", () => {
    const cart: CustomerVisitCartLine[] = [
      {
        lineKey: "a",
        catalogId: "c1",
        kind: "product",
        serviceId: null,
        subServiceId: null,
        serviceName: "Indomie (Goreng)",
        subServiceName: null,
        quantity: 1,
        unitPrice: 27000,
        trackStock: false,
        inventorySkuId: null,
        availableQty: null,
        lineSalesTypeId: "st-dine",
        lineSalesTypeLabel: "Dine In",
        modifiers: [{ optionId: "m1", name: "Telur", extraPrice: 3000 }],
      },
      {
        lineKey: "b",
        catalogId: "c2",
        kind: "product",
        serviceId: null,
        subServiceId: null,
        serviceName: "Teh",
        subServiceName: null,
        quantity: 1,
        unitPrice: 5000,
        trackStock: false,
        inventorySkuId: null,
        availableQty: null,
        lineSalesTypeId: "st-ta",
        lineSalesTypeLabel: "Take Away",
      },
    ];
    const nameById = new Map([
      ["st-dine", "Dine In"],
      ["st-ta", "Take Away"],
    ]);
    const groups = groupPosActivityProductsBySalesType({
      detail: { catalog_sales_type_id: "st-dine", items: [] },
      cartSnapshot: cart,
      salesTypeNameById: nameById,
      unknownSalesTypeLabel: "—",
    });
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.salesTypeName)).toEqual(["Dine In", "Take Away"]);
    expect(groups[0].lines[0].children).toHaveLength(1);
  });
});
