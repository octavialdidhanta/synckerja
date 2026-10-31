import { describe, expect, it } from "vitest";
import { buildAuthContext } from "../src/authz/context";
import { AuthzError } from "../src/authz/errors";
import { isDigitalMarketingEnabled } from "../src/authz/moduleAccess";
import type { AccessClaims } from "../src/oauth/tokens";
import { filterTools } from "../src/mcp/filterTools";

const allScopes = ["session:read", "content:read", "okr:read", "crm:read"];

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

  it("hides data tools when the page matrix has no row", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: allScopes },
      configurations: [],
      subscriptionSelfServiceEnabled: true,
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual(["session.whoami"]);
  });

  it("shows the calendar with content plans and hides OKR and leads for a content-only page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: allScopes },
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([
      "session.whoami",
      "content.plans.list",
      "content.calendar.list",
    ]);
  });

  it("hides OKR when the token did not grant okr:read", () => {
    const ctx = buildAuthContext({
      ...base,
      configurations: [
        { page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] },
        { page_path: "/okr", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).not.toContain("okr.cycles.list");
    expect(names).not.toContain("okr.objectives.list");
  });

  it("hides OKR when that sales module is off and still allows whoami", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: allScopes },
      subscriptionSelfServiceEnabled: false,
      salesRows: [
        { module_key: "digitalMarketing", is_enabled: true },
        { module_key: "omnichannel", is_enabled: true },
        { module_key: "okr", is_enabled: false },
      ],
      configurations: [
        { page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] },
        { page_path: "/okr", roles_allowed: ["employee"] },
        { page_path: "/omnichannel/leads", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("session.whoami");
    expect(names).toContain("content.plans.list");
    expect(names).toContain("crm.leads.list");
    expect(names).not.toContain("okr.cycles.list");
    expect(names).not.toContain("okr.objectives.list");
  });
});

const phase2Scopes = [
  ...allScopes,
  "ads:read",
  "finance:read",
  "hr:read",
  "sales:read",
  "kol:read",
  "commerce:read",
];

const phase2Pages = [
  { page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] },
  { page_path: "/digital-marketing/google-ads", roles_allowed: ["employee"] },
  { page_path: "/incomes/transaction", roles_allowed: ["employee"] },
  { page_path: "/expenses/dashboard", roles_allowed: ["employee"] },
  { page_path: "/employees", roles_allowed: ["employee"] },
  { page_path: "/operations/sales", roles_allowed: ["employee"] },
  { page_path: "/kol-management/campaigns", roles_allowed: ["employee"] },
  { page_path: "/kol-management/kol-management", roles_allowed: ["employee"] },
  { page_path: "/operations/sales/stock-management", roles_allowed: ["employee"] },
];

describe("phase 2 tool visibility", () => {
  it("hides phase 2 tools from a phase 1 token even when those pages are granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: allScopes },
      configurations: phase2Pages,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.list");
    expect(names).not.toContain("ads.accounts.list");
    expect(names).not.toContain("finance.income.list");
    expect(names).not.toContain("finance.expenses.list");
    expect(names).not.toContain("hr.employees.list");
    expect(names).not.toContain("sales.visits.list");
    expect(names).not.toContain("kol.campaigns.list");
    expect(names).not.toContain("kol.profiles.list");
    expect(names).not.toContain("inventory.stock.list");
  });

  it("shows employees and hides finance and stock when only the employees page is granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/employees", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("session.whoami");
    expect(names).toContain("hr.employees.list");
    expect(names).not.toContain("finance.income.list");
    expect(names).not.toContain("finance.expenses.list");
    expect(names).not.toContain("inventory.stock.list");
  });

  it("shows stock for the permission path and hides it for the browser URL alone", () => {
    const allowed = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/operations/sales/stock-management", roles_allowed: ["employee"] }],
    });
    const browserOnly = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/operations/inventory", roles_allowed: ["employee"] }],
    });
    expect(filterTools(allowed).map((tool) => tool.name)).toContain("inventory.stock.list");
    expect(filterTools(browserOnly).map((tool) => tool.name)).not.toContain("inventory.stock.list");
  });

  it("shows ads accounts when any one ads page is granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/digital-marketing/tiktok-ads", roles_allowed: ["employee"] }],
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toContain("ads.accounts.list");
  });

  it("hides income and expenses when the finance module is off and still allows whoami", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      subscriptionSelfServiceEnabled: false,
      salesRows: [
        { module_key: "finance", is_enabled: false },
        { module_key: "humanResources", is_enabled: true },
        { module_key: "operations", is_enabled: true },
        { module_key: "digitalMarketing", is_enabled: true },
      ],
      configurations: phase2Pages,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("session.whoami");
    expect(names).toContain("hr.employees.list");
    expect(names).not.toContain("finance.income.list");
    expect(names).not.toContain("finance.expenses.list");
  });

  it("hides data tools when the page matrix is empty", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [],
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual(["session.whoami"]);
  });
});

const phase3Scopes = [...phase2Scopes, "content:write", "okr:write", "crm:write"];

describe("phase 3 tool visibility", () => {
  it("hides write tools from a phase 2 token even when the pages are granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [
        ...phase2Pages,
        { page_path: "/okr", roles_allowed: ["employee"] },
        { page_path: "/omnichannel/leads", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.list");
    expect(names).not.toContain("content.plans.create");
    expect(names).not.toContain("content.plans.update");
    expect(names).not.toContain("okr.objectives.create");
    expect(names).not.toContain("okr.objectives.update");
    expect(names).not.toContain("crm.leads.create");
    expect(names).not.toContain("crm.leads.update");
  });

  it("hides content writes when only the calendar page is granted and still allows whoami", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["session:read", "content:write"] },
      configurations: [
        { page_path: "/digital-marketing/social-media/content-calendar", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("session.whoami");
    expect(names).not.toContain("content.plans.create");
    expect(names).not.toContain("content.plans.update");
  });

  it("shows content writes when the content page and write scope are granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase3Scopes },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.create");
    expect(names).toContain("content.plans.update");
    expect(names).not.toContain("okr.objectives.create");
  });
});
