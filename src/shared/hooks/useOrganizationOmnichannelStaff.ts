import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { AvailableEmployee } from "@/shared/hooks/useAvailableEmployees";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";

export const organizationOmnichannelStaffQueryKey = (organizationId: string | null | undefined) =>
  ["organization-omnichannel-staff", organizationId] as const;

export type OmnichannelStaffRole = "agent" | "supervisor" | "admin";

export type OrganizationOmnichannelStaffRow = {
  id: string;
  organization_id: string;
  employee_id: string;
  role: OmnichannelStaffRole;
  created_at: string;
  updated_at: string;
  employees: {
    id: string;
    full_name: string;
    email: string | null;
    user_id: string | null;
  } | null;
};

function mapRowToAvailableEmployee(row: OrganizationOmnichannelStaffRow): AvailableEmployee {
  const e = row.employees;
  return {
    id: row.employee_id,
    full_name: e?.full_name ?? "",
    email: e?.email ?? "",
    employee_status_id: null,
    employee_status_name: null,
    pending_removal: null,
  };
}

export function useOrganizationOmnichannelStaff() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: organizationOmnichannelStaffQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<OrganizationOmnichannelStaffRow[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_omnichannel_staff")
        .select(
          `
          id,
          organization_id,
          employee_id,
          role,
          created_at,
          updated_at,
          employees:employee_id (
            id,
            full_name,
            email,
            user_id
          )
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const rows = (data ?? []) as unknown as OrganizationOmnichannelStaffRow[];
      return rows.map((r) => ({
        ...r,
        employees: Array.isArray(r.employees) ? r.employees[0] ?? null : r.employees,
      }));
    },
    staleTime: 60_000,
  });
}

/** Leads / livechat assignee dropdowns: same shape as `useAvailableEmployees`, scoped to omnichannel roster. */
export function useOmnichannelRosterAssignees() {
  const q = useOrganizationOmnichannelStaff();
  const data = q.data?.map(mapRowToAvailableEmployee) ?? [];
  return {
    ...q,
    data,
  };
}

export function useOmnichannelRosterCount() {
  const { data, ...rest } = useOrganizationOmnichannelStaff();
  return {
    ...rest,
    count: data?.length ?? 0,
  };
}

type InsertStaffInput = {
  employeeId: string;
  role: OmnichannelStaffRole;
  /** Omnichannel roster cap from subscription (min HR seats, paid add-on seats); client pre-check + DB trigger. */
  maxRosterSlots: number;
};

type UpdateStaffInput = {
  id: string;
  role: OmnichannelStaffRole;
};

export function useUpsertOrganizationOmnichannelStaff() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (input: InsertStaffInput) => {
      if (!organizationId) throw new Error("No organization");
      const { count, error: countErr } = await supabase
        .from("organization_omnichannel_staff")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);
      if (countErr) throw countErr;
      if ((count ?? 0) >= input.maxRosterSlots) {
        throw new Error("ROSTER_FULL");
      }
      const { error } = await supabase.from("organization_omnichannel_staff").insert({
        organization_id: organizationId,
        employee_id: input.employeeId,
        role: input.role,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: organizationOmnichannelStaffQueryKey(organizationId) });
        await queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      }
    },
  });
}

export function useUpdateOrganizationOmnichannelStaffRole() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (input: UpdateStaffInput) => {
      const { error } = await supabase
        .from("organization_omnichannel_staff")
        .update({ role: input.role })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: organizationOmnichannelStaffQueryKey(organizationId) });
      }
    },
  });
}

export function useRemoveOrganizationOmnichannelStaff() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  return useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("organization_omnichannel_staff").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (organizationId) {
        await queryClient.invalidateQueries({ queryKey: organizationOmnichannelStaffQueryKey(organizationId) });
        await queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        await queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      }
    },
  });
}

/** Employees with login not yet on omnichannel roster (for add-user picker). */
export function useOmnichannelStaffAddCandidates(roster: OrganizationOmnichannelStaffRow[] | undefined) {
  const { organizationId } = useCurrentOrg();
  const rosterKey = roster?.map((r) => r.employee_id).sort().join(",") ?? "";

  return useQuery({
    queryKey: ["omnichannel-staff-candidates", organizationId, rosterKey],
    enabled: Boolean(organizationId) && roster !== undefined,
    queryFn: async () => {
      if (!organizationId) return [];
      const onRoster = new Set((roster ?? []).map((r) => r.employee_id));
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email")
        .eq("organization_id", organizationId)
        .not("user_id", "is", null)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).filter((e) => e.id && !onRoster.has(e.id));
    },
    staleTime: 30_000,
  });
}
