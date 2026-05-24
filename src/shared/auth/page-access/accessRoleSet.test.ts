import { describe, expect, it } from "vitest";
import { buildEffectiveAccessRoles, hasOwnerRole } from "./accessRoleSet";

describe("hasOwnerRole", () => {
  it("returns true when primary role is owner", () => {
    expect(hasOwnerRole([], "owner")).toBe(true);
  });

  it("returns true when effective roles include owner", () => {
    expect(hasOwnerRole(["admin", "owner"], "admin")).toBe(true);
  });

  it("returns false for admin-only users", () => {
    expect(hasOwnerRole(["admin"], "admin")).toBe(false);
  });
});

describe("buildEffectiveAccessRoles", () => {
  it("maps member to employee", () => {
    expect(buildEffectiveAccessRoles(["member"], null)).toContain("employee");
  });
});
