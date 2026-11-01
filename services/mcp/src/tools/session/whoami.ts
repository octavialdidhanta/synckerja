import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const whoamiInput = z.object({}).strict();

export function whoamiResult(ctx: McpAuthContext) {
  return {
    organization_id: ctx.organizationId,
    company_name: ctx.companyName,
    profile_id: ctx.profileId,
    employee_id: ctx.employeeId,
    roles: ctx.roles,
    scopes: ctx.scopes,
    membership_active: ctx.membershipActive,
    organizations: ctx.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      roles: organization.roles,
      active: organization.id === ctx.organizationId,
    })),
  };
}
