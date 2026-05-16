import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { PiutangMetrics } from '@/4-1-transaction/piutang/shared/piutangMetrics';
import { PiutangRemainingCard } from '@/mobile/3-incomes/section/cards/PiutangRemainingCard';
import { PiutangTotalPaidCard } from '@/mobile/3-incomes/section/cards/PiutangTotalPaidCard';

const LOGICAL_SLIDE_COUNT = 2;
const TRANSITION_MS = 400;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const TRACK_LENGTH = 4;
const FIRST_REAL = 1;
const LAST_REAL = 2;

export type MobilePiutangMetricsCarouselProps = {
  isLoading?: boolean;
  metrics: PiutangMetrics;
};

/** Matches carousel (`LOGICAL_SLIDE_COUNT = 2`) — dipakai guard/Suspense/overlay piutang mobile. */
export function MobilePiutangCarouselSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="w-full px-0" style={{ width: '100%' }}>
        <div className="min-h-[7.25rem] w-full overflow-hidden rounded-lg border border-border bg-card">
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" aria-hidden />
              <Skeleton className="h-4 max-w-[180px] flex-1" aria-hidden />
            </div>
            <Skeleton className="h-8 w-3/4 max-w-[140px]" aria-hidden />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pb-1 pt-3" aria-hidden>
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <Skeleton key={i} className={cn('h-2 rounded-full', i === 0 ? 'w-5' : 'w-2')} aria-hidden />
        ))}
      </div>
    </div>
  );
}

export function MobilePiutangMetricsCarousel({
  isLoading = false,
  metrics,
}: MobilePiutangMetricsCarouselProps) {
  const [index, setIndex] = useState(FIRST_REAL);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => setIndex(next), []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 40;
    if (diff > threshold) {
      if (index === LAST_REAL) goTo(TRACK_LENGTH - 1);
      else goTo(index + 1);
    } else if (diff < -threshold) {
      if (index === FIRST_REAL) goTo(0);
      else goTo(index - 1);
    }
  }, [index, goTo]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onTransitionEnd = () => {
      if (index === 0) {
        setTransitionEnabled(false);
        setIndex(LAST_REAL);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      } else if (index === TRACK_LENGTH - 1) {
        setTransitionEnabled(false);
        setIndex(FIRST_REAL);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      }
    };
    el.addEventListener('transitionend', onTransitionEnd);
    return () => el.removeEventListener('transitionend', onTransitionEnd);
  }, [index]);

  const logicalIndex = index === 0 ? 1 : index === TRACK_LENGTH - 1 ? 0 : index - 1;

  if (isLoading) {
    return <MobilePiutangCarouselSkeleton />;
  }

  const slideWidthPercent = 100 / TRACK_LENGTH;

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div
        ref={trackRef}
        className="flex touch-pan-y select-none"
        style={{
          width: `${TRACK_LENGTH * 100}%`,
          transform: `translate3d(-${index * slideWidthPercent}%, 0, 0)`,
          transition: transitionEnabled ? `transform ${TRANSITION_MS}ms ${EASING}` : 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-1/4 flex-shrink-0 px-0">
          <PiutangTotalPaidCard totalPaid={metrics.totalPaid} activityCount={metrics.activityCount} />
        </div>
        <div className="w-1/4 flex-shrink-0 px-0">
          <PiutangRemainingCard totalRemaining={metrics.totalRemaining} activityCount={metrics.activityCount} />
        </div>
        <div className="w-1/4 flex-shrink-0 px-0">
          <PiutangTotalPaidCard totalPaid={metrics.totalPaid} activityCount={metrics.activityCount} />
        </div>
        <div className="w-1/4 flex-shrink-0 px-0">
          <PiutangRemainingCard totalRemaining={metrics.totalRemaining} activityCount={metrics.activityCount} />
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-1 pt-3">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Piutang metric slide ${i + 1}`}
            onClick={() => goTo(i + 1)}
            className={cn(
              'h-2 rounded-full transition-all duration-200',
              i === logicalIndex ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50',
            )}
          />
        ))}
      </div>
    </div>
  );
}
