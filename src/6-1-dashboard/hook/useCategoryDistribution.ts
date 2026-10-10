import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, isWithinInterval, startOfMonth } from 'date-fns';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import {
  getContentPlansQueryOptions,
  getMasterDataQueryOptions,
} from '../data/dashboardQueryOptions';

export interface CategoryDistributionItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export interface SubCategoryDistributionItem {
  id: string;
  name: string;
  serviceId: string;
  count: number;
  imagePath: string | null;
}

export interface UsedFeatureDistributionItem {
  id: string;
  name: string;
  subServiceId: string;
  count: number;
  feature_description: string | null;
  solution: string | null;
  competitive_advantage: unknown;
}

export interface CategoryDistribution {
  total: number;
  categories: CategoryDistributionItem[];
  subCategories: SubCategoryDistributionItem[];
  features: UsedFeatureDistributionItem[];
}

interface CachedPlanRow {
  id?: string;
  service_id?: string | null;
  sub_service_id?: string | null;
  feature_id?: string | null;
  post_date?: string | null;
}

/** Same month membership as the content table filter in useOptimizedFiltering. */
function planIsInSelectedMonth(postDate: string | null | undefined, monthStart: Date, monthEnd: Date): boolean {
  if (!postDate) return true;
  const planDate = new Date(postDate);
  if (Number.isNaN(planDate.getTime())) return true;
  return isWithinInterval(planDate, { start: monthStart, end: monthEnd });
}

function byCountThenName<T extends { count: number; name: string }>(left: T, right: T): number {
  if (right.count !== left.count) return right.count - left.count;
  return left.name.localeCompare(right.name);
}

export function countCategoryDistribution(input: {
  plans: CachedPlanRow[];
  services: Array<{ id: string; name: string }>;
  subServices: Array<{ id: string; name: string; service_id: string; image_path?: string | null }>;
  features?: Array<{
    id: string;
    feature_name?: string | null;
    service_id?: string | null;
    sub_service_id?: string | null;
    feature_description?: string | null;
    solution?: string | null;
    competitive_advantage?: unknown;
  }>;
  selectedMonth?: Date;
  serviceFilter?: string;
}): CategoryDistribution {
  const filterDate = input.selectedMonth ?? new Date();
  const monthStart = startOfMonth(filterDate);
  const monthEnd = endOfMonth(filterDate);
  const matchesService = (plan: CachedPlanRow) =>
    !input.serviceFilter || input.serviceFilter === 'all' || plan.service_id === input.serviceFilter;

  const categoryCounts: Record<string, number> = {};
  const subCategoryCounts: Record<string, number> = {};
  const featureCounts = new Map<string, { subServiceId: string; featureId: string; count: number }>();
  let total = 0;
  const seenPlanIds = new Set<string>();

  for (const plan of input.plans) {
    if (plan.id) {
      if (seenPlanIds.has(plan.id)) continue;
      seenPlanIds.add(plan.id);
    }
    if (!matchesService(plan) || !planIsInSelectedMonth(plan.post_date, monthStart, monthEnd)) continue;
    total += 1;
    if (!plan.service_id) continue;
    categoryCounts[plan.service_id] = (categoryCounts[plan.service_id] ?? 0) + 1;
    if (plan.sub_service_id) {
      subCategoryCounts[plan.sub_service_id] = (subCategoryCounts[plan.sub_service_id] ?? 0) + 1;
      if (plan.feature_id) {
        const key = `${plan.sub_service_id}:${plan.feature_id}`;
        const current = featureCounts.get(key);
        if (current) current.count += 1;
        else featureCounts.set(key, { subServiceId: plan.sub_service_id, featureId: plan.feature_id, count: 1 });
      }
    }
  }

  const categories = input.services
    .map((service) => {
      const count = categoryCounts[service.id] ?? 0;
      return {
        id: service.id,
        name: service.name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    })
    .sort(byCountThenName);

  const subCategories = input.subServices
    .map((subService) => ({
      id: subService.id,
      name: subService.name,
      serviceId: subService.service_id,
      count: subCategoryCounts[subService.id] ?? 0,
      imagePath: subService.image_path?.trim() || null,
    }))
    .sort(byCountThenName);

  const catalogFeatures = input.features ?? [];
  const featureById = new Map(catalogFeatures.map((feature) => [feature.id, feature]));
  const listedFeatureKeys = new Set<string>();
  const features: UsedFeatureDistributionItem[] = [];

  const pushFeature = (
    featureId: string,
    subServiceId: string,
    count: number,
    source?: (typeof catalogFeatures)[number],
  ) => {
    features.push({
      id: featureId,
      name: source?.feature_name?.trim() || 'Untitled feature',
      subServiceId,
      count,
      feature_description: source?.feature_description ?? null,
      solution: source?.solution ?? null,
      competitive_advantage: source?.competitive_advantage ?? null,
    });
  };

  for (const subService of input.subServices) {
    for (const feature of catalogFeatures) {
      const sameCategory = (feature.service_id ?? null) === subService.service_id;
      const availableForSub = !feature.sub_service_id || feature.sub_service_id === subService.id;
      if (!sameCategory || !availableForSub) continue;
      const key = `${subService.id}:${feature.id}`;
      listedFeatureKeys.add(key);
      pushFeature(feature.id, subService.id, featureCounts.get(key)?.count ?? 0, feature);
    }
  }

  for (const row of featureCounts.values()) {
    const key = `${row.subServiceId}:${row.featureId}`;
    if (listedFeatureKeys.has(key)) continue;
    pushFeature(row.featureId, row.subServiceId, row.count, featureById.get(row.featureId));
  }

  features.sort(byCountThenName);

  return { total, categories, subCategories, features };
}

export const useCategoryDistribution = (selectedMonth?: Date, serviceFilter?: string) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const normalizedMonthTs = selectedMonth != null ? startOfMonth(selectedMonth).getTime() : undefined;
  const normalizedServiceFilter = serviceFilter ?? 'all';

  return useQuery({
    queryKey: ['categoryDistribution', organizationId, normalizedMonthTs, normalizedServiceFilter],
    queryFn: async (): Promise<CategoryDistribution> => {
      if (!organizationId) return { total: 0, categories: [], subCategories: [], features: [] };

      const [master, plansRaw, featureRows] = await Promise.all([
        queryClient.fetchQuery(getMasterDataQueryOptions(organizationId)),
        queryClient.fetchQuery(getContentPlansQueryOptions(organizationId)),
        queryClient.fetchQuery({
          queryKey: ['product-knowledge-features', organizationId],
          queryFn: async () => {
            const { data, error: featureError } = await supabase
              .from('product_knowledge_features')
              .select('*')
              .eq('organization_id', organizationId)
              .order('feature_name');
            if (featureError) throw featureError;
            return data ?? [];
          },
        }),
      ]);

      return countCategoryDistribution({
        plans: (plansRaw ?? []) as CachedPlanRow[],
        services: master.services ?? [],
        subServices: master.subServices ?? [],
        features: (featureRows ?? []) as Array<{ id: string; feature_name?: string | null }>,
        selectedMonth,
        serviceFilter,
      });
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
