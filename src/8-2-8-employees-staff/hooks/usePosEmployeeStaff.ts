import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { supabase } from "@/shared/lib/supabaseClient";
import type {
  EmployeeSlotRow,
  PosEmployeeStaffRow,
  PosStaffListItem,
  PosStaffRole,
  PosStaffSavePayload,
} from "../lib/posStaffTypes";

export const POS_EMPLOYEE_STAFF_QUERY_KEY = "pos-employee-staff";
/** Keep in sync with `POS_EMPLOYEE_ROLES_QUERY_KEY` / `POS_CURRENT_STAFF_PERMISSIONS_KEY` (avoid circular imports). */
const POS_ROLES_QUERY_KEY = "pos-employee-roles";
const POS_STAFF_PERMISSIONS_QUERY_KEY = "pos-current-staff-permissions";

type StaffDbRow = {
  id: string;
  organization_id: string;
  employee_id: string;
  pos_role: PosStaffRole;
  role_id: string | null;
  pin_hash: string | null;
  pin_enabled: boolean;
  allow_pin_for_permissions: boolean;
  description: string | null;
  is_active: boolean;
  invited_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type OutletLinkRow = {
  staff_id: string;
  outlet_id: string;
};

type OutletLite = {
  id: string;
  name: string;
  is_active: boolean | null;
};

type EmployeeLite = {
  id: string;
  full_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  status: string | null;
  user_id: string | null;
};

function mapStaffRow(row: StaffDbRow): PosEmployeeStaffRow {
  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    pos_role: row.pos_role,
    role_id: row.role_id,
    pin_enabled: row.pin_enabled,
    allow_pin_for_permissions: row.allow_pin_for_permissions,
    description: row.description,
    is_active: row.is_active,
    invited_at: row.invited_at,
    verified_at: row.verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    has_pin: Boolean(row.pin_hash),
  };
}

export function usePosEmployeeStaff() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { subscriptionStatus, isLoading: subscriptionLoading } = useOptimizedSubscription({
    includePlans: false,
  });

  const query = useQuery({
    queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<PosStaffListItem[]> => {
      if (!organizationId) return [];

      const [staffRes, linksRes, outletsRes] = await Promise.all([
        supabase
          .from("pos_employee_staff")
          .select(
            "id, organization_id, employee_id, pos_role, role_id, pin_hash, pin_enabled, allow_pin_for_permissions, description, is_active, invited_at, verified_at, created_at, updated_at",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("pos_employee_staff_outlets")
          .select("staff_id, outlet_id")
          .eq("organization_id", organizationId),
        supabase
          .from("pos_outlets")
          .select("id, name, is_active")
          .eq("organization_id", organizationId)
          .eq("is_deleted", false),
      ]);

      if (staffRes.error) throw staffRes.error;
      if (linksRes.error) throw linksRes.error;
      if (outletsRes.error) throw outletsRes.error;

      const staffRows = (staffRes.data ?? []) as StaffDbRow[];
      const links = (linksRes.data ?? []) as OutletLinkRow[];
      const outlets = (outletsRes.data ?? []) as OutletLite[];
      const employeeIds = [...new Set(staffRows.map((r) => r.employee_id))];
      const roleIds = [...new Set(staffRows.map((r) => r.role_id).filter(Boolean))] as string[];

      let employeesById = new Map<string, EmployeeLite>();
      if (employeeIds.length > 0) {
        const empRes = await supabase
          .from("employees")
          .select("id, full_name, email, mobile_phone, status, user_id")
          .eq("organization_id", organizationId)
          .in("id", employeeIds);
        if (empRes.error) throw empRes.error;
        employeesById = new Map(
          ((empRes.data ?? []) as EmployeeLite[]).map((e) => [e.id, e]),
        );
      }

      type RoleLite = { id: string; name: string; slug: string; is_system: boolean };
      let rolesById = new Map<string, RoleLite>();
      if (roleIds.length > 0) {
        const rolesRes = await supabase
          .from("pos_employee_roles")
          .select("id, name, slug, is_system")
          .eq("organization_id", organizationId)
          .in("id", roleIds);
        if (rolesRes.error) throw rolesRes.error;
        rolesById = new Map(
          ((rolesRes.data ?? []) as RoleLite[]).map((r) => [r.id, r]),
        );
      }

      const outletNameById = new Map(outlets.map((o) => [o.id, o.name]));
      const activeOutletIds = outlets.filter((o) => o.is_active !== false).map((o) => o.id);
      const linksByStaff = new Map<string, string[]>();
      for (const link of links) {
        const list = linksByStaff.get(link.staff_id) ?? [];
        list.push(link.outlet_id);
        linksByStaff.set(link.staff_id, list);
      }

      return staffRows.map((row) => {
        const emp = employeesById.get(row.employee_id);
        const role = row.role_id ? rolesById.get(row.role_id) : undefined;
        const outletIds = linksByStaff.get(row.id) ?? [];
        const outletNames = outletIds
          .map((id) => outletNameById.get(id))
          .filter((name): name is string => Boolean(name));
        const allOutlets =
          activeOutletIds.length > 1 &&
          activeOutletIds.every((id) => outletIds.includes(id));

        return {
          ...mapStaffRow(row),
          full_name: emp?.full_name?.trim() || "—",
          email: emp?.email ?? null,
          mobile_phone: emp?.mobile_phone ?? null,
          employee_status: emp?.status ?? null,
          user_id: emp?.user_id ?? null,
          outlet_ids: outletIds,
          outlet_names: outletNames,
          all_outlets: allOutlets,
          role_name: role?.name ?? null,
          role_slug: role?.slug ?? null,
          role_is_system: role?.is_system ?? false,
        };
      });
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId] });
    void queryClient.invalidateQueries({ queryKey: [POS_ROLES_QUERY_KEY, organizationId] });
    void queryClient.invalidateQueries({
      queryKey: [POS_STAFF_PERMISSIONS_QUERY_KEY, organizationId],
    });
  };

  const save = useMutation({
    mutationFn: async (payload: PosStaffSavePayload) => {
      if (!organizationId) throw new Error("Organization ID is required");

      let roleId = payload.role_id ?? null;
      if (!roleId) {
        await supabase.rpc("pos_ensure_default_roles", {
          p_organization_id: organizationId,
        });
        const { data: roleRow } = await supabase
          .from("pos_employee_roles")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("slug", payload.pos_role)
          .maybeSingle();
        roleId = (roleRow?.id as string | undefined) ?? null;
      }

      const fields = {
        organization_id: organizationId,
        employee_id: payload.employee_id,
        pos_role: payload.pos_role,
        role_id: roleId,
        description: payload.description?.trim() || null,
        is_active: payload.is_active ?? true,
        allow_pin_for_permissions: payload.allow_pin_for_permissions ?? true,
        ...(payload.mark_invited ? { invited_at: new Date().toISOString() } : {}),
        ...(payload.mark_verified
          ? { verified_at: new Date().toISOString() }
          : {}),
        ...(payload.invited_at !== undefined ? { invited_at: payload.invited_at } : {}),
        ...(payload.verified_at !== undefined ? { verified_at: payload.verified_at } : {}),
      };

      let staffId = payload.id;
      if (staffId) {
        const { error } = await supabase
          .from("pos_employee_staff")
          .update(fields)
          .eq("id", staffId)
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("pos_employee_staff")
          .insert(fields)
          .select("id")
          .single();
        if (error) throw error;
        staffId = data.id as string;
      }

      if (payload.outlet_ids !== undefined && staffId) {
        const { error: outletError } = await supabase.rpc("pos_staff_set_outlets", {
          p_staff_id: staffId,
          p_outlet_ids: payload.outlet_ids,
        });
        if (outletError) throw outletError;
      }

      return staffId;
    },
    onSuccess: () => invalidate(),
  });

  const setActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { error } = await supabase
        .from("pos_employee_staff")
        .update({ is_active })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const setOutlets = useMutation({
    mutationFn: async ({ staffId, outletIds }: { staffId: string; outletIds: string[] }) => {
      const { error } = await supabase.rpc("pos_staff_set_outlets", {
        p_staff_id: staffId,
        p_outlet_ids: outletIds,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const staff = query.data ?? [];
  const memberLimit = Math.max(
    1,
    Number(subscriptionStatus?.member_limit ?? subscriptionStatus?.member_count ?? staff.length) ||
      Math.max(staff.length, 1),
  );

  const slotRows: EmployeeSlotRow[] = (() => {
    const filled: EmployeeSlotRow[] = staff.map((s) => ({ kind: "staff", staff: s }));
    const emptyCount = Math.max(0, memberLimit - staff.length);
    for (let i = 0; i < emptyCount; i += 1) {
      filled.push({ kind: "empty", slotIndex: staff.length + i + 1 });
    }
    return filled;
  })();

  const expiryDate =
    subscriptionStatus?.subscription_end_date ||
    subscriptionStatus?.end_date ||
    subscriptionStatus?.trial_end_date ||
    null;

  return {
    staff,
    slotRows,
    memberLimit,
    expiryDate,
    isLoading: query.isLoading || (Boolean(organizationId) && subscriptionLoading),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    save,
    setActive,
    setOutlets,
    invalidate,
  };
}
