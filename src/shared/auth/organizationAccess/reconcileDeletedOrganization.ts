import { supabase } from "@/shared/lib/supabaseClient";
import type { ReconcileOrganizationResult } from "@/shared/auth/organizationAccess/organizationAccessTypes";

async function listActiveMembershipOrgIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  return (data ?? []).map((row) => String(row.organization_id));
}

async function clearActiveOrganizationInProfile(userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ active_organization_id: null })
    .eq("user_id", userId);
}

async function setActiveOrganizationInProfile(userId: string, organizationId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ active_organization_id: organizationId })
    .eq("user_id", userId);
}

async function organizationRowExists(organizationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

/** Resolve access when active org row is missing (CMS hard delete / revoked membership). */
export async function reconcileMissingOrganizationRow(
  userId: string,
  staleOrganizationId: string | null | undefined,
): Promise<ReconcileOrganizationResult> {
  const membershipOrgIds = await listActiveMembershipOrgIds(userId);

  if (membershipOrgIds.length === 0) {
    await clearActiveOrganizationInProfile(userId);
    return { organizationId: null, accessState: "no_membership" };
  }

  for (const candidateId of membershipOrgIds) {
    if (!(await organizationRowExists(candidateId))) continue;

    if (staleOrganizationId && candidateId !== staleOrganizationId) {
      await setActiveOrganizationInProfile(userId, candidateId);
      return { organizationId: candidateId, accessState: "orphan_recovering" };
    }

    if (!staleOrganizationId || candidateId === staleOrganizationId) {
      if (staleOrganizationId !== candidateId) {
        await setActiveOrganizationInProfile(userId, candidateId);
      }
      return { organizationId: candidateId, accessState: "ready" };
    }
  }

  await clearActiveOrganizationInProfile(userId);
  return { organizationId: null, accessState: "no_membership" };
}

export async function resolveOrganizationAccessState(
  userId: string,
  activeOrganizationId: string | null | undefined,
): Promise<ReconcileOrganizationResult> {
  if (!activeOrganizationId) {
    const membershipOrgIds = await listActiveMembershipOrgIds(userId);
    if (membershipOrgIds.length === 0) {
      return { organizationId: null, accessState: "no_membership" };
    }
    return reconcileMissingOrganizationRow(userId, null);
  }

  if (await organizationRowExists(activeOrganizationId)) {
    return { organizationId: activeOrganizationId, accessState: "ready" };
  }

  return reconcileMissingOrganizationRow(userId, activeOrganizationId);
}
