import { ReactNode } from "react";
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface EmployeeLimitHardGuardProps {
  children: ReactNode;
  subscriptionStatus: SubscriptionStatus | null | undefined;
  statusLoading: boolean;
}

export const EmployeeLimitHardGuard = ({
  children,
  subscriptionStatus,
  statusLoading,
}: EmployeeLimitHardGuardProps) => {
  if (statusLoading) {
    return (
      <div className="flex h-dvh min-h-0 w-full flex-col gap-4 overflow-hidden bg-gray-50 px-4 py-6" aria-busy>
        <Skeleton className="mx-auto h-10 w-full max-w-4xl rounded-lg" />
        <Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-lg" />
      </div>
    );
  }

  if (subscriptionStatus?.over_limit && subscriptionStatus?.is_active) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-gray-50 p-4 text-center">
        <p>Employee limit exceeded. Please upgrade your subscription.</p>
      </div>
    );
  }

  return <>{children}</>;
};
