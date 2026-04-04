import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getContentPlansQueryOptions, getMasterDataQueryOptions } from '../data/dashboardQueryOptions';

// Single optimized hook for all social media data (uses shared query options for prefetch deduplication)
export const useOptimizedSocialMediaData = () => {
  const { organizationId } = useCurrentOrg();

  const contentPlansQuery = useQuery(getContentPlansQueryOptions(organizationId));
  const masterDataQuery = useQuery(getMasterDataQueryOptions(organizationId));

  // Combine loading states efficiently
  const isFetching = contentPlansQuery.isFetching || masterDataQuery.isFetching;

  const hasContentPlans = contentPlansQuery.data && contentPlansQuery.data.length > 0;
  const hasMasterData = masterDataQuery.data && 
    (masterDataQuery.data.contentTypes?.length > 0 || 
     masterDataQuery.data.services?.length > 0 || 
     masterDataQuery.data.contentPillars?.length > 0);
  
  // Show loading whenever either query is still pending and we don't have that query's data yet.
  // This prevents a flash of empty table when master data resolves first (e.g. from cache) while content plans are still fetching.
  const isLoading =
    (contentPlansQuery.isPending && !hasContentPlans) ||
    (masterDataQuery.isPending && !hasMasterData);
  const error = contentPlansQuery.error || masterDataQuery.error;

  // Return optimized data structure
  return {
    // Data
    contentPlans: contentPlansQuery.data || [],
    contentTypes: masterDataQuery.data?.contentTypes || [],
    services: masterDataQuery.data?.services || [],
    subServices: masterDataQuery.data?.subServices || [],
    contentPillars: masterDataQuery.data?.contentPillars || [],
    
    // States
    isLoading,
    isFetching, // Background updates
    error,
    organizationId,
    
    // Query invalidation helpers
    invalidateContentPlans: () => contentPlansQuery.refetch(),
    invalidateMasterData: () => masterDataQuery.refetch(),
  };
};