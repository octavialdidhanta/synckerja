import { describe, expect, it } from "vitest";
import {
  filterPlanModuleRowsForCard,
  formatPlanModuleLine,
  planHasCustomModulesFeature,
  translatePlanFeatureBullet,
} from "@/10-subscription/shared/planFeatureDisplayI18n";
import { buildPlanModuleDisplayRows } from "@/10-subscription/shared/planModuleDisplay";
import { createDefaultSalesModuleAccess } from "@/shared/auth/module-access/moduleCatalog";

const t = (key: string, opts?: Record<string, unknown>) => {
  const map: Record<string, string> = {
    "subscription.plans.features.dashboard": "Dashboard",
  "subscription.plans.features.customModules": "Custom modules",
    "subscription.plans.features.enterpriseMemberAllowed": "101+ Member Allowed",
    "subscription.plans.features.customModules": "Custom modules",
    "subscription.plans.enterprise.feature.customModules": "Custom modules",
    "subscription.plans.features.memberAllowed": "{{count}} Member Allowed",
    "subscription.plans.features.moduleLine": "{{name}} module",
    "layout.nav.okr": "OKR",
  };
  let out = map[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      out = out.replace(`{{${k}}}`, String(v));
    }
  }
  return out;
};

describe("translatePlanFeatureBullet", () => {
  it("translates dashboard and enterprise bullets", () => {
    expect(translatePlanFeatureBullet("Dashboard selalu aktif", t)).toBe("Dashboard");
    expect(translatePlanFeatureBullet("101+ Member Allowed", t)).toBe("101+ Member Allowed");
    expect(translatePlanFeatureBullet("Modul kustom", t)).toBe("Custom modules");
  });

  it("translates member allowed with count", () => {
    expect(translatePlanFeatureBullet("5 Member Allowed", t)).toBe("5 Member Allowed");
  });
});

describe("planHasCustomModulesFeature", () => {
  it("true when plan_module_access.customModules is enabled", () => {
    expect(
      planHasCustomModulesFeature({
        plan_module_access: { customModules: true },
        features: [],
      }),
    ).toBe(true);
  });

  it("true when legacy features contain Modul kustom", () => {
    expect(
      planHasCustomModulesFeature({
        features: ["Modul OKR", "Modul kustom", "Dashboard"],
      }),
    ).toBe(true);
  });

  it("false when toggle off and no legacy feature line", () => {
    expect(
      planHasCustomModulesFeature({
        plan_module_access: { customModules: false },
        features: ["Modul OKR", "Dashboard"],
      }),
    ).toBe(false);
  });
});

describe("filterPlanModuleRowsForCard", () => {
  it("excludes omnichannel and leadMagnet from included module list", () => {
    const access = createDefaultSalesModuleAccess();
    access.okr = true;
    access.omnichannel = true;
    access.leadMagnet = true;
    const rows = buildPlanModuleDisplayRows(access);
    const filtered = filterPlanModuleRowsForCard(rows, { excludeAddOnModules: true });
    expect(filtered.map((r) => r.key)).toContain("okr");
    expect(filtered.map((r) => r.key)).not.toContain("omnichannel");
    expect(filtered.map((r) => r.key)).not.toContain("leadMagnet");
  });
});

describe("formatPlanModuleLine", () => {
  it("wraps module nav label", () => {
    expect(formatPlanModuleLine("layout.nav.okr", t)).toBe("OKR module");
  });
});
