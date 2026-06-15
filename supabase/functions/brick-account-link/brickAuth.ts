import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { brickCorsHeaders, brickJson } from "./brickApi.ts";

export { brickCorsHeaders, brickJson };

export async function getUserFromBearer(
  admin: SupabaseClient,
  authHeader: string | null,
): Promise<{ userId: string } | { error: Response }> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return { error: brickJson({ error: "Unauthorized" }, 401) };
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user?.id) {
    return { error: brickJson({ error: "Invalid token" }, 401) };
  }
  return { userId: userRes.user.id };
}

export async function requireActiveOrg(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  const activeOrg = profile?.active_organization_id != null
    ? String(profile.active_organization_id)
    : "";
  if (!activeOrg || activeOrg !== organizationId) {
    return brickJson({ error: "Forbidden" }, 403);
  }
  return null;
}

export async function requireBrickOrgAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<Response | null> {
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const role = String(roleRow?.role ?? "").toLowerCase();
  if (role !== "owner" && role !== "admin") {
    return brickJson({ error: "Forbidden: owner or admin required" }, 403);
  }
  return null;
}
