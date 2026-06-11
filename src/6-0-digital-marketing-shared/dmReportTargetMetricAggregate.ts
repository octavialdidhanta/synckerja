import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { isEfficiencyMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  parseDmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportChannel,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

export type DmTargetValueEntry = {
  channel: DmReportChannel;
  accountKey: string;
  value: number;
};

function efficiencyPair(
  metricKey: string,
  actuals: DmAccountPeriodActuals,
): { numerator: number; denominator: number } | null {
  if (metricKey === "ctr") {
    const numerator = actualValueForAccount(actuals, "clicks");
    const denominator = actualValueForAccount(actuals, "impressions");
    if (numerator == null || denominator == null || denominator <= 0) return null;
    return { numerator, denominator };
  }
  if (metricKey === "cpc") {
    const cost = actualValueForAccount(actuals, "cost");
    const clicks = actualValueForAccount(actuals, "clicks");
    if (cost != null && clicks != null && clicks > 0) {
      return { numerator: cost, denominator: clicks };
    }
    const cpc = actualValueForAccount(actuals, "cpc");
    if (cpc != null && clicks != null && clicks > 0) {
      return { numerator: cpc * clicks, denominator: clicks };
    }
    return null;
  }
  if (metricKey === "cpa") {
    const numerator = actualValueForAccount(actuals, "cost");
    const denominator = actualValueForAccount(actuals, "converted_leads");
    if (numerator == null || denominator == null || denominator <= 0) return null;
    return { numerator, denominator };
  }
  return null;
}

/**
 * Blended CTR/CPC/CPA across accounts.
 * When restrictToAccountKeys is set, only those accounts contribute (excludes "—" / no target).
 */
export function aggregateEfficiencyActualFromAccounts(
  metricKey: string,
  accountActuals: Map<string, DmAccountPeriodActuals>,
  filterAccountKeys: Set<string> | null | undefined,
  restrictToAccountKeys?: Set<string> | null,
): number | null {
  let numerator = 0;
  let denominator = 0;

  for (const [accountKey, actuals] of accountActuals) {
    if (filterAccountKeys && !filterAccountKeys.has(accountKey)) continue;
    if (restrictToAccountKeys && !restrictToAccountKeys.has(accountKey)) continue;
    if (!actuals.hasConnectedAccount) continue;

    const pair = efficiencyPair(metricKey, actuals);
    if (!pair) continue;
    numerator += pair.numerator;
    denominator += pair.denominator;
  }

  return denominator > 0 ? numerator / denominator : null;
}

export function aggregateSumActualForTargetedAccounts(
  metricKey: string,
  accountActuals: Map<string, DmAccountPeriodActuals>,
  accountKeys: string[],
): number | null {
  let sum = 0;
  let hasValue = false;

  for (const accountKey of accountKeys) {
    const actuals = accountActuals.get(accountKey);
    if (!actuals?.hasConnectedAccount) continue;
    const value = actualValueForAccount(actuals, metricKey);
    if (value == null) continue;
    sum += value;
    hasValue = true;
  }

  return hasValue ? sum : null;
}

/** Mean per channel, then mean across channels that have at least one target. */
export function aggregateEfficiencyTargetValues(entries: DmTargetValueEntry[]): number | null {
  const byChannel = new Map<DmReportChannel, number[]>();

  for (const entry of entries) {
    if (!Number.isFinite(entry.value) || entry.value <= 0) continue;
    const list = byChannel.get(entry.channel) ?? [];
    list.push(entry.value);
    byChannel.set(entry.channel, list);
  }

  const channelAverages: number[] = [];
  for (const values of byChannel.values()) {
    if (values.length === 0) continue;
    channelAverages.push(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  if (channelAverages.length === 0) return null;
  return channelAverages.reduce((sum, value) => sum + value, 0) / channelAverages.length;
}

/** Sum for volume metrics; per-channel mean for efficiency metric targets. */
export function aggregateTargetValues(
  metricKey: string,
  entries: DmTargetValueEntry[],
): number | null {
  const valid = entries.filter((e) => Number.isFinite(e.value) && e.value > 0);
  if (valid.length === 0) return null;

  if (isEfficiencyMetricKey(metricKey)) {
    return aggregateEfficiencyTargetValues(valid);
  }

  return valid.reduce((sum, entry) => sum + entry.value, 0);
}

export function targetEntryFromMapKey(
  mapKey: string,
  metricKey: string,
  value: number,
): DmTargetValueEntry | null {
  const suffix = `:${metricKey}`;
  if (!mapKey.endsWith(suffix)) return null;
  const accountKey = mapKey.slice(0, mapKey.length - suffix.length);
  const parsed = parseDmTargetAccountKey(accountKey);
  if (!parsed) return null;
  return { channel: parsed.channel, accountKey, value };
}
