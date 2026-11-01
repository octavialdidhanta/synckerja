import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMembership } from "../authz/context";
import { AuthzError } from "../authz/errors";
import type { AccessClaims } from "../oauth/tokens";

export type ConnectorSession = {
  userId: string;
  clientId: string;
  connectionId: string;
  activeOrganizationId: string;
};

type SessionRow = {
  user_id: string;
  client_id: string;
  connection_id: string;
  active_organization_id: string;
};

export function activeOrganizationId(session: ConnectorSession | null, claims: AccessClaims): string | null {
  return session?.activeOrganizationId ?? claims.orgId;
}

function sessionFromRow(row: SessionRow): ConnectorSession {
  return {
    userId: row.user_id,
    clientId: row.client_id,
    connectionId: row.connection_id,
    activeOrganizationId: row.active_organization_id,
  };
}

async function readSession(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
): Promise<ConnectorSession | null> {
  const { data, error } = await admin
    .from("mcp_connector_sessions")
    .select("user_id, client_id, connection_id, active_organization_id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new AuthzError("session_lookup_failed", 401);
  return data ? sessionFromRow(data as SessionRow) : null;
}

/** The session row wins over org_id in a legacy access token. A missing row is seeded from that claim. */
export async function resolveConnectorSession(
  admin: SupabaseClient,
  claims: AccessClaims,
): Promise<ConnectorSession | null> {
  const existing = await readSession(admin, claims.sub, claims.clientId);
  if (existing) return existing;
  if (!claims.orgId) return null;

  const connectionId = claims.connectionId ?? crypto.randomUUID();
  const { error } = await admin.from("mcp_connector_sessions").insert({
    user_id: claims.sub,
    client_id: claims.clientId,
    connection_id: connectionId,
    active_organization_id: claims.orgId,
  });
  if (error) {
    if (error.code === "23505") {
      const raced = await readSession(admin, claims.sub, claims.clientId);
      if (raced) return raced;
    }
    throw new AuthzError("session_lookup_failed", 401);
  }

  const { error: tokenError } = await admin
    .from("mcp_oauth_refresh_tokens")
    .update({ connection_id: connectionId })
    .eq("user_id", claims.sub)
    .eq("client_id", claims.clientId)
    .is("connection_id", null)
    .is("revoked_at", null);
  if (tokenError) throw new AuthzError("session_lookup_failed", 401);

  return {
    userId: claims.sub,
    clientId: claims.clientId,
    connectionId,
    activeOrganizationId: claims.orgId,
  };
}

export async function listActiveMemberships(
  admin: SupabaseClient,
  userId: string,
): Promise<OrganizationMembership[]> {
  const { data: members, error } = await admin
    .from("user_organizations")
    .select("organization_id, is_active")
    .eq("user_id", userId);
  if (error) throw new AuthzError("membership_lookup_failed", 401);

  const ids = (members ?? [])
    .filter((row) => row.is_active !== false && typeof row.organization_id === "string")
    .map((row) => String(row.organization_id));
  if (ids.length === 0) return [];

  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id, company_name")
    .in("id", ids);
  if (orgError) throw new AuthzError("organization_lookup_failed", 401);

  const { data: roles, error: roleError } = await admin
    .from("user_roles")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("organization_id", ids);
  if (roleError) throw new AuthzError("role_lookup_failed", 401);

  const rolesByOrg = new Map<string, string[]>();
  for (const row of roles ?? []) {
    const orgId = String(row.organization_id);
    const list = rolesByOrg.get(orgId) ?? [];
    list.push(String(row.role));
    rolesByOrg.set(orgId, list);
  }

  return (orgs ?? [])
    .map((org) => ({
      id: String(org.id),
      name: String(org.company_name ?? ""),
      roles: rolesByOrg.get(String(org.id)) ?? [],
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function switchConnectorOrganization(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  organizationId: string,
): Promise<void> {
  const { error } = await admin.rpc("mcp_switch_organization", {
    p_user_id: userId,
    p_client_id: clientId,
    p_organization_id: organizationId,
  });
  if (!error) return;
  if (error.message.includes("not_a_member")) throw new AuthzError("not_a_member", 403);
  if (error.message.includes("session_missing")) throw new AuthzError("session_missing", 401);
  throw new Error(error.message);
}
