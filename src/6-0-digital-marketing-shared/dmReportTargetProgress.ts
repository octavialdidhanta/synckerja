import {
  computeDmReportBaselineGapPercentage,
  dmMetricBaselineOnTargetScale,
} from "@/6-0-digital-marketing-shared/dmReportTargetBaseline";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportSummaryDisplayPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import {
  aggregateEfficiencyActualFromAccounts,
  aggregateSumActualForTargetedAccounts,
  aggregateTargetValues,
  targetEntryFromMapKey,
  type DmTargetValueEntry,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import {
  dmCtrFractionToPercent,
  effectiveTargetForDmMetric,
  isEfficiencyMetricKey,
  isPercentageMetricKey,
  resolveDmReportTargetPeriod,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  type DmAccountPeriodActuals,
  type DmReportMetricValueKind,
  type DmReportTargetProgress,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

function targetMapFromRows(rows: DmReportTargetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(`${row.channel}:${row.account_id}:${row.metric_key}`, value);
  }
  return map;
}

export function computeDmReportTargetProgress(args: {
  accountActuals: Map<string, DmAccountPeriodActuals>;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: DmReportTargetRow[];
  selectedMetricKeys: string[];
  valueKinds: Record<string, DmReportMetricValueKind>;
  filterAccountKeys?: Set<string> | null;
  metricDirections?: DmReportMetricDirectionsMap | null;
  /** Headline card values. CTR is a click/impression fraction; it replaces the account blend. */
  cardActualByMetric?: Partial<Record<string, number | null>>;
  /** Previous-period actuals keyed by dmTargetPeriodCacheKey(previous period). */
  previousActualsByPeriod?: ReadonlyMap<string, Map<string, DmAccountPeriodActuals>>;
}): DmReportTargetProgress[] {
  const resolvedPeriod = resolveDmReportTargetPeriod(args.dateSelection);
  if (!resolvedPeriod) return [];

  const bounds = resolvePeriodKeyToBounds({
    periodType: resolvedPeriod.periodType,
    year: resolvedPeriod.year,
    month: resolvedPeriod.month,
    quarter: resolvedPeriod.quarter,
  });

  const targetMap = targetMapFromRows(args.targetRows);
  const results: DmReportTargetProgress[] = [];

  for (const metricKey of args.selectedMetricKeys) {
    const targetEntries: DmTargetValueEntry[] = [];
    const targetedAccountKeys: string[] = [];

    for (const [key, targetValue] of targetMap) {
      const entry = targetEntryFromMapKey(key, metricKey, targetValue);
      if (!entry) continue;
      if (args.filterAccountKeys && !args.filterAccountKeys.has(entry.accountKey)) continue;
      targetEntries.push(entry);
      targetedAccountKeys.push(entry.accountKey);
    }

    const targetedAccountKeySet =
      targetedAccountKeys.length > 0 ? new Set(targetedAccountKeys) : null;

    const rawTarget = aggregateTargetValues(metricKey, targetEntries);
    const effectiveTarget =
      rawTarget != null ? effectiveTargetForDmMetric(rawTarget, metricKey, bounds) : null;
    const valueKind = args.valueKinds[metricKey] ?? "count";
    const showProgress = effectiveTarget != null && effectiveTarget > 0;

    let actual = isEfficiencyMetricKey(metricKey)
      ? aggregateEfficiencyActualFromAccounts(
          metricKey,
          args.accountActuals,
          args.filterAccountKeys,
          targetedAccountKeySet,
        )
      : aggregateSumActualForTargetedAccounts(
          metricKey,
          args.accountActuals,
          targetedAccountKeys,
        );

    const cardFraction = args.cardActualByMetric?.[metricKey];
    if (
      isPercentageMetricKey(metricKey) &&
      cardFraction != null &&
      Number.isFinite(cardFraction)
    ) {
      actual = dmCtrFractionToPercent(cardFraction);
    }

    const baselineFull = dmMetricBaselineOnTargetScale({
      metricKey,
      rows: args.targetRows,
      filterAccountKeys: args.filterAccountKeys,
      previousActualsByPeriod: args.previousActualsByPeriod ?? new Map(),
    });
    const baseline =
      baselineFull != null
        ? effectiveTargetForDmMetric(baselineFull, metricKey, bounds)
        : null;

    const percentage =
      showProgress && actual != null && effectiveTarget != null
        ? baseline != null
          ? computeDmReportBaselineGapPercentage(actual, baseline, effectiveTarget)
          : computeDmReportSummaryDisplayPercentage(
              actual,
              effectiveTarget,
              metricKey,
              args.metricDirections,
            )
        : null;
    const deviationPercentage =
      showProgress && actual != null && effectiveTarget != null
        ? computeDmReportTargetDeviationPercentage(
            actual,
            effectiveTarget,
            metricKey,
            args.metricDirections,
          )
        : null;

    results.push({
      metricKey,
      actual,
      target: showProgress ? effectiveTarget : null,
      targetRaw: rawTarget,
      percentage,
      deviationPercentage,
      baseline,
      showProgress,
      valueKind,
    });
  }

  return results;
}

export function dmTargetProgressByMetric(
  list: DmReportTargetProgress[],
): Map<string, DmReportTargetProgress> {
  return new Map(list.map((p) => [p.metricKey, p]));
}

export function dmTargetProgressByReportSlot(
  list: DmReportTargetProgress[],
  selectedReportMetrics: ReportTableMetricKey[],
): Map<ReportTableMetricKey, DmReportTargetProgress> {
  const byMetric = dmTargetProgressByMetric(list);
  const map = new Map<ReportTableMetricKey, DmReportTargetProgress>();
  for (const slot of selectedReportMetrics) {
    const progress = byMetric.get(slot);
    if (progress) map.set(slot, progress);
  }
  return map;
}
