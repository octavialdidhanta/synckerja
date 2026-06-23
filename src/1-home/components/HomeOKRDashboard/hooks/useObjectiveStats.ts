import { useQuery, useQueries } from '@tanstack/react-query';
import {
  EMPTY_OBJECTIVE_STATS,
  fetchObjectiveStatsForType,
  OBJECTIVE_STATS_QUERY_KEY,
  type ObjectiveStats,
} from './objectiveStatsQuery';

export type { ObjectiveStats } from './objectiveStatsQuery';
export { EMPTY_OBJECTIVE_STATS, fetchObjectiveStatsForType } from './objectiveStatsQuery';

export const useObjectiveStats = (
  organizationId: string | undefined,
  type: 'company' | 'department' | 'individual',
  cycleIds?: string[],
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [OBJECTIVE_STATS_QUERY_KEY, organizationId, type, cycleIds],
    queryFn: () => fetchObjectiveStatsForType(organizationId, type, cycleIds),
    enabled: !!organizationId && enabled,
    staleTime: 5 * 60 * 1000,
  });
};

type HomeOkrObjectiveStatsParams = {
  organizationId?: string;
  cycleIds?: string[];
  loadCompany: boolean;
  loadDepartment: boolean;
  loadIndividual: boolean;
};

/** Home OKR progress cards — lazy per tab, shared fetch helpers (embedded joins). */
export function useHomeOkrObjectiveStats({
  organizationId,
  cycleIds,
  loadCompany,
  loadDepartment,
  loadIndividual,
}: HomeOkrObjectiveStatsParams) {
  const results = useQueries({
    queries: [
      {
        queryKey: [OBJECTIVE_STATS_QUERY_KEY, organizationId, 'company', cycleIds],
        queryFn: () => fetchObjectiveStatsForType(organizationId, 'company', cycleIds),
        enabled: !!organizationId && loadCompany,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: [OBJECTIVE_STATS_QUERY_KEY, organizationId, 'department', cycleIds],
        queryFn: () => fetchObjectiveStatsForType(organizationId, 'department', cycleIds),
        enabled: !!organizationId && loadDepartment,
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: [OBJECTIVE_STATS_QUERY_KEY, organizationId, 'individual', cycleIds],
        queryFn: () => fetchObjectiveStatsForType(organizationId, 'individual', cycleIds),
        enabled: !!organizationId && loadIndividual,
        staleTime: 5 * 60 * 1000,
      },
    ],
  });

  const [companyQuery, departmentQuery, individualQuery] = results;

  return {
    company: {
      ...companyQuery,
      data: companyQuery.data ?? EMPTY_OBJECTIVE_STATS,
    },
    department: {
      ...departmentQuery,
      data: departmentQuery.data ?? EMPTY_OBJECTIVE_STATS,
    },
    individual: {
      ...individualQuery,
      data: individualQuery.data ?? EMPTY_OBJECTIVE_STATS,
    },
  };
}
