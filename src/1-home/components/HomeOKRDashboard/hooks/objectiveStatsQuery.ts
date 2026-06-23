import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import { filterValidCycleIds } from '@/shared/lib/uuidValidation';

export interface ObjectiveStats {
  avgProgress: number;
  totalObjectives: number;
  nextDeadline: string;
  active?: number;
  draft?: number;
  completed?: number;
}

export const EMPTY_OBJECTIVE_STATS: ObjectiveStats = {
  avgProgress: 0,
  totalObjectives: 0,
  nextDeadline: 'N/A',
  active: 0,
  draft: 0,
  completed: 0,
};

type ObjectiveRow = {
  id: string;
  progress_percentage?: number | null;
  end_date?: string | null;
  status?: string | null;
};

function countByStatus(objectives: ObjectiveRow[]) {
  return {
    active: objectives.filter((obj) => obj.status === 'active').length,
    draft: objectives.filter((obj) => obj.status === 'draft').length,
    completed: objectives.filter((obj) => obj.status === 'completed').length,
  };
}

function computeNextDeadline(objectives: ObjectiveRow[]): string {
  const now = new Date();
  const upcomingDeadlines = objectives
    .map((obj) => obj.end_date)
    .filter((date): date is string => Boolean(date && new Date(date) > now))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (upcomingDeadlines.length === 0) return 'N/A';
  const nextDate = new Date(upcomingDeadlines[0]);
  const quarter = Math.ceil((nextDate.getMonth() + 1) / 3);
  return `Q${quarter}`;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildStats(objectives: ObjectiveRow[], avgProgress: number): ObjectiveStats {
  const statusCounts = countByStatus(objectives);
  return {
    avgProgress: Math.round(avgProgress),
    totalObjectives: objectives.length,
    nextDeadline: computeNextDeadline(objectives),
    ...statusCounts,
  };
}

async function fetchCompanyObjectiveStats(
  organizationId: string,
  validCycleIds: string[],
): Promise<ObjectiveStats> {
  const { data: objectives, error } = await supabase
    .from('company_objectives')
    .select(
      'id, progress_percentage, end_date, status, department_objectives(progress_percentage)',
    )
    .eq('organization_id', organizationId)
    .in('cycle_id', validCycleIds);

  if (error) {
    logger.error('[company] Error fetching objectives:', error);
    return EMPTY_OBJECTIVE_STATS;
  }

  const rows = objectives ?? [];
  if (rows.length === 0) return EMPTY_OBJECTIVE_STATS;

  const objectiveProgresses = rows.map((objective) => {
    const deptRows = asArray(
      (objective as { department_objectives?: { progress_percentage?: number | null }[] })
        .department_objectives,
    );
    if (deptRows.length === 0) {
      return objective.progress_percentage || 0;
    }
    const total = deptRows.reduce((sum, dept) => sum + (dept.progress_percentage || 0), 0);
    return total / deptRows.length;
  });

  const avgProgress =
    objectiveProgresses.reduce((sum, progress) => sum + progress, 0) / rows.length;
  return buildStats(rows, avgProgress);
}

async function fetchDepartmentObjectiveStats(
  organizationId: string,
  validCycleIds: string[],
): Promise<ObjectiveStats> {
  const { data: objectives, error } = await supabase
    .from('department_objectives')
    .select('id, progress_percentage, end_date, status')
    .eq('organization_id', organizationId)
    .in('cycle_id', validCycleIds);

  if (error) {
    logger.error('[department] Error fetching objectives:', error);
    return EMPTY_OBJECTIVE_STATS;
  }

  const rows = objectives ?? [];
  if (rows.length === 0) return EMPTY_OBJECTIVE_STATS;

  const avgProgress =
    rows.reduce((sum, obj) => sum + (obj.progress_percentage || 0), 0) / rows.length;
  return buildStats(rows, avgProgress);
}

type KeyResultEmbed = {
  individual_objective_id?: string | null;
  current_value?: number | null;
  target_value?: number | null;
  progress_percentage?: number | null;
  metric_type?: string | null;
};

function keyResultProgress(kr: KeyResultEmbed): number {
  if (kr.metric_type === 'number') {
    const currentValue = kr.current_value || 0;
    const targetValue = kr.target_value || 1;
    return targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  }
  return kr.progress_percentage || 0;
}

async function fetchIndividualObjectiveStats(
  organizationId: string,
  validCycleIds: string[],
): Promise<ObjectiveStats> {
  const { data: objectives, error } = await supabase
    .from('individual_objectives')
    .select(
      'id, progress_percentage, end_date, status, key_results(individual_objective_id, current_value, target_value, progress_percentage, metric_type)',
    )
    .eq('organization_id', organizationId)
    .in('cycle_id', validCycleIds);

  if (error) {
    logger.error('[individual] Error fetching objectives:', error);
    return EMPTY_OBJECTIVE_STATS;
  }

  const rows = objectives ?? [];
  if (rows.length === 0) return EMPTY_OBJECTIVE_STATS;

  const objectiveProgresses = rows.map((objective) => {
    const keyResults = asArray(
      (objective as { key_results?: KeyResultEmbed[] }).key_results,
    );
    if (keyResults.length === 0) {
      return objective.progress_percentage || 0;
    }
    const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr), 0);
    return total / keyResults.length;
  });

  const avgProgress =
    objectiveProgresses.reduce((sum, progress) => sum + progress, 0) / rows.length;
  return buildStats(rows, avgProgress);
}

export async function fetchObjectiveStatsForType(
  organizationId: string | undefined,
  type: 'company' | 'department' | 'individual',
  cycleIds?: string[],
): Promise<ObjectiveStats> {
  if (!organizationId) {
    return EMPTY_OBJECTIVE_STATS;
  }

  const validCycleIds = filterValidCycleIds(cycleIds);
  if (validCycleIds.length === 0) {
    return EMPTY_OBJECTIVE_STATS;
  }

  logger.query(`🔍 [${type}] Fetching objective stats:`, { organizationId, cycleIds, type });

  switch (type) {
    case 'company':
      return fetchCompanyObjectiveStats(organizationId, validCycleIds);
    case 'department':
      return fetchDepartmentObjectiveStats(organizationId, validCycleIds);
    case 'individual':
      return fetchIndividualObjectiveStats(organizationId, validCycleIds);
    default:
      return EMPTY_OBJECTIVE_STATS;
  }
}

export const OBJECTIVE_STATS_QUERY_KEY = 'objective-stats';
