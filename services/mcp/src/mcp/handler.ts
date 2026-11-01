import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ZodRawShape, ZodTypeAny } from "zod";
import { AuthzError } from "../authz/errors";
import type { McpAuthContext } from "../authz/context";
import type { ContentPlanRow } from "../db/listContentPlans";
import type { ContentBriefRecord, ContentBriefWrite, ContentCatalogRow } from "../db/contentBriefs";
import type { CrmLeadRow, OkrCycleRow, OkrDepartmentRow, OkrObjectiveListRow, OkrObjectiveRow } from "../db/phase1Reads";
import type {
  AdsAccountRow,
  EmployeeRow,
  ExpenseRow,
  IncomeRow,
  KolCampaignRow,
  KolProfileRow,
  StockRow,
  VisitRow,
} from "../db/phase2Reads";
import type { ExpenseRecord, IncomeRecord } from "../db/phase5Writes";
import type { DepartmentObjectiveRecord, IndividualObjectiveRecord } from "../db/phase3Writes";
import type { PayrollRunRow, PosDailySalesRow } from "../db/payrollPosReads";
import type {
  AssignTaskInput,
  AssignTaskResult,
  CompletedStepRow,
  CreateTaskInput,
  InitiativeRow,
  TakeInitiativeInput,
  TakeInitiativeResult,
  TaskListRow,
  TaskRecord,
  TaskSummary,
  UpdateTaskInput,
  TaskObjectiveLink,
  TaskStepRecord,
  TaskStepRow,
  WorkloadRow,
} from "../db/dailyTasks";
import type { HabitCheckInput, HabitCheckResult, HabitDayRow } from "../db/habits";
import type { SchedulePlanResult } from "../tools/content/plansSchedule";
import type { AccessClaims } from "../oauth/tokens";
import {
  adsAccountsInput,
  adsAccountsResult,
  calendarInput,
  calendarResult,
  contentPlansInput,
  contentPlansResult,
  createExpenseInput,
  createExpenseResult,
  createIncomeInput,
  createIncomeResult,
  createLeadInput,
  createLeadResult,
  createObjectiveInput,
  createObjectiveResult,
  createPlanInput,
  createPlanResult,
  catalogInput,
  catalogResult,
  createBriefInput,
  createBriefResult,
  cyclesInput,
  cyclesResult,
  departmentsInput,
  departmentsResult,
  createDepartmentObjectiveInput,
  createDepartmentObjectiveResult,
  createIndividualObjectiveInput,
  createIndividualObjectiveResult,
  employeesInput,
  employeesResult,
  expensesInput,
  expensesResult,
  incomeInput,
  incomeResult,
  kolCampaignsInput,
  kolCampaignsResult,
  kolProfilesInput,
  kolProfilesResult,
  leadsInput,
  leadsResult,
  schedulePlanInput,
  schedulePlanResult,
  setLeadStatusInput,
  setLeadStatusResult,
  objectivesInput,
  objectivesResult,
  payrollRunsInput,
  payrollRunsResult,
  posDailyInput,
  posDailyResult,
  stockInput,
  stockResult,
  updateExpenseInput,
  updateExpenseResult,
  updateExpenseSchema,
  updateIncomeInput,
  updateIncomeResult,
  updateIncomeSchema,
  updateLeadInput,
  updateLeadResult,
  updateLeadSchema,
  updateObjectiveInput,
  updateObjectiveResult,
  updateObjectiveSchema,
  updatePlanInput,
  updatePlanResult,
  updatePlanSchema,
  visitsInput,
  visitsResult,
  whoamiInput,
  whoamiResult,
  taskSummaryInput,
  taskSummaryResult,
  taskListInput,
  taskListResult,
  taskInitiativeInput,
  taskInitiativeResult,
  taskWorkloadInput,
  taskWorkloadResult,
  completedStepsInput,
  completedStepsResult,
  createTaskInput,
  createTaskResult,
  updateTaskInput,
  updateTaskResult,
  updateTaskSchema,
  deleteTaskInput,
  deleteTaskResult,
  assignTaskInput,
  assignTaskResult,
  linkTaskObjectiveInput,
  linkTaskObjectiveResult,
  takeInitiativeInput,
  takeInitiativeResult,
  taskStepsInput,
  taskStepsResult,
  createStepInput,
  createStepResult,
  updateStepResult,
  updateStepSchema,
  deleteStepInput,
  deleteStepResult,
  habitsListInput,
  habitsListResult,
  habitCheckInput,
  habitCheckResult,
} from "../tools";
import type { ToolCallOutcome } from "../db/toolGate";
import { filterTools, isToolVisible } from "./filterTools";
import type { McpToolName } from "./registry";

export type McpReadDeps = {
  listContentPlans: (ctx: McpAuthContext) => Promise<ContentPlanRow[]>;
  listContentCalendar: (ctx: McpAuthContext, month: string | null) => Promise<ContentPlanRow[]>;
  listContentCatalog: (ctx: McpAuthContext) => Promise<ContentCatalogRow[]>;
  listOkrCycles: (ctx: McpAuthContext) => Promise<OkrCycleRow[]>;
  listOkrObjectives: (ctx: McpAuthContext, cycleId: string | null) => Promise<OkrObjectiveListRow[]>;
  listOkrDepartments: (ctx: McpAuthContext) => Promise<OkrDepartmentRow[]>;
  listCrmLeads: (ctx: McpAuthContext, status: string | null) => Promise<CrmLeadRow[]>;
  listAdsAccounts: (ctx: McpAuthContext) => Promise<AdsAccountRow[]>;
  listIncomeTransactions: (ctx: McpAuthContext, month: string | null) => Promise<IncomeRow[]>;
  listExpenses: (ctx: McpAuthContext, month: string | null) => Promise<ExpenseRow[]>;
  listEmployees: (ctx: McpAuthContext) => Promise<EmployeeRow[]>;
  listPayrollRuns: (ctx: McpAuthContext, month: string | null) => Promise<PayrollRunRow[]>;
  listCustomerVisits: (ctx: McpAuthContext, month: string | null) => Promise<VisitRow[]>;
  listPosDailySales: (ctx: McpAuthContext, month: string | null) => Promise<PosDailySalesRow[]>;
  listKolCampaigns: (ctx: McpAuthContext) => Promise<KolCampaignRow[]>;
  listKolProfiles: (ctx: McpAuthContext) => Promise<KolProfileRow[]>;
  listInventoryStock: (ctx: McpAuthContext) => Promise<StockRow[]>;
  createContentPlan: (
    ctx: McpAuthContext,
    input: { title: string; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>;
  createContentBrief: (ctx: McpAuthContext, input: ContentBriefWrite) => Promise<ContentBriefRecord>;
  updateContentPlan: (
    ctx: McpAuthContext,
    input: { id: string; title: string | null; postDate: string | null; brief: string | null },
  ) => Promise<ContentPlanRow>;
  createCompanyObjective: (
    ctx: McpAuthContext,
    input: { cycleId: string; title: string; whyImportant: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>;
  updateObjective: (
    ctx: McpAuthContext,
    input: { id: string; level: "company" | "department" | "individual"; title: string | null; status: string | null },
  ) => Promise<OkrObjectiveRow>;
  createDepartmentObjective: (
    ctx: McpAuthContext,
    input: {
      companyObjectiveId: string;
      departmentId: string;
      title: string;
      description: string | null;
      status: string | null;
    },
  ) => Promise<DepartmentObjectiveRecord>;
  createIndividualObjective: (
    ctx: McpAuthContext,
    input: {
      departmentObjectiveId: string;
      title: string;
      description: string | null;
      status: string | null;
      employeeId: string | null;
    },
  ) => Promise<IndividualObjectiveRecord>;
  createLead: (
    ctx: McpAuthContext,
    input: {
      client: string;
      title: string;
      category: string;
      source: string | null;
      fuPriority: string | null;
      status: string | null;
    },
  ) => Promise<CrmLeadRow>;
  updateLead: (
    ctx: McpAuthContext,
    input: {
      id: string;
      client: string | null;
      title: string | null;
      category: string | null;
      source: string | null;
      fuPriority: string | null;
    },
  ) => Promise<CrmLeadRow>;
  scheduleContentPlan: (ctx: McpAuthContext, id: string) => Promise<SchedulePlanResult>;
  setLeadStatus: (ctx: McpAuthContext, input: { id: string; status: string }) => Promise<CrmLeadRow>;
  createIncomeTransaction: (
    ctx: McpAuthContext,
    input: {
      transactionDate: string;
      amount: number;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>;
  updateIncomeTransaction: (
    ctx: McpAuthContext,
    input: {
      id: string;
      transactionDate: string | null;
      amount: number | null;
      customerName: string | null;
      paymentMethod: string | null;
      description: string | null;
    },
  ) => Promise<IncomeRecord>;
  createExpenseRecord: (
    ctx: McpAuthContext,
    input: {
      expenseName: string;
      amount: number;
      createDate: string;
      expenseType: string;
      category: string;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>;
  updateExpenseRecord: (
    ctx: McpAuthContext,
    input: {
      id: string;
      expenseName: string | null;
      amount: number | null;
      createDate: string | null;
      expenseType: string | null;
      category: string | null;
      description: string | null;
    },
  ) => Promise<ExpenseRecord>;
  listTaskSummary: (ctx: McpAuthContext, month: string | null) => Promise<TaskSummary>;
  listTasks: (ctx: McpAuthContext, status: string | null, month: string | null) => Promise<TaskListRow[]>;
  listTaskInitiative: (ctx: McpAuthContext) => Promise<InitiativeRow[]>;
  listTaskWorkload: (ctx: McpAuthContext, timeframe: string | null) => Promise<WorkloadRow[]>;
  listCompletedSteps: (ctx: McpAuthContext, month: string | null) => Promise<CompletedStepRow[]>;
  createTask: (ctx: McpAuthContext, input: CreateTaskInput) => Promise<TaskRecord>;
  updateTask: (ctx: McpAuthContext, input: UpdateTaskInput) => Promise<TaskRecord>;
  deleteTask: (ctx: McpAuthContext, id: string) => Promise<{ id: string }>;
  assignTask: (ctx: McpAuthContext, input: AssignTaskInput) => Promise<AssignTaskResult>;
  linkTaskObjective: (
    ctx: McpAuthContext,
    input: { taskId: string; individualObjectiveId: string },
  ) => Promise<TaskObjectiveLink>;
  takeTaskInitiative: (ctx: McpAuthContext, input: TakeInitiativeInput) => Promise<TakeInitiativeResult>;
  listTaskSteps: (ctx: McpAuthContext, taskId: string) => Promise<TaskStepRow[]>;
  createTaskStep: (
    ctx: McpAuthContext,
    input: { taskId: string; title: string; description: string | null },
  ) => Promise<TaskStepRecord>;
  updateTaskStep: (ctx: McpAuthContext, input: { id: string; title: string }) => Promise<TaskStepRecord>;
  deleteTaskStep: (ctx: McpAuthContext, id: string) => Promise<{ id: string }>;
  listHabits: (ctx: McpAuthContext, date: string | null) => Promise<HabitDayRow[]>;
  checkHabit: (ctx: McpAuthContext, input: HabitCheckInput) => Promise<HabitCheckResult>;
};

type HandlerDeps = McpReadDeps & {
  loadContext: (claims: AccessClaims) => Promise<McpAuthContext>;
  takeToolSlot: (ctx: McpAuthContext) => Promise<{ allowed: boolean; recordDenial: boolean }>;
  recordToolCall: (ctx: McpAuthContext, toolName: string, outcome: ToolCallOutcome) => Promise<void>;
};

type ToolArgs = Record<string, unknown>;

function forbidden() {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: "forbidden" }],
  };
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("invalid_input");
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid_input");
  return value;
}

function requiredNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid_input");
  return value;
}

async function noteCall(
  deps: HandlerDeps,
  ctx: McpAuthContext,
  toolName: McpToolName,
  outcome: ToolCallOutcome,
): Promise<void> {
  try {
    await deps.recordToolCall(ctx, toolName, outcome);
  } catch {
    // A missed audit row does not hide a finished tool result or turn a denial into a success.
  }
}

async function reload(deps: HandlerDeps, claims: AccessClaims): Promise<McpAuthContext | null> {
  try {
    return await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) return null;
    throw error;
  }
}

const toolInputs: Record<McpToolName, ZodTypeAny> = {
  "session.whoami": whoamiInput,
  "content.plans.list": contentPlansInput,
  "content.calendar.list": calendarInput,
  "content.catalog.list": catalogInput,
  "okr.cycles.list": cyclesInput,
  "okr.objectives.list": objectivesInput,
  "okr.departments.list": departmentsInput,
  "crm.leads.list": leadsInput,
  "ads.accounts.list": adsAccountsInput,
  "finance.income.list": incomeInput,
  "finance.income.create": createIncomeInput,
  "finance.income.update": updateIncomeSchema,
  "finance.expenses.list": expensesInput,
  "finance.expenses.create": createExpenseInput,
  "finance.expenses.update": updateExpenseSchema,
  "hr.employees.list": employeesInput,
  "payroll.runs.list": payrollRunsInput,
  "sales.visits.list": visitsInput,
  "pos.sales.daily": posDailyInput,
  "kol.campaigns.list": kolCampaignsInput,
  "kol.profiles.list": kolProfilesInput,
  "inventory.stock.list": stockInput,
  "content.plans.create": createPlanInput,
  "content.briefs.create": createBriefInput,
  "content.plans.update": updatePlanSchema,
  "okr.objectives.create": createObjectiveInput,
  "okr.objectives.update": updateObjectiveSchema,
  "okr.objectives.department.create": createDepartmentObjectiveInput,
  "okr.objectives.individual.create": createIndividualObjectiveInput,
  "crm.leads.create": createLeadInput,
  "crm.leads.update": updateLeadSchema,
  "content.plans.schedule": schedulePlanInput,
  "crm.leads.setStatus": setLeadStatusInput,
  "tasks.summary": taskSummaryInput,
  "tasks.list": taskListInput,
  "tasks.initiative.list": taskInitiativeInput,
  "tasks.workload": taskWorkloadInput,
  "tasks.completed.list": completedStepsInput,
  "tasks.create": createTaskInput,
  "tasks.update": updateTaskSchema,
  "tasks.delete": deleteTaskInput,
  "tasks.assign": assignTaskInput,
  "tasks.objective.link": linkTaskObjectiveInput,
  "tasks.initiative.take": takeInitiativeInput,
  "tasks.steps.list": taskStepsInput,
  "tasks.steps.create": createStepInput,
  "tasks.steps.update": updateStepSchema,
  "tasks.steps.delete": deleteStepInput,
  "habits.list": habitsListInput,
  "habits.check": habitCheckInput,
};

async function runTool(name: McpToolName, ctx: McpAuthContext, args: ToolArgs, deps: McpReadDeps): Promise<unknown> {
  switch (name) {
    case "session.whoami":
      return whoamiResult(ctx);
    case "content.plans.list":
      return contentPlansResult(ctx, deps.listContentPlans);
    case "content.calendar.list":
      return calendarResult(ctx, optionalString(args.month), deps.listContentCalendar);
    case "content.catalog.list":
      return catalogResult(ctx, deps.listContentCatalog);
    case "okr.cycles.list":
      return cyclesResult(ctx, deps.listOkrCycles);
    case "okr.objectives.list":
      return objectivesResult(ctx, optionalString(args.cycle_id), deps.listOkrObjectives);
    case "okr.departments.list":
      return departmentsResult(ctx, deps.listOkrDepartments);
    case "crm.leads.list":
      return leadsResult(ctx, optionalString(args.status), deps.listCrmLeads);
    case "ads.accounts.list":
      return adsAccountsResult(ctx, deps.listAdsAccounts);
    case "finance.income.list":
      return incomeResult(ctx, optionalString(args.month), deps.listIncomeTransactions);
    case "finance.expenses.list":
      return expensesResult(ctx, optionalString(args.month), deps.listExpenses);
    case "finance.income.create":
      return createIncomeResult(
        ctx,
        {
          transactionDate: requiredString(args.transaction_date),
          amount: requiredNumber(args.amount),
          customerName: optionalString(args.customer_name),
          paymentMethod: optionalString(args.payment_method),
          description: optionalString(args.description),
        },
        deps.createIncomeTransaction,
      );
    case "finance.income.update":
      if (!updateIncomeInput.safeParse(args).success) throw new Error("invalid_input");
      return updateIncomeResult(
        ctx,
        {
          id: requiredString(args.id),
          transactionDate: optionalString(args.transaction_date),
          amount: optionalNumber(args.amount),
          customerName: optionalString(args.customer_name),
          paymentMethod: optionalString(args.payment_method),
          description: optionalString(args.description),
        },
        deps.updateIncomeTransaction,
      );
    case "finance.expenses.create":
      return createExpenseResult(
        ctx,
        {
          expenseName: requiredString(args.expense_name),
          amount: requiredNumber(args.amount),
          createDate: requiredString(args.create_date),
          expenseType: requiredString(args.expense_type),
          category: requiredString(args.category),
          description: optionalString(args.description),
        },
        deps.createExpenseRecord,
      );
    case "finance.expenses.update":
      if (!updateExpenseInput.safeParse(args).success) throw new Error("invalid_input");
      return updateExpenseResult(
        ctx,
        {
          id: requiredString(args.id),
          expenseName: optionalString(args.expense_name),
          amount: optionalNumber(args.amount),
          createDate: optionalString(args.create_date),
          expenseType: optionalString(args.expense_type),
          category: optionalString(args.category),
          description: optionalString(args.description),
        },
        deps.updateExpenseRecord,
      );
    case "hr.employees.list":
      return employeesResult(ctx, deps.listEmployees);
    case "payroll.runs.list":
      return payrollRunsResult(ctx, optionalString(args.month), deps.listPayrollRuns);
    case "sales.visits.list":
      return visitsResult(ctx, optionalString(args.month), deps.listCustomerVisits);
    case "pos.sales.daily":
      return posDailyResult(ctx, optionalString(args.month), deps.listPosDailySales);
    case "kol.campaigns.list":
      return kolCampaignsResult(ctx, deps.listKolCampaigns);
    case "kol.profiles.list":
      return kolProfilesResult(ctx, deps.listKolProfiles);
    case "inventory.stock.list":
      return stockResult(ctx, deps.listInventoryStock);
    case "content.plans.create":
      return createPlanResult(
        ctx,
        {
          title: requiredString(args.title),
          postDate: optionalString(args.post_date),
          brief: optionalString(args.brief),
        },
        deps.createContentPlan,
      );
    case "content.briefs.create": {
      const parsed = createBriefInput.safeParse(args);
      if (!parsed.success) throw new Error("invalid_input");
      const data = parsed.data;
      const blank = (value: string | undefined) => value ?? "";
      return createBriefResult(
        ctx,
        {
          title: data.title,
          postDate: data.post_date ?? null,
          contentTypeId: data.content_type_id,
          serviceId: data.service_id ?? null,
          subServiceId: data.sub_service_id ?? null,
          featureId: data.feature_id ?? null,
          postAspect: data.post_aspect ?? null,
          voiceOver: data.voice_over ?? null,
          characters: data.characters ?? [],
          locations: data.locations ?? [],
          properties: data.properties ?? [],
          caption: data.caption ?? null,
          sequences: data.sequences.map((sequence) => ({
            name: sequence.name,
            shots: sequence.shots.map((shot) => ({
              timing: blank(shot.timing),
              visual: blank(shot.visual),
              vo: blank(shot.vo),
              element: blank(shot.element),
              tagging: blank(shot.tagging),
            })),
          })),
        },
        deps.createContentBrief,
      );
    }
    case "content.plans.update":
      if (!updatePlanInput.safeParse(args).success) throw new Error("invalid_input");
      return updatePlanResult(
        ctx,
        {
          id: requiredString(args.id),
          title: optionalString(args.title),
          postDate: optionalString(args.post_date),
          brief: optionalString(args.brief),
        },
        deps.updateContentPlan,
      );
    case "okr.objectives.create":
      return createObjectiveResult(
        ctx,
        {
          cycleId: requiredString(args.cycle_id),
          title: requiredString(args.title),
          whyImportant: optionalString(args.why_important),
          status: optionalString(args.status),
        },
        deps.createCompanyObjective,
      );
    case "okr.objectives.update":
      if (!updateObjectiveInput.safeParse(args).success) throw new Error("invalid_input");
      return updateObjectiveResult(
        ctx,
        {
          id: requiredString(args.id),
          level: requiredString(args.level) as "company" | "department" | "individual",
          title: optionalString(args.title),
          status: optionalString(args.status),
        },
        deps.updateObjective,
      );
    case "okr.objectives.department.create":
      return createDepartmentObjectiveResult(
        ctx,
        {
          companyObjectiveId: requiredString(args.company_objective_id),
          departmentId: requiredString(args.department_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
          status: optionalString(args.status),
        },
        deps.createDepartmentObjective,
      );
    case "okr.objectives.individual.create":
      return createIndividualObjectiveResult(
        ctx,
        {
          departmentObjectiveId: requiredString(args.department_objective_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
          status: optionalString(args.status),
          employeeId: optionalString(args.employee_id),
        },
        deps.createIndividualObjective,
      );
    case "crm.leads.create":
      return createLeadResult(
        ctx,
        {
          client: requiredString(args.client),
          title: requiredString(args.title),
          category: requiredString(args.category),
          source: optionalString(args.source),
          fuPriority: optionalString(args.fu_priority),
          status: optionalString(args.status),
        },
        deps.createLead,
      );
    case "crm.leads.update":
      if (!updateLeadInput.safeParse(args).success) throw new Error("invalid_input");
      return updateLeadResult(
        ctx,
        {
          id: requiredString(args.id),
          client: optionalString(args.client),
          title: optionalString(args.title),
          category: optionalString(args.category),
          source: optionalString(args.source),
          fuPriority: optionalString(args.fu_priority),
        },
        deps.updateLead,
      );
    case "content.plans.schedule":
      return schedulePlanResult(ctx, requiredString(args.id), deps.scheduleContentPlan);
    case "crm.leads.setStatus":
      return setLeadStatusResult(
        ctx,
        { id: requiredString(args.id), status: requiredString(args.status) },
        deps.setLeadStatus,
      );
    case "tasks.summary":
      return taskSummaryResult(ctx, optionalString(args.month), deps.listTaskSummary);
    case "tasks.list":
      return taskListResult(ctx, optionalString(args.status), optionalString(args.month), deps.listTasks);
    case "tasks.initiative.list":
      return taskInitiativeResult(ctx, deps.listTaskInitiative);
    case "tasks.workload":
      return taskWorkloadResult(ctx, optionalString(args.timeframe), deps.listTaskWorkload);
    case "tasks.completed.list":
      return completedStepsResult(ctx, optionalString(args.month), deps.listCompletedSteps);
    case "tasks.create":
      return createTaskResult(
        ctx,
        {
          title: requiredString(args.title),
          description: optionalString(args.description),
          priority: optionalString(args.priority),
          dueDate: optionalString(args.due_date),
          employeeId: optionalString(args.employee_id),
          planMonth: requiredString(args.plan_month),
        },
        deps.createTask,
      );
    case "tasks.update":
      if (!updateTaskInput.safeParse(args).success) throw new Error("invalid_input");
      return updateTaskResult(
        ctx,
        {
          id: requiredString(args.id),
          title: optionalString(args.title),
          priority: optionalString(args.priority),
          dueDate: optionalString(args.due_date),
          planMonth: optionalString(args.plan_month),
        },
        deps.updateTask,
      );
    case "tasks.delete":
      return deleteTaskResult(ctx, requiredString(args.id), deps.deleteTask);
    case "tasks.assign":
      return assignTaskResult(
        ctx,
        {
          id: requiredString(args.id),
          employeeId: requiredString(args.employee_id),
          dueDate: optionalString(args.due_date),
        },
        deps.assignTask,
      );
    case "tasks.objective.link":
      return linkTaskObjectiveResult(
        ctx,
        {
          taskId: requiredString(args.task_id),
          individualObjectiveId: requiredString(args.individual_objective_id),
        },
        deps.linkTaskObjective,
      );
    case "tasks.initiative.take":
      return takeInitiativeResult(
        ctx,
        {
          id: requiredString(args.id),
          level: requiredString(args.level),
          dueDate: requiredString(args.due_date),
          employeeId: optionalString(args.employee_id),
        },
        deps.takeTaskInitiative,
      );
    case "tasks.steps.list":
      return taskStepsResult(ctx, requiredString(args.task_id), deps.listTaskSteps);
    case "tasks.steps.create":
      return createStepResult(
        ctx,
        {
          taskId: requiredString(args.task_id),
          title: requiredString(args.title),
          description: optionalString(args.description),
        },
        deps.createTaskStep,
      );
    case "tasks.steps.update":
      return updateStepResult(
        ctx,
        { id: requiredString(args.id), title: requiredString(args.title) },
        deps.updateTaskStep,
      );
    case "tasks.steps.delete":
      return deleteStepResult(ctx, requiredString(args.id), deps.deleteTaskStep);
    case "habits.list":
      return habitsListResult(ctx, optionalString(args.date), deps.listHabits);
    case "habits.check":
      return habitCheckResult(
        ctx,
        {
          habitId: requiredString(args.habit_id),
          checked: requiredBoolean(args.checked),
          date: optionalString(args.date),
          index: optionalNumber(args.index),
        },
        deps.checkHabit,
      );
  }
}

export async function handleMcpRequest(
  request: Request,
  claims: AccessClaims,
  deps: HandlerDeps,
): Promise<Response> {
  let ctx: McpAuthContext;
  try {
    ctx = await deps.loadContext(claims);
  } catch (error) {
    if (error instanceof AuthzError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const server = new McpServer({ name: "synckerja", version: "0.1.0" });
  for (const tool of filterTools(ctx)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: toolInputs[tool.name] as unknown as ZodRawShape },
      async (args) => {
        const slot = await deps.takeToolSlot(ctx);
        if (!slot.allowed) {
          if (slot.recordDenial) await noteCall(deps, ctx, tool.name, "rate_limited");
          return { isError: true as const, content: [{ type: "text" as const, text: "rate_limited" }] };
        }
        const fresh = await reload(deps, claims);
        if (!fresh || !isToolVisible(tool.name, fresh)) {
          await noteCall(deps, fresh ?? ctx, tool.name, "forbidden");
          return forbidden();
        }
        try {
          const body = await runTool(tool.name, fresh, (args ?? {}) as ToolArgs, deps);
          await noteCall(deps, fresh, tool.name, "ok");
          return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
        } catch (error) {
          await noteCall(deps, fresh, tool.name, "error");
          throw error;
        }
      },
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
  }
}
