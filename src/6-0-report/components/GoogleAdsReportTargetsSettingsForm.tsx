import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildSummaryMetricOptions } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { useGoogleAdsMetricCatalog } from "@/google-ads/hooks/useGoogleAdsMetricCatalog";
import { GoogleAdsReportTargetMetricPicker } from "@/6-0-report/components/GoogleAdsReportTargetMetricPicker";
import { GoogleAdsReportTargetsTable } from "@/6-0-report/components/GoogleAdsReportTargetsTable";
import { useGoogleAdsReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportPeriodActuals";
import { useGoogleAdsReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportPeriodSettingsQuery";
import { useGoogleAdsReportTargetAccounts } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetAccounts";
import { useGoogleAdsReportTargetAssignmentsQuery } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetAssignmentsQuery";
import { useGoogleAdsReportTargetsMutations } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetsMutations";
import { useGoogleAdsReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetsQuery";
import { requiresCompanyObjectiveForGoogleAdsSave } from "@/6-0-digital-marketing-shared/googleAdsReportTargetSaveValidation";
import {
  googleAdsTargetAccountKey,
  googleAdsTargetCellKey,
  type GoogleAdsReportTargetAccountAssignment,
  type GoogleAdsReportTargetFormValue,
  type GoogleAdsReportTargetPeriodKey,
  type GoogleAdsReportTargetPeriodType,
  type GoogleAdsReportTargetAssignmentRow,
  type GoogleAdsReportTargetRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { useInsightPeriodCompanyObjectives } from "@/6-0-social-media-performance-shared/hooks/useInsightPeriodCompanyObjectives";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
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
import type { MetricValueKind } from "@/google-ads/metrics/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const QUARTERS = [1, 2, 3, 4] as const;

function rowsToAssignmentsMap(
  rows: GoogleAdsReportTargetAssignmentRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[googleAdsTargetAccountKey(row.google_customer_id)] = row.employee_id;
  }
  return map;
}

function rowsToFormMap(rows: GoogleAdsReportTargetRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map[googleAdsTargetCellKey(row.google_customer_id, row.metric_key)] = String(value);
  }
  return map;
}

type Props = {
  initialPeriod?: Partial<GoogleAdsReportTargetPeriodKey>;
};

export function GoogleAdsReportTargetsSettingsForm({ initialPeriod }: Props) {
  const { t } = useAppTranslation();
  const { user } = useCurrentUser();
  const { organizationId } = useCurrentOrg();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [periodType, setPeriodType] = useState<GoogleAdsReportTargetPeriodType>(
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
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const periodKey: GoogleAdsReportTargetPeriodKey = useMemo(() => {
    if (periodType === "monthly") {
      return { periodType, year, month };
    }
    return { periodType, year, quarter };
  }, [periodType, year, month, quarter]);

  const { accounts, isLoading: accountsListLoading } = useGoogleAdsReportTargetAccounts();
  const targetsQuery = useGoogleAdsReportTargetsQuery(periodKey);
  const assignmentsQuery = useGoogleAdsReportTargetAssignmentsQuery(periodKey);
  const periodSettingsQuery = useGoogleAdsReportPeriodSettingsQuery(periodKey);
  const {
    objectives: companyObjectives,
    isLoading: companyObjectivesLoading,
    hasMatchingCycle,
  } = useInsightPeriodCompanyObjectives(periodKey);
  const { data: employees = [], isLoading: employeesLoading } = useAvailableEmployees();
  const { data: catalog } = useGoogleAdsMetricCatalog(organizationId, "campaign", true);

  const metricOptions = useMemo(
    () => buildSummaryMetricOptions("campaign", catalog, []),
    [catalog],
  );

  const metricLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const opt of metricOptions) map[opt.key] = opt.label;
    return map;
  }, [metricOptions]);

  const metricValueKinds = useMemo(() => {
    const map: Record<string, MetricValueKind> = {};
    for (const opt of metricOptions) map[opt.key] = opt.valueKind;
    return map;
  }, [metricOptions]);

  const {
    getAccountActuals,
    actualsByAccount,
    inProgress,
    periodNotStarted,
    isLoading: actualsLoading,
  } = useGoogleAdsReportPeriodActuals(periodKey, selectedMetrics, metricValueKinds);
  const { saveTargets } = useGoogleAdsReportTargetsMutations();

  const actualLabel = inProgress
    ? t("digitalMarketing.googleAdsReportTargets.currentLabel", "Current")
    : t("digitalMarketing.googleAdsReportTargets.actualLabel", "Actual");

  useEffect(() => {
    if (targetsQuery.data) {
      setFormMap(rowsToFormMap(targetsQuery.data));
    }
  }, [targetsQuery.data]);

  useEffect(() => {
    if (assignmentsQuery.data) {
      setAssignmentsMap(rowsToAssignmentsMap(assignmentsQuery.data));
    }
  }, [assignmentsQuery.data]);

  useEffect(() => {
    setCompanyObjectiveId("");
    setSelectedMetrics([]);
  }, [periodType, year, month, quarter]);

  useEffect(() => {
    if (periodSettingsQuery.data) {
      if (periodSettingsQuery.data.company_objective_id) {
        setCompanyObjectiveId(periodSettingsQuery.data.company_objective_id);
      }
      const metrics = periodSettingsQuery.data.selected_metrics ?? [];
      if (metrics.length > 0) {
        setSelectedMetrics(metrics);
      }
    } else if (periodSettingsQuery.isSuccess) {
      setCompanyObjectiveId("");
    }
  }, [periodSettingsQuery.data, periodSettingsQuery.isSuccess]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) years.push(y);
    return years;
  }, [currentYear]);

  const setCellValue = useCallback(
    (account: { customerId: string }, metricKey: string, raw: string) => {
      const key = googleAdsTargetCellKey(account.customerId, metricKey);
      setFormMap((prev) => ({ ...prev, [key]: raw }));
    },
    [],
  );

  const setAssignee = useCallback(
    (account: { customerId: string }, employeeId: string | null) => {
      const key = googleAdsTargetAccountKey(account.customerId);
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
      toast.error(
        t("digitalMarketing.googleAdsReportTargets.authRequired", "Sign in to save targets."),
      );
      return;
    }

    if (selectedMetrics.length === 0) {
      toast.error(
        t(
          "digitalMarketing.googleAdsReportTargets.metricsRequired",
          "Select at least one metric for this period.",
        ),
      );
      return;
    }

    const values: GoogleAdsReportTargetFormValue[] = [];
    for (const account of accounts) {
      for (const metricKey of selectedMetrics) {
        const raw =
          formMap[googleAdsTargetCellKey(account.customerId, metricKey)]?.trim() ?? "";
        if (!raw) continue;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast.error(
            t(
              "digitalMarketing.googleAdsReportTargets.invalidValue",
              "Enter a valid non-negative number for all targets.",
            ),
          );
          return;
        }
        values.push({
          customerId: account.customerId,
          metricKey,
          targetValue: parsed,
        });
      }
    }

    const assignments: GoogleAdsReportTargetAccountAssignment[] = [];
    for (const account of accounts) {
      const employeeId = assignmentsMap[googleAdsTargetAccountKey(account.customerId)];
      if (employeeId) {
        assignments.push({
          customerId: account.customerId,
          employeeId,
        });
      }
    }

    const needsCompanyObjective = requiresCompanyObjectiveForGoogleAdsSave(values, assignments);
    if (needsCompanyObjective && !companyObjectiveId) {
      toast.error(
        t(
          "digitalMarketing.googleAdsReportTargets.companyObjectiveRequired",
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
        selectedMetrics,
        metricLabels,
        metricValueKinds,
      });

      if (result.okrSync.skippedNoCycle) {
        toast.warning(
          t(
            "digitalMarketing.googleAdsReportTargets.okrNoCycle",
            "Targets saved. No matching OKR cycle — Individual Objectives were not synced.",
          ),
        );
      } else if (result.okrSync.syncedIndividualObjectiveCount > 0) {
        toast.success(
          t(
            "digitalMarketing.googleAdsReportTargets.saveSuccessWithOkr",
            "{{count}} Individual Objectives synced to OKR.",
            { count: result.okrSync.syncedIndividualObjectiveCount },
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.googleAdsReportTargets.saveSuccess", "Targets saved."),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "COMPANY_OBJECTIVE_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.googleAdsReportTargets.companyObjectiveRequired",
            "Select a Company Objective before saving targets or assigning a PIC.",
          ),
        );
        return;
      }
      if (message === "PIC_REQUIRED_FOR_DEPARTMENT" || message === "PIC_DEPARTMENT_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.googleAdsReportTargets.picRequired",
            "Assign at least one PIC with a department before saving.",
          ),
        );
        return;
      }
      toast.error(
        t("digitalMarketing.googleAdsReportTargets.saveError", "Failed to save targets."),
      );
    }
  };

  const targetsLoading =
    targetsQuery.isLoading || assignmentsQuery.isLoading || periodSettingsQuery.isLoading;
  const inputsDisabled = !companyObjectiveId;
  const showActualsLoading = actualsLoading && !periodNotStarted && selectedMetrics.length > 0;
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
            {t("digitalMarketing.googleAdsReportTargets.periodType", "Period type")}
          </Label>
          <Select
            value={periodType}
            onValueChange={(v) => setPeriodType(v as GoogleAdsReportTargetPeriodType)}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">
                {t("digitalMarketing.googleAdsReportTargets.monthly", "Monthly")}
              </SelectItem>
              <SelectItem value="quarterly">
                {t("digitalMarketing.googleAdsReportTargets.quarterly", "Quarterly")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.googleAdsReportTargets.year", "Year")}
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
              {t("digitalMarketing.googleAdsReportTargets.month", "Month")}
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
              {t("digitalMarketing.googleAdsReportTargets.quarterLabel", "Quarter")}
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
            {t(
              "digitalMarketing.googleAdsReportTargets.companyObjectiveLabel",
              "Company Objective",
            )}{" "}
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
                  "digitalMarketing.googleAdsReportTargets.companyObjectivePlaceholder",
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

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          {t("digitalMarketing.googleAdsReportTargets.metricsLabel", "Metrics for this period")}
        </Label>
        <GoogleAdsReportTargetMetricPicker
          selectedMetrics={selectedMetrics}
          onChange={setSelectedMetrics}
          disabled={inputsDisabled}
        />
        {inputsDisabled ? (
          <p className="text-xs text-muted-foreground">
            {t(
              "digitalMarketing.googleAdsReportTargets.selectCompanyObjectiveHint",
              "Select a Company Objective to choose metrics and enter targets.",
            )}
          </p>
        ) : null}
      </div>

      {selectedMetrics.length > 0 && accounts.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t(
            "digitalMarketing.googleAdsReportTargets.noAccountsConnected",
            "No active Google Ads accounts found. Connect accounts in Digital Marketing → Google Ads settings first.",
          )}
        </p>
      ) : null}

      {selectedMetrics.length > 0 && accounts.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "digitalMarketing.googleAdsReportTargets.googleAdsOnlyHint",
            "All rows below are Google Ads customer accounts. Meta Ads and TikTok Ads targets are not available on this page yet — use the main Report tab to view their performance.",
          )}
        </p>
      ) : null}

      {selectedMetrics.length > 0 && accounts.length > 0 ? (
        <GoogleAdsReportTargetsTable
          accounts={accounts}
          selectedMetrics={selectedMetrics}
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
          onAssigneeChange={setAssignee}
          onCellChange={setCellValue}
        />
      ) : selectedMetrics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "digitalMarketing.googleAdsReportTargets.noMetricsSelected",
            "Add metrics above to configure targets per Google Ads account.",
          )}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saveTargets.isPending || selectedMetrics.length === 0}
        >
          {saveTargets.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("digitalMarketing.googleAdsReportTargets.save", "Save targets")}
        </Button>
      </div>
    </div>
  );
}
