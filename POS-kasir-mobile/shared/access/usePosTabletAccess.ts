import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { clearPosSelectedOutlet } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import type {
  PosTabletAccessReason,
  PosTabletAccessStatus,
  PosTabletStaffMembership,
} from "./posTabletAccessTypes";
import { resolvePosTabletAccess } from "./posTabletEntitlement";
import { fetchPosTabletStaffOrgs } from "./fetchPosTabletStaffOrgs";
import { pickPosTabletOrganization } from "./pickPosTabletOrganization";

export const POS_TABLET_ACCESS_QUERY_KEY = "pos-tablet-access";
export const POS_TABLET_STAFF_ORGS_QUERY_KEY = "pos-tablet-staff-orgs";

/**
 * Fail-closed gate for authenticated `/pos/*` tablet routes.
 * Requires: POS add-on active AND active Slot Karyawan staff with role_id.
 * Owner/Admin do not bypass without a staff slot.
 *
 * If profile `active_organization_id` points at an org without POS staff/add-on
 * (e.g. "Test") but the user has staff+add-on elsewhere, switches active org first.
 */
export function usePosTabletAccess() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { setActiveOrganization, isSwitching } = useUserOrganizations();
  const switchAttemptedFor = useRef<string | null>(null);
  const [switchFailed, setSwitchFailed] = useState(false);

  const staffOrgsQuery = useQuery({
    queryKey: [POS_TABLET_STAFF_ORGS_QUERY_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchPosTabletStaffOrgs(user.id);
    },
  });

  const orgPick = useMemo(
    () =>
      pickPosTabletOrganization(organizationId, staffOrgsQuery.data ?? []),
    [organizationId, staffOrgsQuery.data],
  );

  useEffect(() => {
    if (!user?.id) {
      switchAttemptedFor.current = null;
      setSwitchFailed(false);
      return;
    }
    if (staffOrgsQuery.isLoading || staffOrgsQuery.isError) return;
    if (orgPick.action !== "switch") {
      setSwitchFailed(false);
      return;
    }
    if (isSwitching) return;
    if (organizationId === orgPick.organizationId) return;
    if (switchFailed) return;
    if (switchAttemptedFor.current === orgPick.organizationId) return;

    switchAttemptedFor.current = orgPick.organizationId;
    clearPosSelectedOutlet();
    void setActiveOrganization(orgPick.organizationId).catch(() => {
      setSwitchFailed(true);
    });
  }, [
    user?.id,
    staffOrgsQuery.isLoading,
    staffOrgsQuery.isError,
    orgPick,
    isSwitching,
    organizationId,
    setActiveOrganization,
    switchFailed,
  ]);

  const orgSyncPending =
    Boolean(user?.id) &&
    !switchFailed &&
    (staffOrgsQuery.isLoading ||
      isSwitching ||
      (orgPick.action === "switch" && organizationId !== orgPick.organizationId));

  const {
    subscriptionStatus,
    statusLoading: subscriptionLoading,
  } = useOptimizedSubscription({ includePlans: false });
  const outlets = usePosOutlets();

  const addonActive = Boolean(subscriptionStatus?.pos_addon_active);

  const membershipQuery = useQuery({
    queryKey: [POS_TABLET_ACCESS_QUERY_KEY, organizationId, user?.id],
    enabled: Boolean(
      organizationId &&
        user?.id &&
        !orgSyncPending &&
        !subscriptionLoading &&
        addonActive &&
        orgPick.action !== "deny",
    ),
    queryFn: async (): Promise<PosTabletStaffMembership | null> => {
      if (!organizationId || !user?.id) return null;

      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!emp?.id) return null;

      const { data: staff } = await supabase
        .from("pos_employee_staff")
        .select("id, role_id, is_active")
        .eq("organization_id", organizationId)
        .eq("employee_id", emp.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!staff?.id || !staff.role_id) return null;

      const { data: outletRows } = await supabase
        .from("pos_employee_staff_outlets")
        .select("outlet_id")
        .eq("staff_id", staff.id);

      return {
        staffId: String(staff.id),
        outletIds: (outletRows ?? [])
          .map((r) => String((r as { outlet_id: string }).outlet_id))
          .filter(Boolean),
      };
    },
  });

  const membershipLoading =
    Boolean(
      organizationId &&
        user?.id &&
        !orgSyncPending &&
        !subscriptionLoading &&
        addonActive &&
        orgPick.action !== "deny",
    ) && membershipQuery.isLoading;

  const outletsLoading = Boolean(organizationId) && outlets.isLoading;

  const resolved = useMemo(() => {
    if (orgSyncPending || staffOrgsQuery.isLoading) {
      return { status: "loading" as const, reason: null };
    }
    if (staffOrgsQuery.isError || switchFailed) {
      return { status: "denied" as const, reason: "not_staff" as const };
    }
    if (orgPick.action === "deny") {
      return {
        status: "denied" as const,
        reason: orgPick.reason,
      };
    }
    return resolvePosTabletAccess({
      loading: Boolean(
        user?.id && organizationId && (subscriptionLoading || membershipLoading),
      ),
      addonActive,
      hasStaffWithRole: Boolean(membershipQuery.data),
    });
  }, [
    orgSyncPending,
    staffOrgsQuery.isLoading,
    staffOrgsQuery.isError,
    switchFailed,
    orgPick,
    user?.id,
    organizationId,
    subscriptionLoading,
    membershipLoading,
    addonActive,
    membershipQuery.data,
  ]);

  const status: PosTabletAccessStatus =
    !user?.id || (!organizationId && orgPick.action !== "deny" && !orgSyncPending)
      ? "denied"
      : resolved.status;
  const reason: PosTabletAccessReason =
    status === "loading"
      ? null
      : status === "denied" && !organizationId && orgPick.action !== "deny"
        ? "not_staff"
        : resolved.reason;

  /** null = all active org outlets; otherwise only these IDs. */
  const allowedOutletIds: Set<string> | null = useMemo(() => {
    if (status !== "allowed") return new Set();
    const assigned = membershipQuery.data?.outletIds ?? [];
    if (assigned.length === 0) return null;
    return new Set(assigned);
  }, [status, membershipQuery.data?.outletIds]);

  const orgActiveOutletIds = useMemo(() => {
    return new Set(
      (outlets.rows ?? []).filter((r) => r.is_active).map((r) => r.id),
    );
  }, [outlets.rows]);

  const canUseOutlet = useCallback(
    (outletId: string | null | undefined): boolean => {
      if (!outletId) return false;
      if (status !== "allowed") return false;
      if (!orgActiveOutletIds.has(outletId)) return false;
      if (allowedOutletIds === null) return true;
      return allowedOutletIds.has(outletId);
    },
    [status, orgActiveOutletIds, allowedOutletIds],
  );

  const filterOutlets = useCallback(
    <T extends { id: string }>(list: T[]): T[] => {
      if (status !== "allowed") return [];
      return list.filter((o) => canUseOutlet(o.id));
    },
    [status, canUseOutlet],
  );

  return {
    status,
    reason,
    isLoading: status === "loading" || (status === "allowed" && outletsLoading),
    isOrgPrivileged: false,
    hasStaffMembership: Boolean(membershipQuery.data),
    staffId: membershipQuery.data?.staffId ?? null,
    /** null = all active org outlets. */
    allowedOutletIds,
    canUseOutlet,
    filterOutlets,
    orgActiveOutletIds,
    outletsReady: !outletsLoading,
  };
}
