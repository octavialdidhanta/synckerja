import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  buildEffectiveAccessRoles,
  hasOwnerRole,
} from "@/shared/auth/page-access/accessRoleSet";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  POS_BACKOFFICE_NAV_PERMISSION,
  resolveBackofficePermissionForPath,
} from "../lib/posAccessPermissionCatalog";
import type { NavSubItem } from "@/shared/layouts/sidebar/navConfig";

export const POS_CURRENT_STAFF_PERMISSIONS_KEY = "pos-current-staff-permissions";

export type PosStaffPermissionsState = {
  /** True when user has an active POS staff row (subject to role ACL). */
  hasStaffMembership: boolean;
  permissionKeys: Set<string>;
  /**
   * When true, skip POS ACL.
   * Org owner/admin always unrestricted (even with a staff row);
   * users without a staff row are also unrestricted.
   */
  unrestricted: boolean;
};

function canKey(keys: Set<string>, key: string): boolean {
  if (keys.has(key)) return true;
  // parent key grants children for nav-level checks
  const parts = key.split(".");
  while (parts.length > 1) {
    parts.pop();
    if (keys.has(parts.join("."))) return true;
  }
  return false;
}

export function usePosStaffPermissions() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { userRole, organizationMemberRoles, centralProfileHydrated } =
    useCentralizedUserData();

  const effectiveRoles = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
  const rolesReady = Boolean(!user?.id || centralProfileHydrated);
  const isOrgPrivileged =
    rolesReady &&
    (hasOwnerRole(effectiveRoles, userRole) || effectiveRoles.includes("admin"));

  const query = useQuery({
    queryKey: [POS_CURRENT_STAFF_PERMISSIONS_KEY, organizationId, user?.id],
    enabled: Boolean(organizationId && user?.id),
    queryFn: async (): Promise<PosStaffPermissionsState> => {
      if (!organizationId || !user?.id) {
        return { hasStaffMembership: false, permissionKeys: new Set(), unrestricted: true };
      }

      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!emp?.id) {
        return { hasStaffMembership: false, permissionKeys: new Set(), unrestricted: true };
      }

      const { data: staff } = await supabase
        .from("pos_employee_staff")
        .select("id, role_id, is_active")
        .eq("organization_id", organizationId)
        .eq("employee_id", emp.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff?.role_id) {
        // Employee exists but not POS staff → unrestricted for Office (HR only)
        return { hasStaffMembership: false, permissionKeys: new Set(), unrestricted: true };
      }

      const { data: perms } = await supabase
        .from("pos_employee_role_permissions")
        .select("permission_key")
        .eq("role_id", staff.role_id);

      return {
        hasStaffMembership: true,
        permissionKeys: new Set((perms ?? []).map((p) => p.permission_key as string)),
        unrestricted: false,
      };
    },
  });

  const base = query.data ?? {
    hasStaffMembership: false,
    permissionKeys: new Set<string>(),
    unrestricted: true,
  };

  // Hydrate-safe: fail-open until org roles resolve; owner/admin always bypass staff ACL.
  const unrestricted =
    !rolesReady || isOrgPrivileged || base.unrestricted;

  const state: PosStaffPermissionsState = {
    hasStaffMembership: base.hasStaffMembership,
    permissionKeys: base.permissionKeys,
    unrestricted,
  };

  const can = (key: string) => {
    if (state.unrestricted) return true;
    return canKey(state.permissionKeys, key);
  };

  const canPath = (pathname: string) => {
    if (state.unrestricted) return true;
    const key = resolveBackofficePermissionForPath(pathname);
    if (!key) return true;
    return can(key);
  };

  return {
    ...state,
    isLoading: query.isLoading || Boolean(user?.id && !centralProfileHydrated),
    isOrgPrivileged,
    can,
    canPath,
  };
}

/** Filter POS group sub-nav (Library…Inventory). Non-POS items pass through. */
export function filterPosBackofficeNavItems(
  items: NavSubItem[],
  state: Pick<PosStaffPermissionsState, "unrestricted" | "permissionKeys">,
): NavSubItem[] {
  if (state.unrestricted) return items;

  return items.filter((item) => {
    const prefixes = item.activePathPrefixes?.length
      ? item.activePathPrefixes
      : [item.path];
    // Only gate known POS backoffice prefixes
    let matched = false;
    for (const prefix of prefixes) {
      for (const [navPrefix, key] of Object.entries(POS_BACKOFFICE_NAV_PERMISSION)) {
        if (prefix === navPrefix || prefix.startsWith(`${navPrefix}/`) || navPrefix.startsWith(prefix)) {
          matched = true;
          if (canKey(state.permissionKeys, key)) return true;
        }
      }
    }
    // Sales / ecommerce etc. outside gambar-11 strip → keep visible
    return !matched;
  });
}
