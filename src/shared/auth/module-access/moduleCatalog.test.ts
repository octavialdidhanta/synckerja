import { describe, expect, it } from "vitest";
import {
  isSalesModulePathBlocked,
  resolveSalesModuleForPath,
  createDefaultSalesModuleAccess,
  createFullModuleAccess,
  SALES_MODULE_KEYS,
} from "@/shared/auth/module-access/moduleCatalog";

describe("moduleCatalog", () => {
  it("defaults all sales modules to disabled", () => {
    const access = createDefaultSalesModuleAccess();
    for (const key of SALES_MODULE_KEYS) {
      expect(access[key]).toBe(false);
    }
  });

  it("createFullModuleAccess enables all catalog modules", () => {
    const access = createFullModuleAccess();
    for (const key of SALES_MODULE_KEYS) {
      expect(access[key]).toBe(true);
    }
  });

  it("includes leadMagnet in sales module keys", () => {
    expect(SALES_MODULE_KEYS).toContain("leadMagnet");
    expect(SALES_MODULE_KEYS).toHaveLength(9);
  });

  it("resolves dashboard to null", () => {
    expect(resolveSalesModuleForPath("/")).toBeNull();
  });

  it("resolves each sales module key from representative paths", () => {
    expect(resolveSalesModuleForPath("/okr/company-objective")).toBe("okr");
    expect(resolveSalesModuleForPath("/employees")).toBe("humanResources");
    expect(resolveSalesModuleForPath("/incomes/dashboard")).toBe("finance");
    expect(resolveSalesModuleForPath("/expenses/dashboard")).toBe("finance");
    expect(resolveSalesModuleForPath("/digital-marketing/traffic")).toBe("digitalMarketing");
    expect(resolveSalesModuleForPath("/digital-marketing/lead-magnet")).toBe("digitalMarketing");
    expect(resolveSalesModuleForPath("/omnichannel/livechat")).toBe("omnichannel");
    expect(resolveSalesModuleForPath("/operations/sales/activities")).toBe("operations");
    expect(resolveSalesModuleForPath("/tools/daily-task")).toBe("tools");
    expect(resolveSalesModuleForPath("/request-form/purchase")).toBe("requestForm");
  });

  it("uses longest-prefix match for nested paths", () => {
    expect(resolveSalesModuleForPath("/omnichannel/settings")).toBe("omnichannel");
    expect(resolveSalesModuleForPath("/operations/sales/stock-management")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/inventory")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/inventory/mapping")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/service-list")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/product-list")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/bundles")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/categories")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/brands")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/modifiers")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/gratuity")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/discounts")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/promos")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/sales-types")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/taxes")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/library/checkout")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/ingredient/list")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/ingredient/categories")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/ingredient/recipes")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/settings/outlets-list")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/settings/checkout")).toBe("operations");
    expect(resolveSalesModuleForPath("/finance/bank-mutations")).toBe("finance");
  });

  it("does not resolve subscription paths to a sales module", () => {
    expect(resolveSalesModuleForPath("/subscription/overview")).toBeNull();
    expect(resolveSalesModuleForPath("/subscription/plans")).toBeNull();
  });

  it("blocks paths for sales tenant when module disabled", () => {
    const access = createDefaultSalesModuleAccess();
    access.finance = false;
    expect(isSalesModulePathBlocked("/expenses/dashboard", true, access)).toBe(true);
    expect(isSalesModulePathBlocked("/okr/company-objective", true, access)).toBe(true);
  });

  it("allows enabled modules for sales tenant", () => {
    const access = createDefaultSalesModuleAccess();
    access.finance = true;
    expect(isSalesModulePathBlocked("/incomes/dashboard", true, access)).toBe(false);
    expect(isSalesModulePathBlocked("/expenses/dashboard", true, access)).toBe(false);
  });

  it("does not block when module gating is inactive", () => {
    const access = createDefaultSalesModuleAccess();
    expect(isSalesModulePathBlocked("/finance/bank-mutations", false, access)).toBe(false);
    expect(isSalesModulePathBlocked("/employees", false, access)).toBe(false);
  });

  it("blocks mandiri plan-gated tenant when module disabled", () => {
    const access = createFullModuleAccess();
    access.humanResources = false;
    expect(isSalesModulePathBlocked("/employees", true, access)).toBe(true);
    expect(isSalesModulePathBlocked("/", true, access)).toBe(false);
  });
});
