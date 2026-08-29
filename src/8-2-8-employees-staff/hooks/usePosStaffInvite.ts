import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useUserCreation } from "@/2-1-employees/hooks/useUserCreation";
import { useMagicLinkCreation } from "@/2-1-employees/hooks/useMagicLinkCreation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildDepartmentQueryKey } from "@/shared/hooks/crudMaster/departmentUtils";
import {
  resolveOutletIdsForRole,
  validateOutletsForRole,
} from "../lib/posStaffRoleRules";
import { ensurePosOperationsDepartment } from "../lib/posOperationsDepartment";
import type { PosStaffListItem, PosStaffRole } from "../lib/posStaffTypes";
import { POS_EMPLOYEE_STAFF_QUERY_KEY } from "./usePosEmployeeStaff";
import { isPosUserMagicVerified } from "./usePosStaffVerification";

export type PosInviteNewPayload = {
  fullName: string;
  email: string;
  /** Preferred: Access role id. Falls back to system role matching `pos_role`. */
  role_id?: string | null;
  pos_role: PosStaffRole;
  outlet_ids: string[];
};

export type PosInviteLinkPayload = {
  employee_id: string;
  role_id?: string | null;
  pos_role: PosStaffRole;
  outlet_ids: string[];
  /** When true, also send magic-link if still pending. */
  sendInviteIfPending?: boolean;
};

export type PosInviteResult = {
  staffId: string;
  employeeId: string;
  verified: boolean;
  emailSent: boolean;
  emailError?: string | null;
};

async function resolveOnboarded(userId: string | null | undefined): Promise<boolean> {
  return isPosUserMagicVerified(userId);
}

export function usePosStaffInvite() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { createUser } = useUserCreation();
  const { createMagicLink } = useMagicLinkCreation();
  const { rows: outlets } = usePosOutlets();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId],
    });
    void queryClient.invalidateQueries({ queryKey: ["employees-optimized", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["pos-employee-roles", organizationId] });
    void queryClient.invalidateQueries({ queryKey: buildDepartmentQueryKey(organizationId) });
    void queryClient.invalidateQueries({ queryKey: ["departments"] });
  };

  const activeOutletIds = outlets.filter((o) => o.is_active !== false).map((o) => o.id);

  const upsertStaff = async (args: {
    employeeId: string;
    pos_role: PosStaffRole;
    role_id?: string | null;
    outlet_ids: string[];
    verified: boolean;
  }) => {
    if (!organizationId) throw new Error("Organization ID is required");

    const outletIds = resolveOutletIdsForRole(args.pos_role, args.outlet_ids, activeOutletIds);
    const outletCheck = validateOutletsForRole(args.pos_role, outletIds);
    if (!outletCheck.ok) {
      throw new Error("cashier_needs_outlet");
    }

    await supabase.rpc("pos_ensure_default_roles", {
      p_organization_id: organizationId,
    });

    let roleId = args.role_id ?? null;
    if (!roleId) {
      const { data: roleRow } = await supabase
        .from("pos_employee_roles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("slug", args.pos_role)
        .maybeSingle();
      roleId = (roleRow?.id as string | undefined) ?? null;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("pos_employee_staff")
      .insert({
        organization_id: organizationId,
        employee_id: args.employeeId,
        pos_role: args.pos_role,
        role_id: roleId,
        is_active: true,
        invited_at: now,
        verified_at: args.verified ? now : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    const staffId = data.id as string;
    const { error: outletError } = await supabase.rpc("pos_staff_set_outlets", {
      p_staff_id: staffId,
      p_outlet_ids: outletIds,
    });
    if (outletError) throw outletError;
    return staffId;
  };

  const inviteNew = useMutation({
    mutationFn: async (payload: PosInviteNewPayload): Promise<PosInviteResult> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const email = payload.email.trim().toLowerCase();
      const fullName = payload.fullName.trim();
      if (!fullName || !email) throw new Error("name_email_required");

      const outletIds = resolveOutletIdsForRole(
        payload.pos_role,
        payload.outlet_ids,
        activeOutletIds,
      );
      const outletCheck = validateOutletsForRole(payload.pos_role, outletIds);
      if (!outletCheck.ok) throw new Error("cashier_needs_outlet");

      const { data: existingEmp } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .maybeSingle();

      if (existingEmp) {
        throw new Error("employee_email_exists");
      }

      // create auth user + employee (HR department = Operations)
      const userId = await createUser(email, fullName, organizationId, "employee");
      if (!userId) throw new Error("user_create_failed");

      await new Promise((r) => setTimeout(r, 800));

      const departmentId = await ensurePosOperationsDepartment(organizationId);

      const { data: employee, error: empError } = await supabase
        .from("employees")
        .insert({
          organization_id: organizationId,
          user_id: userId,
          full_name: fullName,
          email,
          status: "active",
          department_id: departmentId,
        })
        .select("id")
        .single();
      if (empError) throw empError;

      const staffId = await upsertStaff({
        employeeId: employee.id as string,
        pos_role: payload.pos_role,
        role_id: payload.role_id,
        outlet_ids: outletIds,
        verified: false,
      });

      const magic = await createMagicLink(userId, email, fullName, organizationId);
      invalidate();

      return {
        staffId,
        employeeId: employee.id as string,
        verified: false,
        emailSent: Boolean(magic?.emailSent),
        emailError: magic?.emailError ?? (magic?.success === false ? "magic_link_failed" : null),
      };
    },
  });

  const linkExisting = useMutation({
    mutationFn: async (payload: PosInviteLinkPayload): Promise<PosInviteResult> => {
      if (!organizationId) throw new Error("Organization ID is required");

      const { data: emp, error: empError } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email")
        .eq("id", payload.employee_id)
        .eq("organization_id", organizationId)
        .single();
      if (empError) throw empError;

      const { data: already } = await supabase
        .from("pos_employee_staff")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("employee_id", emp.id)
        .maybeSingle();
      if (already) throw new Error("already_linked");

      const verified = await resolveOnboarded(emp.user_id);
      const staffId = await upsertStaff({
        employeeId: emp.id as string,
        pos_role: payload.pos_role,
        role_id: payload.role_id,
        outlet_ids: payload.outlet_ids,
        verified,
      });

      let emailSent = false;
      let emailError: string | null = null;
      if (!verified && payload.sendInviteIfPending !== false && emp.user_id && emp.email) {
        const magic = await createMagicLink(
          emp.user_id,
          emp.email,
          emp.full_name || emp.email,
          organizationId,
        );
        emailSent = Boolean(magic?.emailSent);
        emailError = magic?.emailError ?? null;
        await supabase
          .from("pos_employee_staff")
          .update({ invited_at: new Date().toISOString() })
          .eq("id", staffId);
      }

      invalidate();
      return {
        staffId,
        employeeId: emp.id as string,
        verified,
        emailSent,
        emailError,
      };
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (staff: PosStaffListItem): Promise<{ emailSent: boolean; emailError?: string | null }> => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (staff.verified_at) {
        return { emailSent: false, emailError: "already_verified" };
      }
      if (!staff.user_id || !staff.email) {
        throw new Error("missing_user_or_email");
      }

      const magic = await createMagicLink(
        staff.user_id,
        staff.email,
        staff.full_name,
        organizationId,
      );

      await supabase
        .from("pos_employee_staff")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", staff.id)
        .eq("organization_id", organizationId);

      invalidate();
      return {
        emailSent: Boolean(magic?.emailSent),
        emailError: magic?.emailError ?? (magic?.success === false ? "magic_link_failed" : null),
      };
    },
  });

  return {
    inviteNew,
    linkExisting,
    resendInvitation,
    activeOutletIds,
    isPending:
      inviteNew.isPending || linkExisting.isPending || resendInvitation.isPending,
  };
}
