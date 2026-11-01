import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarInput } from "../src/tools/content/calendarList";
import { contentPlansInput } from "../src/tools/content/plansList";
import { leadsInput } from "../src/tools/crm/leadsList";
import { createLeadInput } from "../src/tools/crm/leadsCreate";
import { updateLeadInput } from "../src/tools/crm/leadsUpdate";
import { schedulePlanInput } from "../src/tools/content/plansSchedule";
import { setLeadStatusInput } from "../src/tools/crm/leadsSetStatus";
import { createPlanInput } from "../src/tools/content/plansCreate";
import { catalogInput } from "../src/tools/content/catalogList";
import { createBriefInput } from "../src/tools/content/briefsCreate";
import { buildBriefConcept, buildBriefMarkdown } from "../src/tools/content/briefMarkdown";
import { createContentBrief } from "../src/db/contentBriefs";
import { attachLeadMagnetDelivery, listLeadMagnetDrafts } from "../src/db/leadMagnet";
import { draftReadInput } from "../src/tools/leadmagnet/draftRead";
import { assertPublicHttpsUrl } from "../src/tools/leadmagnet/safePdfUrl";
import { updatePlanInput, updatePlanSchema } from "../src/tools/content/plansUpdate";
import { updateObjectiveSchema } from "../src/tools/okr/objectivesUpdate";
import { updateLeadSchema } from "../src/tools/crm/leadsUpdate";
import { createObjectiveInput } from "../src/tools/okr/objectivesCreate";
import { departmentsInput } from "../src/tools/okr/departmentsList";
import { createDepartmentObjectiveInput } from "../src/tools/okr/departmentCreate";
import { createIndividualObjectiveInput } from "../src/tools/okr/individualCreate";
import { linkTaskObjectiveInput } from "../src/tools/tasks/objectiveLink";
import { updateObjectiveInput } from "../src/tools/okr/objectivesUpdate";
import { adsAccountsInput } from "../src/tools/ads/accountsList";
import { createIncomeInput } from "../src/tools/finance/incomeCreate";
import { updateIncomeInput, updateIncomeSchema } from "../src/tools/finance/incomeUpdate";
import { createExpenseInput } from "../src/tools/finance/expensesCreate";
import { updateExpenseInput, updateExpenseSchema } from "../src/tools/finance/expensesUpdate";
import { incomeInput } from "../src/tools/finance/incomeList";
import { expensesInput } from "../src/tools/finance/expensesList";
import { employeesInput } from "../src/tools/hr/employeesList";
import { stockInput } from "../src/tools/inventory/stockList";
import { kolCampaignsInput } from "../src/tools/kol/campaignsList";
import { kolProfilesInput } from "../src/tools/kol/profilesList";
import { visitsInput } from "../src/tools/sales/visitsList";
import { payrollRunsInput } from "../src/tools/payroll/runsList";
import { posDailyInput } from "../src/tools/pos/salesDaily";
import { taskSummaryInput } from "../src/tools/tasks/summary";
import { taskListInput } from "../src/tools/tasks/list";
import { taskInitiativeInput } from "../src/tools/tasks/initiativeList";
import { taskWorkloadInput } from "../src/tools/tasks/workload";
import { completedStepsInput } from "../src/tools/tasks/completedList";
import { createTaskInput } from "../src/tools/tasks/create";
import { updateTaskInput, updateTaskSchema } from "../src/tools/tasks/update";
import { deleteTaskInput } from "../src/tools/tasks/delete";
import { assignTaskInput } from "../src/tools/tasks/assign";
import { takeInitiativeInput } from "../src/tools/tasks/take";
import { taskStepsInput } from "../src/tools/tasks/stepsList";
import { createStepInput } from "../src/tools/tasks/stepsCreate";
import { updateStepSchema } from "../src/tools/tasks/stepsUpdate";
import { deleteStepInput } from "../src/tools/tasks/stepsDelete";
import { habitsListInput } from "../src/tools/habits/list";
import { habitCheckInput } from "../src/tools/habits/check";
import { checkHabit, listHabits } from "../src/db/habits";
import {
  assignTask,
  deleteTask,
  deleteTaskStep,
  linkTaskObjective,
  listCompletedSteps,
  listTaskInitiative,
  listTaskSummary,
  listTasks,
  listTaskWorkload,
  createTask,
  updateTask,
} from "../src/db/dailyTasks";
import { cyclesInput } from "../src/tools/okr/cyclesList";
import { objectivesInput } from "../src/tools/okr/objectivesList";
import { whoamiInput } from "../src/tools/session/whoami";
import { listContentPlans } from "../src/db/listContentPlans";
import { listContentCalendar, listCrmLeads, listOkrCycles, listOkrDepartments, listOkrObjectives } from "../src/db/phase1Reads";
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
  createDepartmentObjective,
  createIndividualObjective,
  createLead,
  setLeadStatus,
  updateContentPlan,
  updateLead,
  updateObjective,
} from "../src/db/phase3Writes";
import { listPayrollRuns, listPosDailySales } from "../src/db/payrollPosReads";
import { scheduleContentPlan } from "../src/db/scheduleContentPlan";
import {
  createExpenseRecord,
  createIncomeTransaction,
  updateExpenseRecord,
  updateIncomeTransaction,
} from "../src/db/phase5Writes";

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
    expect(payrollRunsInput.safeParse({}).success).toBe(true);
    expect(payrollRunsInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(payrollRunsInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(payrollRunsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(payrollRunsInput.safeParse({ employee_id: "11111111-1111-4111-8111-111111111111" }).success).toBe(false);
    expect(posDailyInput.safeParse({ month: "October" }).success).toBe(false);
    expect(posDailyInput.safeParse({ outlet_id: "11111111-1111-4111-8111-111111111111" }).success).toBe(false);
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
    expect(Object.keys(updatePlanSchema.shape)).toEqual(expect.arrayContaining(["id", "title", "post_date", "brief"]));
    expect(Object.keys(updateObjectiveSchema.shape)).toEqual(expect.arrayContaining(["id", "level", "title", "status"]));
    expect(Object.keys(updateLeadSchema.shape)).toEqual(expect.arrayContaining(["id", "client", "title", "fu_priority"]));
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
    expect(departmentsInput.safeParse({}).success).toBe(true);
    expect(departmentsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(createDepartmentObjectiveInput.safeParse({
      company_objective_id: planId,
      department_id: planId,
      title: "Pipeline",
    }).success).toBe(true);
    expect(createDepartmentObjectiveInput.safeParse({
      company_objective_id: planId,
      department_id: planId,
      title: "Pipeline",
      organization_id: "org-2",
      email: "a@b.c",
      phone: "0812",
      progress_percentage: 40,
    }).success).toBe(false);
    expect(createIndividualObjectiveInput.safeParse({
      department_objective_id: planId,
      title: "Calls",
    }).success).toBe(true);
    expect(createIndividualObjectiveInput.safeParse({
      department_objective_id: planId,
      title: "Calls",
      organization_id: "org-2",
      email: "a@b.c",
      phone: "0812",
      progress_percentage: 10,
    }).success).toBe(false);
    expect(linkTaskObjectiveInput.safeParse({
      task_id: planId,
      individual_objective_id: planId,
    }).success).toBe(true);
    expect(linkTaskObjectiveInput.safeParse({
      task_id: planId,
      individual_objective_id: planId,
      organization_id: "org-2",
      email: "a@b.c",
      progress_percentage: 1,
    }).success).toBe(false);
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
    expect(schedulePlanInput.safeParse({ id: planId }).success).toBe(true);
    expect(schedulePlanInput.safeParse({ id: planId, organization_id: "org-2" }).success).toBe(false);
    expect(schedulePlanInput.safeParse({ id: planId, action: "post_now" }).success).toBe(false);
    expect(schedulePlanInput.safeParse({ id: planId, post_now: true }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Open" }).success).toBe(true);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Converted" }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Closed" }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Resolve" }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Open", phone_number: "0812" }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Open", email: "a@b.c" }).success).toBe(false);
    expect(setLeadStatusInput.safeParse({ id: planId, status: "Open", assignee: "Ada" }).success).toBe(false);
  });

  it("rejects payment keys and unpaid-only writes on phase 5 inputs", () => {
    const rowId = "11111111-1111-4111-8111-111111111111";
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 15000,
      customer_name: "Acme",
      payment_method: "cash",
    }).success).toBe(true);
    expect(createIncomeInput.safeParse({ transaction_date: "2026-10-31", amount: 0 }).success).toBe(false);
    expect(createIncomeInput.safeParse({ transaction_date: "2026-02-31", amount: 10 }).success).toBe(false);
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 10,
      payment_method: "bank_transfer",
    }).success).toBe(false);
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 10,
      organization_id: "org-2",
    }).success).toBe(false);
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 10,
      bank_account_id: rowId,
    }).success).toBe(false);
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 10,
      status: "completed",
    }).success).toBe(false);
    expect(createIncomeInput.safeParse({
      transaction_date: "2026-10-31",
      amount: 10,
      receipt: "file",
    }).success).toBe(false);
    expect(updateIncomeInput.safeParse({ id: rowId }).success).toBe(false);
    expect(updateIncomeInput.safeParse({ id: rowId, amount: 20 }).success).toBe(true);
    expect(Object.keys(updateIncomeSchema.shape)).toEqual(expect.arrayContaining([
      "id",
      "transaction_date",
      "amount",
      "customer_name",
      "payment_method",
      "description",
    ]));
    expect(createExpenseInput.safeParse({
      expense_name: "Rent",
      amount: 500,
      create_date: "2026-10-31",
      expense_type: "Operating",
      category: "Office",
    }).success).toBe(true);
    expect(createExpenseInput.safeParse({
      expense_name: "Rent",
      amount: 0,
      create_date: "2026-10-31",
      expense_type: "Operating",
      category: "Office",
    }).success).toBe(false);
    expect(createExpenseInput.safeParse({
      expense_name: "Rent",
      amount: 500,
      create_date: "2026-10-31",
      expense_type: "Operating",
      category: "Office",
      bank_account_id: rowId,
      status: "deleted",
      receipt: "file",
    }).success).toBe(false);
    expect(updateExpenseInput.safeParse({ id: rowId }).success).toBe(false);
    expect(updateExpenseInput.safeParse({ id: rowId, expense_name: "Rent" }).success).toBe(true);
    expect(Object.keys(updateExpenseSchema.shape)).toEqual(expect.arrayContaining([
      "id",
      "expense_name",
      "amount",
      "create_date",
      "expense_type",
      "category",
      "description",
    ]));
    const taskId = "11111111-1111-4111-8111-111111111111";
    expect(taskSummaryInput.safeParse({}).success).toBe(true);
    expect(taskSummaryInput.safeParse({ month: "2026-10" }).success).toBe(true);
    expect(taskSummaryInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(taskListInput.safeParse({ status: "pending" }).success).toBe(true);
    expect(taskListInput.safeParse({ status: "pending", month: "2026-11" }).success).toBe(true);
    expect(taskListInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(taskListInput.safeParse({ month: "2026-11-01" }).success).toBe(false);
    expect(taskListInput.safeParse({ status: "done" }).success).toBe(false);
    expect(taskListInput.safeParse({ email: "a@b.c" }).success).toBe(false);
    expect(taskInitiativeInput.safeParse({ phone: "0812" }).success).toBe(false);
    expect(taskWorkloadInput.safeParse({}).success).toBe(true);
    expect(taskWorkloadInput.safeParse({ timeframe: "year" }).success).toBe(false);
    expect(completedStepsInput.safeParse({ month: "2026-13" }).success).toBe(false);
    expect(createTaskInput.safeParse({ title: "Follow up" }).success).toBe(false);
    expect(createTaskInput.safeParse({ title: "Follow up", plan_month: "2026-11" }).success).toBe(true);
    expect(createTaskInput.safeParse({ title: "Follow up", plan_month: "2026-11-27" }).success).toBe(false);
    expect(createTaskInput.safeParse({ title: "Follow up", plan_month: "2026-11", priority: "critical" }).success).toBe(false);
    expect(createTaskInput.safeParse({
      title: "Follow up",
      plan_month: "2026-11",
      organization_id: "org-2",
      email: "a@b.c",
      phone: "0812",
    }).success).toBe(false);
    expect(updateTaskInput.safeParse({ id: taskId }).success).toBe(false);
    expect(updateTaskInput.safeParse({ id: taskId, priority: "high" }).success).toBe(true);
    expect(updateTaskInput.safeParse({ id: taskId, plan_month: "2026-11" }).success).toBe(true);
    expect(updateTaskInput.safeParse({ id: taskId, plan_month: "2026-11-27" }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: taskId, status: "completed" }).success).toBe(false);
    expect(Object.keys(updateTaskSchema.shape)).toEqual(["id", "title", "priority", "due_date", "plan_month"]);
    expect(deleteTaskInput.safeParse({ id: taskId, comment: "remove" }).success).toBe(false);
    expect(assignTaskInput.safeParse({
      id: taskId,
      employee_id: taskId,
      file: "note.txt",
    }).success).toBe(false);
    expect(takeInitiativeInput.safeParse({
      id: taskId,
      level: "task",
      due_date: "2026-11-02",
    }).success).toBe(true);
    expect(takeInitiativeInput.safeParse({
      id: taskId,
      level: "task",
      due_date: "2026-02-31",
    }).success).toBe(false);
    expect(taskStepsInput.safeParse({ task_id: taskId }).success).toBe(true);
    expect(taskStepsInput.safeParse({ task_id: taskId, organization_id: "org-2" }).success).toBe(false);
    expect(createStepInput.safeParse({ task_id: taskId, title: "Draft" }).success).toBe(true);
    expect(createStepInput.safeParse({ task_id: taskId, title: "Draft", email: "a@b.c" }).success).toBe(false);
    expect(updateStepSchema.safeParse({ id: taskId, title: "Draft" }).success).toBe(true);
    expect(updateStepSchema.safeParse({ id: taskId }).success).toBe(false);
    expect(updateStepSchema.safeParse({ id: taskId, title: "Draft", is_completed: true }).success).toBe(false);
    expect(Object.keys(updateStepSchema.shape)).toEqual(["id", "title"]);
    expect(deleteStepInput.safeParse({ id: taskId, comment: "gone" }).success).toBe(false);
    expect(habitsListInput.safeParse({}).success).toBe(true);
    expect(habitsListInput.safeParse({ date: "2026-11-01", phone: "0812" }).success).toBe(false);
    expect(habitCheckInput.safeParse({ habit_id: taskId, checked: true }).success).toBe(true);
    expect(habitCheckInput.safeParse({
      habit_id: taskId,
      checked: true,
      notes: "free text",
      organization_id: "org-2",
    }).success).toBe(false);
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

  it("calls the payroll and POS RPCs with the session organization and month only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    await listPayrollRuns(admin, ctx, null);
    await listPosDailySales(admin, ctx, "2026-10");
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_payroll_runs", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_pos_daily_sales", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_month: "2026-10",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("employee_id");
    expect(sent).not.toContain("outlet_id");
    expect(sent).not.toContain("bank_account");
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
    const companyPayload = JSON.stringify(rpc.mock.calls[2]);
    expect(companyPayload).not.toContain("progress");
    expect(companyPayload).not.toContain("weight");
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
    await setLeadStatus(admin, ctx, { id, status: "Open" });
    expect(rpc).toHaveBeenNthCalledWith(7, "mcp_set_lead_status", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_status: "Open",
    });
  });

  it("calls the phase 5 RPCs with the session organization and no payment fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "row-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await createIncomeTransaction(admin, ctx, {
      transactionDate: "2026-10-31",
      amount: 15000,
      customerName: "Acme",
      paymentMethod: "cash",
      description: null,
    });
    await updateIncomeTransaction(admin, ctx, {
      id,
      transactionDate: null,
      amount: 16000,
      customerName: null,
      paymentMethod: null,
      description: null,
    });
    await createExpenseRecord(admin, ctx, {
      expenseName: "Rent",
      amount: 500,
      createDate: "2026-10-31",
      expenseType: "Operating",
      category: "Office",
      description: null,
    });
    await updateExpenseRecord(admin, ctx, {
      id,
      expenseName: "Rent revised",
      amount: null,
      createDate: null,
      expenseType: null,
      category: null,
      description: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_create_income_transaction", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_transaction_date: "2026-10-31",
      p_amount: 15000,
      p_customer_name: "Acme",
      p_payment_method: "cash",
      p_description: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_update_income_transaction", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_transaction_date: null,
      p_amount: 16000,
      p_customer_name: null,
      p_payment_method: null,
      p_description: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_create_expense", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_expense_name: "Rent",
      p_amount: 500,
      p_create_date: "2026-10-31",
      p_expense_type: "Operating",
      p_category: "Office",
      p_description: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_update_expense", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_expense_name: "Rent revised",
      p_amount: null,
      p_create_date: null,
      p_expense_type: null,
      p_category: null,
      p_description: null,
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("bank_account_id");
    expect(sent).not.toContain("gateway_wallet_provider");
  });

  it("calls delete and assign with the session and the requested ids only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "task-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await listTaskSummary(admin, ctx, null);
    await listTasks(admin, ctx, "pending", "2026-11");
    await listTaskInitiative(admin, ctx);
    await listTaskWorkload(admin, ctx, "week");
    await listCompletedSteps(admin, ctx, "2026-10");
    await deleteTask(admin, ctx, id);
    await assignTask(admin, ctx, { id, employeeId: id, dueDate: "2026-11-02" });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_tasks", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_status: "pending",
      p_month: "2026-11",
    });
    expect(rpc).toHaveBeenNthCalledWith(6, "mcp_delete_task", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
    });
    expect(rpc).toHaveBeenNthCalledWith(7, "mcp_assign_task", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_employee_id: id,
      p_due_date: "2026-11-02",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("comment");
    expect(sent).not.toContain("file");
    expect(sent).not.toContain("attachment");
    expect(sent).not.toContain("email");
    expect(sent).not.toContain("phone");
  });

  it("calls create and update with the plan month and not a client plan date", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "task-1", plan_month: "2026-11" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await createTask(admin, ctx, {
      title: "Follow up",
      description: null,
      priority: null,
      dueDate: "2026-12-02",
      employeeId: null,
      planMonth: "2026-11",
    });
    await updateTask(admin, ctx, {
      id,
      title: null,
      priority: null,
      dueDate: null,
      planMonth: "2026-11",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_create_task", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_title: "Follow up",
      p_description: null,
      p_priority: null,
      p_due_date: "2026-12-02",
      p_employee_id: null,
      p_plan_month: "2026-11",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_update_task", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
      p_title: null,
      p_priority: null,
      p_due_date: null,
      p_plan_month: "2026-11",
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("plan_date");
    expect(sent).not.toContain("2026-11-27");
  });

  it("calls step delete and habit check with the session and the requested fields only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "task-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await deleteTaskStep(admin, ctx, id);
    await listHabits(admin, ctx, null);
    await checkHabit(admin, ctx, { habitId: id, checked: true, date: "2026-11-01", index: 1 });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_delete_task_step", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: id,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_list_habits", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_date: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_check_habit", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_habit_id: id,
      p_checked: true,
      p_date: "2026-11-01",
      p_index: 1,
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("is_completed");
    expect(sent).not.toContain("notes");
    expect(sent).not.toContain("comment");
    expect(sent).not.toContain("email");
  });

  it("schedules with the session user and hides the internal secret", async () => {
    const secret = "schedule-secret-value";
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        eligible: false,
        scheduled: 0,
        blocked: ["approved", secret],
        skipped: [{ platform: "TikTok", reason: "oauth_disconnected", platform_account_id: "acct-1" }],
        failed: [{ platform: "YouTube", error: `boom ${secret}`, platform_account_id: "acct-2" }],
      }),
    });
    const result = await scheduleContentPlan(
      {
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceRoleKey: "service-role",
        scheduledPostsInternalSecret: secret,
      },
      { userId: "user-1", organizationId: "org-1" },
      "11111111-1111-4111-8111-111111111111",
      fetchImpl as unknown as typeof fetch,
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body).toEqual({
      organization_id: "org-1",
      social_media_plan_id: "11111111-1111-4111-8111-111111111111",
      mcp_user_id: "user-1",
      internal_secret: secret,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.skipped).toEqual([{ platform: "TikTok", reason: "oauth_disconnected" }]);
    expect(result.failed).toEqual([{ platform: "YouTube", reason: "boom " }]);
    expect(result.blocked).toEqual(["approved"]);
  });

  it("calls the hierarchy RPCs with the session and the requested ids only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "row-1" }], error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const id = "11111111-1111-4111-8111-111111111111";
    await listOkrDepartments(admin, ctx);
    await createDepartmentObjective(admin, ctx, {
      companyObjectiveId: id,
      departmentId: id,
      title: "Pipeline",
      description: null,
      status: "active",
    });
    await createIndividualObjective(admin, ctx, {
      departmentObjectiveId: id,
      title: "Calls",
      description: null,
      status: null,
      employeeId: null,
    });
    await linkTaskObjective(admin, ctx, { taskId: id, individualObjectiveId: id });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_okr_departments", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "mcp_create_department_objective", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_company_objective_id: id,
      p_department_id: id,
      p_title: "Pipeline",
      p_description: null,
      p_status: "active",
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "mcp_create_individual_objective", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_department_objective_id: id,
      p_title: "Calls",
      p_description: null,
      p_status: null,
      p_employee_id: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "mcp_link_task_objective", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_task_id: id,
      p_individual_objective_id: id,
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("weight");
    expect(sent).not.toContain("progress");
    expect(sent).not.toContain("email");
    expect(sent).not.toContain("phone");
    expect(sent).not.toContain("notes");
  });

  it("builds a canonical storyboard and keeps concept images out of the payload", async () => {
    const typeId = "22222222-2222-4222-8222-222222222222";
    const valid = {
      title: "Launch",
      content_type_id: typeId,
      sequences: [{ name: "Sequence 1", shots: [{ timing: "Slide 1" }] }],
    };
    expect(catalogInput.safeParse({}).success).toBe(true);
    expect(catalogInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(createBriefInput.safeParse(valid).success).toBe(true);
    expect(createBriefInput.safeParse({ title: "Launch", sequences: valid.sequences }).success).toBe(false);
    expect(createBriefInput.safeParse({ ...valid, organization_id: "org-2" }).success).toBe(false);
    expect(createBriefInput.safeParse({ ...valid, approved: true }).success).toBe(false);
    expect(createBriefInput.safeParse({ ...valid, brief: "A paragraph without a table" }).success).toBe(false);
    expect(createBriefInput.safeParse({ ...valid, google_drive_link: "https://drive" }).success).toBe(false);
    expect(createBriefInput.safeParse({
      ...valid,
      characters: [{ name: "Ayu", description: "host", portraitPath: "org/brief/x.jpg" }],
    }).success).toBe(false);

    const brief = buildBriefMarkdown([
      {
        name: "Sequence 1",
        shots: [
          { timing: "0-2s", visual: "a|b\nnext", vo: "Hello", element: "prop", tagging: "#tag" },
          { timing: "2-4s", visual: "", vo: "Again", element: "", tagging: "" },
        ],
      },
      { name: "Sequence 2", shots: [{ timing: "Slide 1", visual: "wide", vo: "", element: "", tagging: "" }] },
    ]);
    const lines = brief.split("\n");
    expect(lines[0]).toBe("| Timing | Visual | VO (Voice Over) | Scene Visual | Element Lainnya | Tagging |");
    const cells = lines[2].split("|").slice(1, -1).map((cell) => cell.trim());
    expect(cells[1]).toBe("");
    expect(cells[3]).toBe("a/b<br>next");
    const comment = brief.match(/<!--synckerja-brief-sequences:(\[[\s\S]*?\])-->/);
    expect(comment?.[1]).toBeTruthy();
    const sequences = JSON.parse(comment?.[1] ?? "[]") as Array<{ name: string; rowCount: number }>;
    expect(sequences.map((sequence) => sequence.rowCount)).toEqual([2, 1]);
    expect(sequences[0]?.name).toBe("Sequence 1");

    const tooMany = Array.from({ length: 8 }, (_, index) => ({
      name: `Sequence ${index + 1}`,
      shots: Array.from({ length: 4 }, () => ({ timing: "1" })),
    }));
    expect(() => buildBriefMarkdown(tooMany)).toThrow("invalid_input");

    const reel = buildBriefConcept({
      postAspect: "4:5",
      characters: [{ name: "Ayu", description: "host" }],
    }, "Reel");
    expect(reel).not.toContain("postAspect");
    expect(reel).toContain("@character_ayu");
    expect(reel).not.toContain("portraitPath");
    const carousel = buildBriefConcept({
      postAspect: "4:5",
      characters: [{ name: "Ayu", description: "host" }],
    }, "Carousel");
    expect(carousel).toContain('"postAspect":"4:5"');
    expect(carousel?.startsWith('{"v":1')).toBe(true);

    const rpc = vi.fn(async (fn: string) => {
      if (fn === "mcp_list_content_catalog") {
        return {
          data: [{ kind: "type", id: typeId, name: "Carousel", service_id: null, sub_service_id: null }],
          error: null,
        };
      }
      return {
        data: [{
          id: "plan-1",
          title: "Launch",
          content_type_name: "Carousel",
          service_name: null,
          sub_service_name: null,
          feature_name: null,
          shot_count: 1,
        }],
        error: null,
      };
    });
    const admin = { rpc } as unknown as SupabaseClient;
    await createContentBrief(admin, { userId: "user-1", organizationId: "org-1" }, {
      title: "Launch",
      postDate: null,
      contentTypeId: typeId,
      serviceId: null,
      subServiceId: null,
      featureId: null,
      postAspect: "4:5",
      voiceOver: null,
      characters: [{ name: "Ayu", description: "host" }],
      locations: [],
      properties: [],
      caption: "Buy now",
      sequences: [{ name: "Sequence 1", shots: [{ timing: "Slide 1", visual: "desk", vo: "Hello", element: "", tagging: "" }] }],
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "mcp_list_content_catalog", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
    });
    const createCall = rpc.mock.calls[1] as unknown as [string, Record<string, string | null>];
    expect(createCall[0]).toBe("mcp_create_content_brief");
    expect(createCall[1].p_brief).toContain("| Timing | Visual | VO (Voice Over) |");
    expect(createCall[1].p_brief).toContain("| Slide 1 |  | Hello | desk |");
    expect(createCall[1].p_brief).not.toContain("A paragraph without a table");
    expect(createCall[1].p_concept).toContain('"postAspect":"4:5"');
    expect(createCall[1].p_concept).toContain("@character_ayu");
    expect(createCall[1].p_concept).not.toContain("portraitPath");
    expect(createCall[1].p_caption).toBe("Buy now");
    expect(createCall[1].p_post_aspect).toBe("4:5");
    expect(JSON.stringify(createCall[1])).not.toContain("google_drive");
    expect(JSON.stringify(createCall[1])).not.toContain("approved");
  });

  it("reads a lead-magnet draft and stores only a real https pdf", async () => {
    expect(draftReadInput.safeParse({ organization_id: "org-1" }).success).toBe(false);
    expect(draftReadInput.safeParse({ account_id: "acct-1" }).success).toBe(false);
    expect(draftReadInput.safeParse({}).success).toBe(true);
    expect(() => assertPublicHttpsUrl("http://example.com/guide.pdf")).toThrow("invalid_input");
    expect(() => assertPublicHttpsUrl("https://localhost/guide.pdf")).toThrow("invalid_input");
    expect(() => assertPublicHttpsUrl("https://169.254.169.254/latest")).toThrow("invalid_input");
    expect(() => assertPublicHttpsUrl("https://127.0.0.1/guide.pdf")).toThrow("invalid_input");

    const organizationId = "11111111-1111-4111-8111-111111111111";
    const campaignId = "22222222-2222-4222-8222-222222222222";
    const calls: Array<[string, Record<string, unknown>]> = [];
    const upload = vi.fn(async () => ({ data: { path: "stored.pdf" }, error: null }));
    const remove = vi.fn(async () => ({ data: [], error: null }));
    const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (fn === "mcp_list_lead_magnet_drafts") {
        return {
          data: [{ id: campaignId, name: "Offer", has_file: false, file_name: null }],
          error: null,
        };
      }
      return {
        data: [{
          id: campaignId,
          file_name: "guide.pdf",
          has_file: true,
          previous_storage_path: "11111111-1111-4111-8111-111111111111/old.pdf",
        }],
        error: null,
      };
    });
    const admin = { rpc, storage: { from: () => ({ upload, remove }) } } as unknown as SupabaseClient;
    const ctx = { userId: "user-1", organizationId };
    const fetchImpl = vi.fn(async () => new Response(Uint8Array.from([1, 2, 3, 4, 5]), { status: 200 }));
    await expect(attachLeadMagnetDelivery(admin, "https://db.example", ctx, {
      campaignId,
      fileUrl: "https://files.example/guide.pdf",
    }, {
      fetchImpl,
      resolveHost: async () => ["1.1.1.1"],
    })).rejects.toThrow("invalid_input");
    expect(upload).not.toHaveBeenCalled();

    fetchImpl.mockResolvedValue(new Response(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), { status: 200 }));
    const saved = await attachLeadMagnetDelivery(admin, "https://db.example", ctx, {
      campaignId,
      fileUrl: "https://files.example/guide.pdf",
    }, {
      fetchImpl,
      resolveHost: async () => ["1.1.1.1"],
    });
    expect(saved).toEqual({ id: campaignId, file_name: "guide.pdf", has_file: true });
    expect(calls[0][0]).toBe("mcp_list_lead_magnet_drafts");
    const setCall = calls.find((call) => call[0] === "mcp_set_lead_magnet_delivery");
    expect(setCall?.[1].p_campaign_id).toBe(campaignId);
    expect(setCall?.[1].p_mime).toBe("application/pdf");
    expect(String(setCall?.[1].p_storage_path)).toMatch(/_guide\.pdf$/);
    expect(JSON.stringify(setCall?.[1])).not.toContain("account_id");
    expect(JSON.stringify(setCall?.[1])).not.toContain("active");
    expect(remove).toHaveBeenCalledWith(["11111111-1111-4111-8111-111111111111/old.pdf"]);

    calls.length = 0;
    await listLeadMagnetDrafts(admin, ctx, null);
    expect(calls[0][0]).toBe("mcp_list_lead_magnet_drafts");
    expect(calls[0][1].p_campaign_id).toBeNull();

    await expect(attachLeadMagnetDelivery(admin, "https://db.example", ctx, {
      campaignId,
      fileUrl: "https://files.example/guide.pdf",
    }, {
      fetchImpl,
      resolveHost: async () => ["10.0.0.8"],
    })).rejects.toThrow("invalid_input");
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
    const payrollRuns = readFileSync(new URL("../src/tools/payroll/runsList.ts", import.meta.url), "utf8");
    const posDaily = readFileSync(new URL("../src/tools/pos/salesDaily.ts", import.meta.url), "utf8");
    const createPlan = readFileSync(new URL("../src/tools/content/plansCreate.ts", import.meta.url), "utf8");
    const catalog = readFileSync(new URL("../src/tools/content/catalogList.ts", import.meta.url), "utf8");
    const createBrief = readFileSync(new URL("../src/tools/content/briefsCreate.ts", import.meta.url), "utf8");
    const briefMarkdown = readFileSync(new URL("../src/tools/content/briefMarkdown.ts", import.meta.url), "utf8");
    const contentBriefs = readFileSync(new URL("../src/db/contentBriefs.ts", import.meta.url), "utf8");
    const updatePlan = readFileSync(new URL("../src/tools/content/plansUpdate.ts", import.meta.url), "utf8");
    const createObjective = readFileSync(new URL("../src/tools/okr/objectivesCreate.ts", import.meta.url), "utf8");
    const updateObjective = readFileSync(new URL("../src/tools/okr/objectivesUpdate.ts", import.meta.url), "utf8");
    const departments = readFileSync(new URL("../src/tools/okr/departmentsList.ts", import.meta.url), "utf8");
    const createDepartment = readFileSync(new URL("../src/tools/okr/departmentCreate.ts", import.meta.url), "utf8");
    const createIndividual = readFileSync(new URL("../src/tools/okr/individualCreate.ts", import.meta.url), "utf8");
    const linkObjective = readFileSync(new URL("../src/tools/tasks/objectiveLink.ts", import.meta.url), "utf8");
    const createLead = readFileSync(new URL("../src/tools/crm/leadsCreate.ts", import.meta.url), "utf8");
    const updateLead = readFileSync(new URL("../src/tools/crm/leadsUpdate.ts", import.meta.url), "utf8");
    const schedulePlan = readFileSync(new URL("../src/tools/content/plansSchedule.ts", import.meta.url), "utf8");
    const setStatus = readFileSync(new URL("../src/tools/crm/leadsSetStatus.ts", import.meta.url), "utf8");
    const createIncome = readFileSync(new URL("../src/tools/finance/incomeCreate.ts", import.meta.url), "utf8");
    const updateIncome = readFileSync(new URL("../src/tools/finance/incomeUpdate.ts", import.meta.url), "utf8");
    const createExpense = readFileSync(new URL("../src/tools/finance/expensesCreate.ts", import.meta.url), "utf8");
    const updateExpense = readFileSync(new URL("../src/tools/finance/expensesUpdate.ts", import.meta.url), "utf8");
    const taskSummary = readFileSync(new URL("../src/tools/tasks/summary.ts", import.meta.url), "utf8");
    const taskList = readFileSync(new URL("../src/tools/tasks/list.ts", import.meta.url), "utf8");
    const taskInitiative = readFileSync(new URL("../src/tools/tasks/initiativeList.ts", import.meta.url), "utf8");
    const taskWorkload = readFileSync(new URL("../src/tools/tasks/workload.ts", import.meta.url), "utf8");
    const completedSteps = readFileSync(new URL("../src/tools/tasks/completedList.ts", import.meta.url), "utf8");
    const createTask = readFileSync(new URL("../src/tools/tasks/create.ts", import.meta.url), "utf8");
    const updateTask = readFileSync(new URL("../src/tools/tasks/update.ts", import.meta.url), "utf8");
    const deleteTaskSource = readFileSync(new URL("../src/tools/tasks/delete.ts", import.meta.url), "utf8");
    const assignTaskSource = readFileSync(new URL("../src/tools/tasks/assign.ts", import.meta.url), "utf8");
    const takeTask = readFileSync(new URL("../src/tools/tasks/take.ts", import.meta.url), "utf8");
    const dailyTasks = readFileSync(new URL("../src/db/dailyTasks.ts", import.meta.url), "utf8");
    const stepsList = readFileSync(new URL("../src/tools/tasks/stepsList.ts", import.meta.url), "utf8");
    const stepsCreate = readFileSync(new URL("../src/tools/tasks/stepsCreate.ts", import.meta.url), "utf8");
    const stepsUpdate = readFileSync(new URL("../src/tools/tasks/stepsUpdate.ts", import.meta.url), "utf8");
    const stepsDelete = readFileSync(new URL("../src/tools/tasks/stepsDelete.ts", import.meta.url), "utf8");
    const habitsList = readFileSync(new URL("../src/tools/habits/list.ts", import.meta.url), "utf8");
    const habitCheck = readFileSync(new URL("../src/tools/habits/check.ts", import.meta.url), "utf8");
    const habitsDb = readFileSync(new URL("../src/db/habits.ts", import.meta.url), "utf8");
    const draftRead = readFileSync(new URL("../src/tools/leadmagnet/draftRead.ts", import.meta.url), "utf8");
    const deliveryAttach = readFileSync(new URL("../src/tools/leadmagnet/deliveryAttach.ts", import.meta.url), "utf8");
    const leadMagnet = readFileSync(new URL("../src/db/leadMagnet.ts", import.meta.url), "utf8");
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
      payrollRuns,
      posDaily,
      createPlan,
      catalog,
      createBrief,
      briefMarkdown,
      contentBriefs,
      updatePlan,
      createObjective,
      updateObjective,
      departments,
      createDepartment,
      createIndividual,
      linkObjective,
      createLead,
      updateLead,
      schedulePlan,
      setStatus,
      createIncome,
      updateIncome,
      createExpense,
      updateExpense,
      taskSummary,
      taskList,
      taskInitiative,
      taskWorkload,
      completedSteps,
      createTask,
      updateTask,
      deleteTaskSource,
      assignTaskSource,
      takeTask,
      dailyTasks,
      stepsList,
      stepsCreate,
      stepsUpdate,
      stepsDelete,
      habitsList,
      habitCheck,
      habitsDb,
      draftRead,
      deliveryAttach,
      leadMagnet,
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
