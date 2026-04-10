import { useMemo, useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import type { Locale } from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/features/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/features/ui/tabs";
import { Alert, AlertDescription } from "@/features/ui/alert";
import { Button } from "@/features/ui/button";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { LoadingDots } from "@/components/LoadingDots";
import {
  DateRangeValue,
  JobDescEmployeeSummary,
  JobDescTimeframe,
} from "./types";
import { useJobDescAssignments } from "./useJobDescAssignments";
import { JobDescFilters } from "./JobDescFilters";
import { JobDescEmployeeCard } from "./JobDescEmployeeCard";
import { PendingApprovalSection } from "@/features/8-2-DailyTask/section/PendingApprovalSection";

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

interface JobDescTrackerProps {
  refetchRef?: React.MutableRefObject<(() => void) | null>;
}

export const JobDescTracker = ({ refetchRef }: JobDescTrackerProps) => {
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

  const { data, isLoading, isError, error, range, refetch, organizationId } = useJobDescAssignments({
    timeframe,
    customRange,
    includeOverdue,
  });

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
    <Card className="flex-1 min-h-0 flex flex-col border-0 shadow-none w-full">
      <CardHeader className="pb-2 pt-1 px-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t("dailyTask.jobDesc.title", "Job Desc Tracker")}</span>
          <button
            onClick={() => refetch()}
            className="text-xs text-indigo-600 hover:text-indigo-500"
          >
            {t("dailyTask.jobDesc.refresh", "Segarkan")}
          </button>
        </CardTitle>
        <p className="text-xs text-gray-500">
          {t("dailyTask.jobDesc.rangeLabel", "Rentang: {{range}}", {
            range: formatRangeLabel(range, dateLocale),
          })}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col p-0">
        {!organizationId ? (
          <div className="px-1 py-4 content-padding-above-nav-job-desc">
            <Alert>
              <AlertDescription className="text-xs">
                {t("dailyTask.jobDesc.noOrg", "Pilih organisasi atau tunggu organisasi dimuat.")}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
        <>
        <div className="px-1 mb-2 shrink-0">
          {renderFilters()}
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "overview" | "detail")}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-1 mb-2">
            <TabsList className="grid grid-cols-2 h-9 w-full">
              <TabsTrigger value="overview" className="text-xs">
                {t("dailyTask.jobDesc.tabs.overview", "Overview")}
              </TabsTrigger>
              <TabsTrigger value="detail" className="text-xs">
                {t("dailyTask.jobDesc.tabs.detail", "Detail")}
              </TabsTrigger>
            </TabsList>
          </div>

          {isError && (
            <div className="px-1 mb-2 flex flex-col gap-2">
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
            className="flex-1 min-h-0 overflow-y-auto seamless-scroll"
          >
            <div className="space-y-1 content-padding-above-nav-job-desc shrink-0">
              {isLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <LoadingDots />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                      <p className="text-[11px] text-indigo-700">
                        {t("dailyTask.jobDesc.metrics.activeAssignments", "Tugas Aktif")}
                      </p>
                      <p className="text-2xl font-semibold text-indigo-900">
                        {metrics.assignments}
                      </p>
                      <p className="text-[11px] text-indigo-600">
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
          </TabsContent>

          <TabsContent
            value="detail"
            className="flex-1 min-h-0 overflow-y-auto seamless-scroll"
          >
            <div className="space-y-1 content-padding-above-nav-job-desc shrink-0">
              {isLoading ? (
                <div className="py-6 flex items-center justify-center">
                  <LoadingDots />
                </div>
              ) : filteredSummaries.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-4 text-center text-xs text-gray-500">
                  {t("dailyTask.jobDesc.emptyState", "Belum ada tugas aktif pada rentang waktu ini")}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSummaries.map((summary) => (
                    <JobDescEmployeeCard key={summary.employeeId} summary={summary} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </>
        )}
      </CardContent>
    </Card>
  );
};

export default JobDescTracker;
