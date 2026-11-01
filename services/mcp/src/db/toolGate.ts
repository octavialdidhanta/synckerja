import type { SupabaseClient } from "@supabase/supabase-js";
import { activeOrganizationId, resolveConnectorSession } from "./connectorSession";
import type { AccessClaims } from "../oauth/tokens";

export type ToolCallOutcome = "ok" | "error" | "forbidden" | "rate_limited";

type Session = { userId: string; organizationId: string; clientId: string };

type SlotRow = { allowed: boolean; record_denial: boolean };

export async function accessRevokedAt(admin: SupabaseClient, claims: AccessClaims): Promise<string | null> {
  const session = await resolveConnectorSession(admin, claims);
  const organizationId = activeOrganizationId(session, claims);
  if (!organizationId) return null;
  const { data, error } = await admin.rpc("mcp_access_cutoff", {
    p_user_id: claims.sub,
    p_organization_id: organizationId,
    p_client_id: claims.clientId,
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}

export async function takeToolSlot(
  admin: SupabaseClient,
  ctx: { userId: string; organizationId: string },
): Promise<{ allowed: boolean; recordDenial: boolean }> {
  const { data, error } = await admin.rpc("mcp_take_tool_slot", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as SlotRow | null;
  if (!row || typeof row.allowed !== "boolean") throw new Error("rate_limit_failed");
  return { allowed: row.allowed, recordDenial: row.record_denial === true };
}

export async function recordToolCall(
  admin: SupabaseClient,
  ctx: Session,
  toolName: string,
  outcome: ToolCallOutcome,
): Promise<void> {
  const { error } = await admin.rpc("mcp_record_tool_call", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_client_id: ctx.clientId,
    p_tool_name: toolName,
    p_outcome: outcome,
  });
  if (error) throw new Error(error.message);
}
