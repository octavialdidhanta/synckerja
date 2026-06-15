import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { MobileIncomeCarouselSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomeDashboardViewportSkeleton";
import { IncomeTotalCurrentBalanceCard } from "./cards/IncomeTotalCurrentBalanceCard";
import { IncomeTotalIncomeCard } from "./cards/IncomeTotalIncomeCard";
import { IncomeGrowthCard } from "./cards/IncomeGrowthCard";
import { IncomeHighestCard } from "./cards/IncomeHighestCard";
import { IncomeLatestCard } from "./cards/IncomeLatestCard";

const LOGICAL_SLIDE_COUNT = 5;
const TRANSITION_MS = 400;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const TRACK_LENGTH = 7;
const FIRST_REAL = 1;
const LAST_REAL = 5;

export type MobileIncomeDashboardCarouselProps = {
  isLoading: boolean;
  totalCurrentBalance: number;
  bankTotalBalance?: number;
  brickBalance?: number | null;
  xenditBalance?: number | null;
  brickEligible?: boolean;
  xenditEligible?: boolean;
  bankAccountCount?: number;
  yearTotalIncome: number;
  totalIncomeMonthToDate: number;
  growthPercentage: number;
  highest: number;
  highestRecordedAt: string | null;
  highestTransactionName: string | null;
  latest: number;
  latestRecordedAt: string | null;
  latestTransactionName: string | null;
};

export function MobileIncomeDashboardCarousel({
  isLoading,
  totalCurrentBalance,
  bankTotalBalance,
  brickBalance,
  xenditBalance,
  brickEligible,
  xenditEligible,
  bankAccountCount,
  yearTotalIncome,
  totalIncomeMonthToDate,
  growthPercentage,
  highest,
  highestRecordedAt,
  highestTransactionName,
  latest,
  latestRecordedAt,
  latestTransactionName,
}: MobileIncomeDashboardCarouselProps) {
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
    const threshold = 24;
    if (diff > threshold) {
      if (index === LAST_REAL) goTo(6);
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
      } else if (index === 6) {
        setTransitionEnabled(false);
        setIndex(FIRST_REAL);
        requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      }
    };
    el.addEventListener("transitionend", onTransitionEnd);
    return () => el.removeEventListener("transitionend", onTransitionEnd);
  }, [index]);

  const logicalIndex = index === 0 ? 4 : index === 6 ? 0 : index - 1;

  const balanceCardProps = {
    totalCurrentBalance,
    bankTotalBalance,
    brickBalance,
    xenditBalance,
    brickEligible,
    xenditEligible,
    bankAccountCount,
  };

  if (isLoading) {
    return <MobileIncomeCarouselSkeleton />;
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
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeLatestCard
            latest={latest}
            latestRecordedAt={latestRecordedAt}
            latestTransactionName={latestTransactionName}
          />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeTotalCurrentBalanceCard {...balanceCardProps} />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeTotalIncomeCard totalIncome={yearTotalIncome} totalIncomeMonthToDate={totalIncomeMonthToDate} />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeGrowthCard growthPercentage={growthPercentage} />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeHighestCard
            highest={highest}
            highestRecordedAt={highestRecordedAt}
            highestTransactionName={highestTransactionName}
          />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeLatestCard
            latest={latest}
            latestRecordedAt={latestRecordedAt}
            latestTransactionName={latestTransactionName}
          />
        </div>
        <div className="flex-shrink-0 px-0" style={{ width: `${slideWidthPercent}%` }}>
          <IncomeTotalCurrentBalanceCard {...balanceCardProps} />
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-1 pt-3">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Income slide ${i + 1}`}
            onClick={() => goTo(i + 1)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === logicalIndex ? "w-5 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
