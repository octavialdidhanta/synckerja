import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, RefreshCw, Bell, Loader2 } from 'lucide-react';
import { SidebarTrigger } from '@/mobile/components/ui/sidebar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/mobile/components/ui/drawer';
import { Button } from '@/features/ui/button';
import { useDailyTask } from '@/features/8-2-DailyTask/DailyTaskContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useToast } from '@/features/ui/use-toast';
import { TaskList } from './TaskList';
import { DailyTaskPageSkeleton } from '../DailyTaskPageSkeleton';
import { MobileTaskFilterDrawerContent } from './MobileTaskFilterDrawer';
import { hasActiveFilters } from './filterUtils';
import { useNotificationBadgeCount } from '@/mobile/hooks/useNotificationBadgeCount';
import { NotificationsModal } from '@/mobile/components/NotificationsModal';

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
      <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t('dailyTask.page.title', 'Daily Task')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('dailyTask.page.subtitle', 'Manage your daily tasks here')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
          <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-daily-task">
            {/* Skeleton only on initial load when we have no data; once we have tasks, keep TaskList mounted so modal state (e.g. Sub Step) is not lost on refetch */}
            {isLoading && !isRefreshing && tasks.length === 0 ? <DailyTaskPageSkeleton /> : <TaskList />}
          </div>
        </div>
      </div>
    </>
  );
}
