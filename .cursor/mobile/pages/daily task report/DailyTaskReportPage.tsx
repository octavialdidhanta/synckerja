import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DesktopWarning } from '@/mobile/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { AppSidebar } from '@/mobile/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile/components/ToolsNavigationFooter';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import { DailyTaskReportProvider, useDailyTaskReport } from '@/features/8-2-DailyTaskReport/context/ReportContext';
import { OverviewCards } from './components/OverviewCards';
import { PerformanceTable } from './components/PerformanceTable';
import { BlockersAndUpdatesPanel } from './components/BlockersAndUpdatesPanel';
import { Filters } from './components/Filters';
import { DailyTaskReportPageSkeleton } from './DailyTaskReportPageSkeleton';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { Button } from '@/features/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const DailyTaskReportScrollContent = () => {
  const { loading, refreshError, retryRefresh, refreshReport, performance } = useDailyTaskReport();
  const { t } = useAppTranslation();
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
    if (didRecoveryRefetch.current || loading || (performance?.length ?? 0) > 0) return;
    didRecoveryRefetch.current = true;
    refreshReport().catch(() => {});
  }, [loading, performance, refreshReport]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refreshReport();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshReport, isRefreshing]);

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
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  if (loading && !isRefreshing) {
    return <DailyTaskReportPageSkeleton />;
  }

  return (
    <>
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
        <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-daily-task-report space-y-1">
          {refreshError != null && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex flex-col gap-2">
              <p className="text-sm text-destructive font-medium">{t('dailyTaskReport.page.loadError', 'Failed to load report')}</p>
              <p className="text-xs text-muted-foreground">{refreshError}</p>
              <Button variant="default" size="sm" className="self-start" onClick={() => retryRefresh()}>
                {t('dailyTaskReport.page.retry', 'Retry')}
              </Button>
            </div>
          )}
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <Filters />
          </div>
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <OverviewCards />
          </div>
          <PerformanceTable />
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <BlockersAndUpdatesPanel />
          </div>
        </div>
      </div>
    </>
  );
};

const DailyTaskReportPage = () => {
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const { t } = useAppTranslation();

  return (
    <DesktopWarning>
      <SidebarProvider>
        <DailyTaskReportProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />

            {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc */}
            <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
              <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <div>
                    <h1 className="text-base font-semibold text-foreground">{t('dailyTaskReport.page.title', 'Daily Task Report')}</h1>
                    <p className="text-xs text-muted-foreground">{t('dailyTaskReport.page.subtitle', 'Ringkasan performa dan progress tugas')}</p>
                  </div>
                </div>
                <div></div>
              </header>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <DailyTaskReportScrollContent />
              </div>

              <ToolsNavigationFooter className="safe-area-bottom-lower" />
            </main>
          </div>
        </DailyTaskReportProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default DailyTaskReportPage;
