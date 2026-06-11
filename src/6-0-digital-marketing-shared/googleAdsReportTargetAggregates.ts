import { actualValueForAccount } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import type { GoogleAdsAccountPeriodActuals } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { isRateMetricKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import { googleAdsTargetCellKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { GoogleAdsReportTargetAccountRef } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

function weightedRate(
  accounts: GoogleAdsReportTargetAccountRef[],
  getActuals: (customerId: string) => GoogleAdsAccountPeriodActuals,
  numeratorKey: string,
  denominatorKey: string,
): number | null {
  let num = 0;
  let den = 0;
  for (const account of accounts) {
    const actuals = getActuals(account.customerId);
    if (!actuals.hasConnectedAccount) continue;
    const n = actualValueForAccount(actuals, numeratorKey);
    const d = actualValueForAccount(actuals, denominatorKey);
    if (n == null || d == null || d <= 0) continue;
    num += n;
    den += d;
  }
  if (den <= 0) return null;
  return num / den;
}

function aggregateRateMetric(
  metricKey: string,
  accounts: GoogleAdsReportTargetAccountRef[],
  getActuals: (customerId: string) => GoogleAdsAccountPeriodActuals,
): number | null {
  if (metricKey === "ctr") {
    return weightedRate(accounts, getActuals, "clicks", "impressions");
  }
  if (metricKey === "conv_rate") {
    return weightedRate(accounts, getActuals, "conversions", "clicks");
  }
  if (metricKey === "interaction_rate") {
    return weightedRate(accounts, getActuals, "interactions", "impressions");
  }
  if (metricKey === "avg_cpc") {
    return weightedRate(accounts, getActuals, "spent", "clicks");
  }
  if (metricKey === "cost_per_conv") {
    return weightedRate(accounts, getActuals, "spent", "conversions");
  }
  if (metricKey === "conv_value_per_cost") {
    return weightedRate(accounts, getActuals, "conv_value", "spent");
  }

  let sum = 0;
  let count = 0;
  for (const account of accounts) {
    const actuals = getActuals(account.customerId);
    if (!actuals.hasConnectedAccount) continue;
    const v = actualValueForAccount(actuals, metricKey);
    if (v == null) continue;
    sum += v;
    count += 1;
  }
  if (count === 0) return null;
  return sum / count;
}

export function aggregateGoogleAdsTargetMetrics(
  metricKey: string,
  accounts: GoogleAdsReportTargetAccountRef[],
  getActuals: (customerId: string) => GoogleAdsAccountPeriodActuals,
  formMap: Record<string, string>,
  periodNotStarted: boolean,
): { actual: number | null; target: number | null } {
  if (periodNotStarted) {
    let targetSum = 0;
    let hasTarget = false;
    for (const account of accounts) {
      const raw = formMap[googleAdsTargetCellKey(account.customerId, metricKey)]?.trim() ?? "";
      if (!raw) continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      if (isRateMetricKey(metricKey)) {
        return { actual: null, target: parsed };
      }
      targetSum += parsed;
      hasTarget = true;
    }
    return { actual: null, target: hasTarget ? targetSum : null };
  }

  const actual = isRateMetricKey(metricKey)
    ? aggregateRateMetric(metricKey, accounts, getActuals)
    : accounts.reduce((sum, account) => {
        const actuals = getActuals(account.customerId);
        if (!actuals.hasConnectedAccount) return sum;
        const v = actualValueForAccount(actuals, metricKey);
        return v != null ? sum + v : sum;
      }, 0);

  if (isRateMetricKey(metricKey)) {
    let sum = 0;
    let count = 0;
    for (const account of accounts) {
      const raw = formMap[googleAdsTargetCellKey(account.customerId, metricKey)]?.trim() ?? "";
      if (!raw) continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      sum += parsed;
      count += 1;
    }
    return {
      actual: actual != null && Number.isFinite(actual) ? actual : null,
      target: count > 0 ? sum / count : null,
    };
  }

  let targetSum = 0;
  let hasTarget = false;
  for (const account of accounts) {
    const raw = formMap[googleAdsTargetCellKey(account.customerId, metricKey)]?.trim() ?? "";
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) continue;
    targetSum += parsed;
    hasTarget = true;
  }

  return {
    actual: accounts.some((a) => getActuals(a.customerId).hasConnectedAccount)
      ? actual
      : null,
    target: hasTarget ? targetSum : null,
  };
}
