import { NavigationFooter } from "@/mobile/components/NavigationFooter";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { ReportsSkeleton } from "./ReportsSkeleton";
import { useAttendanceHistory } from "@/mobile/hooks/useAttendanceHistory";
import { useAttendanceStats } from "@/mobile/hooks/useAttendanceStats";
import { useAttendanceCalculations } from "@/mobile/hooks/useAttendanceCalculations";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { AttendanceHistoryTable } from "@/mobile/components/AttendanceHistoryTable";
import { MonthlyStatsCards } from "@/mobile/components/MonthlyStatsCards";
import { DetailedStatsCard } from "@/mobile/components/DetailedStatsCard";
import { WorkTimeAnalysisCard } from "@/mobile/components/WorkTimeAnalysisCard";
import { AttendanceChart } from "@/mobile/components/AttendanceChart";
import { RealtimeStatusIndicator } from "@/mobile/components/RealtimeStatusIndicator";
import { CustomDatePicker } from "@/mobile/components/CustomDatePicker";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, isWithinInterval, format } from "date-fns";
import { Button } from "@/features/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile/components/ui/drawer";
import { ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const Reports = () => {
  useStatusBarStyle("light");
  const { t, language } = useAppTranslation();
  const {
    stats: attendanceStats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats
  } = useAttendanceStats({ skipAttendanceRealtime: true });
  const {
    attendanceHistory,
    loading,
    error,
    realtimeConnected,
    refetch
  } = useAttendanceHistory({ onRealtimeRefetch: refetchStats });
  const [dateFilter, setDateFilter] = useState("this_month");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{start: Date; end: Date} | null>(null);
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const didRecoveryRefetch = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    if (didRecoveryRefetch.current || loading || statsLoading) return;
    const hasData = (attendanceHistory?.length ?? 0) > 0 || attendanceStats != null;
    if (hasData) return;
    didRecoveryRefetch.current = true;
    Promise.all([refetch(), refetchStats()]).catch(() => {});
  }, [loading, statsLoading, attendanceHistory, attendanceStats, refetch, refetchStats]);

  // Handle date filter change
  const handleDateFilterChange = (value: string) => {
    if (value === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setDateFilter(value);
    }
  };

  // Handle custom date range selection
  const handleCustomDateRange = (startDate: Date, endDate: Date) => {
    setCustomDateRange({ start: startDate, end: endDate });
    setDateFilter("custom");
  };

  const periodOptions: { value: string; labelKey: string }[] = [
    { value: "today", labelKey: "reports.dateFilter.today" },
    { value: "yesterday", labelKey: "reports.dateFilter.yesterday" },
    { value: "this_week", labelKey: "reports.dateFilter.thisWeek" },
    { value: "this_month", labelKey: "reports.dateFilter.thisMonth" },
    { value: "last_month", labelKey: "reports.dateFilter.lastMonth" },
    { value: "custom", labelKey: "reports.dateFilter.custom" },
  ];
  const selectedPeriod = periodOptions.find((o) => o.value === dateFilter);
  const periodLabel = selectedPeriod ? t(selectedPeriod.labelKey, dateFilter) : t("reports.dateFilter.thisMonth", "This Month");

  // Date range based on filter selection
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return {
          start: startOfDay(yesterday),
          end: endOfDay(yesterday)
        };
      case "this_week":
        return {
          start: startOfWeek(now, {
            weekStartsOn: 1
          }),
          end: endOfWeek(now, {
            weekStartsOn: 1
          })
        };
      case "this_month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      case "custom":
        // Use custom date range if available, otherwise default to current month
        if (customDateRange) {
          return {
            start: startOfDay(customDateRange.start),
            end: endOfDay(customDateRange.end)
          };
        }
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  }, [dateFilter, customDateRange]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await Promise.all([refetch(), refetchStats()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, refetchStats, isRefreshing]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      handlePullRefresh();
    }
  }, [handlePullRefresh]);

  // Filter attendance data based on selected date range
  const filteredAttendanceHistory = useMemo(() => {
    if (!attendanceHistory || attendanceHistory.length === 0) return [];
    return attendanceHistory.filter(record => {
      const recordDate = new Date(record.attendance_date);
      return isWithinInterval(recordDate, dateRange);
    });
  }, [attendanceHistory, dateRange]);

  // Use the custom hook for calculations
  const {
    filteredStats,
    chartData
  } = useAttendanceCalculations({
    attendanceHistory: filteredAttendanceHistory,
    language
  });

  const { mainFixedStyle } = useVisualViewport();

  return (
    <DesktopWarning>
      <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc */}
        <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
          <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <div>
                <h1 className="text-base font-semibold text-foreground">{t("reports.pageTitle", "Reports")}</h1>
                <p className="text-xs text-muted-foreground">{t("reports.pageSubtitle", "Statistik kehadiran dan laporan")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RealtimeStatusIndicator
                isConnected={realtimeConnected}
                className="text-xs md:hidden"
              />
              <div className="hidden md:block">
                <RealtimeStatusIndicator isConnected={realtimeConnected} />
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
              ref={listScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
                style={{
                  height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                  minHeight: 0,
                  transition: isPulling ? 'none' : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              >
                {isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
                ) : pullDistance >= PULL_THRESHOLD ? (
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
                  </span>
                ) : (
                  <RefreshCw
                    className="h-5 w-5 opacity-80 shrink-0"
                    style={{
                      transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                      transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                    }}
                    aria-hidden
                  />
                )}
              </div>
              {error && !loading ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default">
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-1">{t("reports.error", "Error")}</p>
                    <p className="text-sm text-muted-foreground mb-3">{error}</p>
                    <Button variant="default" size="sm" onClick={() => refetch()}>
                      {t("mobileHome.retry", "Coba lagi")}
                    </Button>
                  </div>
                </div>
              ) : statsError && !statsLoading ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default">
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-1">{t("reports.error", "Error")}</p>
                    <p className="text-sm text-muted-foreground mb-3">{statsError}</p>
                    <Button variant="default" size="sm" onClick={() => refetchStats()}>
                      {t("mobileHome.retry", "Coba lagi")}
                    </Button>
                  </div>
                </div>
              ) : ((loading || statsLoading) && !isRefreshing) ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default">
                  <ReportsSkeleton />
                </div>
              ) : (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default space-y-1">
                  <div>
                    <MonthlyStatsCards
                      totalWorkingDays={attendanceStats?.total_working_days || 0}
                      attendancePercentage={attendanceStats?.attendance_percentage || 0}
                      statsLoading={statsLoading}
                    />
                  </div>

                  <div>
                    <DetailedStatsCard
                      presentDays={attendanceStats?.present_days || 0}
                      lateDays={attendanceStats?.late_days || 0}
                      absentDays={attendanceStats?.absent_days || 0}
                      totalOvertime={filteredStats.totalOvertime}
                      statsLoading={statsLoading}
                      headerAction={
                        <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
                          <DrawerTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-32 h-8 text-xs justify-between gap-1 px-2"
                            >
                              <span className="truncate min-w-0">{periodLabel}</span>
                              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            </Button>
                          </DrawerTrigger>
                          <DrawerContent className="max-h-[85dvh] flex flex-col">
                            <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                              <DrawerTitle className="text-lg font-semibold">
                                {t("reports.statsPeriodSelected", "Selected Period Stats")}
                              </DrawerTitle>
                            </DrawerHeader>
                            <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                              <div className="flex flex-col gap-2 w-full">
                                {periodOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      handleDateFilterChange(opt.value);
                                      setPeriodDrawerOpen(false);
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors",
                                      dateFilter === opt.value
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background border-input hover:bg-muted"
                                    )}
                                  >
                                    {t(opt.labelKey, opt.value)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                              <DrawerClose asChild>
                                <Button className="w-full" size="sm">
                                  {t("dailyTaskReport.filters.done", "Done")}
                                </Button>
                              </DrawerClose>
                            </div>
                          </DrawerContent>
                        </Drawer>
                      }
                    />
                  </div>

                  <div>
                    <AttendanceHistoryTable
                      attendanceHistory={filteredAttendanceHistory}
                      loading={loading}
                      error={error}
                    />
                  </div>

                  <div>
                    <WorkTimeAnalysisCard
                      avgCheckIn={filteredStats.avgCheckIn}
                      avgCheckOut={filteredStats.avgCheckOut}
                      workingHours={filteredStats.workingHours}
                      workingMinutesRemainder={filteredStats.workingMinutesRemainder}
                    />
                  </div>

                  <div>
                    <AttendanceChart chartData={chartData} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Spacer so content doesn't scroll under the fixed footer */}
          <NavigationFooter className="safe-area-bottom-lower" />
        </main>

        <CustomDatePicker
          isOpen={showCustomDatePicker}
          onClose={() => setShowCustomDatePicker(false)}
          onDateRangeSelect={handleCustomDateRange}
          initialStartDate={customDateRange?.start}
          initialEndDate={customDateRange?.end}
        />
      </div>
    </SidebarProvider>
    </DesktopWarning>
  );
};

export default Reports;
