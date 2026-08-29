import { supabase } from "@/shared/lib/supabaseClient";
import { pickHighestUserRoleFromRows } from "@/shared/lib/organizationRolePick";

export type OrganizationMembership = {
  organizationId: string;
  companyName: string;
  role: string;
};

type OrgRow = {
  organization_id: string;
  organizations: { company_name: string } | { company_name: string }[] | null;
};

function pickRole(rows: { organization_id: string; role: string }[], orgId: string): string {
  const forOrg = rows.filter((r) => r.organization_id === orgId);
  if (forOrg.length === 0) return "employee";
  return pickHighestUserRoleFromRows(forOrg) ?? "employee";
}

function orgNameFromRow(row: OrgRow): string {
  const o = row.organizations;
  if (!o) return "";
  if (Array.isArray(o)) return o[0]?.company_name ?? "";
  return o.company_name ?? "";
}

export type UserOrganizationsData = {
  memberships: OrganizationMembership[];
  activeOrganizationId: string | null;
  userId: string;
};

export const userOrganizationsQueryKey = ["user-organizations"] as const;

export function buildUserOrganizationsData(
  userId: string,
  profileActiveOrgId: string | null | undefined,
  uoRows: OrgRow[],
  roles: { organization_id: string; role: string }[],
): UserOrganizationsData {
  const memberships: OrganizationMembership[] = uoRows.map((row) => ({
    organizationId: row.organization_id,
    companyName: orgNameFromRow(row),
    role: pickRole(roles, row.organization_id),
  }));

  const memberIds = new Set(memberships.map((m) => m.organizationId));
  let activeOrganizationId = profileActiveOrgId ?? null;

  if (activeOrganizationId && !memberIds.has(activeOrganizationId)) {
    activeOrganizationId = null;
  }

  if (!activeOrganizationId && memberships.length > 0) {
    activeOrganizationId = memberships[0].organizationId;
  }

  return {
    memberships,
    activeOrganizationId,
    userId,
  };
}

export type FetchUserOrganizationsHints = {
  userId?: string;
  profileActiveOrgId?: string | null;
  /** When true, skip writing active_organization_id back to profiles (central already did). */
  skipProfileSync?: boolean;
};

export async function fetchUserOrganizations(
  hints?: FetchUserOrganizationsHints,
): Promise<UserOrganizationsData | null> {
  let userId = hints?.userId;
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  const needsProfileFetch = hints?.profileActiveOrgId === undefined;

  const [profileRes, uoRes, rolesRes] = await Promise.all([
    needsProfileFetch
      ? supabase
          .from("profiles")
          .select("active_organization_id")
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({
          data: { active_organization_id: hints!.profileActiveOrgId ?? null },
          error: null,
        }),
    supabase
      .from("user_organizations")
      .select("organization_id, organizations(company_name)")
      .eq("user_id", userId),
    supabase.from("user_roles").select("organization_id, role").eq("user_id", userId),
  ]);

  if (uoRes.error) {
    console.warn("user_organizations:", uoRes.error);
  }
  if (rolesRes.error) {
    console.warn("user_roles:", rolesRes.error);
  }

  const data = buildUserOrganizationsData(
    userId,
    profileRes.data?.active_organization_id,
    (uoRes.data ?? []) as OrgRow[],
    rolesRes.data ?? [],
  );

  if (
    !hints?.skipProfileSync &&
    !profileRes.data?.active_organization_id &&
    data.activeOrganizationId &&
    data.memberships.length > 0
  ) {
    const { error } = await supabase
      .from("profiles")
      .update({ active_organization_id: data.activeOrganizationId })
      .eq("user_id", userId);
    if (error) console.warn("profiles active_organization_id sync:", error);
  }

  return data;
}
