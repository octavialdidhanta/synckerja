import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import { PaymentHistory } from "@/10-subscription/management/components/PaymentHistory";
import { ManagementPageSkeleton } from "@/10-subscription/management/ManagementPageSkeleton";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { supabase } from "@/shared/lib/supabaseClient";
import { cn } from "@/shared/lib/utils";

export default function ManagementPage() {
  const { organizationId } = useActiveOrganization();
  const { statusLoading } = useOptimizedSubscription();
  const { isLoading: historyLoading } = useQuery({
    queryKey: ["payment-history", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("organization_id", organizationId)
        .in("status", ["success", "settlement", "paid"])
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { isLoading: pendingLoading } = useQuery({
    queryKey: ["payment-pending", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const [initialManagementReady, setInitialManagementReady] = useState(false);
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const initialBootstrapping = !organizationId || statusLoading || historyLoading || pendingLoading;

  useEffect(() => {
    if (initialManagementReady) return;

    if (initialBootstrapping) {
      setSkeletonVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setInitialManagementReady(true);
      setSkeletonVisible(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [initialBootstrapping, initialManagementReady]);

  const showShellSkeleton = !initialManagementReady && skeletonVisible;

  return (
    <SubscriptionSectionLayout>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            "seamless-scroll max-h-[calc(100vh-120px)] overflow-y-auto p-6",
            showShellSkeleton && "pointer-events-none invisible",
          )}
        >
          <div className="mx-auto max-w-4xl">
            <PaymentHistory />
          </div>
        </div>
        {showShellSkeleton ? (
          <div className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden bg-background p-6" aria-busy="true">
            <div className="mx-auto max-w-4xl">
              <ManagementPageSkeleton />
            </div>
          </div>
        ) : null}
      </div>
    </SubscriptionSectionLayout>
  );
}
