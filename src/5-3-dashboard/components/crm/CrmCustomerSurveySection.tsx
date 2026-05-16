import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ConversationSummaryPeriodKey } from "@/5-3-dashboard/components/crm/crmConversationSummaryMetrics";
import {
  computeSurveyPromoterStatus,
  MIN_SURVEY_RESPONSES_FOR_STATUS,
  type SurveyPromoterStatusKind,
} from "@/features/customer-survey/core/surveyPromoterTarget";
import type { CrmCustomerSurveyAssigneeRow } from "@/features/customer-survey/hooks/useCrmCustomerSurveySummary";
import { useCrmCustomerSurveySummary } from "@/features/customer-survey/hooks/useCrmCustomerSurveySummary";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { AssigneeSurveyTargetCell } from "@/5-3-dashboard/components/crm/AssigneeSurveyTargetCell";
import { SurveyPromoterStatusBadge } from "@/5-3-dashboard/components/crm/SurveyPromoterStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/utils";

function periodMenuLabel(
  key: ConversationSummaryPeriodKey,
  t: (k: string, d?: string, o?: Record<string, string | number>) => string,
): string {
  if (key === "all") return t("crm.customerSurvey.periodAll", "All time");
  return t("crm.customerSurvey.periodDays", "Last {{days}} days", { days: Number(key) });
}

function ScoreBars({
  counts,
  total,
  dense,
}: {
  counts: Record<string, number>;
  total: number;
  dense?: boolean;
}) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className={cn("flex flex-col gap-2", dense ? "mt-1" : "mt-3")}>
      {(["1", "2", "3", "4", "5"] as const).map((k) => {
        const n = counts[k] ?? 0;
        const pct = Math.round((100 * n) / safeTotal);
        return (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-4 shrink-0 font-medium text-muted-foreground">{k}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

type AssigneeSortCol = "assignee_name" | "response_count" | "promoter_pct" | "target_promoter_pct" | "status";

const STATUS_SORT_RANK: Record<SurveyPromoterStatusKind, number> = {
  insufficient_data: 0,
  no_target: 1,
  failed: 2,
  achieve: 3,
};

function compareAssigneeRows(
  a: CrmCustomerSurveyAssigneeRow,
  b: CrmCustomerSurveyAssigneeRow,
  col: AssigneeSortCol,
): number {
  switch (col) {
    case "assignee_name":
      return a.assignee_name.localeCompare(b.assignee_name, undefined, { sensitivity: "base" });
    case "response_count":
      return a.response_count - b.response_count;
    case "promoter_pct":
      return a.promoter_pct - b.promoter_pct;
    case "target_promoter_pct":
      return a.target_promoter_pct - b.target_promoter_pct;
    case "status": {
      const ra = STATUS_SORT_RANK[computeSurveyPromoterStatus(a.response_count, a.promoter_pct, a.target_promoter_pct)];
      const rb = STATUS_SORT_RANK[computeSurveyPromoterStatus(b.response_count, b.promoter_pct, b.target_promoter_pct)];
      return ra - rb;
    }
    default:
      return 0;
  }
}

export function CrmCustomerSurveySection() {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { canManage } = useOmnichannelSurveySettingsAdmin();
  const [period, setPeriod] = useState<ConversationSummaryPeriodKey>("30");
  const [sort, setSort] = useState<{ col: AssigneeSortCol; dir: "asc" | "desc" }>({
    col: "response_count",
    dir: "desc",
  });
  const { data, isPending, isError, error } = useCrmCustomerSurveySummary(organizationId, period);

  const total = data?.total_responses ?? 0;

  const subtitle = useMemo(() => periodMenuLabel(period, t), [period, t]);

  const sortedAssignees = useMemo(() => {
    if (!data?.by_assignee.length) return [];
    const copy = [...data.by_assignee];
    const mult = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => mult * compareAssigneeRows(a, b, sort.col));
    return copy;
  }, [data?.by_assignee, sort]);

  const toggleSort = useCallback((col: AssigneeSortCol) => {
    setSort((s) => {
      if (s.col === col) return { col, dir: s.dir === "asc" ? "desc" : "asc" };
      const defaultDesc =
        col === "response_count" || col === "promoter_pct" || col === "target_promoter_pct";
      return { col, dir: defaultDesc ? "desc" : "asc" };
    });
  }, []);

  const SortBtn = useCallback(
    ({ col, label, align = "start" }: { col: AssigneeSortCol; label: string; align?: "start" | "end" }) => {
      const active = sort.col === col;
      const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
      return (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "inline-flex h-8 gap-1 px-2 font-medium text-foreground hover:bg-muted/80",
            align === "end" ? "-mr-2" : "-ml-2",
          )}
          onClick={() => toggleSort(col)}
          aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        >
          {label}
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      );
    },
    [sort, toggleSort],
  );

  if (!organizationId) return null;

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      aria-label={t("crm.customerSurvey.sectionAria", "Customer survey CES")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">
            {t("crm.customerSurvey.title", "Survei pelanggan (WhatsApp)")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as ConversationSummaryPeriodKey)}>
          <SelectTrigger className="h-8 w-[160px]" aria-label={t("crm.customerSurvey.periodLabel", "Period")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["7", "30", "90", "all"] as const).map((k) => (
              <SelectItem key={k} value={k}>
                {periodMenuLabel(k, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}

      {isError ? (
        <p className="mt-4 text-sm text-destructive">
          {t("crm.customerSurvey.loadError", "Could not load survey metrics.")}
          {import.meta.env.DEV && error instanceof Error && error.message.includes("RPC is not deployed") ? (
            <span className="mt-1 block text-xs opacity-90">{error.message}</span>
          ) : null}
        </p>
      ) : null}

      {!isPending && !isError && data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border/80 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("crm.customerSurvey.promoterPct", "% promoters")}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {data.promoter_pct}%
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("crm.customerSurvey.promoterMinHint", "(rating ≥ {{min}})", {
                  min: data.promoter_min_rating,
                })}
              </span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("crm.customerSurvey.totalResponses", "{{count}} responses", { count: total })}
            </p>
          </div>

          <div className="rounded-md border border-border/80 bg-muted/10 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("crm.customerSurvey.scoreDistribution", "Scores 1–5")}
            </p>
            <ScoreBars counts={data.counts_by_rating} total={total} />
          </div>

          <div className="lg:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("crm.customerSurvey.byAssignee", "Per agent")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("crm.customerSurvey.minResponsesHint", "At least {{count}} responses in the period to evaluate status", {
                count: data.min_responses_for_status ?? MIN_SURVEY_RESPONSES_FOR_STATUS,
              })}
            </p>
            <div className="mt-2 overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">
                      <SortBtn col="assignee_name" label={t("crm.customerSurvey.colAgent", "Agent")} />
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <SortBtn
                          col="response_count"
                          label={t("crm.customerSurvey.colResponses", "Responses")}
                          align="end"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <SortBtn
                          col="promoter_pct"
                          label={t("crm.customerSurvey.colPromoterPct", "% promoters")}
                          align="end"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <SortBtn
                          col="target_promoter_pct"
                          label={t("crm.customerSurvey.colTargetPct", "Target % promoters")}
                          align="end"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      <div className="flex justify-end">
                        <SortBtn col="status" label={t("crm.customerSurvey.colStatus", "Status")} align="end" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_assignee.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        {t("crm.customerSurvey.empty", "No responses in this period.")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAssignees.map((row) => (
                      <TableRow key={row.assignee_id ?? row.assignee_name}>
                        <TableCell className="font-medium">{row.assignee_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.response_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.promoter_pct}%</TableCell>
                        <TableCell className="text-right">
                          {organizationId ? (
                            <AssigneeSurveyTargetCell
                              organizationId={organizationId}
                              assigneeId={row.assignee_id}
                              targetPct={row.target_promoter_pct}
                              hasAssigneeOverride={row.has_assignee_override}
                              canEdit={canManage}
                            />
                          ) : (
                            <span className="tabular-nums">{row.target_promoter_pct}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <SurveyPromoterStatusBadge
                            responseCount={row.response_count}
                            promoterPct={row.promoter_pct}
                            targetPct={row.target_promoter_pct}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
