import {
  evaluatePageAccess,
  type PageAccessConfig,
} from "../../../../src/shared/auth/page-access/evaluatePageAccess";
import { buildEffectiveAccessRoles, hasOwnerRole } from "../../../../src/shared/auth/page-access/accessRoleSet";
import type { AccessClaims } from "../oauth/tokens";
import { AuthzError } from "./errors";
import { isDigitalMarketingEnabled, type ModuleRow } from "./moduleAccess";

export const CONTENT_PAGE_PATH = "/digital-marketing/social-media";

export type McpAuthContext = {
  userId: string;
  profileId: string;
  organizationId: string;
  employeeId: string | null;
  companyName: string;
  roles: string[];
  scopes: string[];
  clientId: string;
  digitalMarketingEnabled: boolean;
  contentPageAllowed: boolean;
};

export function buildAuthContext(input: {
  claims: AccessClaims;
  member: boolean;
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
  if (!input.member) throw new AuthzError("not_a_member", 401);
  if (!input.profileId || input.profileId !== input.claims.profileId) {
    throw new AuthzError("profile_mismatch", 401);
  }
  if (input.claims.employeeId && input.claims.employeeId !== input.employeeId) {
    throw new AuthzError("employee_mismatch", 401);
  }

  const effective = buildEffectiveAccessRoles(input.roles, null);
  const owner = hasOwnerRole(effective, null);
  const status = (input.employeeStatus || "active").toLowerCase();
  if (input.employeeId && (status === "terminated" || status === "inactive") && !owner) {
    throw new AuthzError("terminated", 403);
  }

  const digitalMarketingEnabled = isDigitalMarketingEnabled({
    subscriptionSelfServiceEnabled: input.subscriptionSelfServiceEnabled,
    salesRows: input.salesRows,
    subscriptionPlanId: input.subscriptionPlanId,
    planRows: input.planRows,
  });
  const contentPageAllowed = evaluatePageAccess(
    CONTENT_PAGE_PATH,
    input.configurations,
    {
      roles: input.roles,
      primaryRole: null,
      employeeId: input.employeeId,
      jobLevelId: input.jobLevelId,
      jobLevelName: input.jobLevelName,
    },
    "deny",
  );

  return {
    userId: input.claims.sub,
    profileId: input.profileId,
    organizationId: input.claims.orgId,
    employeeId: input.employeeId,
    companyName: input.companyName,
    roles: input.roles,
    scopes: input.claims.scopes,
    clientId: input.claims.clientId,
    digitalMarketingEnabled,
    contentPageAllowed,
  };
}
