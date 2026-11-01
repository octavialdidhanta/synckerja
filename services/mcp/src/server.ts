import { serve } from "@hono/node-server";
import { loadConfig } from "./config";
import { loadContext } from "./authz/loadContext";
import { createAdmin } from "./db/admin";
import { isActiveMember, loadConsentIdentity, verifySupabaseUser } from "./db/identity";
import { listContentPlans } from "./db/listContentPlans";
import { createContentBrief, listContentCatalog } from "./db/contentBriefs";
import { attachLeadMagnetDelivery, listLeadMagnetDrafts } from "./db/leadMagnet";
import { listContentCalendar, listCrmLeads, listOkrCycles, listOkrDepartments, listOkrObjectives } from "./db/phase1Reads";
import {
  listAdsAccounts,
  listCustomerVisits,
  listEmployees,
  listExpenses,
  listIncomeTransactions,
  listInventoryStock,
  listKolCampaigns,
  listKolProfiles,
} from "./db/phase2Reads";
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
} from "./db/phase3Writes";
import {
  createExpenseRecord,
  createIncomeTransaction,
  updateExpenseRecord,
  updateIncomeTransaction,
} from "./db/phase5Writes";
import { listPayrollRuns, listPosDailySales } from "./db/payrollPosReads";
import {
  assignTask,
  createTask,
  deleteTask,
  linkTaskObjective,
  listCompletedSteps,
  listTaskInitiative,
  listTaskSummary,
  listTasks,
  listTaskWorkload,
  takeTaskInitiative,
  updateTask,
  createTaskStep,
  deleteTaskStep,
  listTaskSteps,
  updateTaskStep,
} from "./db/dailyTasks";
import { checkHabit, listHabits } from "./db/habits";
import { accessRevokedAt, recordToolCall, takeToolSlot } from "./db/toolGate";
import { scheduleContentPlan } from "./db/scheduleContentPlan";
import { createApp } from "./http/createApp";
import { SupabaseGrantStore } from "./oauth/supabaseStore";

const config = loadConfig();
const admin = createAdmin(config.supabaseUrl, config.supabaseServiceRoleKey);
const app = createApp({
  config,
  store: new SupabaseGrantStore(admin),
  verifySupabaseUser: (jwt) => verifySupabaseUser(admin, jwt),
  isActiveMember: (userId, organizationId) => isActiveMember(admin, userId, organizationId),
  loadIdentity: (userId, organizationId) => loadConsentIdentity(admin, userId, organizationId),
  loadContext: (claims) => loadContext(admin, claims),
  accessRevokedAt: (claims) => accessRevokedAt(admin, claims),
  takeToolSlot: (ctx) => takeToolSlot(admin, ctx),
  recordToolCall: (ctx, toolName, outcome) => recordToolCall(admin, ctx, toolName, outcome),
  listContentPlans: (ctx) => listContentPlans(admin, ctx),
  listContentCalendar: (ctx, month) => listContentCalendar(admin, ctx, month),
  listContentCatalog: (ctx) => listContentCatalog(admin, ctx),
  listOkrCycles: (ctx) => listOkrCycles(admin, ctx),
  listOkrObjectives: (ctx, cycleId) => listOkrObjectives(admin, ctx, cycleId),
  listOkrDepartments: (ctx) => listOkrDepartments(admin, ctx),
  listCrmLeads: (ctx, status) => listCrmLeads(admin, ctx, status),
  listAdsAccounts: (ctx) => listAdsAccounts(admin, ctx),
  listIncomeTransactions: (ctx, month) => listIncomeTransactions(admin, ctx, month),
  listExpenses: (ctx, month) => listExpenses(admin, ctx, month),
  listEmployees: (ctx) => listEmployees(admin, ctx),
  listPayrollRuns: (ctx, month) => listPayrollRuns(admin, ctx, month),
  listCustomerVisits: (ctx, month) => listCustomerVisits(admin, ctx, month),
  listPosDailySales: (ctx, month) => listPosDailySales(admin, ctx, month),
  listKolCampaigns: (ctx) => listKolCampaigns(admin, ctx),
  listKolProfiles: (ctx) => listKolProfiles(admin, ctx),
  listInventoryStock: (ctx) => listInventoryStock(admin, ctx),
  createContentPlan: (ctx, input) => createContentPlan(admin, ctx, input),
  createContentBrief: (ctx, input) => createContentBrief(admin, ctx, input),
  listLeadMagnetDrafts: (ctx, campaignId) => listLeadMagnetDrafts(admin, ctx, campaignId),
  attachLeadMagnetDelivery: (ctx, input) => attachLeadMagnetDelivery(admin, config.supabaseUrl, ctx, input),
  updateContentPlan: (ctx, input) => updateContentPlan(admin, ctx, input.id, input),
  createCompanyObjective: (ctx, input) => createCompanyObjective(admin, ctx, input),
  updateObjective: (ctx, input) => updateObjective(admin, ctx, input),
  createDepartmentObjective: (ctx, input) => createDepartmentObjective(admin, ctx, input),
  createIndividualObjective: (ctx, input) => createIndividualObjective(admin, ctx, input),
  createLead: (ctx, input) => createLead(admin, ctx, input),
  updateLead: (ctx, input) => updateLead(admin, ctx, input),
  scheduleContentPlan: (ctx, id) => scheduleContentPlan(config, ctx, id),
  setLeadStatus: (ctx, input) => setLeadStatus(admin, ctx, input),
  createIncomeTransaction: (ctx, input) => createIncomeTransaction(admin, ctx, input),
  updateIncomeTransaction: (ctx, input) => updateIncomeTransaction(admin, ctx, input),
  createExpenseRecord: (ctx, input) => createExpenseRecord(admin, ctx, input),
  updateExpenseRecord: (ctx, input) => updateExpenseRecord(admin, ctx, input),
  listTaskSummary: (ctx, month) => listTaskSummary(admin, ctx, month),
  listTasks: (ctx, status, month) => listTasks(admin, ctx, status, month),
  listTaskInitiative: (ctx) => listTaskInitiative(admin, ctx),
  listTaskWorkload: (ctx, timeframe) => listTaskWorkload(admin, ctx, timeframe),
  listCompletedSteps: (ctx, month) => listCompletedSteps(admin, ctx, month),
  createTask: (ctx, input) => createTask(admin, ctx, input),
  updateTask: (ctx, input) => updateTask(admin, ctx, input),
  deleteTask: (ctx, id) => deleteTask(admin, ctx, id),
  assignTask: (ctx, input) => assignTask(admin, ctx, input),
  linkTaskObjective: (ctx, input) => linkTaskObjective(admin, ctx, input),
  takeTaskInitiative: (ctx, input) => takeTaskInitiative(admin, ctx, input),
  listTaskSteps: (ctx, taskId) => listTaskSteps(admin, ctx, taskId),
  createTaskStep: (ctx, input) => createTaskStep(admin, ctx, input),
  updateTaskStep: (ctx, input) => updateTaskStep(admin, ctx, input),
  deleteTaskStep: (ctx, id) => deleteTaskStep(admin, ctx, id),
  listHabits: (ctx, date) => listHabits(admin, ctx, date),
  checkHabit: (ctx, input) => checkHabit(admin, ctx, input),
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`MCP endpoint ${config.publicUrl}/mcp`);
});
