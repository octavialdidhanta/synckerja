import { describe, expect, it } from "vitest";
import { buildDefaultFeatureAccess, mergeFeatureAccess } from "./inventoryFeatureKeys";

describe("inventoryFeatureKeys", () => {
  it("builds default access for advanced modes", () => {
    const rows = buildDefaultFeatureAccess("advanced", "advanced");
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.allowed_roles.includes("owner"))).toBe(true);
  });

  it("returns empty for simple modes", () => {
    expect(buildDefaultFeatureAccess("simple", "simple")).toEqual([]);
  });

  it("merges existing access when switching to advanced", () => {
    const merged = mergeFeatureAccess(
      [{ feature_key: "po_request", allowed_roles: ["hr"] }],
      "advanced",
      "simple",
    );
    expect(merged.find((r) => r.feature_key === "po_request")?.allowed_roles).toEqual(["hr"]);
    expect(merged.find((r) => r.feature_key === "po_approval")?.allowed_roles).toEqual([
      "owner",
      "admin",
    ]);
  });
});
