import { describe, expect, it } from "vitest";
import { buildAuthContext, type McpAuthContext, type OrganizationMembership } from "../src/authz/context";
import type { AccessClaims } from "../src/oauth/tokens";
import { filterTools } from "../src/mcp/filterTools";
import { activeOrganizationId } from "../src/db/connectorSession";
import { matchOrganization } from "../src/tools/session/matchOrganization";
import { stampOrganization } from "../src/tools/session/stampOrganization";
import { switchOrgInput, switchOrgResult } from "../src/tools/session/switchOrg";
import { contentPlansInput } from "../src/tools/content/plansList";

const claims: AccessClaims = {
  sub: "user-1",
  profileId: "profile-1",
  orgId: null,
  employeeId: "emp-a",
  connectionId: "connection-1",
  scopes: ["session:read", "content:read", "finance:write"],
  clientId: "client-1",
  jti: "jti-1",
  iat: 1,
};

const organizations: OrganizationMembership[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Synckerja Office", roles: ["owner"] },
  { id: "22222222-2222-4222-8222-222222222222", name: "OBC", roles: ["employee"] },
  { id: "33333333-3333-4333-8333-333333333333", name: "Obc", roles: ["employee"] },
];

function context(organizationId: string, employeeId: string | null, extra: Partial<McpAuthContext> = {}): McpAuthContext {
  const built = buildAuthContext({
    claims: { ...claims, orgId: organizationId, employeeId },
    member: true,
    organizationId,
    organizations,
    profileId: "profile-1",
    employeeId,
    employeeStatus: "active",
    jobLevelId: null,
    jobLevelName: null,
    roles: organizations.find((organization) => organization.id === organizationId)?.roles ?? [],
    companyName: organizations.find((organization) => organization.id === organizationId)?.name ?? "",
    configurations: [{ page_path: "/digital-marketing/social-media", roles_allowed: ["owner", "employee"] }],
    subscriptionSelfServiceEnabled: true,
    salesRows: null,
    subscriptionPlanId: null,
    planRows: null,
  });
  return { ...built, ...extra };
}

describe("activeOrganizationId", () => {
  const legacy = { ...claims, orgId: "org-legacy", connectionId: null };

  it("uses the token organization until a session exists", () => {
    expect(activeOrganizationId(null, legacy)).toBe("org-legacy");
  });

  it("follows the session after it exists, including a different token organization", () => {
    expect(
      activeOrganizationId(
        {
          userId: "user-1",
          clientId: "client-1",
          connectionId: "connection-1",
          activeOrganizationId: "org-live",
        },
        legacy,
      ),
    ).toBe("org-live");
  });
});

describe("matchOrganization", () => {
  it("matches one name without caring about letter case", () => {
    const match = matchOrganization("  synckerja office ", [organizations[0], organizations[1]]);
    expect(match).toEqual({ ok: true, organization: organizations[0] });
  });

  it("rejects an unknown name", () => {
    expect(matchOrganization("Missing", organizations)).toEqual({ ok: false, reason: "not_found", matches: [] });
  });

  it("rejects two organizations with the same name", () => {
    const match = matchOrganization("obc", organizations);
    expect(match.ok).toBe(false);
    if (match.ok) return;
    expect(match.reason).toBe("ambiguous");
    expect(match.matches.map((organization) => organization.id)).toEqual([organizations[1].id, organizations[2].id]);
  });
});

describe("switchOrgResult", () => {
  it("does not change the session when the name is ambiguous", async () => {
    let called = false;
    const result = await switchOrgResult(context(organizations[0].id, "emp-a"), { name: "OBC" }, {
      switchOrganization: async () => {
        called = true;
      },
      reload: async () => context(organizations[1].id, "emp-b"),
    });
    expect(called).toBe(false);
    expect(result).toMatchObject({ switched: false, error: "ambiguous_organization" });
  });

  it("switches by exact name and returns the target employee context", async () => {
    const switched: string[] = [];
    const result = await switchOrgResult(context(organizations[0].id, "emp-a"), { name: "Synckerja Office" }, {
      switchOrganization: async () => {
        throw new Error("same org");
      },
      reload: async () => context(organizations[0].id, "emp-a"),
    });
    expect(switched).toEqual([]);
    expect(result).toMatchObject({
      switched: true,
      organization_id: organizations[0].id,
      organization_name: "Synckerja Office",
      roles: ["owner"],
      tools_changed: false,
    });
  });

  it("uses the reloaded organization instead of the employee stored in the token", async () => {
    let target = "";
    const next = context(organizations[1].id, "emp-b", {
      pages: {},
      modules: {
        digitalMarketing: false,
        okr: false,
        omnichannel: false,
        finance: false,
        humanResources: false,
        pos: false,
        operations: false,
        tools: false,
      },
    });
    const result = await switchOrgResult(context(organizations[0].id, "emp-a"), { organization_id: organizations[1].id }, {
      switchOrganization: async (organizationId) => {
        target = organizationId;
      },
      reload: async () => next,
    });
    expect(target).toBe(organizations[1].id);
    expect(result).toMatchObject({
      switched: true,
      organization_id: organizations[1].id,
      organization_name: "OBC",
      roles: ["employee"],
      tools_changed: true,
    });
    if (!("tools" in result) || !result.tools) throw new Error("missing tools");
    expect(result.tools).toEqual(filterTools(next).map((tool) => tool.name));
    expect(result.tools).not.toContain("content.plans.list");
  });

  it("rejects an organization id the user does not belong to", async () => {
    let called = false;
    const result = await switchOrgResult(
      context(organizations[0].id, "emp-a"),
      { organization_id: "44444444-4444-4444-8444-444444444444" },
      {
        switchOrganization: async () => {
          called = true;
        },
        reload: async () => context(organizations[0].id, "emp-a"),
      },
    );
    expect(called).toBe(false);
    expect(result).toEqual({ switched: false, error: "organization_not_found" });
  });
});

describe("switchOrgInput", () => {
  it("accepts one selector and rejects an organization argument mixed with a name", () => {
    expect(switchOrgInput.safeParse({ name: "OBC" }).success).toBe(true);
    expect(switchOrgInput.safeParse({ organization_id: organizations[1].id }).success).toBe(true);
    expect(switchOrgInput.safeParse({}).success).toBe(false);
    expect(switchOrgInput.safeParse({ name: "OBC", organization_id: organizations[1].id }).success).toBe(false);
  });
});

describe("stampOrganization", () => {
  it("adds the active organization to an object and wraps an array", () => {
    const ctx = { organizationId: "org-1", companyName: "OBC" };
    expect(stampOrganization({ id: "row-1" }, ctx)).toEqual({
      id: "row-1",
      organization_id: "org-1",
      organization_name: "OBC",
    });
    expect(stampOrganization([{ id: "row-1" }], ctx)).toEqual({
      organization_id: "org-1",
      organization_name: "OBC",
      items: [{ id: "row-1" }],
    });
  });
});

describe("read tools", () => {
  it("rejects organization_id", () => {
    expect(contentPlansInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
  });
});
