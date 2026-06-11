import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  aggregateEfficiencyActualFromAccounts,
  aggregateTargetValues,
  type DmTargetValueEntry,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import { isEfficiencyMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  dmTargetCellKey,
  type DmAccountPeriodActuals,
  type DmReportTargetAccountRef,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function accountActualsMap(
  accounts: DmReportTargetAccountRef[],
  getActuals: (account: DmReportTargetAccountRef) => DmAccountPeriodActuals,
): Map<string, DmAccountPeriodActuals> {
  const map = new Map<string, DmAccountPeriodActuals>();
  for (const account of accounts) {
    map.set(dmTargetAccountKey(account.channel, account.accountId), getActuals(account));
  }
  return map;
}

function parseTargetEntries(
  metricKey: string,
  accounts: DmReportTargetAccountRef[],
  formMap: Record<string, string>,
): DmTargetValueEntry[] {
  const entries: DmTargetValueEntry[] = [];
  for (const account of accounts) {
    const raw =
      formMap[dmTargetCellKey(account.channel, account.accountId, metricKey)]?.trim() ?? "";
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) continue;
    entries.push({
      channel: account.channel,
      accountKey: dmTargetAccountKey(account.channel, account.accountId),
      value: parsed,
    });
  }
  return entries;
}

export function aggregateDmTargetMetrics(
  metricKey: string,
  accounts: DmReportTargetAccountRef[],
  getActuals: (account: DmReportTargetAccountRef) => DmAccountPeriodActuals,
  formMap: Record<string, string>,
  periodNotStarted: boolean,
): { actual: number | null; target: number | null } {
  const targetEntries = parseTargetEntries(metricKey, accounts, formMap);
  const target = aggregateTargetValues(metricKey, targetEntries);
  const targetedAccountKeys =
    targetEntries.length > 0
      ? new Set(targetEntries.map((entry) => entry.accountKey))
      : null;

  if (periodNotStarted) {
    return { actual: null, target };
  }

  const actualsMap = accountActualsMap(accounts, getActuals);

  if (isEfficiencyMetricKey(metricKey)) {
    const actual = aggregateEfficiencyActualFromAccounts(
      metricKey,
      actualsMap,
      null,
      targetedAccountKeys,
    );
    return {
      actual: actual != null && Number.isFinite(actual) ? actual : null,
      target,
    };
  }

  const actual = accounts.reduce((sum, account) => {
    const actuals = getActuals(account);
    if (!actuals.hasConnectedAccount) return sum;
    const value = actualValueForAccount(actuals, metricKey);
    return value != null ? sum + value : sum;
  }, 0);

  return {
    actual: accounts.some((account) => getActuals(account).hasConnectedAccount) ? actual : null,
    target,
  };
}
