import { useMemo } from "react";
import {
  actualValueForMetric,
  aggregateEngagementTargetsWeighted,
  formatActualReferenceValue,
  summarizeAccountsActuals,
  type PlatformPeriodActuals,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import {
  INSIGHT_TARGET_METRICS,
  INSIGHT_TARGET_PLATFORMS,
  insightTargetAccountKey,
  insightTargetCellKey,
  type InsightTargetAccountRef,
  type InsightTargetMetric,
  type InsightTargetPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { SocialMediaInsightAccountAvatar } from "@/6-0-social-media-report/components/SocialMediaInsightAccountAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
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
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { AvailableEmployee } from "@/shared/hooks/useAvailableEmployees";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

const UNASSIGNED_VALUE = "__unassigned__";

function platformLabelKey(platform: InsightTargetPlatform): string {
  const map: Record<InsightTargetPlatform, string> = {
    tiktok: "digitalMarketing.socialMediaPerformance.platformTikTok",
    youtube: "digitalMarketing.socialMediaPerformance.platformYouTube",
    linkedin: "digitalMarketing.socialMediaPerformance.platformLinkedIn",
    instagram: "digitalMarketing.socialMediaPerformance.platformInstagram",
    facebook: "digitalMarketing.socialMediaPerformance.platformFacebook",
  };
  return map[platform];
}

function metricLabelKey(metric: InsightTargetMetric): string {
  const map: Record<InsightTargetMetric, string> = {
    audience: "digitalMarketing.socialMediaInsightReport.summaryAudience",
    views: "digitalMarketing.socialMediaInsightReport.summaryViews",
    likes: "digitalMarketing.socialMediaInsightReport.summaryLikes",
    comments: "digitalMarketing.socialMediaInsightReport.summaryComments",
    shares: "digitalMarketing.socialMediaInsightReport.summaryShares",
    avg_engagement_rate: "digitalMarketing.socialMediaInsightReport.summaryEngagement",
  };
  return map[metric];
}

type Props = {
  accountsByPlatform: Record<InsightTargetPlatform, InsightTargetAccountRef[]>;
  formMap: Record<string, string>;
  assignmentsMap: Record<string, string>;
  getAccountActuals: (account: InsightTargetAccountRef) => PlatformPeriodActuals;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  employees: AvailableEmployee[];
  employeesLoading: boolean;
  inputsDisabled?: boolean;
  onAssigneeChange: (account: InsightTargetAccountRef, employeeId: string | null) => void;
  onCellChange: (account: InsightTargetAccountRef, metric: InsightTargetMetric, raw: string) => void;
};

function orderedAccounts(
  accountsByPlatform: Record<InsightTargetPlatform, InsightTargetAccountRef[]>,
): InsightTargetAccountRef[] {
  const list: InsightTargetAccountRef[] = [];
  for (const platform of INSIGHT_TARGET_PLATFORMS) {
    list.push(...accountsByPlatform[platform]);
  }
  return list;
}

function computeMetricAggregates(
  accounts: InsightTargetAccountRef[],
  getAccountActuals: (account: InsightTargetAccountRef) => PlatformPeriodActuals,
  formMap: Record<string, string>,
  periodNotStarted: boolean,
): Record<InsightTargetMetric, { actual: number | null; target: number | null }> {
  const accountActuals = accounts.map((account) => getAccountActuals(account));
  const actualSummary = periodNotStarted
    ? null
    : summarizeAccountsActuals(accountActuals);

  const result = {} as Record<
    InsightTargetMetric,
    { actual: number | null; target: number | null }
  >;

  for (const metric of INSIGHT_TARGET_METRICS) {
    if (metric === "avg_engagement_rate") {
      result[metric] = {
        actual: actualSummary
          ? actualValueForMetric(actualSummary, metric)
          : null,
        target: aggregateEngagementTargetsWeighted(accounts, getAccountActuals, formMap),
      };
      continue;
    }

    let targetSum = 0;
    let hasTarget = false;
    for (const account of accounts) {
      const rawTarget =
        formMap[insightTargetCellKey(account.platform, account.accountId, metric)]?.trim() ??
        "";
      if (!rawTarget) continue;
      const parsed = Number(rawTarget);
      if (!Number.isFinite(parsed) || parsed < 0) continue;
      targetSum += parsed;
      hasTarget = true;
    }

    result[metric] = {
      actual: actualSummary ? actualValueForMetric(actualSummary, metric) : null,
      target: hasTarget ? targetSum : null,
    };
  }

  return result;
}

type MetricCellProps = {
  account: InsightTargetAccountRef;
  metric: InsightTargetMetric;
  actuals: PlatformPeriodActuals;
  formMap: Record<string, string>;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
  targetsLoading: boolean;
  inputsDisabled: boolean;
  onCellChange: (account: InsightTargetAccountRef, metric: InsightTargetMetric, raw: string) => void;
};

function MetricCell({
  account,
  metric,
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
  const rawActual = actualValueForMetric(actuals, metric);
  const formattedActual = periodNotStarted
    ? t("digitalMarketing.socialMediaInsightTargets.periodNotStarted", "Not started")
    : !actuals.hasConnectedAccount
      ? t("digitalMarketing.socialMediaInsightTargets.noData", "No data")
      : formatActualReferenceValue(metric, rawActual);

  const cellKey = insightTargetCellKey(account.platform, account.accountId, metric);

  const canUseActualAsTarget =
    !inputsDisabled &&
    !periodNotStarted &&
    actuals.hasConnectedAccount &&
    rawActual != null &&
    rawActual > 0;

  const targetLabel = t("digitalMarketing.socialMediaInsightTargets.targetLabel", "Target");
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
              "digitalMarketing.socialMediaInsightTargets.useActualAsTarget",
              "Click to use as target",
            )}
            disabled={!canUseActualAsTarget}
            onClick={() => {
              if (rawActual == null || rawActual <= 0) return;
              const value =
                metric === "avg_engagement_rate"
                  ? rawActual.toFixed(2)
                  : String(Math.round(rawActual));
              onCellChange(account, metric, value);
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
                step={metric === "avg_engagement_rate" ? 0.01 : 1}
                className={cn(
                  metricValueColClass,
                  "h-7 w-full rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  "[appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                  metric === "avg_engagement_rate" && "pr-3",
                  (formMap[cellKey] ?? "") ? "text-gray-800" : "text-muted-foreground/40",
                )}
                disabled={inputsDisabled || targetsLoading}
                aria-label={targetLabel}
                value={formMap[cellKey] ?? ""}
                onChange={(e) => onCellChange(account, metric, e.target.value)}
              />
              {metric === "avg_engagement_rate" ? (
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

type MetricSummaryCellProps = {
  metric: InsightTargetMetric;
  actual: number | null;
  target: number | null;
  actualLabel: string;
  periodNotStarted: boolean;
  showActualsLoading: boolean;
};

function MetricSummaryCell({
  metric,
  actual,
  target,
  actualLabel,
  periodNotStarted,
  showActualsLoading,
}: MetricSummaryCellProps) {
  const { t } = useAppTranslation();
  const targetLabel = t("digitalMarketing.socialMediaInsightTargets.targetLabel", "Target");
  const metricLabelClass =
    "w-14 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";
  const metricValueColClass =
    "min-w-0 flex-1 text-right text-xs font-semibold tabular-nums text-gray-800";

  const formattedActual = periodNotStarted
    ? t("digitalMarketing.socialMediaInsightTargets.periodNotStarted", "Not started")
    : formatActualReferenceValue(metric, actual);
  const formattedTarget = formatActualReferenceValue(metric, target);

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

export function InsightTargetsTable({
  accountsByPlatform,
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
  const { organizationId } = useCurrentOrg();
  const accounts = orderedAccounts(accountsByPlatform);
  const metricAggregates = useMemo(
    () => computeMetricAggregates(accounts, getAccountActuals, formMap, periodNotStarted),
    [accounts, getAccountActuals, formMap, periodNotStarted],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <Table containerClassName="overflow-visible">
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="sticky top-0 z-10 min-w-[5.5rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.socialMediaInsightTargets.colPlatform", "Platform")}
            </TableHead>
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.socialMediaInsightTargets.colAccount", "Account")}
            </TableHead>
            <TableHead className="sticky top-0 z-10 min-w-[10rem] bg-gray-50 text-xs font-semibold text-gray-700">
              {t("digitalMarketing.socialMediaInsightTargets.colPic", "PIC")}
            </TableHead>
            {INSIGHT_TARGET_METRICS.map((metric) => (
              <TableHead
                key={metric}
                className="sticky top-0 z-10 min-w-[5.5rem] bg-gray-50 text-center text-xs font-semibold text-gray-700"
              >
                {t(metricLabelKey(metric), metric)}
                {metric === "avg_engagement_rate" ? (
                  <span className="ml-0.5 font-normal text-muted-foreground">(%)</span>
                ) : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map((account, rowIndex) => {
            const actuals = getAccountActuals(account);
            const platformLabel = t(platformLabelKey(account.platform), account.platform);
            const assignedEmployeeId =
              assignmentsMap[insightTargetAccountKey(account.platform, account.accountId)] ?? null;

            return (
              <TableRow
                key={`${account.platform}:${account.accountId}`}
                className={rowIndex % 2 === 1 ? "bg-gray-50/40" : undefined}
              >
                <TableCell className="align-middle text-sm font-medium text-gray-800">
                  {platformLabel}
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex items-center gap-2">
                    <SocialMediaInsightAccountAvatar
                      avatarUrl={account.avatarUrl}
                      accountLabel={account.accountLabel}
                      organizationId={organizationId}
                      platform={account.platform}
                      accountId={account.accountId}
                      className="h-7 w-7"
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                      {account.accountLabel}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="align-middle">
                  <Select
                    value={assignedEmployeeId ?? UNASSIGNED_VALUE}
                    onValueChange={(v) =>
                      onAssigneeChange(account, v === UNASSIGNED_VALUE ? null : v)
                    }
                    disabled={inputsDisabled || targetsLoading || employeesLoading}
                  >
                    <SelectTrigger className="h-8 w-full min-w-[9rem] text-xs">
                      <SelectValue
                        placeholder={t(
                          "digitalMarketing.socialMediaInsightTargets.assigneePlaceholder",
                          "Assign PIC",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>
                        {t("digitalMarketing.socialMediaInsightTargets.unassigned", "Unassigned")}
                      </SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {INSIGHT_TARGET_METRICS.map((metric) => (
                  <TableCell key={metric} className="align-middle px-2 py-2">
                    <MetricCell
                      account={account}
                      metric={metric}
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
        {accounts.length > 0 ? (
          <TableFooter>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
              <TableCell colSpan={3} className="text-sm font-semibold text-gray-800">
                {t("digitalMarketing.socialMediaInsightTargets.rowTotal", "Total")}
              </TableCell>
              {INSIGHT_TARGET_METRICS.map((metric) => (
                <TableCell key={metric} className="align-middle px-2 py-2">
                  <MetricSummaryCell
                    metric={metric}
                    actual={metricAggregates[metric].actual}
                    target={metricAggregates[metric].target}
                    actualLabel={actualLabel}
                    periodNotStarted={periodNotStarted}
                    showActualsLoading={showActualsLoading}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}
