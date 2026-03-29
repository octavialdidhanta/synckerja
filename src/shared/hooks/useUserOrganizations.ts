import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

const ROLE_ORDER = ["owner", "admin", "manager", "member"];

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
  if (forOrg.length === 0) return "member";
  forOrg.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a.role);
    const ib = ROLE_ORDER.indexOf(b.role);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    return sa - sb;
  });
  return forOrg[0].role;
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

async function fetchUserOrganizations(): Promise<UserOrganizationsData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, uoRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("active_organization_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("user_organizations")
      .select("organization_id, organizations(company_name)")
      .eq("user_id", user.id),
    supabase.from("user_roles").select("organization_id, role").eq("user_id", user.id),
  ]);

  if (uoRes.error) {
    console.warn("user_organizations:", uoRes.error);
  }
  if (rolesRes.error) {
    console.warn("user_roles:", rolesRes.error);
  }

  const roles = rolesRes.data ?? [];
  const rows = (uoRes.data ?? []) as OrgRow[];
  const memberships: OrganizationMembership[] = rows.map((row) => ({
    organizationId: row.organization_id,
    companyName: orgNameFromRow(row),
    role: pickRole(roles, row.organization_id),
  }));

  const memberIds = new Set(memberships.map((m) => m.organizationId));
  let activeOrganizationId = profileRes.data?.active_organization_id ?? null;

  if (activeOrganizationId && !memberIds.has(activeOrganizationId)) {
    activeOrganizationId = null;
  }

  if (!activeOrganizationId && memberships.length > 0) {
    activeOrganizationId = memberships[0].organizationId;
    const { error } = await supabase
      .from("profiles")
      .update({ active_organization_id: activeOrganizationId })
      .eq("user_id", user.id);
    if (error) console.warn("profiles active_organization_id sync:", error);
  }

  return {
    memberships,
    activeOrganizationId,
    userId: user.id,
  };
}

const QUERY_KEY = ["user-organizations"] as const;

export function useUserOrganizations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUserOrganizations,
    staleTime: 30_000,
  });

  const setActiveMutation = useMutation({
    mutationFn: async (organizationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: uo } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!uo) {
        throw new Error("not_member");
      }

      const { error } = await supabase
        .from("profiles")
        .update({ active_organization_id: organizationId })
        .eq("user_id", user.id);

      if (error) throw error;
      return organizationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const setActiveOrganization = async (organizationId: string) => {
    await setActiveMutation.mutateAsync(organizationId);
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    setActiveOrganization,
    isSwitching: setActiveMutation.isPending,
    switchError: setActiveMutation.error,
  };
}

