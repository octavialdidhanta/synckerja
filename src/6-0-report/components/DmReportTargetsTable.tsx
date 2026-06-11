import { useMemo } from "react";
import {
  actualValueForAccount,
  formatDmActualValue,
} from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { aggregateDmTargetMetrics } from "@/6-0-digital-marketing-shared/dmReportTargetAggregates";
import { channelLabel } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  isDmReportActualOnTrackForDirection,
  isDmReportTargetRespectingToggle,
  resolveDmReportMetricDirection,
  type DmReportMetricDirectionsMap,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { isPercentageMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  dmTargetCellKey,
  type DmAccountPeriodActuals,
  type DmReportChannel,
  type DmReportMetricValueKind,
  type DmReportTargetAccountRef,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
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

const UNASSIGNED_VALUE = "__unassigned__";

const CHANNEL_BADGE_CLASS: Record<DmReportChannel, string> = {
  google: "border-blue-200 bg-blue-50 text-blue-800",
  meta: "border-sky-200 bg-sky-50 text-sky-800",
  tiktok: "border-slate-300 bg-slate-100 text-slate-800",
};

type Props = {
  accounts: DmReportTargetAccountRef[];
  selectedMetrics: string[];
  hideChannelColumn?: boolean;
  metricLabels: Record<string, string>;
  metricValueKinds: Record<string, DmReportMetricValueKind>;
  formMap: Record<string, string>;
  assignmentsMap: Record<string, string>;
  getAccountActuals: (account: DmReportTargetAccountRef) => DmAccountPeriodActuals;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  employees: AvailableEmployee[];
  employeesLoading: boolean;
  inputsDisabled?: boolean;
  metricDirections: DmReportMetricDirectionsMap;
  onAssigneeChange: (account: DmReportTargetAccountRef, employeeId: string | null) => void;
  onCellChange: (account: DmReportTargetAccountRef, metricKey: string, raw: string) => void;
  onCellBlur: (account: DmReportTargetAccountRef, metricKey: string) => void;
};

type MetricCellProps = {
  account: DmReportTargetAccountRef;
  metricKey: string;
  valueKind: DmReportMetricValueKind;
  actuals: DmAccountPeriodActuals;
  formMap: Record<string, string>;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  inputsDisabled: boolean;
  metricDirections: DmReportMetricDirectionsMap;
  onCellChange: (account: DmReportTargetAccountRef, metricKey: string, raw: string) => void;
  onCellBlur: (account: DmReportTargetAccountRef, metricKey: string) => void;
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
  metricDirections,
  onCellChange,
  onCellBlur,
}: MetricCellProps) {
  const { t } = useAppTranslation();
  const rawActual = actualValueForAccount(actuals, metricKey);
  const formattedActual = periodNotStarted
    ? t("digitalMarketing.dmReportTargets.periodNotStarted", "Not started")
    : !actuals.hasConnectedAccount
      ? t("digitalMarketing.dmReportTargets.noData", "No data")
      : formatDmActualValue(
          account.channel,
          metricKey,
          rawActual,
          actuals.currencyCode ?? account.currencyCode,
        );

  const cellKey = dmTargetCellKey(account.channel, account.accountId, metricKey);
  const showPercentSuffix = isPercentageMetricKey(metricKey) || valueKind === "rate";

  const canUseActualAsTarget =
    !inputsDisabled &&
    !periodNotStarted &&
    actuals.hasConnectedAccount &&
    rawActual != null &&
    rawActual > 0;

  const targetLabel = t("digitalMarketing.dmReportTargets.targetLabel", "Target");
  const direction = resolveDmReportMetricDirection(metricKey, metricDirections);
  const parsedTarget = Number(formMap[cellKey]);
  const actualOnTrack =
    Number.isFinite(parsedTarget) &&
    parsedTarget > 0 &&
    rawActual != null &&
    isDmReportActualOnTrackForDirection(rawActual, parsedTarget, metricKey, metricDirections);
  const actualOffTrack =
    Number.isFinite(parsedTarget) &&
    parsedTarget > 0 &&
    rawActual != null &&
    rawActual > 0 &&
    !isDmReportActualOnTrackForDirection(rawActual, parsedTarget, metricKey, metricDirections);
  const targetViolatesToggle =
    Number.isFinite(parsedTarget) &&
    parsedTarget > 0 &&
    rawActual != null &&
    rawActual > 0 &&
    !isDmReportTargetRespectingToggle(parsedTarget, rawActual, metricKey, metricDirections);
  const ruleHint =
    direction === "lower_is_better"
      ? t(
          "digitalMarketing.dmReportTargets.ruleDesc",
          "Desc: target cannot exceed actual (target ≤ actual)",
        )
      : t(
          "digitalMarketing.dmReportTargets.ruleAsc",
          "Asc: target cannot be below actual (target ≥ actual)",
        );
  const metricLabelClass =
    "w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const metricValueColClass =
    "min-w-0 flex-1 text-right text-xs font-semibold tabular-nums text-gray-800";

  return (
    <div className="min-w-[5.5rem]">
      {showActualsLoading ? (
        <Skeleton className="h-[3.25rem] w-full rounded-md" />
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-md border bg-white",
            targetViolatesToggle ? "border-red-400" : "border-gray-200",
          )}
          title={ruleHint}
        >
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-1.5 border-b border-gray-100 px-2 py-1 text-left",
              actualOffTrack && "bg-red-50/90",
              actualOnTrack && rawActual != null && parsedTarget > 0 && "bg-emerald-50/90",
              !actualOffTrack && !actualOnTrack && "bg-gray-50/90",
              canUseActualAsTarget ? "cursor-pointer hover:bg-gray-100/90" : "cursor-default",
            )}
            title={t("digitalMarketing.dmReportTargets.useActualAsTarget", "Click to use as target")}
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
                  targetViolatesToggle && "text-red-600",
                )}
                disabled={inputsDisabled || targetsLoading}
                aria-label={targetLabel}
                aria-invalid={targetViolatesToggle}
                title={ruleHint}
                value={formMap[cellKey] ?? ""}
                onChange={(e) => onCellChange(account, metricKey, e.target.value)}
                onBlur={() => onCellBlur(account, metricKey)}
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
  channel,
  metricKey,
  valueKind,
  actual,
  target,
  currencyCode,
  actualLabel,
  periodNotStarted,
  showActualsLoading,
}: {
  channel: DmReportChannel;
  metricKey: string;
  valueKind: DmReportMetricValueKind;
  actual: number | null;
  target: number | null;
  currencyCode: string | null;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
}) {
  const { t } = useAppTranslation();
  const targetLabel = t("digitalMarketing.dmReportTargets.targetLabel", "Target");
  const metricLabelClass =
    "w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const metricValueColClass =
    "min-w-0 flex-1 text-right text-xs font-semibold tabular-nums text-gray-800";

  const formattedActual = periodNotStarted
    ? t("digitalMarketing.dmReportTargets.periodNotStarted", "Not started")
    : formatDmActualValue(channel, metricKey, actual, currencyCode);
  const formattedTarget = formatDmActualValue(channel, metricKey, target, currencyCode);

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

export function DmReportTargetsTable({
  accounts,
  selectedMetrics,
  hideChannelColumn = false,
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
  metricDirections,
  onAssigneeChange,
  onCellChange,
  onCellBlur,
}: Props) {
  const { t } = useAppTranslation();

  const metricAggregates = useMemo(() => {
    const result: Record<string, { actual: number | null; target: number | null }> = {};
    for (const metricKey of selectedMetrics) {
      result[metricKey] = aggregateDmTargetMetrics(
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
            {hideChannelColumn ? null : (
              <TableHead className="sticky top-0 z-10 min-w-[5.5rem] bg-gray-50 text-xs font-semibold text-gray-700">
                {t("digitalMarketing.report.tableChannel", "Channel")}
              </TableHead>
            )}
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.dmReportTargets.colAccount", "Account")}
            </TableHead>
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.dmReportTargets.colPic", "PIC")}
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
            const actuals = getAccountActuals(account);
            const accountKey = dmTargetAccountKey(account.channel, account.accountId);
            const assignedEmployeeId = assignmentsMap[accountKey] ?? null;

            return (
              <TableRow
                key={accountKey}
                className={rowIndex % 2 === 1 ? "bg-gray-50/40" : undefined}
              >
                {hideChannelColumn ? null : (
                  <TableCell className="align-middle">
                    <Badge
                      variant="outline"
                      className={cn(
                        "whitespace-nowrap text-[10px] font-medium",
                        CHANNEL_BADGE_CLASS[account.channel],
                      )}
                    >
                      {channelLabel(account.channel, t)}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="align-middle">
                  <span className="text-sm font-medium text-gray-900">{account.accountLabel}</span>
                  <p className="text-[10px] text-muted-foreground">{account.accountId}</p>
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
                          "digitalMarketing.dmReportTargets.selectPic",
                          "Select PIC",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>
                        {t("digitalMarketing.dmReportTargets.unassigned", "Unassigned")}
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
                      metricDirections={metricDirections}
                      onCellChange={onCellChange}
                      onCellBlur={onCellBlur}
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
                colSpan={hideChannelColumn ? 2 : 3}
                className="text-xs font-semibold uppercase tracking-wide text-gray-700"
              >
                {t("digitalMarketing.dmReportTargets.totalRow", "Total")}
              </TableCell>
              {selectedMetrics.map((metricKey) => {
                const agg = metricAggregates[metricKey];
                return (
                  <TableCell key={metricKey} className="p-2">
                    <MetricSummaryCell
                      channel="google"
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
