import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { PillarData } from '../types/social-media';
import { startOfMonth, endOfMonth } from 'date-fns';
import {
  getContentPlansQueryOptions,
  getMasterDataQueryOptions,
} from '../data/dashboardQueryOptions';

interface CachedPlanRow {
  id: string;
  content_pillar_id?: string | null;
  post_date?: string | null;
  service_id?: string | null;
}

export const useContentPillarData = (selectedMonth?: Date, serviceFilter?: string) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const normalizedMonthTs = selectedMonth != null ? startOfMonth(selectedMonth).getTime() : undefined;
  const normalizedServiceFilter = serviceFilter ?? 'all';

  return useQuery({
    queryKey: ['contentPillarData', organizationId, normalizedMonthTs, normalizedServiceFilter],
    queryFn: async (): Promise<PillarData[]> => {
      if (!organizationId) return [];

      const [master, plansRaw] = await Promise.all([
        queryClient.fetchQuery(getMasterDataQueryOptions(organizationId)),
        queryClient.fetchQuery(getContentPlansQueryOptions(organizationId)),
      ]);

      const pillarsData = master.contentPillars ?? [];
      if (pillarsData.length === 0) return [];

      const seenNames = new Set<string>();
      const filteredPillars = pillarsData.filter((pillar) => {
        if (seenNames.has(pillar.name)) return false;
        seenNames.add(pillar.name);
        return true;
      });

      const filterDate = selectedMonth != null ? selectedMonth : new Date();
      const filterMonthStart = startOfMonth(filterDate);
      const filterMonthEnd = endOfMonth(filterDate);
      const prevMonthStart = new Date(filterMonthStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      const prevMonthEnd = endOfMonth(prevMonthStart);

      const toLocalDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const monthStartStr = toLocalDateStr(filterMonthStart);
      const monthEndStr = toLocalDateStr(filterMonthEnd);
      const prevMonthStartStr = toLocalDateStr(prevMonthStart);
      const prevMonthEndStr = toLocalDateStr(prevMonthEnd);

      const plans = (plansRaw ?? []) as CachedPlanRow[];
      const matchesService = (plan: CachedPlanRow) =>
        !serviceFilter || serviceFilter === 'all' || plan.service_id === serviceFilter;

      const usageCounts: Record<string, number> = {};
      const prevUsageCounts: Record<string, number> = {};

      for (const plan of plans) {
        if (!plan.content_pillar_id || !plan.post_date || !matchesService(plan)) continue;
        const postDate = plan.post_date.slice(0, 10);
        if (postDate >= monthStartStr && postDate <= monthEndStr) {
          usageCounts[plan.content_pillar_id] = (usageCounts[plan.content_pillar_id] ?? 0) + 1;
        }
        if (postDate >= prevMonthStartStr && postDate <= prevMonthEndStr) {
          prevUsageCounts[plan.content_pillar_id] = (prevUsageCounts[plan.content_pillar_id] ?? 0) + 1;
        }
      }

      return filteredPillars.map((pillar) => ({
        pillar_id: pillar.id,
        pillar_name: pillar.name,
        count: usageCounts[pillar.id] ?? 0,
        funnel: (pillar.funnel_stage as 'top' | 'middle' | 'bottom') || 'top',
        previousMonthCount: prevUsageCounts[pillar.id] ?? 0,
        isDefault: pillar.is_default || false,
        description: pillar.description ?? null,
        category: pillar.category ?? null,
      }));
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: 2000,
  });
};
