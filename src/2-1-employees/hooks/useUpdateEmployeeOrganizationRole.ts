import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { userOrganizationsQueryKey } from "@/shared/hooks/useUserOrganizations";

export type AssignableOrgRole = "admin" | "employee";

export async function updateEmployeeOrganizationRoleApi(params: {
  employeeUserId: string;
  organizationId: string;
  employeeRecordId?: string;
  newRole: AssignableOrgRole;
}): Promise<void> {
  const { employeeUserId, organizationId, newRole } = params;

  const { data: rows, error: selErr } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", employeeUserId)
    .eq("organization_id", organizationId);

  if (selErr) throw selErr;

  const now = new Date().toISOString();

  if (!rows?.length) {
    const { error } = await supabase.from("user_roles").insert({
      user_id: employeeUserId,
      organization_id: organizationId,
      role: newRole,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("user_roles")
    .update({ role: newRole, updated_at: now })
    .eq("user_id", employeeUserId)
    .eq("organization_id", organizationId);

  if (error) throw error;
}

export function useUpdateEmployeeOrganizationRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployeeOrganizationRoleApi,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["employees-optimized"] });
      if (variables.employeeRecordId) {
        await queryClient.invalidateQueries({
          queryKey: ["employees-optimized", "detail", variables.employeeRecordId],
        });
      }
      await queryClient.invalidateQueries({ queryKey: userOrganizationsQueryKey });
    },
  });
}
