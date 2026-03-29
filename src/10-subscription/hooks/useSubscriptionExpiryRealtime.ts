import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";

export function useSubscriptionExpiryRealtime() {
  const queryClient = useQueryClient();
  const { organizationId, loading } = useActiveOrganization();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const previousOrgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (previousOrgIdRef.current && previousOrgIdRef.current !== organizationId && channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!organizationId) {
      previousOrgIdRef.current = null;
      return;
    }

    if (channelRef.current && previousOrgIdRef.current === organizationId) return;

    previousOrgIdRef.current = organizationId;
    const channelName = `subscription-expiry-realtime-${organizationId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "organization_subscriptions",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const payloadOrgId =
            (payload.new as { organization_id?: string } | null)?.organization_id ||
            (payload.old as { organization_id?: string } | null)?.organization_id;
          if (payloadOrgId !== organizationId) return;
          void queryClient.invalidateQueries({
            queryKey: subscriptionQueryKeys.status(organizationId),
            refetchType: "active",
          });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, loading, queryClient]);
}
