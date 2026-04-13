import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile-app/components/ToolsNavigationFooter';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import MobileTaskInitiative, { InitiativeStats } from './section/MobileTaskInitiative';
import { DailyTaskProvider, useDailyTask } from '@/8-2-DailyTask/context/DailyTaskContext';
import { MeetingNotesProvider } from '@/8-1-meeting-notes/context/MeetingNotesContext';
import { InitiativePageSkeleton } from './InitiativePageSkeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { RefreshCw, Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const InitiativeContent = ({ isRefreshing = false }: { isRefreshing?: boolean }) => {
  const [, setInitiativeStats] = useState<InitiativeStats>({ totalItems: 0, unassignedItems: 0 });
  const [childLoading, setChildLoading] = useState(true);

  /* During pull-to-refresh do not show skeleton (avoid flicker). Show skeleton only on initial load. */
  const showSkeleton = childLoading && !isRefreshing;
  const hideContent = childLoading && !isRefreshing;
  return (
    <>
      {showSkeleton && <InitiativePageSkeleton />}
      <div className="flex flex-col" style={hideContent ? { display: 'none' } : undefined}>
        <MobileTaskInitiative onStatsChange={setInitiativeStats} onLoadingChange={setChildLoading} />
      </div>
    </>
  );
};

/**
 * Header + konten Initiative + pull-to-refresh. Tanpa `AppSidebar` / footer — dipakai di dalam shell `5-daily-task/DailyTaskPage` saat `?view=initiative`.
 */
function InitiativeScrollSurface({ children }: { children?: React.ReactNode }) {
  useStatusBarStyle('light');
  const { t } = useAppTranslation();
  const { tasks, refetchTasks, isLoading } = useDailyTask();
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
    if (didRecoveryRefetch.current || isLoading || tasks.length > 0) return;
    didRecoveryRefetch.current = true;
    refetchTasks().catch(() => {});
  }, [isLoading, tasks.length, refetchTasks]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetchTasks();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchTasks, isRefreshing]);

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

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground">
              {t('initiative.page.title', 'Initiative')}
            </h1>
            <p className="text-xs text-muted-foreground">{t('initiative.page.subtitle', 'Track initiative progress')}</p>
          </div>
        </div>
        <div className="shrink-0" />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={listScrollRef}
          className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
            style={{
              height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
              minHeight: 0,
              transition: isPulling ? 'none' : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
            ) : pullDistance >= PULL_THRESHOLD ? (
              <span className="whitespace-nowrap text-xs font-medium text-primary">
                {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
              </span>
            ) : (
              <RefreshCw
                className="h-5 w-5 shrink-0 opacity-80"
                style={{
                  transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                  transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                }}
                aria-hidden
              />
            )}
          </div>
          <div className="content-padding-above-nav-daily-task mx-auto w-full max-w-md space-y-1 px-2 pt-2">
            {children ?? <InitiativeContent isRefreshing={isRefreshing} />}
          </div>
        </div>
      </div>
    </>
  );
}

/** Layout penuh (sidebar + main fixed + footer) untuk route mandiri. */
const InitiativeStandaloneLayout = () => {
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();

  return (
    <div className="flex min-h-screen w-full min-w-0 bg-background">
      <AppSidebar />
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 max-w-none flex-col bg-background"
        style={mainFixedStyle}
      >
        <InitiativeScrollSurface />
        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
};

/**
 * Tab Initiative di tools (`/tools/daily-task?view=initiative`). Konten saja — shell sidebar/footer dari `5-daily-task/DailyTaskPage`.
 */
export function InitiativeMobileTab() {
  return <InitiativeScrollSurface />;
}

const InitiativePage = () => {
  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <DailyTaskProvider>
            <InitiativeStandaloneLayout />
          </DailyTaskProvider>
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default InitiativePage;
