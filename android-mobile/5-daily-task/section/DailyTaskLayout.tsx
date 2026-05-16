import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, RefreshCw, Bell, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/mobile-app/components/ui/sidebar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/mobile-app/components/ui/drawer';
import { Button } from '@/shared/components/ui/button';
import { useDailyTask } from '@/8-2-DailyTask/context/DailyTaskContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { TaskList } from './TaskList';
import { MobileTaskFilterDrawerContent } from './MobileTaskFilterDrawer';
import { hasActiveFilters } from './filterUtils';
import { useNotificationBadgeCount } from '@/shared/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile-app/components/NotificationsModal';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
/** Softer resistance: follow finger with slight damping for natural feel */
const PULL_RESISTANCE = 0.55;

export function DailyTaskLayout() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { filters, resetFilters, refetchTasks, isLoading, tasks } = useDailyTask();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const didRecoveryRefetch = useRef(false);
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);
  const activeFilters = hasActiveFilters(filters);
  const listScrollRef = useRef<HTMLDivElement>(null);

  // When navigating from another page (e.g. Initiative), ensure we load data if still empty after initial load
  useEffect(() => {
    if (didRecoveryRefetch.current || isLoading || tasks.length > 0) return;
    didRecoveryRefetch.current = true;
    refetchTasks().catch(() => {});
  }, [isLoading, tasks.length, refetchTasks]);

  // Scroll list to top when date/plan filter changes so the updated list is visible
  useEffect(() => {
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [
    filters.dateRange,
    filters.planDateRange,
    filters.customPlanMonth,
    filters.customStartDate,
    filters.customEndDate,
  ]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetchTasks();
    } catch {
      toast({
        title: t('dailyTask.filters.refresh', 'Refresh'),
        description: 'Failed to refresh tasks',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchTasks, isRefreshing, toast, t]);

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

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight text-foreground">
              {t('dailyTask.page.title', 'Daily Task')}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t('dailyTask.page.subtitle', 'Manage your daily tasks here')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            className="relative p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label={t('mobileHome.notificationsTitle', 'Notifikasi')}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {notificationBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
              </span>
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={t('dailyTask.filters.resetFilters', 'Reset filter')}
            onClick={() => {
              resetFilters();
              setDrawerOpen(false);
            }}
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Button>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 relative"
                aria-label={t('dailyTask.filters.filter', 'Filter')}
              >
                <Filter className="h-4 w-4" />
                {activeFilters && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] flex flex-col">
              <DrawerHeader className="text-left pb-2 safe-area-top">
                <DrawerTitle>{t('dailyTask.filters.filter', 'Filter')}</DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-0">
                <MobileTaskFilterDrawerContent
                onAfterCustomMonthSelect={() => setDrawerOpen(false)}
                onAfterCustomDateRangeSelect={() => setDrawerOpen(false)}
                onAfterDueDatePresetSelect={() => setDrawerOpen(false)}
              />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </header>

      <NotificationsModal open={notificationsOpen} onOpenChange={setNotificationsOpen} initialTab="tasks" />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={listScrollRef}
          className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
            style={{
              height:
                pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
              minHeight: 0,
              transition: isPulling
                ? 'none'
                : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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
          <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-2 content-padding-above-nav-daily-task">
            {/* Initial load skeleton: page-level overlay in `DailyTaskPage`. Keep TaskList mounted on refetch. */}
            <TaskList />
          </div>
        </div>
      </div>
    </>
  );
}
