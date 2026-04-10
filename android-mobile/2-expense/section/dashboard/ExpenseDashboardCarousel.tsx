import { useState, useCallback, useRef, useEffect } from "react";
import { QuickViewTotalBalanceCard } from "@/mobile/2-expense/section/dashboard/QuickViewTotalBalanceCard";
import { CurrentMonthTotalCard } from "@/mobile/2-expense/section/dashboard/CurrentMonthTotalCard";
import { TotalExpensesYTDCard } from "@/mobile/2-expense/section/dashboard/TotalExpensesYTDCard";
import { HighestExpenseCard } from "@/mobile/2-expense/section/dashboard/HighestExpenseCard";
import { LatestTransactionCard } from "@/mobile/2-expense/section/dashboard/LatestTransactionCard";
import {
  useExpenseDashboardStats,
  type ExpenseStatsItem,
} from "@/shared/hooks/finance/useExpenseDashboardStats";
import { cn } from "@/shared/lib/utils";

const LOGICAL_SLIDE_COUNT = 5;
const TRANSITION_MS = 400;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const TRACK_LENGTH = 7;
const FIRST_REAL = 1;
const LAST_REAL = 5;

export interface ExpenseDashboardCarouselProps {
  currentMonthTotal?: number;
  highestExpense?: ExpenseStatsItem | null;
  latestExpense?: ExpenseStatsItem | null;
  totalExpensesYTD?: number;
  ytdTransactionCount?: number;
}

export function ExpenseDashboardCarousel(props: ExpenseDashboardCarouselProps = {}) {
  const [index, setIndex] = useState(FIRST_REAL);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const hookStats = useExpenseDashboardStats();
  const currentMonthTotal = props.currentMonthTotal ?? hookStats.currentMonthTotal;
  const totalExpensesYTD = props.totalExpensesYTD ?? hookStats.totalExpensesYTD;
  const ytdTransactionCount = props.ytdTransactionCount ?? hookStats.ytdTransactionCount;
  const highestExpense =
    props.highestExpense !== undefined ? props.highestExpense : hookStats.highestExpense;
  const latestExpense = props.latestExpense ?? hookStats.latestExpense;

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
    const threshold = 40;
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransitionEnabled(true));
        });
      } else if (index === 6) {
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

  const logicalIndex = index === 0 ? 4 : index === 6 ? 0 : index - 1;

  const slideWidthPercent = 100 / TRACK_LENGTH;

  return (
    <div className="w-full overflow-hidden">
      <div
        ref={trackRef}
        className="flex touch-pan-y"
        style={{
          width: `${TRACK_LENGTH * 100}%`,
          transform: `translate3d(-${index * slideWidthPercent}%, 0, 0)`,
          transition: transitionEnabled ? `transform ${TRANSITION_MS}ms ${EASING}` : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <LatestTransactionCard latestExpense={latestExpense} />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <QuickViewTotalBalanceCard />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <CurrentMonthTotalCard currentMonthTotal={currentMonthTotal} />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <TotalExpensesYTDCard
            totalExpensesYTD={totalExpensesYTD}
            ytdTransactionCount={ytdTransactionCount}
          />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <HighestExpenseCard highestExpense={highestExpense} />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <LatestTransactionCard latestExpense={latestExpense} />
        </div>
        <div className="min-w-0 flex-shrink-0" style={{ width: `${slideWidthPercent}%` }}>
          <QuickViewTotalBalanceCard />
        </div>
      </div>

      <div className="flex justify-center gap-1.5 pb-1 pt-3">
        {Array.from({ length: LOGICAL_SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => goTo(i + 1)}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              i === logicalIndex
                ? "w-5 bg-primary"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}
