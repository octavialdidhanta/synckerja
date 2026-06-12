import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InsightTargetsTable } from "@/6-0-social-media-report/components/InsightTargetsTable";
import { useSocialMediaInsightPeriodActuals } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightPeriodActuals";
import { useSocialMediaInsightTargetAccounts } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAccounts";
import { useInsightPeriodCompanyObjectives } from "@/6-0-social-media-performance-shared/hooks/useInsightPeriodCompanyObjectives";
import { useSocialMediaInsightPeriodSettingsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightPeriodSettingsQuery";
import { useSocialMediaInsightTargetAssignmentsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAssignmentsQuery";
import { useSocialMediaInsightTargetsMutations } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsMutations";
import { useSocialMediaInsightTargetsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsQuery";
import { requiresCompanyObjectiveForSave } from "@/6-0-social-media-performance-shared/insightTargetSaveValidation";
import {
  insightTargetAccountKey,
  insightTargetCellKey,
  type InsightTargetAccountAssignment,
  type InsightTargetAccountRef,
  type InsightTargetFormValue,
  type InsightTargetMetric,
  type InsightTargetPeriodKey,
  type InsightTargetPeriodType,
  type SocialMediaInsightTargetAssignmentRow,
  type SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { useAvailableEmployees } from "@/shared/hooks/useAvailableEmployees";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const QUARTERS = [1, 2, 3, 4] as const;

function rowsToAssignmentsMap(
  rows: SocialMediaInsightTargetAssignmentRow[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[insightTargetAccountKey(row.platform, row.account_id)] = row.employee_id;
  }
  return map;
}

function rowsToFormMap(rows: SocialMediaInsightTargetRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    const accountId = row.account_id?.trim();
    if (!accountId) continue;
    map[insightTargetCellKey(row.platform, accountId, row.metric)] = String(value);
  }
  return map;
}

type Props = {
  initialPeriod?: Partial<InsightTargetPeriodKey>;
};

export function InsightTargetsSettingsForm({ initialPeriod }: Props) {
  const { t } = useAppTranslation();
  const { user } = useCurrentUser();
  const now = new Date();
  const currentYear = now.getFullYear();

  const [periodType, setPeriodType] = useState<InsightTargetPeriodType>(
    initialPeriod?.periodType ?? "monthly",
  );
  const [year, setYear] = useState(initialPeriod?.year ?? currentYear);
  const [month, setMonth] = useState(initialPeriod?.month ?? now.getMonth() + 1);
  const [quarter, setQuarter] = useState(initialPeriod?.quarter ?? Math.floor(now.getMonth() / 3) + 1);
  const [formMap, setFormMap] = useState<Record<string, string>>({});
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, string>>({});
  const [companyObjectiveId, setCompanyObjectiveId] = useState<string>("");

  const periodKey: InsightTargetPeriodKey = useMemo(() => {
    if (periodType === "monthly") {
      return { periodType, year, month };
    }
    return { periodType, year, quarter };
  }, [periodType, year, month, quarter]);

  const { accountsByPlatform, accounts, isLoading: accountsListLoading } =
    useSocialMediaInsightTargetAccounts();
  const targetsQuery = useSocialMediaInsightTargetsQuery(periodKey);
  const assignmentsQuery = useSocialMediaInsightTargetAssignmentsQuery(periodKey);
  const periodSettingsQuery = useSocialMediaInsightPeriodSettingsQuery(periodKey);
  const {
    objectives: companyObjectives,
    isLoading: companyObjectivesLoading,
    hasMatchingCycle,
  } = useInsightPeriodCompanyObjectives(periodKey);
  const { data: employees = [], isLoading: employeesLoading } = useAvailableEmployees();
  const {
    getAccountActuals,
    actualsByAccount,
    inProgress,
    periodNotStarted,
    isLoading: actualsLoading,
    wasDateClamped,
  } = useSocialMediaInsightPeriodActuals(periodKey);
  const { saveTargets } = useSocialMediaInsightTargetsMutations();

  const actualLabel = inProgress
    ? t("digitalMarketing.socialMediaInsightTargets.currentLabel", "Current")
    : t("digitalMarketing.socialMediaInsightTargets.actualLabel", "Actual");

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
  }, [periodType, year, month, quarter]);

  useEffect(() => {
    if (periodSettingsQuery.data?.company_objective_id) {
      setCompanyObjectiveId(periodSettingsQuery.data.company_objective_id);
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
    (account: InsightTargetAccountRef, metric: InsightTargetMetric, raw: string) => {
      const key = insightTargetCellKey(account.platform, account.accountId, metric);
      setFormMap((prev) => ({ ...prev, [key]: raw }));
    },
    [],
  );

  const setAssignee = useCallback(
    (account: InsightTargetAccountRef, employeeId: string | null) => {
      const key = insightTargetAccountKey(account.platform, account.accountId);
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
        t("digitalMarketing.socialMediaInsightTargets.authRequired", "Sign in to save targets."),
      );
      return;
    }
    const values: InsightTargetFormValue[] = [];
    for (const account of accounts) {
      for (const metric of [
        "audience",
        "views",
        "likes",
        "comments",
        "shares",
        "avg_engagement_rate",
      ] as const) {
        const raw =
          formMap[insightTargetCellKey(account.platform, account.accountId, metric)]?.trim() ??
          "";
        if (!raw) continue;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast.error(
            t(
              "digitalMarketing.socialMediaInsightTargets.invalidValue",
              "Enter a valid non-negative number for all targets.",
            ),
          );
          return;
        }
        values.push({
          platform: account.platform,
          accountId: account.accountId,
          metric,
          targetValue: parsed,
        });
      }
    }

    const assignments: InsightTargetAccountAssignment[] = [];
    for (const account of accounts) {
      const employeeId =
        assignmentsMap[insightTargetAccountKey(account.platform, account.accountId)];
      if (employeeId) {
        assignments.push({
          platform: account.platform,
          accountId: account.accountId,
          employeeId,
        });
      }
    }

    const accountActuals = new Map(
      Object.entries(actualsByAccount).map(([k, v]) => [k, v]),
    );

    const needsCompanyObjective = requiresCompanyObjectiveForSave(values, assignments);
    if (needsCompanyObjective && !companyObjectiveId) {
      toast.error(
        t(
          "digitalMarketing.socialMediaInsightTargets.companyObjectiveRequired",
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
        accountActuals,
        createdBy: user.id,
        companyObjectiveId: companyObjectiveId || null,
      });

      if (result.okrSync.skippedNoCycle) {
        toast.warning(
          t(
            "digitalMarketing.socialMediaInsightTargets.okrNoCycle",
            "Targets saved. No matching OKR cycle — Individual Objectives were not synced.",
          ),
        );
      } else if (result.okrSync.syncedIndividualObjectiveCount > 0) {
        toast.success(
          t(
            "digitalMarketing.socialMediaInsightTargets.saveSuccessWithOkr",
            "{{count}} Individual Objectives synced to OKR.",
            { count: result.okrSync.syncedIndividualObjectiveCount },
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.socialMediaInsightTargets.saveSuccess", "Targets saved."),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "COMPANY_OBJECTIVE_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.socialMediaInsightTargets.companyObjectiveRequired",
            "Select a Company Objective before saving targets or assigning a PIC.",
          ),
        );
        return;
      }
      if (message === "PIC_REQUIRED_FOR_DEPARTMENT" || message === "PIC_DEPARTMENT_REQUIRED") {
        toast.error(
          t(
            "digitalMarketing.socialMediaInsightTargets.picRequired",
            "Assign at least one PIC with a department before saving.",
          ),
        );
        return;
      }
      toast.error(
        t("digitalMarketing.socialMediaInsightTargets.saveError", "Failed to save targets."),
      );
    }
  };

  const targetsLoading =
    targetsQuery.isLoading || assignmentsQuery.isLoading || periodSettingsQuery.isLoading;
  const inputsDisabled = !companyObjectiveId;
  const showActualsLoading = actualsLoading && !periodNotStarted;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.socialMediaInsightTargets.periodType", "Period type")}
          </Label>
          <Select
            value={periodType}
            onValueChange={(v) => setPeriodType(v as InsightTargetPeriodType)}
          >
            <SelectTrigger className="h-9 w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">
                {t("digitalMarketing.socialMediaInsightTargets.monthly", "Monthly")}
              </SelectItem>
              <SelectItem value="quarterly">
                {t("digitalMarketing.socialMediaInsightTargets.quarterly", "Quarterly")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("digitalMarketing.socialMediaInsightTargets.year", "Year")}
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
              {t("digitalMarketing.socialMediaInsightTargets.month", "Month")}
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
              {t("digitalMarketing.socialMediaInsightTargets.quarterLabel", "Quarter")}
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
              "digitalMarketing.socialMediaInsightTargets.companyObjectiveLabel",
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
                  "digitalMarketing.socialMediaInsightTargets.companyObjectivePlaceholder",
                  "Select company objective",
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {companyObjectivesLoading ? (
                <SelectItem value="__loading__" disabled>
                  {t(
                    "digitalMarketing.socialMediaInsightTargets.companyObjectiveLoading",
                    "Loading…",
                  )}
                </SelectItem>
              ) : (
                companyObjectives.map((obj) => (
                  <SelectItem key={obj.id} value={obj.id}>
                    {obj.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!hasMatchingCycle && !companyObjectivesLoading ? (
        <p className="rounded bg-warning-muted p-2 text-xs text-warning-foreground">
          {t(
            "digitalMarketing.socialMediaInsightTargets.companyObjectiveNoCycle",
            "No matching OKR cycle for this period. Create an OKR cycle first, then add Company Objectives in the OKR tab.",
          )}
        </p>
      ) : null}
      {companyObjectives.length === 0 && hasMatchingCycle && !companyObjectivesLoading ? (
        <p className="rounded bg-warning-muted p-2 text-xs text-warning-foreground">
          {t(
            "digitalMarketing.socialMediaInsightTargets.companyObjectiveEmpty",
            "No active Company Objectives for this period. Create one in the Company Objective OKR tab first.",
          )}
        </p>
      ) : null}
      {wasDateClamped ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "digitalMarketing.socialMediaInsightTargets.actualsClampedHint",
            "TikTok data may be limited to the last 365 days.",
          )}
        </p>
      ) : null}

      {accountsListLoading ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-4 flex-1 min-w-[3rem]" />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mx-3 my-2 h-[3.25rem] w-[calc(100%-1.5rem)]" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-muted-foreground">
          {t(
            "digitalMarketing.socialMediaInsightTargets.noAccountsConnected",
            "Connect TikTok, YouTube, or LinkedIn accounts in settings to set targets.",
          )}
        </p>
      ) : (
        <InsightTargetsTable
          accountsByPlatform={accountsByPlatform}
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
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={
            targetsLoading ||
            saveTargets.isPending ||
            accounts.length === 0 ||
            inputsDisabled
          }
        >
          {saveTargets.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("digitalMarketing.socialMediaInsightTargets.save", "Save targets")}
        </Button>
      </div>
    </div>
  );
}
