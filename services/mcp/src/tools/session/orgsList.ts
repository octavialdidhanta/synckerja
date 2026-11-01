import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const orgsListInput = z.object({}).strict();

export function orgsListResult(ctx: McpAuthContext) {
  return {
    organizations: ctx.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      roles: organization.roles,
    })),
  };
}
