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
  connectionId: null,
  scopes: ["session:read", "content:read"],
  clientId: "mcp_client",
  jti: "jti-1",
  iat: 1_700_000_000,
};

const sessionTools = ["session.whoami", "session.orgs.list", "session.switchOrg"];
const aiEmployeeTools = [
  "ai_employee.list",
  "ai_employee.status",
  "ai_employee.runs.list",
  "ai_employee.report",
  "ai_employee.queue.list",
  "ai_employee.command",
  "ai_employee.chat",
  "ai_employee.routines.list",
  "ai_employee.routine.upsert",
  "ai_employee.schedule.update",
  "ai_employee.brief.get",
  "ai_employee.brief.update",
];

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

  it("keeps only the session tools when the active organization membership is gone", () => {
    const ctx = buildAuthContext({
      ...base,
      member: false,
      claims: { ...claims, scopes: allScopes },
      roles: [],
      configurations: [],
    });
    expect(ctx.membershipActive).toBe(false);
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([...sessionTools, ...aiEmployeeTools]);
  });

  it("hides content plans when the token did not grant content:read", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["session:read"] },
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([...sessionTools, ...aiEmployeeTools]);
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
    expect(names).not.toContain("content.catalog.list");
    expect(names).not.toContain("content.briefs.create");
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
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([...sessionTools, ...aiEmployeeTools]);
  });

  it("shows the calendar with content plans and hides OKR and leads for a content-only page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: allScopes },
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([
      ...sessionTools,
      "content.plans.list",
      "content.calendar.list",
      "content.catalog.list",
      "product_knowledge.list",
      "content.briefs.get",
      ...aiEmployeeTools,
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
    expect(names).not.toContain("ads.performance.summary");
    expect(names).not.toContain("finance.income.list");
    expect(names).not.toContain("finance.expenses.list");
    expect(names).not.toContain("hr.employees.list");
    expect(names).not.toContain("sales.visits.list");
    expect(names).not.toContain("kol.campaigns.list");
    expect(names).not.toContain("kol.profiles.list");
    expect(names).not.toContain("inventory.stock.list");
    expect(names).not.toContain("inventory.summary.list");
    expect(names).not.toContain("inventory.purchase_order.create");
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
    expect(names).not.toContain("inventory.summary.list");
    expect(names).not.toContain("inventory.purchase_order.create");
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
    expect(filterTools(allowed).map((tool) => tool.name)).toContain("inventory.summary.list");
    expect(filterTools(allowed).map((tool) => tool.name)).not.toContain("inventory.purchase_order.create");
    expect(filterTools(browserOnly).map((tool) => tool.name)).not.toContain("inventory.stock.list");
    expect(filterTools(browserOnly).map((tool) => tool.name)).not.toContain("inventory.summary.list");
    expect(filterTools(browserOnly).map((tool) => tool.name)).not.toContain("inventory.purchase_order.create");
  });

  it("shows purchase order create only with commerce write and the stock page", () => {
    const allowed = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: [...phase2Scopes, "commerce:write"] },
      configurations: [{ page_path: "/operations/sales/stock-management", roles_allowed: ["employee"] }],
    });
    const readOnly = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/operations/sales/stock-management", roles_allowed: ["employee"] }],
    });
    const wrongPage = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: [...phase2Scopes, "commerce:write"] },
      configurations: [{ page_path: "/operations/inventory", roles_allowed: ["employee"] }],
    });
    expect(filterTools(allowed).map((tool) => tool.name)).toContain("inventory.purchase_order.create");
    expect(filterTools(readOnly).map((tool) => tool.name)).not.toContain("inventory.purchase_order.create");
    expect(filterTools(wrongPage).map((tool) => tool.name)).not.toContain("inventory.purchase_order.create");
  });

  it("shows ads accounts when any one ads page is granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [{ page_path: "/digital-marketing/tiktok-ads", roles_allowed: ["employee"] }],
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toContain("ads.accounts.list");
    expect(filterTools(ctx).map((tool) => tool.name)).toContain("ads.performance.summary");
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
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual([...sessionTools, ...aiEmployeeTools]);
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
    expect(names).toContain("content.catalog.list");
    expect(names).not.toContain("content.plans.create");
    expect(names).not.toContain("content.briefs.create");
    expect(names).not.toContain("content.plans.update");
    expect(names).not.toContain("okr.objectives.create");
    expect(names).not.toContain("okr.objectives.update");
    expect(names).not.toContain("okr.objectives.department.create");
    expect(names).not.toContain("okr.objectives.individual.create");
    expect(names).not.toContain("crm.leads.create");
    expect(names).not.toContain("crm.leads.update");
    expect(names).not.toContain("content.plans.schedule");
    expect(names).not.toContain("crm.leads.setStatus");
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
    expect(names).not.toContain("content.briefs.create");
    expect(names).not.toContain("content.briefs.get");
    expect(names).not.toContain("content.catalog.list");
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
    expect(names).toContain("content.briefs.create");
    expect(names).toContain("content.briefs.get");
    expect(names).toContain("content.catalog.list");
    expect(names).toContain("content.plans.update");
    expect(names).not.toContain("content.plans.schedule");
    expect(names).not.toContain("okr.objectives.create");
    expect(names).not.toContain("okr.objectives.department.create");
    expect(names).not.toContain("okr.objectives.individual.create");
    expect(names).not.toContain("crm.leads.setStatus");
  });
});

describe("okr hierarchy visibility", () => {
  it("shows the department list and hides the new writes", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["okr:read"] },
      configurations: [{ page_path: "/okr", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("okr.departments.list");
    expect(names).toContain("okr.objectives.list");
    expect(names).not.toContain("okr.objectives.department.create");
    expect(names).not.toContain("okr.objectives.individual.create");
    expect(names).not.toContain("tasks.objective.link");
  });

  it("hides department and individual creates when the OKR page is missing", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["okr:write"] },
      configurations: [],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).not.toContain("okr.objectives.department.create");
    expect(names).not.toContain("okr.objectives.individual.create");
  });
});

const phase4Scopes = [...phase3Scopes, "content:publish"];

describe("phase 4 tool visibility", () => {
  it("hides scheduling from a content write token", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase3Scopes },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.create");
    expect(names).not.toContain("content.plans.schedule");
  });

  it("shows scheduling only with the publish scope and the content page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase4Scopes },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.schedule");
    expect(names).not.toContain("crm.leads.setStatus");
  });

  it("shows lead status changes with the existing write scope and the leads page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase3Scopes },
      configurations: [{ page_path: "/omnichannel/leads", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("crm.leads.setStatus");
    expect(names).not.toContain("content.plans.schedule");
  });
});

const phase5Scopes = [...phase4Scopes, "finance:write"];

describe("phase 5 tool visibility", () => {
  it("hides finance writes from a finance read token even when the pages are granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: phase2Pages,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("finance.income.list");
    expect(names).toContain("finance.expenses.list");
    expect(names).not.toContain("finance.income.create");
    expect(names).not.toContain("finance.income.update");
    expect(names).not.toContain("finance.expenses.create");
    expect(names).not.toContain("finance.expenses.update");
  });

  it("shows income writes only on the income page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase5Scopes },
      configurations: [{ page_path: "/incomes/transaction", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("finance.income.create");
    expect(names).toContain("finance.income.update");
    expect(names).not.toContain("finance.expenses.create");
    expect(names).not.toContain("finance.expenses.update");
  });

  it("shows expense writes only on the expenses page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase5Scopes },
      configurations: [{ page_path: "/expenses/dashboard", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("finance.expenses.create");
    expect(names).toContain("finance.expenses.update");
    expect(names).not.toContain("finance.income.create");
    expect(names).not.toContain("finance.income.update");
  });
});

const summaryScopes = [...phase5Scopes, "payroll:read", "pos:read"];

describe("payroll and POS summary visibility", () => {
  it("hides payroll runs from an hr read token even when the payroll page is granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: [
        { page_path: "/employees", roles_allowed: ["employee"] },
        { page_path: "/payroll/calculations", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("hr.employees.list");
    expect(names).not.toContain("payroll.runs.list");
  });

  it("shows payroll runs only on the payroll page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: summaryScopes },
      configurations: [{ page_path: "/payroll/calculations", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("payroll.runs.list");
    expect(names).not.toContain("pos.sales.daily");
    expect(names).not.toContain("hr.employees.list");
  });

  it("shows daily sales only on the sales summary page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: summaryScopes },
      configurations: [{ page_path: "/operations/reports/sales/summary", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("pos.sales.daily");
    expect(names).not.toContain("payroll.runs.list");
    expect(names).not.toContain("sales.visits.list");
  });
});

const taskReadScopes = [...summaryScopes, "tasks:read"];
const taskWriteScopes = [...taskReadScopes, "tasks:write"];
const dailyTaskPage = [{ page_path: "/tools/daily-task", roles_allowed: ["employee"] }];

describe("daily task visibility", () => {
  it("hides daily tasks from an hr read token even when the daily task page is granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: phase2Scopes },
      configurations: dailyTaskPage,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).not.toContain("tasks.summary");
    expect(names).not.toContain("tasks.list");
    expect(names).not.toContain("tasks.initiative.list");
    expect(names).not.toContain("tasks.workload");
    expect(names).not.toContain("tasks.completed.list");
    expect(names).not.toContain("tasks.create");
    expect(names).not.toContain("tasks.steps.list");
    expect(names).not.toContain("habits.list");
  });

  it("shows the five read tools and hides writes", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: taskReadScopes },
      configurations: dailyTaskPage,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names.filter((name) => name.startsWith("tasks."))).toEqual([
      "tasks.summary",
      "tasks.list",
      "tasks.initiative.list",
      "tasks.workload",
      "tasks.completed.list",
      "tasks.steps.list",
      "tasks.substeps.list",
    ]);
    expect(names).not.toContain("tasks.steps.create");
    expect(names).not.toContain("tasks.steps.update");
    expect(names).not.toContain("tasks.steps.delete");
    expect(names).not.toContain("tasks.substeps.create");
    expect(names).not.toContain("tasks.steps.image.add");
    expect(names).not.toContain("tasks.objective.link");
  });

  it("shows no daily task tools when the page is missing", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["tasks:write"] },
      configurations: [],
    });
    expect(filterTools(ctx)).toEqual([]);
  });

  it("shows writes only when the daily task page and write scope are both present", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: taskWriteScopes },
      configurations: dailyTaskPage,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("tasks.create");
    expect(names).toContain("tasks.update");
    expect(names).toContain("tasks.delete");
    expect(names).toContain("tasks.assign");
    expect(names).toContain("tasks.initiative.take");
    expect(names).toContain("tasks.steps.create");
    expect(names).toContain("tasks.substeps.create");
    expect(names).toContain("tasks.steps.image.add");
    expect(names).toContain("tasks.objective.link");
    expect(names).toContain("tasks.summary");
    expect(names).not.toContain("habits.list");
    expect(names).not.toContain("habits.check");
  });
});

const habitsPage = [{ page_path: "/tools/habits-tracker", roles_allowed: ["employee"] }];

describe("habit tracker visibility", () => {
  it("shows the habit list and hides the check tool", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["habits:read"] },
      configurations: habitsPage,
    });
    expect(filterTools(ctx).map((tool) => tool.name)).toEqual(["habits.list"]);
  });

  it("hides habit tools from a daily-task read token", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["tasks:read"] },
      configurations: habitsPage,
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).not.toContain("habits.list");
    expect(names).not.toContain("habits.check");
    expect(names).not.toContain("tasks.steps.list");
  });

  it("shows no habit tools when the page is missing", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["habits:write"] },
      configurations: [],
    });
    expect(filterTools(ctx)).toEqual([]);
  });
});

describe("lead magnet delivery visibility", () => {
  it("hides both tools when the lead magnet page is not granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: [...allScopes, "content:write"] },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("content.plans.list");
    expect(names).toContain("content.catalog.list");
    expect(names).not.toContain("leadmagnet.draft.read");
    expect(names).not.toContain("leadmagnet.delivery.attach");
  });

  it("shows the draft read with content read and hides the save", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read"] },
      configurations: [{ page_path: "/digital-marketing/lead-magnet", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("leadmagnet.draft.read");
    expect(names).not.toContain("leadmagnet.delivery.attach");
    expect(names).not.toContain("content.plans.list");
  });

  it("shows the save only with content write", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read", "content:write"] },
      configurations: [{ page_path: "/digital-marketing/lead-magnet", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("leadmagnet.draft.read");
    expect(names).toContain("leadmagnet.delivery.attach");
  });
});

describe("thinking lab connector visibility", () => {
  const thinkingTools = [
    "thinking.masters.list",
    "thinking.tree.read",
    "thinking.master.create",
    "thinking.bigthought.add",
    "thinking.master.catalog.set",
    "thinking.ideas.list",
    "thinking.chain.read",
    "thinking.execution.check",
    "thinking.plan.save",
    "thinking.plan.direct",
  ];

  it("hides every thinking tool without the Thinking Lab page", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read", "content:write"] },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    for (const name of thinkingTools) expect(names).not.toContain(name);
  });

  it("shows the reads with content read and hides the writes", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read"] },
      configurations: [{ page_path: "/thinking-lab", roles_allowed: ["employee"] }],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("thinking.masters.list");
    expect(names).toContain("thinking.tree.read");
    expect(names).toContain("thinking.ideas.list");
    expect(names).toContain("thinking.chain.read");
    expect(names).not.toContain("thinking.master.create");
    expect(names).not.toContain("thinking.bigthought.add");
    expect(names).not.toContain("thinking.master.catalog.set");
    expect(names).not.toContain("thinking.execution.check");
    expect(names).not.toContain("thinking.plan.save");
    expect(names).not.toContain("thinking.plan.direct");
  });

  it("hides the plan tools when either page is missing", () => {
    const labOnly = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read", "content:write"] },
      configurations: [{ page_path: "/thinking-lab", roles_allowed: ["employee"] }],
    });
    const socialOnly = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read", "content:write"] },
      configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] }],
    });
    expect(filterTools(labOnly).map((tool) => tool.name)).toContain("thinking.execution.check");
    expect(filterTools(labOnly).map((tool) => tool.name)).not.toContain("thinking.plan.save");
    expect(filterTools(labOnly).map((tool) => tool.name)).not.toContain("thinking.plan.direct");
    expect(filterTools(socialOnly).map((tool) => tool.name)).not.toContain("thinking.plan.save");
  });

  it("shows both plan tools only when both pages and content write are granted", () => {
    const ctx = buildAuthContext({
      ...base,
      claims: { ...claims, scopes: ["content:read", "content:write"] },
      configurations: [
        { page_path: "/thinking-lab", roles_allowed: ["employee"] },
        { page_path: "/digital-marketing/social-media", roles_allowed: ["employee"] },
      ],
    });
    const names = filterTools(ctx).map((tool) => tool.name);
    expect(names).toContain("thinking.ideas.list");
    expect(names).toContain("thinking.execution.check");
    expect(names).toContain("thinking.plan.save");
    expect(names).toContain("thinking.plan.direct");
  });
});
