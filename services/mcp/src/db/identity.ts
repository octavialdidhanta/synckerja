import type { SupabaseClient } from "@supabase/supabase-js";

export async function verifySupabaseUser(
  admin: SupabaseClient,
  jwt: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export async function isActiveMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_organizations")
    .select("is_active")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) return false;
  return data.is_active !== false;
}

export async function loadConsentIdentity(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<{ profileId: string; employeeId: string | null } | null> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !profile?.id) return null;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (employeeError) return null;
  return { profileId: profile.id, employeeId: employee?.id ?? null };
}
