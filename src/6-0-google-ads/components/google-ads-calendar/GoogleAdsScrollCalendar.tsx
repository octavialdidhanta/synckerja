import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parse,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { GoogleAdsUnifiedMonthYearPicker } from "@/6-0-google-ads/components/google-ads-calendar/GoogleAdsUnifiedMonthYearPicker";
import {
  googleAdsDateScrollHostClass,
  googleAdsScrollAreaClass,
} from "@/6-0-google-ads/components/google-ads-calendar/scrollAreaClass";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function mondayPaddingCells(monthStart: Date): number {
  return (monthStart.getDay() + 6) % 7;
}

function buildMonthDays(month: Date): (Date | null)[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const pad = mondayPaddingCells(start);
  return [...Array<Date | null>(pad).fill(null), ...days];
}

function listMonthsBetween(min: Date, max: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfMonth(min);
  const last = startOfMonth(max);
  while (cur.getTime() <= last.getTime()) {
    out.push(new Date(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

function monthKey(month: Date): string {
  return format(month, "yyyy-MM");
}

type GoogleAdsScrollCalendarProps = {
  selected?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Scroll the month grid to this month when it changes. */
  focusMonth?: Date;
  /** Bump when popover opens so scroll position syncs after layout. */
  layoutScrollKey?: number;
  className?: string;
  scrollAreaClassName?: string;
  onSelectYear?: (year: number) => void;
  selectableYears?: number[];
  selectedCalendarYear?: number;
};

export function GoogleAdsScrollCalendar({
  selected,
  onSelect,
  minDate,
  maxDate = new Date(),
  focusMonth,
  layoutScrollKey,
  className,
  scrollAreaClassName,
  onSelectYear,
  selectableYears,
  selectedCalendarYear,
}: GoogleAdsScrollCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const programmaticScrollRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const minBound = useMemo(
    () => (minDate ? startOfDay(minDate) : startOfDay(new Date(2010, 0, 1))),
    [minDate],
  );
  const maxBound = useMemo(() => endOfDay(maxDate), [maxDate]);

  const months = useMemo(
    () => listMonthsBetween(minBound, maxBound),
    [minBound, maxBound],
  );

  const initialFocus = focusMonth ?? selected?.to ?? selected?.from ?? new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialFocus));

  const scrollToMonth = useCallback((month: Date, behavior: ScrollBehavior = "smooth") => {
    const key = monthKey(month);
    const el = monthRefs.current.get(key);
    const root = scrollRef.current;
    if (!el || !root) return;

    programmaticScrollRef.current = true;
    const top = el.offsetTop - root.offsetTop;
    root.scrollTo({ top: Math.max(0, top), behavior });

    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, behavior === "smooth" ? 450 : 50);
  }, []);

  const syncViewMonthFromScroll = useCallback(() => {
    const root = scrollRef.current;
    if (!root || programmaticScrollRef.current) return;

    const rootTop = root.getBoundingClientRect().top;
    let bestKey: string | null = null;
    let bestDist = Infinity;

    for (const [key, el] of monthRefs.current) {
      const dist = Math.abs(el.getBoundingClientRect().top - rootTop);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
      }
    }

    if (!bestKey) return;
    const parsed = parse(`${bestKey}-01`, "yyyy-MM-dd", new Date());
    if (!Number.isNaN(parsed.getTime())) {
      setViewMonth((prev) => {
        const next = startOfMonth(parsed);
        return prev.getTime() === next.getTime() ? prev : next;
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!focusMonth) return;
    const m = startOfMonth(focusMonth);
    setViewMonth(m);
    scrollToMonth(m, "auto");
  }, [focusMonth, layoutScrollKey, months.length, scrollToMonth]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const onScroll = () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncViewMonthFromScroll();
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    syncViewMonthFromScroll();
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [months, syncViewMonthFromScroll]);

  const setViewMonthAndScroll = useCallback(
    (month: Date) => {
      const clamped = startOfMonth(month);
      if (isBefore(clamped, startOfMonth(minBound))) return;
      if (isAfter(clamped, startOfMonth(maxBound))) return;
      setViewMonth(clamped);
      scrollToMonth(clamped);
    },
    [minBound, maxBound, scrollToMonth],
  );

  const selectFullMonth = useCallback(
    (month: Date) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      if (isAfter(monthStart, maxBound) || isBefore(monthEnd, minBound)) return;

      let from = monthStart;
      let to = monthEnd;
      if (isBefore(from, minBound)) from = minBound;
      if (isAfter(to, maxBound)) to = maxBound;

      onSelect?.({ from: startOfDay(from), to: endOfDay(to) });
    },
    [minBound, maxBound, onSelect],
  );

  const handleDayClick = (day: Date) => {
    if (isBefore(day, minBound) || isAfter(day, maxBound)) return;

    const from = selected?.from;
    const to = selected?.to;

    const dayStart = startOfDay(day);

    if (!from || (from && to)) {
      onSelect?.({ from: dayStart, to: undefined });
      return;
    }

    if (isBefore(dayStart, startOfDay(from))) {
      onSelect?.({ from: dayStart, to: endOfDay(from) });
    } else {
      onSelect?.({ from: startOfDay(from), to: endOfDay(dayStart) });
    }
  };

  const isDayInRange = (day: Date) => {
    const from = selected?.from;
    const to = selected?.to;
    if (!from || !to) return false;
    const d = startOfDay(day);
    return d >= startOfDay(from) && d <= startOfDay(to);
  };

  const shiftViewMonth = (delta: number) => {
    setViewMonthAndScroll(addMonths(viewMonth, delta));
  };

  return (
    <div className={cn("flex min-h-0 w-full min-w-0 flex-1 flex-col", className)}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white pb-2 pt-0">
        <GoogleAdsUnifiedMonthYearPicker
          viewMonth={viewMonth}
          minDate={minBound}
          maxDate={maxBound}
          onSelectMonth={setViewMonthAndScroll}
          onSelectYear={onSelectYear}
          selectableYears={selectableYears}
          selectedCalendarYear={selectedCalendarYear}
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded p-1 text-gray-600 hover:bg-brand-blue-soft hover:text-brand-blue"
            aria-label="Previous month"
            onClick={() => shiftViewMonth(-1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-gray-600 hover:bg-brand-blue-soft hover:text-brand-blue"
            aria-label="Next month"
            onClick={() => shiftViewMonth(1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px border border-gray-200 bg-gray-200 pb-px pt-2">
        {WEEKDAY_LABELS.map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="flex h-8 items-center justify-center bg-white text-center text-xs font-medium text-gray-600"
          >
            {d}
          </span>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          googleAdsDateScrollHostClass,
          "min-h-0 flex-1 pr-1 [min-height:220px]",
          googleAdsScrollAreaClass,
          scrollAreaClassName,
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        {months.map((month) => {
          const key = monthKey(month);
          const cells = buildMonthDays(month);
          return (
            <div
              key={key}
              data-month-key={key}
              ref={(el) => {
                if (el) monthRefs.current.set(key, el);
                else monthRefs.current.delete(key);
              }}
              className="mb-4"
            >
              <button
                type="button"
                className="w-full py-2 text-left text-sm font-medium tracking-wide text-gray-900 hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 rounded-sm"
                aria-label={`Select all of ${format(month, "MMMM yyyy")}`}
                onClick={() => selectFullMonth(month)}
              >
                {format(month, "MMM yyyy").toUpperCase()}
              </button>
              <div className="grid w-full grid-cols-7 gap-px border border-gray-200 bg-gray-200">
                {cells.map((day, idx) => {
                  if (!day) {
                    return (
                      <div
                        key={`e-${key}-${idx}`}
                        className="h-9 bg-gray-50"
                        aria-hidden
                      />
                    );
                  }
                  const disabled = isBefore(day, minBound) || isAfter(day, maxBound);
                  const isStart = selected?.from && isSameDay(day, selected.from);
                  const isEnd = selected?.to && isSameDay(day, selected.to);
                  const inRange = isDayInRange(day) && !isStart && !isEnd;
                  const isEndpoint = isStart || isEnd;

                  return (
                    <button
                      key={`${key}-${day.getDate()}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        "relative flex h-9 w-full items-center justify-center bg-white text-sm font-normal",
                        disabled && "cursor-not-allowed bg-gray-50 text-gray-300",
                        !disabled &&
                          !isEndpoint &&
                          !inRange &&
                          "text-gray-900 hover:bg-brand-blue-soft/60",
                        inRange && "bg-brand-blue-soft text-brand-blue-on-soft",
                        isEndpoint &&
                          "bg-brand-blue font-medium text-white hover:bg-brand-blue-deep",
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
