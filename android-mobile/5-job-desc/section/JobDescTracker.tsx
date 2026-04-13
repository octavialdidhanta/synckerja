import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import type { Locale } from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  DateRangeValue,
  JobDescEmployeeSummary,
  JobDescTimeframe,
} from "./types";
import { useJobDescAssignments } from "./useJobDescAssignments";
import { JobDescFilters } from "./JobDescFilters";
import { JobDescEmployeeCard } from "./JobDescEmployeeCard";
import { PendingApprovalSection } from "@/8-2-DailyTask/section/PendingApprovalSection";

const formatRangeLabel = (range: DateRangeValue, locale: Locale) => {
  if (!range.start || !range.end) return "-";
  try {
    return `${format(range.start, "dd MMM", { locale })} - ${format(range.end, "dd MMM yyyy", { locale })}`;
  } catch (_error) {
    return "-";
  }
};

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Unknown";
};

const sortSummaries = (summaries: JobDescEmployeeSummary[]) => {
  return [...summaries].sort((a, b) => {
    if (a.idle !== b.idle) {
      return a.idle ? 1 : -1;
    }

    if (b.activeAssignments.length !== a.activeAssignments.length) {
      return b.activeAssignments.length - a.activeAssignments.length;
    }

    return (b.longestPendingHours ?? 0) - (a.longestPendingHours ?? 0);
  });
};

export interface JobDescPullTouchHandlers {
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
}

interface JobDescTrackerProps {
  refetchRef?: React.MutableRefObject<(() => void) | null>;
  /** Untuk overlay skeleton halaman: org bootstrap + fetch pertama job-desc. */
  onBlockingLoadChange?: (blocking: boolean) => void;
  /** Pull-to-refresh: handler di kedua area scroll tab (§1.1 mobile-tools-layout-android). */
  pullTouchHandlers?: JobDescPullTouchHandlers;
}

export const JobDescTracker = ({
  refetchRef,
  onBlockingLoadChange,
  pullTouchHandlers,
}: JobDescTrackerProps) => {
  const { t, language } = useAppTranslation();
  const dateLocale: Locale = language === "id" ? idLocale : enUS;
  const [timeframe, setTimeframe] = useState<JobDescTimeframe>("weekly");
  const [customRange, setCustomRange] = useState<DateRangeValue>({
    start: null,
    end: null,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showIdleOnly, setShowIdleOnly] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [includeOverdue, setIncludeOverdue] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "detail">("overview");
  const overviewScrollRef = useRef<HTMLDivElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overviewScrollRef.current?.scrollTo(0, 0);
    detailScrollRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  const { loading: orgLoading } = useCurrentOrg();
  const {
    data,
    isLoading,
    isError,
    error,
    range,
    refetch,
    organizationId,
    initialLoadPending,
  } = useJobDescAssignments({
    timeframe,
    customRange,
    includeOverdue,
  });

  const blockingLoad = orgLoading || initialLoadPending;

  useEffect(() => {
    onBlockingLoadChange?.(blockingLoad);
  }, [blockingLoad, onBlockingLoadChange]);

  useEffect(() => {
    if (refetchRef) refetchRef.current = refetch;
    return () => {
      if (refetchRef) refetchRef.current = null;
    };
  }, [refetch, refetchRef]);

  const summaries = data?.summaries ?? [];
  const filteredSummaries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortSummaries(
      summaries.filter((summary) => {
        if (selectedEmployeeId && summary.employeeId !== selectedEmployeeId) {
          return false;
        }
        if (showIdleOnly && !summary.idle) {
          return false;
        }
        if (!term) return true;
        const matchesEmployee =
          summary.name.toLowerCase().includes(term) ||
          (summary.jobTitle ?? "").toLowerCase().includes(term);
        if (matchesEmployee) return true;
        return summary.assignments.some((assignment) => {
          return (
            assignment.title.toLowerCase().includes(term) ||
            assignment.taskTitle.toLowerCase().includes(term)
          );
        });
      }),
    );
  }, [summaries, searchTerm, selectedEmployeeId, showIdleOnly]);

  const metrics = useMemo(() => {
    if (!filteredSummaries.length) {
      return {
        busy: 0,
        idle: 0,
        assignments: 0,
        pendingDays: 0,
      };
    }
    const busy = filteredSummaries.filter((summary) => !summary.idle).length;
    const idle = filteredSummaries.length - busy;
    const assignments = filteredSummaries.reduce(
      (sum, summary) => sum + summary.activeAssignments.length,
      0,
    );
    const pendingHoursAvg =
      filteredSummaries.reduce((sum, summary) => sum + summary.longestPendingHours, 0) /
      filteredSummaries.length;
    return {
      busy,
      idle,
      assignments,
      pendingDays: Math.round((pendingHoursAvg || 0) / 24),
    };
  }, [filteredSummaries]);

  const renderFilters = () => (
    <JobDescFilters
      timeframe={timeframe}
      onTimeframeChange={setTimeframe}
      searchTerm={searchTerm}
      onSearchTermChange={setSearchTerm}
      showIdleOnly={showIdleOnly}
      onShowIdleOnlyChange={setShowIdleOnly}
      includeOverdue={includeOverdue}
      onIncludeOverdueChange={setIncludeOverdue}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      employees={summaries}
      selectedEmployeeId={selectedEmployeeId}
      onEmployeeChange={setSelectedEmployeeId}
    />
  );

  return (
    <Card className="flex w-full min-h-0 flex-1 flex-col border-0 shadow-none">
      <CardHeader className="px-0 pb-2 pt-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t("dailyTask.jobDesc.title", "Job Desc Tracker")}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            {t("dailyTask.jobDesc.refresh", "Segarkan")}
          </button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("dailyTask.jobDesc.rangeLabel", "Rentang: {{range}}", {
            range: formatRangeLabel(range, dateLocale),
          })}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        {!organizationId ? (
          <div className="content-padding-above-nav-job-desc px-0 py-4">
            <Alert>
              <AlertDescription className="text-xs">
                {t("dailyTask.jobDesc.noOrg", "Pilih organisasi atau tunggu organisasi dimuat.")}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-1">
        <div className="shrink-0 px-0">
          {renderFilters()}
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "overview" | "detail")}
          className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
        >
          <div className="shrink-0 px-0">
            <TabsList className="grid h-9 w-full grid-cols-2">
              <TabsTrigger
                value="overview"
                className="text-xs data-[state=active]:font-semibold data-[state=active]:text-primary"
              >
                {t("dailyTask.jobDesc.tabs.overview", "Overview")}
              </TabsTrigger>
              <TabsTrigger
                value="detail"
                className="text-xs data-[state=active]:font-semibold data-[state=active]:text-primary"
              >
                {t("dailyTask.jobDesc.tabs.detail", "Detail")}
              </TabsTrigger>
            </TabsList>
          </div>

          {isError && (
            <div className="flex shrink-0 flex-col space-y-1 px-0">
              <Alert>
                <AlertDescription className="text-xs">
                  {t("dailyTask.jobDesc.error", "Tidak dapat memuat data: {{message}}", {
                    message: getErrorMessage(error),
                  })}
                </AlertDescription>
              </Alert>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t("mobileHome.retry", "Coba lagi")}
              </Button>
            </div>
          )}

          <TabsContent
            value="overview"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none ring-0 data-[state=inactive]:hidden focus-visible:ring-0"
          >
            <div
              ref={overviewScrollRef}
              onTouchStart={pullTouchHandlers?.onTouchStart}
              onTouchMove={pullTouchHandlers?.onTouchMove}
              onTouchEnd={pullTouchHandlers?.onTouchEnd}
              className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="content-padding-above-nav-job-desc flex w-full min-w-0 flex-col space-y-1 px-0 pb-1">
              {isLoading ? null : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                      <p className="text-[11px] text-primary">
                        {t("dailyTask.jobDesc.metrics.activeAssignments", "Tugas Aktif")}
                      </p>
                      <p className="text-2xl font-semibold text-foreground">
                        {metrics.assignments}
                      </p>
                      <p className="text-[11px] text-primary/90">
                        {t("dailyTask.jobDesc.metrics.busyEmployees", "{{count}} karyawan sibuk", {
                          count: metrics.busy,
                        })}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      <p className="text-[11px] text-emerald-700">
                        {t("dailyTask.jobDesc.metrics.idleEmployees", "Karyawan Idle")}
                      </p>
                      <p className="text-2xl font-semibold text-emerald-900">
                        {metrics.idle}
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        {t("dailyTask.jobDesc.metrics.avgPendingDays", "Rata-rata pending {{days}} hari", {
                          days: metrics.pendingDays,
                        })}
                      </p>
                    </div>
                  </div>
                  <PendingApprovalSection variant="jobdesc-overview" />
                </>
              )}
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="detail"
            className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none ring-0 data-[state=inactive]:hidden focus-visible:ring-0"
          >
            <div
              ref={detailScrollRef}
              onTouchStart={pullTouchHandlers?.onTouchStart}
              onTouchMove={pullTouchHandlers?.onTouchMove}
              onTouchEnd={pullTouchHandlers?.onTouchEnd}
              className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="content-padding-above-nav-job-desc flex w-full min-w-0 flex-col space-y-1 px-0 pb-1">
              {isLoading ? null : filteredSummaries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {t("dailyTask.jobDesc.emptyState", "Belum ada tugas aktif pada rentang waktu ini")}
                </div>
              ) : (
                <div className="flex w-full min-w-0 flex-col space-y-1">
                  {filteredSummaries.map((summary) => (
                    <JobDescEmployeeCard key={summary.employeeId} summary={summary} />
                  ))}
                </div>
              )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobDescTracker;
