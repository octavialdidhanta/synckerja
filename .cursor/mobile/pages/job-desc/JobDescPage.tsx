import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/mobile/components/ui/sidebar';
import { Button } from '@/features/ui/button';
import { useStatusBarStyle } from '@/mobile/hooks/useStatusBarStyle';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { JobDescTracker } from './section';
import { useNotificationBadgeCount } from '@/mobile/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile/components/NotificationsModal';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

export function JobDescPage() {
  useStatusBarStyle('light');
  const { t } = useAppTranslation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const refetchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

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
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t('jobDesc.page.title', 'Job Desc')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('jobDesc.page.subtitle', 'See active workload per employee')}
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 relative"
            aria-label={t('mobileHome.notificationsTitle', 'Notifikasi')}
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {notificationBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1">
                {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} initialTab="tasks" />

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
          <div className="mx-auto w-full max-w-md px-2 pt-2 flex-1 min-h-0 flex flex-col">
            <JobDescTracker refetchRef={refetchRef} />
          </div>
        </div>
      </div>
    </>
  );
}
