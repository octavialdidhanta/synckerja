import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { aggregateTargetValues } from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import {
  dmActualOnTargetScale,
  dmTargetPeriodCacheKey,
  previousDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportTargetPeriodKey,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

/** Monthly rows win. Quarterly rows fill metrics the month did not set. */
export function mergeDmReportTargetRows(
  primary: DmReportTargetRow[],
  fallback: DmReportTargetRow[],
): DmReportTargetRow[] {
  const keys = new Set(primary.map((row) => targetIdentity(row)));
  return [...primary, ...fallback.filter((row) => !keys.has(targetIdentity(row)))];
}

function targetIdentity(row: DmReportTargetRow): string {
  return `${row.channel}:${row.account_id}:${row.metric_key}`;
}

export function dmTargetRowPeriodKey(row: DmReportTargetRow): DmReportTargetPeriodKey | null {
  if (row.period_type === "monthly" && row.month != null) {
    return { periodType: "monthly", year: row.year, month: row.month };
  }
  if (row.period_type === "quarterly" && row.quarter != null) {
    return { periodType: "quarterly", year: row.year, quarter: row.quarter };
  }
  return null;
}

export function savedDmBaselineValue(row: DmReportTargetRow): number | null {
  if (row.baseline_value == null) return null;
  const value = Number(row.baseline_value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Before-value on the same scale as the target.
 * CTR stays on the percent scale. A saved baseline wins. Otherwise the
 * previous period actual is used (Q4 uses Q3, October uses September).
 * Volume metrics are summed; CTR, CPC, and CPA are averaged per channel.
 */
export function dmMetricBaselineOnTargetScale(args: {
  metricKey: string;
  rows: DmReportTargetRow[];
  filterAccountKeys?: Set<string> | null;
  previousActualsByPeriod: ReadonlyMap<string, Map<string, DmAccountPeriodActuals>>;
}): number | null {
  const entries: { channel: DmReportTargetRow["channel"]; accountKey: string; value: number }[] =
    [];

  for (const row of args.rows) {
    if (row.metric_key !== args.metricKey) continue;
    const accountKey = dmTargetAccountKey(row.channel, row.account_id);
    if (args.filterAccountKeys && !args.filterAccountKeys.has(accountKey)) continue;

    const saved = savedDmBaselineValue(row);
    if (saved != null) {
      entries.push({ channel: row.channel, accountKey, value: saved });
      continue;
    }

    const rowPeriod = dmTargetRowPeriodKey(row);
    if (!rowPeriod) continue;
    const previous = previousDmReportTargetPeriod(rowPeriod);
    const actuals = args.previousActualsByPeriod
      .get(dmTargetPeriodCacheKey(previous))
      ?.get(accountKey);
    if (!actuals?.hasConnectedAccount) continue;
    const scaled = dmActualOnTargetScale(
      args.metricKey,
      actualValueForAccount(actuals, args.metricKey),
    );
    if (scaled == null || scaled <= 0) continue;
    entries.push({ channel: row.channel, accountKey, value: scaled });
  }

  return aggregateTargetValues(args.metricKey, entries);
}

/** @deprecated Use dmMetricBaselineOnTargetScale. */
export function dmCtrBaselinePercent(
  args: Parameters<typeof dmMetricBaselineOnTargetScale>[0],
): number | null {
  return dmMetricBaselineOnTargetScale(args);
}

/** Share of the before → target gap already covered by current. */
export function computeDmReportBaselineGapPercentage(
  actual: number,
  baseline: number,
  target: number,
): number {
  const gap = target - baseline;
  if (!Number.isFinite(gap) || gap === 0) {
    return actual === target ? 100 : 0;
  }
  return Math.round(((actual - baseline) / gap) * 100);
}
