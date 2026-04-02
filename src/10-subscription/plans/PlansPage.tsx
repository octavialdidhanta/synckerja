import { useEffect, useState } from "react";
import { SubscriptionSectionLayout } from "@/10-subscription/shared/SubscriptionSectionLayout";
import HRISSubscriptionPlansTab from "@/10-subscription/plans/HRISSubscriptionPlansTab";
import { PlansPageSkeleton } from "@/10-subscription/plans/PlansPageSkeleton";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { useSubscriptionPlans } from "@/10-subscription/hooks/useSubscriptionPlans";
import { useEmployeeCount } from "@/10-subscription/hooks/useEmployeeCount";
import { useLastPaidSubscription } from "@/10-subscription/hooks/useLastPaidSubscription";
import { cn } from "@/shared/lib/utils";

export default function PlansPage() {
  const { organizationId } = useActiveOrganization();
  const { subscriptionStatus, statusLoading, statusError } = useOptimizedSubscription();
  const { isLoading: plansLoading } = useSubscriptionPlans();
  const { isLoading: employeeCountLoading } = useEmployeeCount();
  const { isLoading: lastPaidLoading } = useLastPaidSubscription(organizationId);

  const [initialPlansReady, setInitialPlansReady] = useState(false);
  const [skeletonVisible, setSkeletonVisible] = useState(true);

  const initialBootstrapping =
    !organizationId ||
    statusLoading ||
    plansLoading ||
    employeeCountLoading ||
    lastPaidLoading ||
    (!subscriptionStatus && !statusError);

  useEffect(() => {
    if (initialPlansReady) return;

    if (initialBootstrapping) {
      setSkeletonVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setInitialPlansReady(true);
      setSkeletonVisible(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [initialBootstrapping, initialPlansReady]);

  const showShellSkeleton = !initialPlansReady && skeletonVisible;

  return (
    <SubscriptionSectionLayout>
      <div className="box-border relative flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2 pt-1">
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            showShellSkeleton && "pointer-events-none invisible",
          )}
        >
          <HRISSubscriptionPlansTab />
        </div>
        {showShellSkeleton ? (
          <div
            className="absolute inset-0 z-10 scrollbar-hide seamless-scroll nested-scroll-touch-chain overflow-y-auto overflow-x-hidden bg-background [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-busy="true"
          >
            <PlansPageSkeleton />
          </div>
        ) : null}
      </div>
    </SubscriptionSectionLayout>
  );
}
