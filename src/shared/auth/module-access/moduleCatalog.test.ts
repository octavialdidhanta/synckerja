import { describe, expect, it } from "vitest";
import {
  isSalesModulePathBlocked,
  isWhatsappBusinessPackagePath,
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

  it("includes leadMagnet and whatsappBusiness in sales module keys", () => {
    expect(SALES_MODULE_KEYS).toContain("leadMagnet");
    expect(SALES_MODULE_KEYS).toContain("whatsappBusiness");
    expect(SALES_MODULE_KEYS).toContain("pos");
    expect(SALES_MODULE_KEYS).not.toContain("thinking");
    expect(SALES_MODULE_KEYS).toHaveLength(13);
  });

  it("resolves dashboard to null", () => {
    expect(resolveSalesModuleForPath("/")).toBeNull();
  });

  it("resolves each sales module key from representative paths", () => {
    expect(resolveSalesModuleForPath("/okr/company-objective")).toBe("okr");
    expect(resolveSalesModuleForPath("/thinking-lab")).toBe("digitalMarketing");
    expect(resolveSalesModuleForPath("/employees")).toBe("humanResources");
    expect(resolveSalesModuleForPath("/ai-employees")).toBe("humanResources");
    expect(resolveSalesModuleForPath("/ai-employees/00000000-0000-4000-8000-000000000001")).toBe("humanResources");
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
    expect(resolveSalesModuleForPath("/operations/sales/stock-management")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/sales/tiktok-shop/settings")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/sales/blibli-orders")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/sales/ecommerce-chat")).toBe("operations");
    expect(resolveSalesModuleForPath("/operations/inventory")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/inventory/mapping")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/service-list")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/product-list")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/bundles")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/categories")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/brands")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/modifiers")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/gratuity")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/discounts")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/promos")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/sales-types")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/taxes")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/library/checkout")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/ingredient/list")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/ingredient/categories")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/ingredient/recipes")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/settings/outlets-list")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/settings/checkout")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/settings/email-notifications")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/settings/receipt")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/customers-list")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/customers-feedback")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/employees-staff")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/employees-staff/slots")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/employees-staff/access")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/employees-staff/pin-access")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/table-management")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/table-management/group")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/table-management/map")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/table-management/report")).toBe("pos");
    expect(resolveSalesModuleForPath("/operations/synckerja-order")).toBe("pos");
    expect(resolveSalesModuleForPath("/finance/bank-mutations")).toBe("finance");
  });

  it("marks WhatsApp Business package paths without taking CRM or other settings", () => {
    expect(isWhatsappBusinessPackagePath("/omnichannel/livechat")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/livechat/template-follow-ups")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/integrations/whatsapp")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/integrations/instagram")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/integrations/facebook")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/integrations/threads")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/integrations/email")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/campaign/whatsapp")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/campaign/templates")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/campaign/recipient-lists")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/campaign/recipient-lists/list-1")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/settings/user-management")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/settings/flow-builder/listing")).toBe(true);
    expect(isWhatsappBusinessPackagePath("/omnichannel/flow-builder/flow-1/editor")).toBe(true);

    expect(isWhatsappBusinessPackagePath("/omnichannel/crm")).toBe(false);
    expect(isWhatsappBusinessPackagePath("/omnichannel/leads")).toBe(false);
    expect(isWhatsappBusinessPackagePath("/omnichannel/contact")).toBe(false);
    expect(isWhatsappBusinessPackagePath("/omnichannel/settings/sla-management")).toBe(false);
    expect(isWhatsappBusinessPackagePath("/omnichannel/settings/api-integration")).toBe(false);
    expect(resolveSalesModuleForPath("/omnichannel/livechat")).toBe("omnichannel");
    expect(resolveSalesModuleForPath("/omnichannel/crm")).toBe("omnichannel");
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

  it("gates POS and Operations independently", () => {
    const access = createDefaultSalesModuleAccess();
    access.pos = true;
    access.operations = false;
    expect(isSalesModulePathBlocked("/operations/dashboard", true, access)).toBe(false);
    expect(isSalesModulePathBlocked("/operations/sales/activities", true, access)).toBe(true);
    access.pos = false;
    access.operations = true;
    expect(isSalesModulePathBlocked("/operations/employees-staff/slots", true, access)).toBe(true);
    expect(isSalesModulePathBlocked("/operations/sales/tiktok-shop/settings", true, access)).toBe(false);
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
