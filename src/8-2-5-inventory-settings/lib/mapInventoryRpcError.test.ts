import { describe, expect, it } from "vitest";
import { isInventoryFeatureForbiddenError, mapInventoryRpcError } from "./mapInventoryRpcError";

describe("mapInventoryRpcError", () => {
  it("maps catalog_inventory_feature_forbidden", () => {
    expect(
      mapInventoryRpcError(new Error("catalog_inventory_feature_forbidden"), "fallback"),
    ).toBe("You do not have permission for this inventory action.");
  });

  it("returns fallback for unknown errors", () => {
    expect(mapInventoryRpcError(new Error("other"), "fallback")).toBe("other");
    expect(mapInventoryRpcError(null, "fallback")).toBe("fallback");
  });

  it("detects feature forbidden errors", () => {
    expect(isInventoryFeatureForbiddenError(new Error("catalog_inventory_feature_forbidden"))).toBe(true);
    expect(isInventoryFeatureForbiddenError(new Error("other"))).toBe(false);
  });
});
