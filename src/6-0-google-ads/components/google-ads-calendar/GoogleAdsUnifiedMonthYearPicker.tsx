import { useEffect, useMemo, useRef, useState } from "react";
import { format, isAfter, isBefore, startOfMonth } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { googleAdsScrollAreaClass } from "@/6-0-google-ads/components/google-ads-calendar/scrollAreaClass";

const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEPT",
  "OCT",
  "NOV",
  "DEC",
] as const;

const PICKER_MIN_YEAR = 2000;

export function formatGoogleAdsMonthYearLabel(month: Date): string {
  return format(month, "MMM yyyy").toUpperCase();
}

type GoogleAdsUnifiedMonthYearPickerProps = {
  viewMonth: Date;
  minDate: Date;
  maxDate: Date;
  onSelectMonth: (month: Date) => void;
};

export function GoogleAdsUnifiedMonthYearPicker({
  viewMonth,
  minDate,
  maxDate,
  onSelectMonth,
}: GoogleAdsUnifiedMonthYearPickerProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const minMonth = startOfMonth(minDate);
  const maxMonth = startOfMonth(maxDate);
  const toYear = maxMonth.getFullYear();
  const fromYear = Math.min(PICKER_MIN_YEAR, minMonth.getFullYear());

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = toYear; y >= fromYear; y--) list.push(y);
    return list;
  }, [fromYear, toYear]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = formatGoogleAdsMonthYearLabel(viewMonth);

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        className="inline-flex items-center gap-1 text-sm font-medium tracking-wide text-gray-900 hover:text-brand-blue"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {label}
        <ChevronDown className="h-4 w-4 text-gray-600" aria-hidden />
      </button>

      {open ? (
        <div
          ref={panelRef}
          className={cn(
            "absolute left-0 top-full z-50 mt-1 max-h-[min(320px,50vh)] w-[252px] border border-gray-800 bg-white py-2 shadow-lg",
            googleAdsScrollAreaClass,
          )}
        >
          {years.map((year) => (
            <div key={year} className="mb-1">
              <div className="px-4 py-1.5 text-sm font-semibold text-gray-900">{year}</div>
              <div className="grid grid-cols-4 gap-0.5 px-3 pb-2">
                {MONTH_ABBR.map((abbr, monthIndex) => {
                  const monthDate = startOfMonth(new Date(year, monthIndex, 1));
                  const disabled =
                    isBefore(monthDate, minMonth) || isAfter(monthDate, maxMonth);
                  const selected =
                    monthDate.getFullYear() === viewMonth.getFullYear() &&
                    monthDate.getMonth() === viewMonth.getMonth();

                  return (
                    <button
                      key={`${year}-${abbr}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onSelectMonth(monthDate);
                        setOpen(false);
                      }}
                      className={cn(
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs font-normal",
                        disabled && "cursor-not-allowed text-gray-300",
                        !disabled && !selected && "text-gray-800 hover:bg-brand-blue-soft",
                        selected && !disabled && "bg-brand-blue font-medium text-white",
                      )}
                    >
                      {abbr}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
