import { describe, expect, it } from "vitest";
import { buildAuthContext } from "../src/authz/context";
import { AuthzError } from "../src/authz/errors";
import { isDigitalMarketingEnabled } from "../src/authz/moduleAccess";
import type { AccessClaims } from "../src/oauth/tokens";
import { filterTools } from "../src/mcp/filterTools";

const claims: AccessClaims = {
  sub: "user-1",
  profileId: "profile-1",
  orgId: "org-1",
  employeeId: "emp-1",
  scopes: ["session:read", "content:read"],
  clientId: "mcp_client",
  jti: "jti-1",
};

const base = {
  claims,
  member: true,
  profileId: "profile-1",
  employeeId: "emp-1",
  employeeStatus: "active",
  jobLevelId: null,
  jobLevelName: null,
  roles: ["employee"],
  companyName: "Acme",
  configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
  subscriptionSelfServiceEnabled: true as boolean | null,
  salesRows: null,
  subscriptionPlanId: null,
  planRows: null,
};

describe("isDigitalMarketingEnabled", () => {
  it("hides the module when a sales tenant has no rows", () => {
    expect(
      isDigitalMarketingEnabled({
        subscriptionSelfServiceEnabled: false,
        salesRows: [],
        subscriptionPlanId: null,
        planRows: null,
      }),
    ).toBe(false);
  });

  it("keeps the module on for a mandiri tenant without a plan", () => {
    expect(
      isDigitalMarketingEnabled({
        subscriptionSelfServiceEnabled: true,
        salesRows: null,
        subscriptionPlanId: null,
        planRows: null,
      }),
    ).toBe(true);
  });
});

describe("buildAuthContext", () => {
  it("rejects a terminated employee who is not an owner", () => {
    expect(() => buildAuthContext({ ...base, employeeStatus: "terminated" })).toThrow(AuthzError);
  });

  it("allows a terminated owner", () => {
    expect(() =>
      buildAuthContext({ ...base, employeeStatus: "terminated", roles: ["owner"] }),
    ).not.toThrow();
  });

  it("hides content plans when the token did not grant content:read", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["session:read"] },
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual(["session.whoami"]);
  });

  it("hides content plans when the sales module is off and still allows whoami", () => {
    const ctx = buildAuthContext({
      ...base,
      subscriptionSelfServiceEnabled: false,
      salesRows: [],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("session.whoami");
    expect(names).not.toContain("content.plans.list");
  });

  it("shows content plans for a mandiri tenant when the page allows the role", () => {
    const ctx = buildAuthContext({
      ...base,
      subscriptionSelfServiceEnabled: null,
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toContain("content.plans.list");
  });

  it("hides content plans when the page matrix has no row", () => {
    const ctx = buildAuthContext({
      ...base,
      configurations: [],
      subscriptionSelfServiceEnabled: true,
    });
    expect(filterTools(ctx).map((tool) => tool.name)).not.toContain("content.plans.list");
  });
});
