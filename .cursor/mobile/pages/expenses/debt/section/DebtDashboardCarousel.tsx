import { useState, useCallback, useRef, useEffect } from "react";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DebtTotalDebtCard } from "@/mobile/pages/expenses/debt/section/DebtTotalDebtCard";
import { DebtTotalLimitCard } from "@/mobile/pages/expenses/debt/section/DebtTotalLimitCard";
import { DebtActiveDebtCard } from "@/mobile/pages/expenses/debt/section/DebtActiveDebtCard";
import { DebtTotalInterestYTDCard } from "@/mobile/pages/expenses/debt/section/DebtTotalInterestYTDCard";

const LOGICAL_SLIDE_COUNT = 4;
const TRANSITION_MS = 400;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const TRACK_LENGTH = 6;
const FIRST_REAL = 1;
const LAST_REAL = 4;

interface DebtDashboardCarouselProps {
  isLoading: boolean;
  totalDebt: number;
  debtCount: number;
  totalLimit: number;
  activeDebtTotal: number;
  activeDebtCount: number;
  totalInterestYtd: number;
}

export function DebtDashboardCarousel({
  isLoading,
  totalDebt,
  debtCount,
  totalLimit,
  activeDebtTotal,
  activeDebtCount,
  totalInterestYtd,
}: DebtDashboardCarouselProps) {
  const [index, setIndex] = useState(FIRST_REAL);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((next: number) => {
    setIndex(next);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 24;
    if (diff > threshold) {
      if (index === LAST_REAL) goTo(5);
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionEnabled(true));
        });
      } else if (index === 5) {
        setTransitionEnabled(false);
        setIndex(FIRST_REAL);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionEnabled(true));
        });
      }
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [index]);

  const logicalIndex = index === 0 ? 3 : index === 5 ? 0 : index - 1;

  if (isLoading) {
    return (
      <div className="w-full overflow-hidden">
        <div className="px-2" style={{ width: "100%" }}>
          <div className="w-full min-h-[7.25rem] rounded-lg border border-border bg-card overflow-hidden">
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <Skeleton className="h-4 flex-1 max-w-[180px]" />
              </div>
              <Skeleton className="h-8 w-3/4 max-w-[140px]" />
              <Skeleton className="h-3 w-1/2 max-w-[100px]" />
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-1.5 pt-3 pb-1">
          {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
            <Skeleton key={i} className={cn("h-2 rounded-full", i === 0 ? "w-5" : "w-2")} />
          ))}
        </div>
      </div>
    );
  }

  const slideWidthPercent = 100 / TRACK_LENGTH;

  return (
    <div className="w-full overflow-hidden">
      <div
        ref={trackRef}
        className="flex touch-pan-y select-none"
        style={{
          width: `${TRACK_LENGTH * 100}%`,
          transform: `translate3d(-${index * slideWidthPercent}%, 0, 0)`,
          transition: transitionEnabled ? `transform ${TRANSITION_MS}ms ${EASING}` : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtTotalInterestYTDCard totalInterestYtd={totalInterestYtd} />
        </div>
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtTotalDebtCard totalDebt={totalDebt} debtCount={debtCount} />
        </div>
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtTotalLimitCard totalLimit={totalLimit} />
        </div>
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtActiveDebtCard activeDebtTotal={activeDebtTotal} activeDebtCount={activeDebtCount} />
        </div>
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtTotalInterestYTDCard totalInterestYtd={totalInterestYtd} />
        </div>
        <div className="flex-shrink-0 px-2" style={{ width: `${slideWidthPercent}%` }}>
          <DebtTotalDebtCard totalDebt={totalDebt} debtCount={debtCount} />
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pt-3 pb-1">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Debt slide ${i + 1}`}
            onClick={() => goTo(i + 1)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === logicalIndex ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
