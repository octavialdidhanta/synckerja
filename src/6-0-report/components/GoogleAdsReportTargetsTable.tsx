import { useMemo } from "react";
import {
  actualValueForAccount,
  formatGoogleAdsActualValue,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import { aggregateGoogleAdsTargetMetrics } from "@/6-0-digital-marketing-shared/googleAdsReportTargetAggregates";
import { isRateMetricKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import {
  googleAdsTargetAccountKey,
  googleAdsTargetCellKey,
  type GoogleAdsAccountPeriodActuals,
  type GoogleAdsReportTargetAccountRef,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { AvailableEmployee } from "@/shared/hooks/useAvailableEmployees";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { MetricValueKind } from "@/google-ads/metrics/types";

const UNASSIGNED_VALUE = "__unassigned__";

type Props = {
  accounts: GoogleAdsReportTargetAccountRef[];
  selectedMetrics: string[];
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, MetricValueKind>;
  formMap: Record<string, string>;
  assignmentsMap: Record<string, string>;
  getAccountActuals: (customerId: string) => GoogleAdsAccountPeriodActuals;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  employees: AvailableEmployee[];
  employeesLoading: boolean;
  inputsDisabled?: boolean;
  onAssigneeChange: (account: GoogleAdsReportTargetAccountRef, employeeId: string | null) => void;
  onCellChange: (account: GoogleAdsReportTargetAccountRef, metricKey: string, raw: string) => void;
};

type MetricCellProps = {
  account: GoogleAdsReportTargetAccountRef;
  metricKey: string;
  valueKind: MetricValueKind;
  actuals: GoogleAdsAccountPeriodActuals;
  formMap: Record<string, string>;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  inputsDisabled: boolean;
  onCellChange: (account: GoogleAdsReportTargetAccountRef, metricKey: string, raw: string) => void;
};

function MetricCell({
  account,
  metricKey,
  valueKind,
  actuals,
  formMap,
  actualLabel,
  periodNotStarted,
  showActualsLoading,
  targetsLoading,
  inputsDisabled,
  onCellChange,
}: MetricCellProps) {
  const { t } = useAppTranslation();
  const rawActual = actualValueForAccount(actuals, metricKey);
  const formattedActual = periodNotStarted
    ? t("digitalMarketing.googleAdsReportTargets.periodNotStarted", "Not started")
    : !actuals.hasConnectedAccount
      ? t("digitalMarketing.googleAdsReportTargets.noData", "No data")
      : formatGoogleAdsActualValue(metricKey, rawActual, account.currencyCode, valueKind);

  const cellKey = googleAdsTargetCellKey(account.customerId, metricKey);
  const showPercentSuffix = isRateMetricKey(metricKey) || valueKind === "rate" || valueKind === "fraction";

  const canUseActualAsTarget =
    !inputsDisabled &&
    !periodNotStarted &&
    actuals.hasConnectedAccount &&
    rawActual != null &&
    rawActual > 0;

  const targetLabel = t("digitalMarketing.googleAdsReportTargets.targetLabel", "Target");
  const metricLabelClass =
    "w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const metricValueColClass =
    "min-w-0 flex-1 text-right text-xs font-semibold tabular-nums text-gray-800";

  return (
    <div className="min-w-[5.5rem]">
      {showActualsLoading ? (
        <Skeleton className="h-[3.25rem] w-full rounded-md" />
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-1.5 border-b border-gray-100 bg-gray-50/90 px-2 py-1 text-left",
              canUseActualAsTarget
                ? "cursor-pointer hover:bg-gray-100/90"
                : "cursor-default",
            )}
            title={t(
              "digitalMarketing.googleAdsReportTargets.useActualAsTarget",
              "Click to use as target",
            )}
            disabled={!canUseActualAsTarget}
            onClick={() => {
              if (rawActual == null || rawActual <= 0) return;
              const value = showPercentSuffix ? rawActual.toFixed(2) : String(Math.round(rawActual));
              onCellChange(account, metricKey, value);
            }}
          >
            <span className={metricLabelClass}>{actualLabel}</span>
            <span className={cn(metricValueColClass, "truncate")}>{formattedActual}</span>
          </button>
          <div className="flex items-center gap-1.5 px-2 py-0.5">
            <span className={metricLabelClass}>{targetLabel}</span>
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                min={0}
                step={showPercentSuffix ? 0.01 : 1}
                className={cn(
                  metricValueColClass,
                  "h-7 w-full rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                  showPercentSuffix && "pr-3",
                  (formMap[cellKey] ?? "") ? "text-gray-800" : "text-muted-foreground/40",
                )}
                disabled={inputsDisabled || targetsLoading}
                aria-label={targetLabel}
                value={formMap[cellKey] ?? ""}
                onChange={(e) => onCellChange(account, metricKey, e.target.value)}
              />
              {showPercentSuffix ? (
                <span
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 flex items-center text-xs font-semibold tabular-nums",
                    (formMap[cellKey] ?? "") ? "text-gray-800" : "text-muted-foreground/40",
                  )}
                  aria-hidden
                >
                  %
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricSummaryCell({
  metricKey,
  valueKind,
  actual,
  target,
  currencyCode,
  actualLabel,
  periodNotStarted,
  showActualsLoading,
}: {
  metricKey: string;
  valueKind: MetricValueKind;
  actual: number | null;
  target: number | null;
  currencyCode: string | null;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
}) {
  const { t } = useAppTranslation();
  const targetLabel = t("digitalMarketing.googleAdsReportTargets.targetLabel", "Target");
  const metricLabelClass =
    "w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const metricValueColClass =
    "min-w-0 flex-1 text-right text-xs font-semibold tabular-nums text-gray-800";

  const formattedActual = periodNotStarted
    ? t("digitalMarketing.googleAdsReportTargets.periodNotStarted", "Not started")
    : formatGoogleAdsActualValue(metricKey, actual, currencyCode, valueKind);
  const formattedTarget = formatGoogleAdsActualValue(metricKey, target, currencyCode, valueKind);

  return (
    <div className="min-w-[5.5rem]">
      {showActualsLoading ? (
        <Skeleton className="h-[3.25rem] w-full rounded-md" />
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/90 px-2 py-1">
            <span className={metricLabelClass}>{actualLabel}</span>
            <span className={cn(metricValueColClass, "truncate")}>{formattedActual}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className={metricLabelClass}>{targetLabel}</span>
            <span
              className={cn(
                metricValueColClass,
                "truncate",
                target == null && "text-muted-foreground/40",
              )}
            >
              {formattedTarget}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function GoogleAdsReportTargetsTable({
  accounts,
  selectedMetrics,
  metricLabels,
  metricValueKinds,
  formMap,
  assignmentsMap,
  getAccountActuals,
  actualLabel,
  periodNotStarted,
  showActualsLoading,
  targetsLoading,
  employees,
  employeesLoading,
  inputsDisabled = false,
  onAssigneeChange,
  onCellChange,
}: Props) {
  const { t } = useAppTranslation();

  const metricAggregates = useMemo(() => {
    const result: Record<string, { actual: number | null; target: number | null }> = {};
    for (const metricKey of selectedMetrics) {
      result[metricKey] = aggregateGoogleAdsTargetMetrics(
        metricKey,
        accounts,
        getAccountActuals,
        formMap,
        periodNotStarted,
      );
    }
    return result;
  }, [accounts, selectedMetrics, getAccountActuals, formMap, periodNotStarted]);

  const primaryCurrency = accounts[0]?.currencyCode ?? null;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <Table containerClassName="overflow-visible">
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="sticky top-0 z-10 min-w-[5.5rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.report.tableChannel", "Channel")}
            </TableHead>
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.googleAdsReportTargets.colAccount", "Account")}
            </TableHead>
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.googleAdsReportTargets.colPic", "PIC")}
            </TableHead>
            {selectedMetrics.map((metricKey) => (
              <TableHead
                key={metricKey}
                className="sticky top-0 z-10 min-w-[5.5rem] bg-gray-50 text-center text-xs font-semibold text-gray-700"
              >
                {metricLabels[metricKey] ?? metricKey}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account, rowIndex) => {
            const actuals = getAccountActuals(account.customerId);
            const assignedEmployeeId =
              assignmentsMap[googleAdsTargetAccountKey(account.customerId)] ?? null;

            return (
              <TableRow
                key={account.customerId}
                className={rowIndex % 2 === 1 ? "bg-gray-50/40" : undefined}
              >
                <TableCell className="align-middle">
                  <Badge
                    variant="outline"
                    className="whitespace-nowrap border-blue-200 bg-blue-50 text-[10px] font-medium text-blue-800"
                  >
                    {t("digitalMarketing.report.channelGoogle", "Google Ads")}
                  </Badge>
                </TableCell>
                <TableCell className="align-middle">
                  <span className="text-sm font-medium text-gray-900">{account.accountLabel}</span>
                  <p className="text-[10px] text-muted-foreground">{account.customerId}</p>
                </TableCell>
                <TableCell className="align-middle">
                  <Select
                    value={assignedEmployeeId ?? UNASSIGNED_VALUE}
                    onValueChange={(v) =>
                      onAssigneeChange(account, v === UNASSIGNED_VALUE ? null : v)
                    }
                    disabled={inputsDisabled || employeesLoading || targetsLoading}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue
                        placeholder={t(
                          "digitalMarketing.googleAdsReportTargets.selectPic",
                          "Select PIC",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>
                        {t("digitalMarketing.googleAdsReportTargets.unassigned", "Unassigned")}
                      </SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {selectedMetrics.map((metricKey) => (
                  <TableCell key={metricKey} className="align-top p-2">
                    <MetricCell
                      account={account}
                      metricKey={metricKey}
                      valueKind={metricValueKinds[metricKey] ?? "count"}
                      actuals={actuals}
                      formMap={formMap}
                      actualLabel={actualLabel}
                      periodNotStarted={periodNotStarted}
                      showActualsLoading={showActualsLoading}
                      targetsLoading={targetsLoading}
                      inputsDisabled={inputsDisabled}
                      onCellChange={onCellChange}
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
        {selectedMetrics.length > 0 && accounts.length > 0 ? (
          <TableFooter>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableCell
                colSpan={3}
                className="text-xs font-semibold uppercase tracking-wide text-gray-700"
              >
                {t("digitalMarketing.googleAdsReportTargets.totalRow", "Total")}
              </TableCell>
              {selectedMetrics.map((metricKey) => {
                const agg = metricAggregates[metricKey];
                return (
                  <TableCell key={metricKey} className="p-2">
                    <MetricSummaryCell
                      metricKey={metricKey}
                      valueKind={metricValueKinds[metricKey] ?? "count"}
                      actual={agg?.actual ?? null}
                      target={agg?.target ?? null}
                      currencyCode={primaryCurrency}
                      actualLabel={actualLabel}
                      periodNotStarted={periodNotStarted}
                      showActualsLoading={showActualsLoading}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
