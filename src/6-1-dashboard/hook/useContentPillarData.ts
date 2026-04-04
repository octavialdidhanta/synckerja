import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { devLog } from '@/shared/lib/logger';
import { PillarData } from '../types/social-media';
import { startOfMonth, endOfMonth } from 'date-fns';

export const useContentPillarData = (selectedMonth?: Date, serviceFilter?: string) => {
  const { organizationId } = useCurrentOrg();
  // Normalize key so same calendar month + filter = same cache (avoids duplicate fetches when reference changes)
  const normalizedMonthTs = selectedMonth != null ? startOfMonth(selectedMonth).getTime() : undefined;
  const normalizedServiceFilter = serviceFilter ?? 'all';

  return useQuery({
    queryKey: ['contentPillarData', organizationId, normalizedMonthTs, normalizedServiceFilter],
    queryFn: async (): Promise<PillarData[]> => {
      try {
        // Starting content pillar data fetch

        // Optimized query using the new is_default column
        const { data: pillarsData, error: pillarsError } = await supabase
          .from('content_pillars')
          .select('id, name, funnel_stage, organization_id, is_default')
          .eq('is_active', true)
          .or(organizationId ? `is_default.eq.true,organization_id.eq.${organizationId}` : 'is_default.eq.true')
          .order('is_default', { ascending: false })
          .order('name', { ascending: true });

        if (pillarsError) {
          devLog.error('Error fetching pillars', pillarsError?.message);
          throw pillarsError;
        }

        if (!pillarsData || pillarsData.length === 0) {
          return [];
        }

        // Filter to avoid duplicates (prefer organization-specific over default)
        const seenNames = new Set<string>();
        const filteredPillars = pillarsData.filter(pillar => {
          if (seenNames.has(pillar.name)) {
            return false;
          }
          seenNames.add(pillar.name);
          return true;
        });

        // Get usage data for selected month and previous month if organization exists
        let usageData: any[] = [];
        let prevUsageData: any[] = [];

        if (organizationId) {
          const filterDate = selectedMonth != null ? selectedMonth : new Date();
          const filterMonthStart = startOfMonth(filterDate);
          const filterMonthEnd = endOfMonth(filterDate);
          // Use local date format (YYYY-MM-DD) to match table filter - avoid timezone shift from toISOString()
          const toLocalDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };
          const monthStartStr = toLocalDateStr(filterMonthStart);
          const monthEndStr = toLocalDateStr(filterMonthEnd);
          
          // Fetching usage data for selected month
          let currentUsageQuery = supabase
            .from('social_media_plans')
            .select('content_pillar_id, post_date')
            .eq('organization_id', organizationId)
            .not('content_pillar_id', 'is', null)
            .gte('post_date', monthStartStr)
            .lte('post_date', monthEndStr);
          
          // Apply service filter if provided
          if (serviceFilter && serviceFilter !== 'all') {
            currentUsageQuery = currentUsageQuery.eq('service_id', serviceFilter);
          }
          
          const { data: currentUsage, error: usageError } = await currentUsageQuery;

          if (usageError) {
            devLog.error('Error fetching usage data', usageError?.message);
          } else {
            usageData = currentUsage || [];
            devLog.debug('Selected month usage data', usageData?.length ?? 0);
          }

          // Previous month usage for comparison
          const prevMonthStart = new Date(filterMonthStart);
          prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
          const prevMonthEnd = endOfMonth(prevMonthStart);
          const prevMonthStartStr = toLocalDateStr(prevMonthStart);
          const prevMonthEndStr = toLocalDateStr(prevMonthEnd);
          
          devLog.debug('Fetching usage for previous month');

          let prevUsageQuery = supabase
            .from('social_media_plans')
            .select('content_pillar_id, post_date')
            .eq('organization_id', organizationId)
            .gte('post_date', prevMonthStartStr)
            .lte('post_date', prevMonthEndStr)
            .not('content_pillar_id', 'is', null);
          
          // Apply service filter if provided
          if (serviceFilter && serviceFilter !== 'all') {
            prevUsageQuery = prevUsageQuery.eq('service_id', serviceFilter);
          }
          
          const { data: prevUsage, error: prevUsageError } = await prevUsageQuery;

          if (prevUsageError) {
            devLog.error('Error fetching previous usage data', prevUsageError?.message);
          } else {
            prevUsageData = prevUsage || [];
            devLog.debug('Previous month usage data', prevUsageData?.length ?? 0);
          }
        }

        // Calculate usage counts
        const usageCounts = usageData.reduce((acc, item) => {
          if (item.content_pillar_id) {
            acc[item.content_pillar_id] = (acc[item.content_pillar_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const prevUsageCounts = prevUsageData.reduce((acc, item) => {
          if (item.content_pillar_id) {
            acc[item.content_pillar_id] = (acc[item.content_pillar_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        // Transform data to PillarData format
        const result = filteredPillars.map(pillar => {
          const pillarData: PillarData = {
            pillar_id: pillar.id,
            pillar_name: pillar.name,
            count: usageCounts[pillar.id] || 0,
            funnel: (pillar.funnel_stage as 'top' | 'middle' | 'bottom') || 'top',
            previousMonthCount: prevUsageCounts[pillar.id] || 0,
            isDefault: pillar.is_default || false
          };
          return pillarData;
        });
        
        return result;
      } catch (error) {
        devLog.error('Error in contentPillarData fetch', error);
        throw error;
      }
    },
    enabled: true,
    staleTime: 30 * 1000, // Reduced to 30 seconds for realtime feel
    gcTime: 2 * 60 * 1000, // Reduced to 2 minutes
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows (realtime handles updates)
    refetchOnMount: false, // Don't refetch on mount if data is fresh (reduces unnecessary requests)
    retry: 2,
    retryDelay: 2000,
  });
};

