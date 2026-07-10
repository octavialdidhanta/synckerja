import { describe, expect, it } from "vitest";
import {
  isSalesModulePathBlocked,
  resolveSalesModuleForPath,
  createDefaultSalesModuleAccess,
  SALES_MODULE_KEYS,
} from "@/shared/auth/module-access/moduleCatalog";

describe("moduleCatalog", () => {
  it("defaults all sales modules to disabled", () => {
    const access = createDefaultSalesModuleAccess();
    for (const key of SALES_MODULE_KEYS) {
      expect(access[key]).toBe(false);
    }
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
    expect(resolveSalesModuleForPath("/omnichannel/livechat")).toBe("omnichannel");
    expect(resolveSalesModuleForPath("/operations/sales/activities")).toBe("operations");
    expect(resolveSalesModuleForPath("/tools/daily-task")).toBe("tools");
    expect(resolveSalesModuleForPath("/request-form/purchase")).toBe("requestForm");
  });

  it("uses longest-prefix match for nested paths", () => {
    expect(resolveSalesModuleForPath("/omnichannel/settings")).toBe("omnichannel");
    expect(resolveSalesModuleForPath("/operations/sales/stock-management")).toBe("operations");
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

  it("does not block mandiri tenants", () => {
    const access = createDefaultSalesModuleAccess();
    expect(isSalesModulePathBlocked("/finance/bank-mutations", false, access)).toBe(false);
    expect(isSalesModulePathBlocked("/employees", false, access)).toBe(false);
  });
});
