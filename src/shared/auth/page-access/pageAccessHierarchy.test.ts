import { describe, expect, it } from "vitest";
import { evaluatePageAccess } from "./evaluatePageAccess";

describe("hierarchical page access (ancestor configs)", () => {
  it("denies child path when parent /omnichannel denies even if settings allows", () => {
    expect(
      evaluatePageAccess(
        "/omnichannel/settings",
        [
          { page_path: "/omnichannel", roles_allowed: [] },
          { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
        ],
        { roles: ["employee"], primaryRole: "employee" },
        "allow",
      ),
    ).toBe(false);
  });

  it("allows child when all matching ancestors allow", () => {
    expect(
      evaluatePageAccess(
        "/omnichannel/settings",
        [
          { page_path: "/omnichannel", roles_allowed: ["employee"] },
          { page_path: "/omnichannel/settings", roles_allowed: ["employee"] },
        ],
        { roles: ["employee"], primaryRole: "employee" },
        "allow",
      ),
    ).toBe(true);
  });

  it("allows unconfigured paths", () => {
    expect(
      evaluatePageAccess("/tools/calculator", [], { roles: ["employee"], primaryRole: "employee" }, "allow"),
    ).toBe(true);
  });
});
