import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useToast } from '@/features/ui/use-toast';
import { ConsistencyRateCard } from './ConsistencyRateCard';
import { HabitGridMobile } from './HabitGridMobile';
import { LoadingDots } from '@/components/LoadingDots';

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

export const HabitTrackerMobileContent = () => {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { loading, refreshData, filteredHabits } = useHabitTracker();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

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

  // Recovery: if list still empty after initial load, refetch once (per pull-to-refresh.mdc)
  useEffect(() => {
    if (didRecoveryRefetch.current || loading || filteredHabits.length > 0) return;
    didRecoveryRefetch.current = true;
    refreshData().catch(() => {});
  }, [loading, filteredHabits.length, refreshData]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refreshData();
    } catch {
      toast({
        title: t('common.error', 'Error'),
        description: t('habitTracker.refreshFailed', 'Gagal me-refresh data'),
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshData, toast, t]);

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

  // Skeleton only on initial load; during pull-to-refresh keep content visible (pull-to-refresh.mdc §5.3)
  const showInitialLoading = loading && !isRefreshing;

  if (showInitialLoading) {
    return (
      <div
        ref={listScrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0 flex flex-col"
      >
        <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-habits space-y-1">
          <div className="bg-card rounded-lg border border-border p-6 flex items-center justify-center">
            <LoadingDots size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listScrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator (first child of scroll per pull-to-refresh.mdc §5.2) */}
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

      <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-habits space-y-1">
        <ConsistencyRateCard currentMonth={currentMonth} />
        <HabitGridMobile currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
      </div>
    </div>
  );
};
