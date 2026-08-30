import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_EMPLOYEE_STAFF_QUERY_KEY } from "./usePosEmployeeStaff";
import { POS_CURRENT_STAFF_PERMISSIONS_KEY } from "./usePosStaffPermissions";
import {
  legacyPosRoleFromSlug,
  slugifyPosRoleName,
} from "../lib/posAccessPermissionPresets";

export const POS_EMPLOYEE_ROLES_QUERY_KEY = "pos-employee-roles";

export type PosEmployeeRoleRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  permission_keys: string[];
  staff_ids: string[];
  staff_names: string[];
};

export type PosRoleSavePayload = {
  id?: string;
  name: string;
  permission_keys: string[];
  staff_ids: string[];
};

export function usePosEmployeeRoles() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_EMPLOYEE_ROLES_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<PosEmployeeRoleRow[]> => {
      if (!organizationId) return [];

      await supabase.rpc("pos_ensure_default_roles", {
        p_organization_id: organizationId,
      });

      const [rolesRes, permsRes, staffRes, empRes] = await Promise.all([
        supabase
          .from("pos_employee_roles")
          .select("id, organization_id, name, slug, is_system, created_at, updated_at")
          .eq("organization_id", organizationId)
          .order("is_system", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("pos_employee_role_permissions")
          .select("role_id, permission_key"),
        supabase
          .from("pos_employee_staff")
          .select("id, role_id, employee_id")
          .eq("organization_id", organizationId),
        supabase
          .from("employees")
          .select("id, full_name")
          .eq("organization_id", organizationId),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (permsRes.error) throw permsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (empRes.error) throw empRes.error;

      const roleIds = new Set((rolesRes.data ?? []).map((r) => r.id as string));
      const permsByRole = new Map<string, string[]>();
      for (const p of permsRes.data ?? []) {
        if (!roleIds.has(p.role_id as string)) continue;
        const list = permsByRole.get(p.role_id as string) ?? [];
        list.push(p.permission_key as string);
        permsByRole.set(p.role_id as string, list);
      }

      const nameByEmp = new Map(
        ((empRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map((e) => [
          e.id,
          e.full_name?.trim() || "—",
        ]),
      );

      const staffByRole = new Map<string, { ids: string[]; names: string[] }>();
      for (const s of staffRes.data ?? []) {
        const roleId = s.role_id as string | null;
        if (!roleId) continue;
        const entry = staffByRole.get(roleId) ?? { ids: [], names: [] };
        entry.ids.push(s.id as string);
        entry.names.push(nameByEmp.get(s.employee_id as string) || "—");
        staffByRole.set(roleId, entry);
      }

      return ((rolesRes.data ?? []) as Array<{
        id: string;
        organization_id: string;
        name: string;
        slug: string;
        is_system: boolean;
        created_at: string;
        updated_at: string;
      }>).map((r) => {
        const staff = staffByRole.get(r.id) ?? { ids: [], names: [] };
        return {
          ...r,
          permission_keys: permsByRole.get(r.id) ?? [],
          staff_ids: staff.ids,
          staff_names: staff.names,
        };
      });
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [POS_EMPLOYEE_ROLES_QUERY_KEY, organizationId],
    });
    void queryClient.invalidateQueries({
      queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId],
    });
    // Same-tab ACL + broadcast via realtime for other clients (tablet).
    void queryClient.invalidateQueries({
      queryKey: [POS_CURRENT_STAFF_PERMISSIONS_KEY],
    });
  };

  const save = useMutation({
    mutationFn: async (payload: PosRoleSavePayload) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("role_name_required");

      let roleId = payload.id;
      let slug = slugifyPosRoleName(name);

      if (roleId) {
        const { data: existing } = await supabase
          .from("pos_employee_roles")
          .select("slug, is_system")
          .eq("id", roleId)
          .single();
        if (existing?.is_system) {
          slug = existing.slug as string;
        }
        const { error } = await supabase
          .from("pos_employee_roles")
          .update({ name, ...(existing?.is_system ? {} : { slug }) })
          .eq("id", roleId)
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        // ensure unique slug
        const { data: clash } = await supabase
          .from("pos_employee_roles")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("slug", slug)
          .maybeSingle();
        if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

        const { data, error } = await supabase
          .from("pos_employee_roles")
          .insert({
            organization_id: organizationId,
            name,
            slug,
            is_system: false,
          })
          .select("id, slug")
          .single();
        if (error) throw error;
        roleId = data.id as string;
        slug = data.slug as string;
      }

      await supabase.from("pos_employee_role_permissions").delete().eq("role_id", roleId);
      const uniqueKeys = [...new Set(payload.permission_keys)];
      if (uniqueKeys.length > 0) {
        const { error: permError } = await supabase
          .from("pos_employee_role_permissions")
          .insert(uniqueKeys.map((permission_key) => ({ role_id: roleId, permission_key })));
        if (permError) throw permError;
      }

      // Reassign staff: clear others on this role, set selected
      const { data: currentlyOnRole } = await supabase
        .from("pos_employee_staff")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("role_id", roleId);
      const currentIds = new Set((currentlyOnRole ?? []).map((r) => r.id as string));
      const nextIds = new Set(payload.staff_ids);

      const toClear = [...currentIds].filter((id) => !nextIds.has(id));
      if (toClear.length > 0) {
        // Move cleared staff to cashier system role
        const { data: cashier } = await supabase
          .from("pos_employee_roles")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("slug", "cashier")
          .maybeSingle();
        if (cashier?.id) {
          await supabase
            .from("pos_employee_staff")
            .update({ role_id: cashier.id, pos_role: "cashier" })
            .in("id", toClear);
        }
      }

      const legacy = legacyPosRoleFromSlug(slug);
      if (payload.staff_ids.length > 0) {
        const { error: assignError } = await supabase
          .from("pos_employee_staff")
          .update({ role_id: roleId, pos_role: legacy })
          .eq("organization_id", organizationId)
          .in("id", payload.staff_ids);
        if (assignError) throw assignError;
      }

      return roleId as string;
    },
    onSuccess: () => invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (roleId: string) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data: role } = await supabase
        .from("pos_employee_roles")
        .select("is_system")
        .eq("id", roleId)
        .single();
      if (role?.is_system) throw new Error("cannot_delete_system_role");

      const { data: cashier } = await supabase
        .from("pos_employee_roles")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("slug", "cashier")
        .maybeSingle();

      if (cashier?.id) {
        await supabase
          .from("pos_employee_staff")
          .update({ role_id: cashier.id, pos_role: "cashier" })
          .eq("organization_id", organizationId)
          .eq("role_id", roleId);
      }

      const { error } = await supabase
        .from("pos_employee_roles")
        .delete()
        .eq("id", roleId)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return {
    roles: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    save,
    remove,
    invalidate,
  };
}

/** Ensure default roles once when org is ready (Access page). */
export function useEnsurePosDefaultRoles(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !organizationId) return;
    void supabase
      .rpc("pos_ensure_default_roles", { p_organization_id: organizationId })
      .then(({ error }) => {
        if (error) {
          console.warn("pos_ensure_default_roles:", error.message);
          return;
        }
        void queryClient.invalidateQueries({
          queryKey: [POS_EMPLOYEE_ROLES_QUERY_KEY, organizationId],
        });
      });
  }, [enabled, organizationId, queryClient]);
}
