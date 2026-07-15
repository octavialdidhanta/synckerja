import { describe, expect, it } from "vitest";
import {
  buildPlanModuleDisplayRows,
  isPlanModuleFeatureLine,
  moduleAccessFromPlanFeatures,
  resolvePlanModuleAccessForDisplay,
} from "@/10-subscription/shared/planModuleDisplay";

describe("planModuleDisplay", () => {
  it("detects CMS module feature lines", () => {
    expect(isPlanModuleFeatureLine("Modul OKR")).toBe(true);
    expect(isPlanModuleFeatureLine("Dashboard")).toBe(false);
  });

  it("parses enabled modules from legacy features", () => {
    const access = moduleAccessFromPlanFeatures([
      "Modul OKR",
      "Modul Human Resources",
      "Dashboard",
    ]);
    expect(access.okr).toBe(true);
    expect(access.humanResources).toBe(true);
    expect(access.finance).toBe(false);
  });

  it("prefers subscription_plan_module_access rows when present", () => {
    const access = resolvePlanModuleAccessForDisplay(
      ["Modul OKR", "Modul Finance"],
      [
        { module_key: "okr", is_enabled: true },
        { module_key: "finance", is_enabled: false },
      ],
    );
    expect(access.okr).toBe(true);
    expect(access.finance).toBe(false);
    expect(access.humanResources).toBe(false);
  });

  it("builds display rows in catalog order", () => {
    const rows = buildPlanModuleDisplayRows(
      resolvePlanModuleAccessForDisplay([], [
        { module_key: "finance", is_enabled: false },
        { module_key: "okr", is_enabled: true },
      ]),
    );
    expect(rows[0].key).toBe("okr");
    expect(rows.find((r) => r.key === "finance")?.enabled).toBe(false);
  });
});
