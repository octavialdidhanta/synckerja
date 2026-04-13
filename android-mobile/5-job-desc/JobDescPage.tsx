import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { JobDescTracker } from './section';
import { useNotificationBadgeCount } from '@/shared/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile-app/components/NotificationsModal';
import { MobileToolsDailyTaskJobDescPageSkeletonOverlay } from './pages/MobileToolsDailyTaskJobDescPageSkeletonOverlay';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;
const SKELETON_MIN_MS = 280;

export function JobDescPage() {
  const { t } = useAppTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const refetchRef = useRef<(() => void) | null>(null);
  const [blockingLoad, setBlockingLoad] = useState(true);
  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevBlockingRef = useRef(false);

  const onBlockingLoadChange = useCallback((blocking: boolean) => {
    setBlockingLoad(blocking);
  }, []);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

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

  const showPageSkeleton = (blockingLoad || !minSettleDone) && !isRefreshing;

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetchRef.current?.();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
    const el = e.currentTarget;
    if (el.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
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

  const onTouchEnd = useCallback((_e: React.TouchEvent<HTMLDivElement>) => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) handlePullRefresh();
  }, [handlePullRefresh]);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          showPageSkeleton && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={showPageSkeleton}
      >
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight text-foreground">
              {t('jobDesc.page.title', 'Job Desc')}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t('jobDesc.page.subtitle', 'See active workload per employee')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label={t('mobileHome.notificationsTitle', 'Notifikasi')}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {notificationBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={isRefreshing}
            aria-label={t('common.refresh', 'Refresh')}
            onClick={() => handlePullRefresh()}
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </div>
      </header>

      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} initialTab="tasks" />

      {/* mobile-tools-layout-android §1.1: no outer scroll; single scroll in TabsContent. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-2 pt-2">
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <JobDescTracker
              refetchRef={refetchRef}
              onBlockingLoadChange={onBlockingLoadChange}
              pullTouchHandlers={{
                onTouchStart,
                onTouchMove,
                onTouchEnd,
              }}
            />
          </div>
        </div>
      </div>
      </div>
      {showPageSkeleton ? <MobileToolsDailyTaskJobDescPageSkeletonOverlay /> : null}
    </div>
  );
}
