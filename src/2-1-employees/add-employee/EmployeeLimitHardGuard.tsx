import { ReactNode, useEffect, useState } from 'react';
import { useOptimizedSubscription } from "@/10-subscription/hooks/useOptimizedSubscription";
import { Skeleton } from '@/shared/components/ui/skeleton';
// import { EmployeeLimitBlockModal } from './EmployeeLimitBlockModal';

interface EmployeeLimitHardGuardProps {
  children: ReactNode;
  feature?: string;
}

export const EmployeeLimitHardGuard = ({
  children,
  feature = 'this feature'
}: EmployeeLimitHardGuardProps) => {
  const {
    subscriptionStatus,
    statusLoading
  } = useOptimizedSubscription();

  const [showBlockModal, setShowBlockModal] = useState(false);

  useEffect(() => {
    // Check if user is over the employee limit
    if (subscriptionStatus?.over_limit && subscriptionStatus?.is_active) {
      setShowBlockModal(true);
    }
  }, [subscriptionStatus]);

  if (statusLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col gap-4 px-4 py-6" aria-busy>
        <Skeleton className="mx-auto h-10 w-full max-w-4xl rounded-lg" />
        <Skeleton className="mx-auto h-96 w-full max-w-4xl rounded-lg" />
      </div>
    );
  }

  // If over employee limit, show block modal instead of content
  if (subscriptionStatus?.over_limit && subscriptionStatus?.is_active) {
    return (
      <div className="p-4 text-center">
        <p>Employee limit exceeded. Please upgrade your subscription.</p>
      </div>
    );
  }

  return <>{children}</>;
};


