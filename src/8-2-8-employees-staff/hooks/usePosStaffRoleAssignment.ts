import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { legacyPosRoleFromSlug } from "../lib/posAccessPermissionPresets";
import { POS_EMPLOYEE_STAFF_QUERY_KEY } from "./usePosEmployeeStaff";
import { POS_EMPLOYEE_ROLES_QUERY_KEY } from "./usePosEmployeeRoles";
import { POS_CURRENT_STAFF_PERMISSIONS_KEY } from "./usePosStaffPermissions";

/**
 * Assign one or more POS staff rows to a role (single role per staff).
 * Syncs legacy `pos_role` from the role slug when it maps to administrator|cashier.
 */
export function usePosStaffRoleAssignment() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_EMPLOYEE_ROLES_QUERY_KEY, organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_CURRENT_STAFF_PERMISSIONS_KEY, organizationId],
    });
  };

  const assign = useMutation({
    mutationFn: async (args: { roleId: string; staffIds: string[] }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (args.staffIds.length === 0) return;

      const { data: role, error: roleError } = await supabase
        .from("pos_employee_roles")
        .select("id, slug")
        .eq("id", args.roleId)
        .eq("organization_id", organizationId)
        .single();
      if (roleError) throw roleError;

      const legacy = legacyPosRoleFromSlug(role.slug as string);
      const { error } = await supabase
        .from("pos_employee_staff")
        .update({ role_id: args.roleId, pos_role: legacy })
        .eq("organization_id", organizationId)
        .in("id", args.staffIds);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return { assign, invalidate };
}
