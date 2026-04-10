import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DesktopWarning } from '@/mobile/components/DesktopWarning';
import { SidebarProvider, SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { AppSidebar } from '@/mobile/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile/components/ToolsNavigationFooter';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import MobileTaskInitiative, { InitiativeStats } from './section/MobileTaskInitiative';
import { DailyTaskProvider, useDailyTask } from '@/features/8-2-DailyTask/DailyTaskContext';
import { MeetingNotesProvider } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { InitiativePageSkeleton } from './InitiativePageSkeleton';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { RefreshCw, Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

/** Layout per .cursor/rules/mobile-tools-layout-android.mdc */
const InitiativeLayout = ({ children }: { children?: React.ReactNode }) => {
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
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
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

        <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
        <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <div>
              <h1 className="text-base font-semibold text-foreground">{t('initiative.page.title', 'Initiative')}</h1>
              <p className="text-xs text-muted-foreground">{t('initiative.page.subtitle', 'Track initiative progress')}</p>
            </div>
          </div>
          <div></div>
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
            <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default space-y-1">
              {children ?? <InitiativeContent isRefreshing={isRefreshing} />}
            </div>
          </div>
        </div>

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>
    </div>
  );
};

const InitiativePage = () => {
  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <DailyTaskProvider>
            <InitiativeLayout />
          </DailyTaskProvider>
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

const InitiativeContent = ({ isRefreshing = false }: { isRefreshing?: boolean }) => {
  const [initiativeStats, setInitiativeStats] = useState<InitiativeStats>({ totalItems: 0, unassignedItems: 0 });
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

export default InitiativePage;

