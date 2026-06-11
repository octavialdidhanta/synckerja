import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DmReportTargetMetricPicker } from "@/6-0-report/components/DmReportTargetMetricPicker";
import { DmReportTargetsTable } from "@/6-0-report/components/DmReportTargetsTable";
import {
  buildReportMetricLabels,
  channelLabel,
  reportMetricValueKind,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  clearDmReportTargetToggleViolations,
  collectDmReportTargetToggleViolations,
  isDmReportTargetRespectingToggle,
  normalizeMetricDirectionsForMetrics,
  parseMetricDirectionsFromSettings,
  resolveDmReportMetricDirection,
  type DmReportMetricDirectionsMap,
  type DmTargetToggleViolation,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  DM_REPORT_CHANNELS,
  emptyChannelMetricsMap,
  hasAnyChannelMetrics,
  unionChannelMetrics,
  type DmReportChannelMetricsMap,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import type { DmReportTargetDirection } from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { requiresCompanyObjectiveForDmSave } from "@/6-0-digital-marketing-shared/dmReportTargetSaveValidation";
import {
  dmTargetAccountKey,
  dmTargetCellKey,
  type DmReportChannel,
  type DmReportTargetAccountAssignment,
  type DmReportTargetAssignmentRow,
  type DmReportTargetFormValue,
  type DmReportTargetPeriodKey,
  type DmReportTargetPeriodType,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useDmReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodActuals";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useDmReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetAccounts";
import { useDmReportTargetAssignmentsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetAssignmentsQuery";
import { useDmReportTargetsMutations } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsMutations";
import { useDmReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsQuery";
import { useInsightPeriodCompanyObjectives } from "@/6-0-social-media-performance-shared/hooks/useInsightPeriodCompanyObjectives";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const QUARTERS = [1, 2, 3, 4] as const;

function rowsToAssignmentsMap(rows: DmReportTargetAssignmentRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[dmTargetAccountKey(row.channel, row.account_id)] = row.employee_id;
  }
  return map;
}

function rowsToFormMap(rows: DmReportTargetRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map[dmTargetCellKey(row.channel, row.account_id, row.metric_key)] = String(value);
  }
  return map;
}

type Props = {
  initialPeriod?: Partial<DmReportTargetPeriodKey>;
};

export function DmReportTargetsSettingsForm({ initialPeriod }: Props) {
  const { t } = useAppTranslation();
  const { user } = useCurrentUser();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [periodType, setPeriodType] = useState<DmReportTargetPeriodType>(
    initialPeriod?.periodType ?? "monthly",
  );
  const [year, setYear] = useState(initialPeriod?.year ?? currentYear);
  const [month, setMonth] = useState(initialPeriod?.month ?? now.getMonth() + 1);
  const [quarter, setQuarter] = useState(
    initialPeriod?.quarter ?? Math.floor(now.getMonth() / 3) + 1,
  );
  const [formMap, setFormMap] = useState<Record<string, string>>({});
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, string>>({});
  const [companyObjectiveId, setCompanyObjectiveId] = useState<string>("");
  const [selectedMetricsByChannel, setSelectedMetricsByChannel] =
    useState<DmReportChannelMetricsMap>(emptyChannelMetricsMap);
  const [metricDirections, setMetricDirections] = useState<DmReportMetricDirectionsMap>({});

  const periodKey: DmReportTargetPeriodKey = useMemo(() => {
    if (periodType === "monthly") {
      return { periodType, year, month };
    }
    return { periodType, year, quarter };
  }, [periodType, year, month, quarter]);

  const { accounts, isLoading: accountsListLoading } = useDmReportTargetAccounts();
  const targetsQuery = useDmReportTargetsQuery(periodKey);
  const assignmentsQuery = useDmReportTargetAssignmentsQuery(periodKey);
  const periodSettingsQuery = useDmReportPeriodSettingsQuery(periodKey);
  const {
    objectives: companyObjectives,
    isLoading: companyObjectivesLoading,
    hasMatchingCycle,
  } = useInsightPeriodCompanyObjectives(periodKey);
  const { data: employees = [], isLoading: employeesLoading } = useAvailableEmployees();

  const metricLabels = useMemo(() => buildReportMetricLabels(t), [t]);

  const metricValueKinds = useMemo(() => {
    const map: Record<string, ReturnType<typeof reportMetricValueKind>> = {};
    for (const key of Object.keys(metricLabels) as ReportTableMetricKey[]) {
      map[key] = reportMetricValueKind(key);
    }
    return map;
  }, [metricLabels]);

  const {
    getAccountActuals,
    actualsByAccount,
    inProgress,
    periodNotStarted,
    isLoading: actualsLoading,
  } = useDmReportPeriodActuals(periodKey, selectedMetricsByChannel);
  const { saveTargets } = useDmReportTargetsMutations();
  const lastAutoClearToastRef = useRef("");

  const showToggleViolationToast = useCallback(
    (violations: DmTargetToggleViolation[]) => {
      if (violations.length === 0) return;
      const fingerprint = violations
        .map((v) => v.cellKey)
        .sort()
        .join("|");
      if (fingerprint === lastAutoClearToastRef.current) return;
      lastAutoClearToastRef.current = fingerprint;

      const details = violations
        .slice(0, 3)
        .map((v) => {
          const metricName = metricLabels[v.metricKey as ReportTableMetricKey] ?? v.metricKey;
          return t(
            v.isDesc
              ? "digitalMarketing.dmReportTargets.toggleViolationDesc"
              : "digitalMarketing.dmReportTargets.toggleViolationAsc",
            v.isDesc
              ? "{{metric}} · {{account}}: Desc requires target ≤ actual"
              : "{{metric}} · {{account}}: Asc requires target ≥ actual",
            { metric: metricName, account: v.accountLabel },
          );
        })
        .join(" · ");

      toast.error(
        t(
          "digitalMarketing.dmReportTargets.toggleViolationSummary",
          "Some targets conflict with the Asc/Desc toggle and were cleared. {{details}}",
          { details },
        ),
      );
    },
    [metricLabels, t],
  );

  const collectToggleViolations = useCallback(
    (map: Record<string, string>) =>
      collectDmReportTargetToggleViolations({
        accounts,
        selectedMetricsByChannel,
        formMap: map,
        metricDirections,
        periodNotStarted,
        hasConnectedAccount: (channel, accountId) =>
          getAccountActuals({
            channel: channel as DmReportChannel,
            accountId,
            accountLabel: accountId,
            currencyCode: null,
            sortOrder: 0,
          }).hasConnectedAccount,
        getActual: (channel, accountId, metricKey) =>
          actualValueForAccount(
            getAccountActuals({
              channel: channel as DmReportChannel,
              accountId,
              accountLabel: accountId,
              currencyCode: null,
              sortOrder: 0,
            }),
            metricKey,
          ),
      }),
    [
      accounts,
      selectedMetricsByChannel,
      metricDirections,
      periodNotStarted,
      getAccountActuals,
    ],
  );

  const sanitizeFormMapForToggle = useCallback(
    (map: Record<string, string>, notify: boolean) => {
      const violations = collectToggleViolations(map).filter((v) => Boolean(map[v.cellKey]?.trim()));
      if (violations.length === 0) return map;
      if (notify) showToggleViolationToast(violations);
      return clearDmReportTargetToggleViolations(map, violations);
    },
    [collectToggleViolations, showToggleViolationToast],
  );

  const actualLabel = inProgress
    ? t("digitalMarketing.dmReportTargets.currentLabel", "Current")
    : t("digitalMarketing.dmReportTargets.actualLabel", "Actual");

  useEffect(() => {
    if (!targetsQuery.data) return;
    const loaded = rowsToFormMap(targetsQuery.data);
    lastAutoClearToastRef.current = "";
    if (periodNotStarted || actualsLoading) {
      setFormMap(loaded);
      return;
    }
    setFormMap(sanitizeFormMapForToggle(loaded, true));
  }, [targetsQuery.data, actualsLoading, periodNotStarted, sanitizeFormMapForToggle]);

  useEffect(() => {
    if (periodNotStarted || actualsLoading) return;
    setFormMap((prev) => sanitizeFormMapForToggle(prev, true));
  }, [
    actualsLoading,
    periodNotStarted,
    metricDirections,
    selectedMetricsByChannel,
    sanitizeFormMapForToggle,
  ]);

  useEffect(() => {
    if (assignmentsQuery.data) {
      setAssignmentsMap(rowsToAssignmentsMap(assignmentsQuery.data));
    }
  }, [assignmentsQuery.data]);

  useEffect(() => {
    setCompanyObjectiveId("");
    setSelectedMetricsByChannel(emptyChannelMetricsMap());
    setMetricDirections({});
    lastAutoClearToastRef.current = "";
  }, [periodType, year, month, quarter]);

  useEffect(() => {
    if (periodSettingsQuery.data) {
      if (periodSettingsQuery.data.company_objective_id) {
        setCompanyObjectiveId(periodSettingsQuery.data.company_objective_id);
      }
      const byChannel = periodSettingsQuery.data.selected_metrics_by_channel;
      if (hasAnyChannelMetrics(byChannel)) {
        setSelectedMetricsByChannel(byChannel);
      }
      setMetricDirections(
        normalizeMetricDirectionsForMetrics(
          unionChannelMetrics(byChannel),
          parseMetricDirectionsFromSettings(periodSettingsQuery.data.metric_directions),
        ),
      );
    } else if (periodSettingsQuery.isSuccess) {
      setCompanyObjectiveId("");
      setMetricDirections({});
    }
  }, [periodSettingsQuery.data, periodSettingsQuery.isSuccess]);

  const accountsByChannel = useMemo(() => {
    const map: Record<DmReportChannel, typeof accounts> = {
      google: [],
      meta: [],
      tiktok: [],
    };
    for (const account of accounts) {
      map[account.channel].push(account);
    }
    return map;
  }, [accounts]);

  const setChannelMetrics = useCallback((channel: DmReportChannel, metrics: string[]) => {
    setSelectedMetricsByChannel((prev) => {
      const next = { ...prev, [channel]: metrics };
      setMetricDirections((dirs) =>
        normalizeMetricDirectionsForMetrics(unionChannelMetrics(next), dirs),
      );
      return next;
    });
  }, []);

  const setMetricDirection = useCallback((metricKey: string, direction: DmReportTargetDirection) => {
    lastAutoClearToastRef.current = "";
    setMetricDirections((prev) => ({ ...prev, [metricKey]: direction }));
  }, []);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) years.push(y);
    return years;
  }, [currentYear]);

  const setCellValue = useCallback(
    (
      account: { channel: DmReportTargetFormValue["channel"]; accountId: string; accountLabel?: string },
      metricKey: string,
      raw: string,
    ) => {
      const key = dmTargetCellKey(account.channel, account.accountId, metricKey);
      setFormMap((prev) => ({ ...prev, [key]: raw }));
    },
    [],
  );

  const validateCellOnBlur = useCallback(
    (
      account: { channel: DmReportTargetFormValue["channel"]; accountId: string; accountLabel?: string },
      metricKey: string,
    ) => {
      const key = dmTargetCellKey(account.channel, account.accountId, metricKey);
      setFormMap((prev) => {
        const raw = prev[key]?.trim() ?? "";
        if (!raw) return prev;

        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) return prev;
        if (periodNotStarted) return prev;

        const actuals = getAccountActuals({
          channel: account.channel,
          accountId: account.accountId,
          accountLabel: account.accountLabel ?? account.accountId,
          currencyCode: null,
          sortOrder: 0,
        });
        const rawActual = actualValueForAccount(actuals, metricKey);

        if (
          !actuals.hasConnectedAccount ||
          rawActual == null ||
          rawActual <= 0 ||
          isDmReportTargetRespectingToggle(parsed, rawActual, metricKey, metricDirections)
        ) {
          return prev;
        }

        const isDesc =
          resolveDmReportMetricDirection(metricKey, metricDirections) === "lower_is_better";
        lastAutoClearToastRef.current = "";
        showToggleViolationToast([
          {
            cellKey: key,
            metricKey,
            accountLabel: account.accountLabel ?? account.accountId,
            channel: account.channel,
            accountId: account.accountId,
            isDesc,
          },
        ]);
        return { ...prev, [key]: "" };
      });
    },
    [getAccountActuals, metricDirections, periodNotStarted, showToggleViolationToast],
  );

  const setAssignee = useCallback(
    (account: { channel: DmReportTargetFormValue["channel"]; accountId: string }, employeeId: string | null) => {
      const key = dmTargetAccountKey(account.channel, account.accountId);
      setAssignmentsMap((prev) => {
        const next = { ...prev };
        if (employeeId) {
          next[key] = employeeId;
        } else {
          delete next[key];
        }
        return next;
      });
    },
    [],
  );

  const handleSave = async () => {
    if (!user?.id) {
      toast.error(t("digitalMarketing.dmReportTargets.authRequired", "Sign in to save targets."));
      return;
    }

    if (!hasAnyChannelMetrics(selectedMetricsByChannel)) {
      toast.error(
        t(
          "digitalMarketing.dmReportTargets.metricsRequired",
          "Select at least one metric for at least one channel.",
        ),
      );
      return;
    }

    const values: DmReportTargetFormValue[] = [];
    const violatingCellKeys: string[] = [];
    const violatingLabels: string[] = [];

    for (const account of accounts) {
      const channelMetrics = selectedMetricsByChannel[account.channel] ?? [];
      for (const metricKey of channelMetrics) {
        const cellKey = dmTargetCellKey(account.channel, account.accountId, metricKey);
        const raw = formMap[cellKey]?.trim() ?? "";
        if (!raw) continue;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast.error(
            t(
              "digitalMarketing.dmReportTargets.invalidValue",
              "Enter a valid non-negative number for all targets.",
            ),
          );
          return;
        }

        const actuals = getAccountActuals(account);
        const rawActual = actualValueForAccount(actuals, metricKey);
        if (
          !periodNotStarted &&
          actuals.hasConnectedAccount &&
          rawActual != null &&
          rawActual > 0 &&
          !isDmReportTargetRespectingToggle(parsed, rawActual, metricKey, metricDirections)
        ) {
          violatingCellKeys.push(cellKey);
          const metricName = metricLabels[metricKey as ReportTableMetricKey] ?? metricKey;
          const isDesc =
            resolveDmReportMetricDirection(metricKey, metricDirections) === "lower_is_better";
          violatingLabels.push(
            t(
              isDesc
                ? "digitalMarketing.dmReportTargets.toggleViolationDesc"
                : "digitalMarketing.dmReportTargets.toggleViolationAsc",
              isDesc
                ? "{{metric}} · {{account}}: Desc requires target ≤ actual"
                : "{{metric}} · {{account}}: Asc requires target ≥ actual",
              { metric: metricName, account: account.accountLabel },
            ),
          );
          continue;
        }

        values.push({
          channel: account.channel,
          accountId: account.accountId,
          metricKey,
          targetValue: parsed,
        });
      }
    }

    if (violatingCellKeys.length > 0) {
      setFormMap((prev) => {
        const next = { ...prev };
        for (const key of violatingCellKeys) {
          next[key] = "";
        }
        return next;
      });
      toast.error(
        t(
          "digitalMarketing.dmReportTargets.toggleViolationSummary",
          "Some targets conflict with the Asc/Desc toggle and were cleared. {{details}}",
          { details: violatingLabels.slice(0, 3).join(" · ") },
        ),
      );
      return;
    }

    const assignments: DmReportTargetAccountAssignment[] = [];
    for (const account of accounts) {
      const employeeId = assignmentsMap[dmTargetAccountKey(account.channel, account.accountId)];
      if (employeeId) {
        assignments.push({
          channel: account.channel,
          accountId: account.accountId,
          employeeId,
        });
      }
    }

    const needsCompanyObjective = requiresCompanyObjectiveForDmSave(values, assignments);
    if (needsCompanyObjective && !companyObjectiveId) {
      toast.error(
        t(
          "digitalMarketing.dmReportTargets.companyObjectiveRequired",
          "Select a Company Objective before saving targets or assigning a PIC.",
        ),
      );
      return;
    }

    try {
      const result = await saveTargets.mutateAsync({
        period: periodKey,
        values,
        assignments,
        accountRefs: accounts,
        accountActuals: actualsByAccount,
        createdBy: user.id,
        companyObjectiveId: companyObjectiveId || null,
        selectedMetricsByChannel,
        metricDirections: normalizeMetricDirectionsForMetrics(
          unionChannelMetrics(selectedMetricsByChannel),
          metricDirections,
        ),
        metricLabels,
        metricValueKinds,
      });

      if (result.okrSync.skippedNoCycle) {
        toast.warning(
          t(
            "digitalMarketing.dmReportTargets.okrNoCycle",
            "Targets saved. No matching OKR cycle — Individual Objectives were not synced.",
          ),
        );
      } else if (result.okrSync.syncedIndividualObjectiveCount > 0) {
        toast.success(
          t(
            "digitalMarketing.dmReportTargets.saveSuccessWithOkr",
            "{{count}} Individual Objectives synced to OKR.",
            { count: result.okrSync.syncedIndividualObjectiveCount },
          ),
        );
      } else {
        toast.success(t("digitalMarketing.dmReportTargets.saveSuccess", "Targets saved."));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "COMPANY_OBJECTIVE_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.dmReportTargets.companyObjectiveRequired",
            "Select a Company Objective before saving targets or assigning a PIC.",
          ),
        );
        return;
      }
      if (message === "PIC_REQUIRED_FOR_DEPARTMENT" || message === "PIC_DEPARTMENT_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.dmReportTargets.picRequired",
            "Assign at least one PIC with a department before saving.",
          ),
        );
        return;
      }
      toast.error(t("digitalMarketing.dmReportTargets.saveError", "Failed to save targets."));
    }
  };

  const targetsLoading =
    targetsQuery.isLoading || assignmentsQuery.isLoading || periodSettingsQuery.isLoading;
  const inputsDisabled = !companyObjectiveId;
  const showActualsLoading =
    actualsLoading && !periodNotStarted && hasAnyChannelMetrics(selectedMetricsByChannel);
  const showPageSkeleton =
    accountsListLoading || (targetsLoading && accounts.length === 0);

  if (showPageSkeleton) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.dmReportTargets.periodType", "Period type")}
          </Label>
          <Select
            value={periodType}
            onValueChange={(v) => setPeriodType(v as DmReportTargetPeriodType)}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">
                {t("digitalMarketing.dmReportTargets.monthly", "Monthly")}
              </SelectItem>
              <SelectItem value="quarterly">
                {t("digitalMarketing.dmReportTargets.quarterly", "Quarterly")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.dmReportTargets.year", "Year")}
          </Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-[6rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodType === "monthly" ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("digitalMarketing.dmReportTargets.month", "Month")}
            </Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="h-9 w-[10rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("digitalMarketing.dmReportTargets.quarterLabel", "Quarter")}
            </Label>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger className="h-9 w-[6rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    Q{q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.dmReportTargets.companyObjectiveLabel", "Company Objective")}{" "}
            <span className="text-brand-accent">*</span>
          </Label>
          <Select
            value={companyObjectiveId || undefined}
            onValueChange={setCompanyObjectiveId}
            disabled={
              companyObjectivesLoading || !hasMatchingCycle || companyObjectives.length === 0
            }
          >
            <SelectTrigger className="h-9 w-full max-w-md">
              <SelectValue
                placeholder={t(
                  "digitalMarketing.dmReportTargets.companyObjectivePlaceholder",
                  "Select company objective",
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {companyObjectives.map((obj) => (
                <SelectItem key={obj.id} value={obj.id}>
                  {obj.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {inputsDisabled ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "digitalMarketing.dmReportTargets.selectCompanyObjectiveHint",
            "Select a Company Objective to choose metrics and enter targets.",
          )}
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t(
            "digitalMarketing.dmReportTargets.noAccountsConnected",
            "No active paid ads accounts found. Connect Google Ads, Meta Ads, or TikTok Ads in Digital Marketing settings first.",
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(
            "digitalMarketing.dmReportTargets.perChannelHint",
            "Each channel has its own metrics and targets. Actual values match the Digital Marketing Report for the selected period.",
          )}
        </p>
      )}

      <div className="space-y-6">
        {DM_REPORT_CHANNELS.map((channel) => {
          const channelAccounts = accountsByChannel[channel];
          const channelMetrics = selectedMetricsByChannel[channel] ?? [];

          return (
            <section
              key={channel}
              className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/40 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {channelLabel(channel, t)}
                </h3>
                {channelAccounts.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("digitalMarketing.dmReportTargets.accountCount", "{{count}} accounts", {
                      count: channelAccounts.length,
                    })}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("digitalMarketing.dmReportTargets.channelMetricsLabel", "Metrics")}
                </Label>
                <DmReportTargetMetricPicker
                  selectedMetrics={channelMetrics}
                  onChange={(metrics) => setChannelMetrics(channel, metrics)}
                  metricDirections={metricDirections}
                  onDirectionChange={setMetricDirection}
                  disabled={inputsDisabled}
                />
              </div>

              {channelAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "digitalMarketing.dmReportTargets.noChannelAccounts",
                    "No active accounts for this channel.",
                  )}
                </p>
              ) : channelMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "digitalMarketing.dmReportTargets.noChannelMetricsSelected",
                    "Add metrics above to configure targets for this channel.",
                  )}
                </p>
              ) : (
                <DmReportTargetsTable
                  accounts={channelAccounts}
                  selectedMetrics={channelMetrics}
                  hideChannelColumn
                  metricLabels={metricLabels}
                  metricValueKinds={metricValueKinds}
                  formMap={formMap}
                  assignmentsMap={assignmentsMap}
                  getAccountActuals={getAccountActuals}
                  actualLabel={actualLabel}
                  periodNotStarted={periodNotStarted}
                  showActualsLoading={showActualsLoading}
                  targetsLoading={targetsLoading}
                  employees={employees}
                  employeesLoading={employeesLoading}
                  inputsDisabled={inputsDisabled}
                  metricDirections={metricDirections}
                  onAssigneeChange={setAssignee}
                  onCellChange={setCellValue}
                  onCellBlur={validateCellOnBlur}
                />
              )}
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={
            saveTargets.isPending || !hasAnyChannelMetrics(selectedMetricsByChannel)
          }
        >
          {saveTargets.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("digitalMarketing.dmReportTargets.save", "Save targets")}
        </Button>
      </div>
    </div>
  );
}
