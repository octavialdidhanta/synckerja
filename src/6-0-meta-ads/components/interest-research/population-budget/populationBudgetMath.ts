/** Campaign-total impressions and budget from unique reach (Meta union). Days only split daily spend. */

export const POPULATION_UNION_ITEM_CAP = 8;
export const DEFAULT_POPULATION_FREQUENCY = 0;
export const DEFAULT_POPULATION_DAYS = 0;

export type PopulationBudgetInputs = {
  population: number;
  cpm: number;
  frequency: number;
  days: number;
};

export type PopulationBudgetResult = {
  impressions: number;
  totalBudget: number;
  dailyBudget: number;
};

function finiteNonNegative(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** impressions = population × frequency (frequency is campaign-total, not per day). */
export function populationImpressions(population: number, frequency: number): number {
  return finiteNonNegative(population) * finiteNonNegative(frequency);
}

/** totalBudget = (impressions / 1000) × CPM */
export function populationTotalBudget(impressions: number, cpm: number): number {
  return Math.round((finiteNonNegative(impressions) / 1000) * finiteNonNegative(cpm));
}

/** dailyBudget = totalBudget / days — days do not multiply impressions. */
export function populationDailyBudget(totalBudget: number, days: number): number {
  const d = finiteNonNegative(days);
  if (d <= 0) return 0;
  return finiteNonNegative(totalBudget) / d;
}

export function computePopulationBudget(inputs: PopulationBudgetInputs): PopulationBudgetResult {
  const impressions = populationImpressions(inputs.population, inputs.frequency);
  const totalBudget = populationTotalBudget(impressions, inputs.cpm);
  const dailyBudget = populationDailyBudget(totalBudget, inputs.days);
  return { impressions, totalBudget, dailyBudget };
}
