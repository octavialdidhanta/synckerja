import {
  evaluatePageAccess,
  type PageAccessConfig,
} from "../../../../src/shared/auth/page-access/evaluatePageAccess";
import { buildEffectiveAccessRoles, hasOwnerRole } from "../../../../src/shared/auth/page-access/accessRoleSet";
import type { AccessClaims } from "../oauth/tokens";
import { AuthzError } from "./errors";
import { isModuleEnabled, type ModuleRow } from "./moduleAccess";

export const CONTENT_PAGE_PATH = "/digital-marketing/social-media";
export const CALENDAR_PAGE_PATH = "/digital-marketing/social-media/content-calendar";
export const OKR_PAGE_PATH = "/okr";
export const LEADS_PAGE_PATH = "/omnichannel/leads";
export const LIVECHAT_PAGE_PATH = "/omnichannel/livechat";
export const MANAGE_COMMENTS_PAGE_PATH = "/digital-marketing/social-media-performance/manage-comments";
export const GOOGLE_ADS_PAGE_PATH = "/digital-marketing/google-ads";
export const META_ADS_PAGE_PATH = "/digital-marketing/meta-ads";
export const TIKTOK_ADS_PAGE_PATH = "/digital-marketing/tiktok-ads";
export const ADS_PAGE_PATHS = [GOOGLE_ADS_PAGE_PATH, META_ADS_PAGE_PATH, TIKTOK_ADS_PAGE_PATH] as const;
export const INCOME_PAGE_PATH = "/incomes/transaction";
export const EXPENSES_PAGE_PATH = "/expenses/dashboard";
export const EMPLOYEES_PAGE_PATH = "/employees";
export const PAYROLL_PAGE_PATH = "/payroll/calculations";
export const VISITS_PAGE_PATH = "/operations/sales";
export const POS_SALES_SUMMARY_PAGE_PATH = "/operations/reports/sales/summary";
export const KOL_CAMPAIGNS_PAGE_PATH = "/kol-management/campaigns";
export const KOL_PROFILES_PAGE_PATH = "/kol-management/kol-management";
/** Permission catalog key. The browser URL is /operations/inventory. */
export const INVENTORY_PAGE_PATH = "/operations/sales/stock-management";
export const INGREDIENT_LIST_PAGE_PATH = "/operations/ingredient/list";
export const INGREDIENT_RECIPES_PAGE_PATH = "/operations/ingredient/recipes";
export const DAILY_TASK_PAGE_PATH = "/tools/daily-task";
export const HABITS_PAGE_PATH = "/tools/habits-tracker";
export const LEAD_MAGNET_PAGE_PATH = "/digital-marketing/lead-magnet";
export const THINKING_LAB_PAGE_PATH = "/thinking-lab";

export const MCP_MODULE_KEYS = [
  "digitalMarketing",
  "okr",
  "omnichannel",
  "finance",
  "humanResources",
  "operations",
  "tools",
] as const;
export type McpModuleKey = (typeof MCP_MODULE_KEYS)[number];

export type OrganizationMembership = {
  id: string;
  name: string;
  roles: string[];
};

export type McpAuthContext = {
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  companyName: string;
  roles: string[];
  scopes: string[];
  clientId: string;
  membershipActive: boolean;
  organizations: OrganizationMembership[];
  modules: Record<McpModuleKey, boolean>;
  pages: Record<string, boolean>;
};

const NO_MODULES: Record<McpModuleKey, boolean> = {
  digitalMarketing: false,
  okr: false,
  omnichannel: false,
  finance: false,
  humanResources: false,
  operations: false,
  tools: false,
};

export function buildAuthContext(input: {
  claims: AccessClaims;
  member: boolean;
  organizationId?: string | null;
  organizations?: OrganizationMembership[];
  profileId: string | null;
  employeeId: string | null;
  employeeStatus: string | null;
  jobLevelId: string | null;
  jobLevelName: string | null;
  roles: string[];
  companyName: string;
  configurations: PageAccessConfig[];
  subscriptionSelfServiceEnabled: boolean | null | undefined;
  salesRows: ModuleRow[] | null;
  subscriptionPlanId: string | null;
  planRows: ModuleRow[] | null;
}): McpAuthContext {
  const organizationId = input.organizationId ?? input.claims.orgId;
  if (!organizationId) throw new AuthzError("organization_lookup_failed", 401);
  const organizations = input.organizations ?? [];

  if (!input.member) {
    return {
      userId: input.claims.sub,
      profileId: input.claims.profileId,
      organizationId,
      employeeId: null,
      companyName: input.companyName,
      roles: [],
      scopes: input.claims.scopes,
      clientId: input.claims.clientId,
      membershipActive: false,
      organizations,
      modules: NO_MODULES,
      pages: {},
    };
  }

  if (!input.profileId || input.profileId !== input.claims.profileId) {
    throw new AuthzError("profile_mismatch", 401);
  }

  const effective = buildEffectiveAccessRoles(input.roles, null);
  const owner = hasOwnerRole(effective, null);
  const status = (input.employeeStatus || "active").toLowerCase();
  if (input.employeeId && (status === "terminated" || status === "inactive") && !owner) {
    throw new AuthzError("terminated", 403);
  }

  const enablement = {
    subscriptionSelfServiceEnabled: input.subscriptionSelfServiceEnabled,
    salesRows: input.salesRows,
    subscriptionPlanId: input.subscriptionPlanId,
    planRows: input.planRows,
  };
  const subject = {
    roles: input.roles,
    primaryRole: null,
    employeeId: input.employeeId,
    jobLevelId: input.jobLevelId,
    jobLevelName: input.jobLevelName,
  };
  const pagePaths = [
    CONTENT_PAGE_PATH,
    CALENDAR_PAGE_PATH,
    OKR_PAGE_PATH,
    LEADS_PAGE_PATH,
    LIVECHAT_PAGE_PATH,
    MANAGE_COMMENTS_PAGE_PATH,
    ...ADS_PAGE_PATHS,
    INCOME_PAGE_PATH,
    EXPENSES_PAGE_PATH,
    EMPLOYEES_PAGE_PATH,
    PAYROLL_PAGE_PATH,
    VISITS_PAGE_PATH,
    POS_SALES_SUMMARY_PAGE_PATH,
    KOL_CAMPAIGNS_PAGE_PATH,
    KOL_PROFILES_PAGE_PATH,
    INVENTORY_PAGE_PATH,
    INGREDIENT_LIST_PAGE_PATH,
    INGREDIENT_RECIPES_PAGE_PATH,
    DAILY_TASK_PAGE_PATH,
    HABITS_PAGE_PATH,
    LEAD_MAGNET_PAGE_PATH,
    THINKING_LAB_PAGE_PATH,
  ];

  return {
    userId: input.claims.sub,
    profileId: input.profileId,
    organizationId,
    employeeId: input.employeeId,
    companyName: input.companyName,
    roles: input.roles,
    scopes: input.claims.scopes,
    clientId: input.claims.clientId,
    membershipActive: true,
    organizations,
    modules: {
      digitalMarketing: isModuleEnabled("digitalMarketing", enablement),
      okr: isModuleEnabled("okr", enablement),
      omnichannel: isModuleEnabled("omnichannel", enablement),
      finance: isModuleEnabled("finance", enablement),
      humanResources: isModuleEnabled("humanResources", enablement),
      operations: isModuleEnabled("operations", enablement),
      tools: isModuleEnabled("tools", enablement),
    },
    pages: Object.fromEntries(
      pagePaths.map((path) => [path, evaluatePageAccess(path, input.configurations, subject, "deny")]),
    ),
  };
}
