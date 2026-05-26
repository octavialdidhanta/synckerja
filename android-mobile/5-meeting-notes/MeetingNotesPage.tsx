import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DesktopWarning } from '@/mobile-app/components/DesktopWarning';
import { SidebarProvider } from '@/mobile-app/components/ui/sidebar';
import { AppSidebar } from '@/mobile-app/components/AppSidebar';
import { ToolsNavigationFooter } from '@/mobile-app/components/ToolsNavigationFooter';
import { ToolsMobileShellHeader } from '@/mobile-app/components/ToolsMobileShellHeader';
import { ToolsMobileDenyGateArea } from '@/mobile-app/components/ToolsMobileDenyGateArea';
import { useToolsMobilePageAccess } from '@/mobile-app/hooks/useToolsMobilePageAccess';
import { useVisualViewport } from '@/shared/hooks/useVisualViewport';
import { useStatusBarStyle } from '@/shared/hooks/useStatusBarStyle';
import { MeetingNotesProvider, useMeetingNotes } from '@/8-1-meeting-notes/context/MeetingNotesContext';
import { MeetingNotesContent } from './section/MeetingNotesContent';
import { MobileToolsMeetingNotesPageSkeletonOverlay } from './pages/MobileToolsMeetingNotesPageSkeletonOverlay';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { MOBILE_PAGE_PATH } from '@/shared/auth/page-access/mobileRoutePagePaths';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
const SKELETON_MIN_MS = 280;

type MeetingNotesScrollContentProps = {
  blockingLoad: boolean;
  isRefreshing: boolean;
  setIsRefreshing: React.Dispatch<React.SetStateAction<boolean>>;
  refreshMeetingPoints: () => Promise<void>;
};

const MeetingNotesScrollContent = ({
  blockingLoad,
  isRefreshing,
  setIsRefreshing,
  refreshMeetingPoints,
}: MeetingNotesScrollContentProps) => {
  const { meetingPoints } = useMeetingNotes();
  const { t } = useAppTranslation();
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
    if (didRecoveryRefetch.current || blockingLoad || (meetingPoints?.length ?? 0) > 0) return;
    didRecoveryRefetch.current = true;
    refreshMeetingPoints().catch(() => {});
  }, [blockingLoad, meetingPoints, refreshMeetingPoints]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refreshMeetingPoints();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMeetingPoints, isRefreshing, setIsRefreshing]);

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

  const showPullChrome = !(blockingLoad && !isRefreshing);

  return (
    <div
      ref={listScrollRef}
      className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showPullChrome && (
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
      )}
      <MeetingNotesContent />
    </div>
  );
};

function MeetingNotesMobileContent() {
  const { mainFixedStyle } = useVisualViewport();
  const { initialLoading, isLoading, refreshMeetingPoints } = useMeetingNotes();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevBlockingRef = useRef(false);

  const blockingLoad = initialLoading || isLoading;

  useEffect(() => {
    const pending = blockingLoad;
    const wasPending = prevBlockingRef.current;
    prevBlockingRef.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setMinSettleDone(true);
              skeletonShownAtRef.current = null;
            });
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [blockingLoad]);

  const pagePath = MOBILE_PAGE_PATH.toolsMeetingNotes;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  const dataPendingSkeleton = (blockingLoad || !minSettleDone) && !isRefreshing;
  const { showFullPageSkeleton: showPageSkeleton } = useModulePageOverlaySkeleton(
    dataPendingSkeleton,
    pagePath,
  );

  const scrollContent = (
    <MeetingNotesScrollContent
      blockingLoad={blockingLoad}
      isRefreshing={isRefreshing}
      setIsRefreshing={setIsRefreshing}
      refreshMeetingPoints={refreshMeetingPoints}
    />
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      {/* Layout per android-mobile/rules/mobile-tools-layout-android.mdc */}
      <main
        className={cn(
          'fixed inset-x-0 z-0 flex min-h-0 w-full max-w-none min-w-0 flex-col bg-background',
          showPageSkeleton && 'pointer-events-none invisible select-none',
        )}
        style={mainFixedStyle}
        aria-hidden={showPageSkeleton}
      >
        <ToolsMobileShellHeader variant="meetingNotes" />
        {showDenyShellHeader ? (
          <ToolsMobileDenyGateArea
            pagePath={pagePath}
            contentPaddingClass="content-padding-above-nav-meeting-notes"
          />
        ) : (
          <ModuleShellContentGate
            pagePath={pagePath}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? scrollContent : null}
          </ModuleShellContentGate>
        )}

        <ToolsNavigationFooter className="safe-area-bottom-lower" />
      </main>

      {showPageSkeleton ? <MobileToolsMeetingNotesPageSkeletonOverlay /> : null}
    </div>
  );
}

const MeetingNotesPage = () => {
  useStatusBarStyle('light');

  return (
    <DesktopWarning>
      <SidebarProvider>
        <MeetingNotesProvider>
          <MeetingNotesMobileContent />
        </MeetingNotesProvider>
      </SidebarProvider>
    </DesktopWarning>
  );
};

export default MeetingNotesPage;
