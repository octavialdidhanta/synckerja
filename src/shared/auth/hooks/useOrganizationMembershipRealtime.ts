import { useEffect, useRef } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

type UseOrganizationMembershipRealtimeOptions = {
  userId: string | undefined;
  activeOrganizationId: string | undefined;
  onMembershipChanged: () => void | Promise<void>;
};

const DEBOUNCE_MS = 500;

export function useOrganizationMembershipRealtime({
  userId,
  activeOrganizationId,
  onMembershipChanged,
}: UseOrganizationMembershipRealtimeOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeOrgRef = useRef(activeOrganizationId);
  activeOrgRef.current = activeOrganizationId;

  useEffect(() => {
    if (!userId) return;

    const scheduleRefresh = (organizationId?: string | null) => {
      const active = activeOrgRef.current;
      if (organizationId && active && organizationId !== active) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void onMembershipChanged();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`org_membership_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "user_organizations",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.old as { organization_id?: string } | undefined;
          scheduleRefresh(row?.organization_id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_organizations",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { organization_id?: string; is_active?: boolean } | undefined;
          if (row?.is_active === false) {
            scheduleRefresh(row.organization_id);
          }
        },
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, onMembershipChanged]);
}
