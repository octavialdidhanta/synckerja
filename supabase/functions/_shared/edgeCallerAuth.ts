/**
 * Caller checks for Edge Functions that the app calls with supabase.functions.invoke
 * (the user's access token is sent as Authorization: Bearer <jwt>).
 */
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCallerToken, isAuthorizedServiceCaller } from "./serviceRoleEdgeAuth.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type RequestUser = { id: string; email: string | null };

/** The signed-in user behind the request, or null (anon key, no token, expired token). */
export async function getRequestUser(admin: SupabaseClient, req: Request): Promise<RequestUser | null> {
  if (isAuthorizedServiceCaller(req)) return null;
  const token = extractCallerToken(req);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { id: data.user.id, email: data.user.email?.toLowerCase() ?? null };
}

/** Active membership of the user in the organization. */
export async function isActiveOrgMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return false;
  return (data as { is_active?: boolean | null }).is_active !== false;
}

/** Same rule as SQL public.user_is_org_owner_or_admin(): role owner/admin in user_roles. */
export async function isOrgOwnerOrAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin"])
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/** Service-role caller (cron / other functions) or a signed-in active member of the org. */
export async function isServiceOrOrgMember(
  admin: SupabaseClient,
  req: Request,
  organizationId: string,
): Promise<boolean> {
  if (isAuthorizedServiceCaller(req)) return true;
  const user = await getRequestUser(admin, req);
  if (!user) return false;
  return isActiveOrgMember(admin, user.id, organizationId);
}
