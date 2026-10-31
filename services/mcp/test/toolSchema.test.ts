import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarInput } from "../src/tools/content/calendarList";
import { contentPlansInput } from "../src/tools/content/plansList";
import { leadsInput } from "../src/tools/crm/leadsList";
import { createLeadInput } from "../src/tools/crm/leadsCreate";
import { updateLeadInput } from "../src/tools/crm/leadsUpdate";
import { createPlanInput } from "../src/tools/content/plansCreate";
import { updatePlanInput } from "../src/tools/content/plansUpdate";
import { createObjectiveInput } from "../src/tools/okr/objectivesCreate";
import { updateObjectiveInput } from "../src/tools/okr/objectivesUpdate";
import { adsAccountsInput } from "../src/tools/ads/accountsList";
import { expensesInput } from "../src/tools/finance/expensesList";
import { incomeInput } from "../src/tools/finance/incomeList";
import { employeesInput } from "../src/tools/hr/employeesList";
import { stockInput } from "../src/tools/inventory/stockList";
import { kolCampaignsInput } from "../src/tools/kol/campaignsList";
import { kolProfilesInput } from "../src/tools/kol/profilesList";
import { visitsInput } from "../src/tools/sales/visitsList";
import { cyclesInput } from "../src/tools/okr/cyclesList";
import { objectivesInput } from "../src/tools/okr/objectivesList";
import { whoamiInput } from "../src/tools/session/whoami";
import { listContentPlans } from "../src/db/listContentPlans";
import { listContentCalendar, listCrmLeads, listOkrCycles, listOkrObjectives } from "../src/db/phase1Reads";
import {
  listAdsAccounts,
  listCustomerVisits,
  listEmployees,
  listExpenses,
  listIncomeTransactions,
  listInventoryStock,
  listKolCampaigns,
  listKolProfiles,
} from "../src/db/phase2Reads";
import {
  createCompanyObjective,
  createContentPlan,
  createLead,
  updateContentPlan,
  updateLead,
  updateObjective,
} from "../src/db/phase3Writes";

describe("phase 0 tool inputs", () => {
  it("rejects an organization_id argument", () => {
    expect(whoamiInput.safeParse({}).success).toBe(true);
    expect(contentPlansInput.safeParse({}).success).toBe(true);
    expect(contentPlansInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(calendarInput.safeParse({}).success).toBe(true);
    expect(calendarInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(calendarInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(calendarInput.safeParse({ month: "October" }).success).toBe(false);
    expect(calendarInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(cyclesInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(objectivesInput.safeParse({ cycle_id: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
    expect(objectivesInput.safeParse({ cycle_id: "not-a-uuid" }).success).toBe(false);
    expect(objectivesInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(leadsInput.safeParse({ status: "Open" }).success).toBe(true);
    expect(leadsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(leadsInput.safeParse({ phone_number: "0812" }).success).toBe(false);
  });

  it("rejects organization, phone, and token keys on phase 2 inputs", () => {
    expect(adsAccountsInput.safeParse({}).success).toBe(true);
    expect(adsAccountsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(adsAccountsInput.safeParse({ access_token: "secret" }).success).toBe(false);
    expect(incomeInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(incomeInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(incomeInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(expensesInput.safeParse({ month: "October" }).success).toBe(false);
    expect(expensesInput.safeParse({ bank_account_id: "acct" }).success).toBe(false);
    expect(employeesInput.safeParse({}).success).toBe(true);
    expect(employeesInput.safeParse({ email: "a@b.c" }).success).toBe(false);
    expect(visitsInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(visitsInput.safeParse({ phone_number: "0812" }).success).toBe(false);
    expect(kolCampaignsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(kolProfilesInput.safeParse({ phone: "0812" }).success).toBe(false);
    expect(stockInput.safeParse({}).success).toBe(true);
    expect(stockInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
  });

  it("rejects forbidden keys and invalid values on phase 3 inputs", () => {
    const planId = "11111111-1111-4111-8111-111111111111";
    expect(createPlanInput.safeParse({ title: "Launch", post_date: "2026-10-31" }).success).toBe(true);
    expect(createPlanInput.safeParse({ title: "Launch", post_date: "2026-13-01" }).success).toBe(false);
    expect(createPlanInput.safeParse({ title: "Launch", post_date: "2026-02-31" }).success).toBe(false);
    expect(createPlanInput.safeParse({ title: "Launch", organization_id: "org-2" }).success).toBe(false);
    expect(createPlanInput.safeParse({ title: "Launch", approved: true }).success).toBe(false);
    expect(createPlanInput.safeParse({ title: "Launch", post_link: "https://example.com" }).success).toBe(false);
    expect(createPlanInput.safeParse({ title: "Launch", google_drive_link: "https://drive" }).success).toBe(false);
    expect(updatePlanInput.safeParse({ id: planId }).success).toBe(false);
    expect(updatePlanInput.safeParse({ id: planId, title: "Rename" }).success).toBe(true);
    expect(createObjectiveInput.safeParse({
      cycle_id: planId,
      title: "Grow",
      status: "draft",
    }).success).toBe(true);
    expect(createObjectiveInput.safeParse({ cycle_id: planId, title: "Grow", status: "completed" }).success).toBe(false);
    expect(updateObjectiveInput.safeParse({ id: planId, level: "company", status: "cancelled" }).success).toBe(true);
    expect(updateObjectiveInput.safeParse({ id: planId, level: "company", status: "published" }).success).toBe(false);
    expect(updateObjectiveInput.safeParse({ id: planId, level: "company", progress_percentage: 40 }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", fu_priority: "High" }).success).toBe(true);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", fu_priority: "Urgent" }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", status: "Converted" }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", phone_number: "0812" }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", email: "a@b.c" }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", assignee: "Ada" }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", assignee_id: planId }).success).toBe(false);
    expect(createLeadInput.safeParse({ client: "Acme", title: "Need", category: "Clinic", ticket_id: "LEAD-1" }).success).toBe(false);
    expect(updateLeadInput.safeParse({ id: planId }).success).toBe(false);
    expect(updateLeadInput.safeParse({ id: planId, client: "Acme" }).success).toBe(true);
    expect(updateLeadInput.safeParse({ id: planId, client: "Acme", organization_id: "org-2" }).success).toBe(false);
  });

  it("calls the membership-checked RPC with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "plan-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const rows = await listContentPlans(admin, { userId: "user-1", organizationId: "org-1" });
    expect(rows).toEqual([{ id: "plan-1" }]);
    expect(rpc).toHaveBeenCalledWith("mcp_list_content_plans", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
  });

  it("calls the phase 1 RPCs with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    await listContentCalendar(admin, ctx, "2026-10");
    await listOkrCycles(admin, ctx);
    await listOkrObjectives(admin, ctx, null);
    await listCrmLeads(admin, ctx, "Open");
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_content_calendar", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: "2026-10",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_okr_cycles", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_list_okr_objectives", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_cycle_id: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_list_crm_leads", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_status: "Open",
    });
  });

  it("calls the phase 2 RPCs with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    await listAdsAccounts(admin, ctx);
    await listIncomeTransactions(admin, ctx, "2026-10");
    await listExpenses(admin, ctx, null);
    await listEmployees(admin, ctx);
    await listCustomerVisits(admin, ctx, "2026-10");
    await listKolCampaigns(admin, ctx);
    await listKolProfiles(admin, ctx);
    await listInventoryStock(admin, ctx);
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_ads_accounts", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_income_transactions", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: "2026-10",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_list_expenses", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_list_employees", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(5, "mcp_list_customer_visits", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: "2026-10",
    });
    expect(rpc).toHaveBeenNthCalledWith(6, "mcp_list_kol_campaigns", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(7, "mcp_list_kol_profiles", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(8, "mcp_list_inventory_stock", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("access_token");
  });

  it("calls the phase 3 RPCs with the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "row-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await createContentPlan(admin, ctx, { title: "Launch", postDate: "2026-10-31", brief: null });
    await updateContentPlan(admin, ctx, id, { title: "Rename", postDate: null, brief: null });
    await createCompanyObjective(admin, ctx, { cycleId: id, title: "Grow", whyImportant: null, status: "draft" });
    await updateObjective(admin, ctx, { id, level: "company", title: null, status: "active" });
    await createLead(admin, ctx, {
      client: "Acme",
      title: "Need",
      category: "Clinic",
      source: null,
      fuPriority: null,
      status: null,
    });
    await updateLead(admin, ctx, { id, client: "Acme", title: null, category: null, source: null, fuPriority: "High" });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_create_content_plan", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_title: "Launch",
      p_post_date: "2026-10-31",
      p_brief: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_update_content_plan", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_title: "Rename",
      p_post_date: null,
      p_brief: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_create_company_objective", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_cycle_id: id,
      p_title: "Grow",
      p_why_important: null,
      p_status: "draft",
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_update_objective", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_level: "company",
      p_id: id,
      p_title: null,
      p_status: "active",
    });
    expect(rpc).toHaveBeenNthCalledWith(5, "mcp_create_lead", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_client: "Acme",
      p_title: "Need",
      p_category: "Clinic",
      p_source: null,
      p_fu_priority: null,
      p_status: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(6, "mcp_update_lead", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_client: "Acme",
      p_title: null,
      p_category: null,
      p_source: null,
      p_fu_priority: "High",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("phone_number");
    expect(sent).not.toContain("post_link");
  });

  it("keeps service-role helpers out of tool files", () => {
    const whoami = readFileSync(new URL("../src/tools/session/whoami.ts", import.meta.url), "utf8");
    const plans = readFileSync(new URL("../src/tools/content/plansList.ts", import.meta.url), "utf8");
    const calendar = readFileSync(new URL("../src/tools/content/calendarList.ts", import.meta.url), "utf8");
    const cycles = readFileSync(new URL("../src/tools/okr/cyclesList.ts", import.meta.url), "utf8");
    const objectives = readFileSync(new URL("../src/tools/okr/objectivesList.ts", import.meta.url), "utf8");
    const leads = readFileSync(new URL("../src/tools/crm/leadsList.ts", import.meta.url), "utf8");
    const ads = readFileSync(new URL("../src/tools/ads/accountsList.ts", import.meta.url), "utf8");
    const income = readFileSync(new URL("../src/tools/finance/incomeList.ts", import.meta.url), "utf8");
    const expenses = readFileSync(new URL("../src/tools/finance/expensesList.ts", import.meta.url), "utf8");
    const employees = readFileSync(new URL("../src/tools/hr/employeesList.ts", import.meta.url), "utf8");
    const visits = readFileSync(new URL("../src/tools/sales/visitsList.ts", import.meta.url), "utf8");
    const campaigns = readFileSync(new URL("../src/tools/kol/campaignsList.ts", import.meta.url), "utf8");
    const profiles = readFileSync(new URL("../src/tools/kol/profilesList.ts", import.meta.url), "utf8");
    const stock = readFileSync(new URL("../src/tools/inventory/stockList.ts", import.meta.url), "utf8");
    const createPlan = readFileSync(new URL("../src/tools/content/plansCreate.ts", import.meta.url), "utf8");
    const updatePlan = readFileSync(new URL("../src/tools/content/plansUpdate.ts", import.meta.url), "utf8");
    const createObjective = readFileSync(new URL("../src/tools/okr/objectivesCreate.ts", import.meta.url), "utf8");
    const updateObjective = readFileSync(new URL("../src/tools/okr/objectivesUpdate.ts", import.meta.url), "utf8");
    const createLead = readFileSync(new URL("../src/tools/crm/leadsCreate.ts", import.meta.url), "utf8");
    const updateLead = readFileSync(new URL("../src/tools/crm/leadsUpdate.ts", import.meta.url), "utf8");
    const identity = readFileSync(new URL("../src/db/identity.ts", import.meta.url), "utf8");
    const consent = readFileSync(new URL("../src/oauth/consent.ts", import.meta.url), "utf8");
    for (const source of [
      whoami,
      plans,
      calendar,
      cycles,
      objectives,
      leads,
      ads,
      income,
      expenses,
      employees,
      visits,
      campaigns,
      profiles,
      stock,
      createPlan,
      updatePlan,
      createObjective,
      updateObjective,
      createLead,
      updateLead,
    ]) {
      expect(source).not.toContain("createAdmin");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("active_organization_id");
    }
    expect(identity).not.toContain("active_organization_id");
    expect(identity).not.toContain(".update(");
    expect(consent).not.toContain("active_organization_id");
    expect(consent).not.toContain(".update(");
  });
});
