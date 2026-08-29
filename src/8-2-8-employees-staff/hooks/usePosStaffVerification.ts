import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { POS_EMPLOYEE_STAFF_QUERY_KEY } from "./usePosEmployeeStaff";

/**
 * Silently syncs pos_employee_staff.verified_at from completed magic_links.
 * Call once staff list has loaded for the current org.
 */
export function usePosStaffVerification(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const lastSyncedOrg = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !organizationId) return;
    if (lastSyncedOrg.current === organizationId) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("pos_staff_sync_verified", {
          p_organization_id: organizationId,
        });
        if (cancelled) return;
        if (error) {
          console.warn("pos_staff_sync_verified:", error.message);
          return;
        }
        lastSyncedOrg.current = organizationId;
        if (Number(data) > 0) {
          void queryClient.invalidateQueries({
            queryKey: [POS_EMPLOYEE_STAFF_QUERY_KEY, organizationId],
          });
        }
      } catch (err) {
        console.warn("pos_staff_sync_verified failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, queryClient]);
}

export async function isPosUserMagicVerified(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase.rpc("pos_staff_is_user_verified", {
    p_user_id: userId,
  });
  if (error) {
    console.warn("pos_staff_is_user_verified:", error.message);
    return false;
  }
  return Boolean(data);
}
