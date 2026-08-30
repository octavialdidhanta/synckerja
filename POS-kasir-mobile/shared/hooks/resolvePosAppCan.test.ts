import { describe, expect, it } from "vitest";
import { canStaffPermissionKey, resolvePosAppCan } from "./resolvePosAppCan";

describe("canStaffPermissionKey", () => {
  it("matches exact and parent keys", () => {
    expect(canStaffPermissionKey(new Set(["app.kitchen_display"]), "app.kitchen_display")).toBe(
      true,
    );
    expect(canStaffPermissionKey(new Set(["app"]), "app.kitchen_display")).toBe(true);
    expect(canStaffPermissionKey(new Set(["app.pos.charge"]), "app.kitchen_display")).toBe(false);
  });
});

describe("resolvePosAppCan", () => {
  const cashierKeys = new Set([
    "app.pos.charge",
    "app.pos.manage_open_bills",
    "app.shift.view_print",
    "app.settings.view",
  ]);

  it("denies while loading", () => {
    expect(
      resolvePosAppCan(
        { isLoading: true, hasStaffMembership: true, permissionKeys: cashierKeys },
        "app.kitchen_display",
      ),
    ).toBe(false);
  });

  it("denies kitchen for cashier role without app.kitchen_display", () => {
    expect(
      resolvePosAppCan(
        { isLoading: false, hasStaffMembership: true, permissionKeys: cashierKeys },
        "app.kitchen_display",
      ),
    ).toBe(false);
    expect(
      resolvePosAppCan(
        { isLoading: false, hasStaffMembership: true, permissionKeys: cashierKeys },
        "app.pos.charge",
      ),
    ).toBe(true);
  });

  it("allows kitchen when role has the key", () => {
    expect(
      resolvePosAppCan(
        {
          isLoading: false,
          hasStaffMembership: true,
          permissionKeys: new Set(["app.kitchen_display"]),
        },
        "app.kitchen_display",
      ),
    ).toBe(true);
  });

  it("does not fail-open without staff membership (ignores Office unrestricted)", () => {
    expect(
      resolvePosAppCan(
        { isLoading: false, hasStaffMembership: false, permissionKeys: new Set() },
        "app.kitchen_display",
      ),
    ).toBe(false);
  });
});
