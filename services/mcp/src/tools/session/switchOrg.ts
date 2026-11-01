import { z } from "zod";
import type { McpAuthContext, OrganizationMembership } from "../../authz/context";
import { AuthzError } from "../../authz/errors";
import { filterTools } from "../../mcp/filterTools";
import { matchOrganization } from "./matchOrganization";

export const switchOrgInput = z
  .object({
    organization_id: z.string().uuid().optional(),
    name: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => Number(Boolean(value.organization_id)) + Number(Boolean(value.name)) === 1, {
    message: "invalid_input",
  });

export type SwitchOrgDeps = {
  switchOrganization: (organizationId: string) => Promise<void>;
  reload: () => Promise<McpAuthContext>;
};

function publicOrg(organization: OrganizationMembership) {
  return { id: organization.id, name: organization.name, roles: organization.roles };
}

function currentResult(ctx: McpAuthContext, toolsChanged: boolean, tools?: string[]) {
  return {
    switched: true as const,
    organization_id: ctx.organizationId,
    organization_name: ctx.companyName,
    roles: ctx.roles,
    scopes: ctx.scopes,
    tools_changed: toolsChanged,
    ...(tools ? { tools } : {}),
  };
}

export async function switchOrgResult(ctx: McpAuthContext, input: unknown, deps: SwitchOrgDeps) {
  const parsed = switchOrgInput.safeParse(input);
  if (!parsed.success) throw new Error("invalid_input");

  let organization: OrganizationMembership | undefined;
  if (parsed.data.organization_id) {
    organization = ctx.organizations.find((item) => item.id === parsed.data.organization_id);
    if (!organization) return { switched: false as const, error: "organization_not_found" };
  } else {
    const named = matchOrganization(parsed.data.name ?? "", ctx.organizations);
    if (!named.ok && named.reason === "ambiguous") {
      const ids = new Set(named.matches.map((match) => match.id));
      return {
        switched: false as const,
        error: "ambiguous_organization",
        organizations: ctx.organizations.filter((item) => ids.has(item.id)).map(publicOrg),
      };
    }
    if (!named.ok) return { switched: false as const, error: "organization_not_found" };
    organization = ctx.organizations.find((item) => item.id === named.organization.id);
  }
  if (!organization) return { switched: false as const, error: "organization_not_found" };

  if (ctx.membershipActive && organization.id === ctx.organizationId) return currentResult(ctx, false);

  try {
    await deps.switchOrganization(organization.id);
  } catch (error) {
    if (error instanceof AuthzError && (error.message === "not_a_member" || error.message === "session_missing")) {
      return { switched: false as const, error: error.message };
    }
    throw error;
  }

  const next = await deps.reload();
  const before = filterTools(ctx).map((tool) => tool.name);
  const after = filterTools(next).map((tool) => tool.name);
  const toolsChanged = before.join("\0") !== after.join("\0");
  return currentResult(next, toolsChanged, toolsChanged ? after : undefined);
}
