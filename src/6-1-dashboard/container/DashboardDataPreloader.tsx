import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import {
  getContentPlansQueryOptions,
  getMasterDataQueryOptions,
  getDigitalMarketingEmployeesQueryOptions,
} from '../data/dashboardQueryOptions';

interface DashboardDataPreloaderProps {
  children: React.ReactNode;
}

/**
 * Prefetches critical dashboard queries in the background. Children's hooks use the same
 * query keys, so they read from cache or share the in-flight request—no duplicate fetches.
 * Initial UI is gated by SocialMediaDashboardSkeleton overlay until aggregated loads finish.
 */
export const DashboardDataPreloader: React.FC<DashboardDataPreloaderProps> = ({ children }) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;
    const opts = {
      contentPlans: getContentPlansQueryOptions(organizationId),
      master: getMasterDataQueryOptions(organizationId),
      employees: getDigitalMarketingEmployeesQueryOptions(organizationId),
    };
    Promise.all([
      queryClient.prefetchQuery({ queryKey: opts.contentPlans.queryKey, queryFn: opts.contentPlans.queryFn }),
      queryClient.prefetchQuery({ queryKey: opts.master.queryKey, queryFn: opts.master.queryFn }),
      queryClient.prefetchQuery({ queryKey: opts.employees.queryKey, queryFn: opts.employees.queryFn }),
    ]).catch(() => {
      toast.error('Failed to load dashboard data. Refresh the page to retry.');
    });
  }, [organizationId, queryClient]);

  return <>{children}</>;
};
