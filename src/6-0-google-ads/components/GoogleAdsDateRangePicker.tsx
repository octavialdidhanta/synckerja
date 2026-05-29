import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { GoogleAdsScrollCalendar } from "@/6-0-google-ads/components/google-ads-calendar/GoogleAdsScrollCalendar";
import "@/6-0-google-ads/components/google-ads-calendar/googleAdsDatePopover.css";
import {
  googleAdsDateScrollHostClass,
  googleAdsScrollAreaClass,
} from "@/6-0-google-ads/components/google-ads-calendar/scrollAreaClass";
import { parseYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";
import {
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
  computePresetRange,
  formatGoogleAdsPickerButtonLabel,
  toYmdLocal,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";

type PresetRow = {
  id: GoogleAdsDatePresetId;
  label: string;
  hasSubmenu?: boolean;
};

const PRESET_ROWS: PresetRow[] = [
  { id: "custom", label: "Custom" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week_mon_today", label: "This week (Mon – Today)", hasSubmenu: true },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_week_mon_sun", label: "Last week (Mon – Sun)", hasSubmenu: true },
  { id: "last_14_days", label: "Last 14 days" },
  { id: "this_month", label: "This month" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "last_month", label: "Last month" },
  { id: "all_time", label: "All time" },
];

type GoogleAdsDateRangePickerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  accountEarliestYmd?: string | null;
  className?: string;
};

function formatInputDate(d: Date | undefined): string {
  if (!d) return "";
  return format(d, "dd/MM/yyyy");
}

function parseInputDate(raw: string): Date | null {
  const trimmed = raw.trim();
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseYmdLocal(trimmed);
}

function normalizeRange(range: DateRange): DateRange {
  const from = range.from ? new Date(range.from) : undefined;
  const to = range.to ? new Date(range.to) : undefined;
  return { from, to };
}

export function GoogleAdsDateRangePicker({
  value,
  onChange,
  accountEarliestYmd,
  className,
}: GoogleAdsDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [calendarLayoutScrollKey, setCalendarLayoutScrollKey] = useState(0);
  const [draftPreset, setDraftPreset] = useState(value.preset);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(value.range);
  const [draftRolling, setDraftRolling] = useState(value.rollingDays);
  const [startInput, setStartInput] = useState(() => formatInputDate(value.range.from));
  const [endInput, setEndInput] = useState(() => formatInputDate(value.range.to));
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [calendarFocusMonth, setCalendarFocusMonth] = useState<Date>(() =>
    startOfMonth(value.range.to ?? value.range.from ?? new Date()),
  );
  const prevOpenRef = useRef(false);

  /** Sync draft from committed value when popover is closed (avoid clobbering in-popover focus). */
  useEffect(() => {
    if (open) return;
    setDraftPreset(value.preset);
    setDraftRange(value.range);
    setDraftRolling(value.rollingDays);
    setStartInput(formatInputDate(value.range.from));
    setEndInput(formatInputDate(value.range.to));
  }, [open, value]);

  /** On open/close only — do not reset focus month on every parent value change while open. */
  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    const justClosed = !open && prevOpenRef.current;
    prevOpenRef.current = open;

    if (justOpened) {
      setDraftPreset(value.preset);
      setDraftRange(value.range);
      setDraftRolling(value.rollingDays);
      setStartInput(formatInputDate(value.range.from));
      setEndInput(formatInputDate(value.range.to));
      const focusDate =
        value.preset === "all_time"
          ? value.range.from
          : value.range.to ?? value.range.from;
      setCalendarFocusMonth(startOfMonth(focusDate ?? new Date()));
      setCalendarLayoutScrollKey((k) => k + 1);
    }

    if (justClosed) {
      setDraftPreset(value.preset);
      setDraftRange(value.range);
      setDraftRolling(value.rollingDays);
      setStartInput(formatInputDate(value.range.from));
      setEndInput(formatInputDate(value.range.to));
    }
  }, [open, value]);

  /** When earliest activity date loads, refresh all_time draft without stealing scroll focus. */
  useEffect(() => {
    if (!accountEarliestYmd) return;
    if (draftPreset !== "all_time" && value.preset !== "all_time") return;
    const range = computePresetRange("all_time", new Date(), { accountEarliestYmd });
    const normalized = normalizeRange(range);
    setDraftRange(normalized);
    setStartInput(formatInputDate(normalized.from));
    setEndInput(formatInputDate(normalized.to));
    if (!open && normalized.from) {
      setCalendarFocusMonth(startOfMonth(normalized.from));
    }
  }, [accountEarliestYmd, draftPreset, value.preset, open]);

  const calendarMinDate = useMemo(() => {
    const fromBounds = accountEarliestYmd ? parseYmdLocal(accountEarliestYmd) : null;
    const fromCommitted =
      value.preset === "all_time" && value.range.from
        ? startOfDay(value.range.from)
        : null;
    const fromDraft =
      draftPreset === "all_time" && draftRange?.from ? startOfDay(draftRange.from) : null;
    const candidates = [fromBounds, fromCommitted, fromDraft].filter(
      (d): d is Date => d != null,
    );
    if (candidates.length === 0) return new Date(2010, 0, 1);
    return candidates.reduce((min, d) => (d < min ? d : min));
  }, [accountEarliestYmd, value.preset, value.range.from, draftPreset, draftRange?.from]);

  const commitSelection = useCallback(
    (
      preset: GoogleAdsDatePresetId,
      range: DateRange,
      rollingDays = draftRolling,
      options?: { closePopover?: boolean; focusScrollMonth?: Date },
    ) => {
      const normalized = normalizeRange(range);
      const next: GoogleAdsDateRangeSelection = {
        preset,
        range: normalized,
        rollingDays,
      };
      onChange(next);
      setDraftPreset(preset);
      setDraftRange(normalized);
      setStartInput(formatInputDate(normalized.from));
      setEndInput(formatInputDate(normalized.to));
      const scrollTarget =
        options?.focusScrollMonth ??
        normalized.from ??
        normalized.to ??
        new Date();
      setCalendarFocusMonth(startOfMonth(scrollTarget));
      if (options?.closePopover) {
        setOpen(false);
      }
    },
    [draftRolling, onChange],
  );

  const selectPreset = (preset: GoogleAdsDatePresetId) => {
    setDraftPreset(preset);
    if (preset === "custom") return;

    const range = computePresetRange(preset, new Date(), {
      accountEarliestYmd,
      rollingDays: draftRolling,
    });

    if (preset === "last_n_days_today" || preset === "last_n_days_yesterday") {
      setDraftRange(range);
      setStartInput(formatInputDate(range.from));
      setEndInput(formatInputDate(range.to));
      setCalendarFocusMonth(startOfMonth(range.to ?? range.from ?? new Date()));
      return;
    }

    commitSelection(preset, range, draftRolling, {
      closePopover: false,
      focusScrollMonth: preset === "all_time" ? range.from : range.to ?? range.from,
    });
  };

  const applyRolling = (preset: "last_n_days_today" | "last_n_days_yesterday") => {
    const range = computePresetRange(preset, new Date(), {
      rollingDays: draftRolling,
    });
    commitSelection(preset, range, draftRolling, {
      closePopover: false,
      focusScrollMonth: range.to ?? range.from,
    });
  };

  const syncInputsToRange = (from: Date | null, to: Date | null) => {
    if (!from || !to) return;
    const range = normalizeRange({ from, to });
    commitSelection("custom", range, draftRolling, {
      closePopover: false,
      focusScrollMonth: range.from,
    });
  };

  const handleStartBlur = () => {
    const from = parseInputDate(startInput);
    const to = parseInputDate(endInput) ?? draftRange?.to;
    if (from && to) syncInputsToRange(from, to);
  };

  const handleEndBlur = () => {
    const from = parseInputDate(startInput) ?? draftRange?.from;
    const to = parseInputDate(endInput);
    if (from && to) syncInputsToRange(from, to);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDraftRange(range);
      setDraftPreset("custom");
      return;
    }

    const partial = normalizeRange(range);
    setDraftRange(partial);
    setDraftPreset("custom");
    setStartInput(formatInputDate(partial.from));
    if (partial.to) setEndInput(formatInputDate(partial.to));

    if (partial.from && partial.to) {
      commitSelection("custom", partial, draftRolling, {
        closePopover: false,
        focusScrollMonth: partial.to,
      });
    }
  };

  const buttonLabel = formatGoogleAdsPickerButtonLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 min-w-[200px] justify-start gap-2 border-gray-300 bg-white px-3 text-left text-sm font-normal shadow-sm hover:bg-gray-50",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{buttonLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="google-ads-date-range-popover w-auto max-h-[min(560px,90vh)] border-gray-200 p-0 shadow-lg"
        align="end"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex h-[min(520px,85vh)] min-h-[420px] max-h-[min(560px,90vh)] w-full overflow-hidden">
          {/* Left — presets */}
          <div className="flex min-h-0 w-[220px] shrink-0 flex-col border-r border-gray-200 py-2">
            <div
              className={cn(
                googleAdsDateScrollHostClass,
                "min-h-0 flex-1 px-1",
                googleAdsScrollAreaClass,
              )}
              onWheel={(e) => e.stopPropagation()}
            >
              {PRESET_ROWS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm text-gray-800 hover:bg-brand-blue-soft/50",
                    draftPreset === row.id &&
                      "bg-brand-blue-soft font-medium text-brand-blue-on-soft",
                  )}
                  onClick={() => selectPreset(row.id)}
                >
                  <span>{row.label}</span>
                  {row.hasSubmenu ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                  ) : null}
                </button>
              ))}

              <div className="mt-1 space-y-1 border-t border-gray-100 px-2 pt-2">
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-wrap items-center gap-1 rounded-sm px-1 py-2 text-left text-sm hover:bg-brand-blue-soft/50",
                    draftPreset === "last_n_days_today" &&
                      "bg-brand-blue-soft text-brand-blue-on-soft",
                  )}
                  onClick={() => applyRolling("last_n_days_today")}
                >
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={draftRolling}
                    className="h-7 w-12 px-1 text-center text-sm"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftRolling(Number(e.target.value) || 30)}
                  />
                  <span>days up to today</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-wrap items-center gap-1 rounded-sm px-1 py-2 text-left text-sm hover:bg-brand-blue-soft/50",
                    draftPreset === "last_n_days_yesterday" &&
                      "bg-brand-blue-soft text-brand-blue-on-soft",
                  )}
                  onClick={() => applyRolling("last_n_days_yesterday")}
                >
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={draftRolling}
                    className="h-7 w-12 px-1 text-center text-sm"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraftRolling(Number(e.target.value) || 30)}
                  />
                  <span>days up to yesterday</span>
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-4 py-3">
              <Label htmlFor="gads-compare" className="text-sm font-normal text-gray-700">
                Compare
              </Label>
              <Switch
                id="gads-compare"
                checked={compareEnabled}
                onCheckedChange={setCompareEnabled}
                disabled
                title="Compare is not available yet"
              />
            </div>
          </div>

          {/* Right — inputs + scrollable calendar */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3">
            <div className="mb-3 grid shrink-0 grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Start date<span className="text-brand-red">*</span>
                </Label>
                <Input
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={handleStartBlur}
                  placeholder="dd/mm/yyyy"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  End date<span className="text-brand-red">*</span>
                </Label>
                <Input
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={handleEndBlur}
                  placeholder="dd/mm/yyyy"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <GoogleAdsScrollCalendar
                selected={draftRange}
                onSelect={handleCalendarSelect}
                minDate={calendarMinDate}
                maxDate={new Date()}
                focusMonth={calendarFocusMonth}
                layoutScrollKey={calendarLayoutScrollKey}
                className="flex min-h-0 flex-1 flex-col"
              />
            </div>

            {draftRange?.from && draftRange?.to ? (
              <p className="mt-2 shrink-0 text-center text-xs text-gray-500">
                {format(draftRange.from, "dd MMM yyyy")} – {format(draftRange.to, "dd MMM yyyy")}
                {" · "}
                Jakarta Time
                {draftPreset === "all_time" && accountEarliestYmd ? (
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    All time: from first activity ({accountEarliestYmd}) through today
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { toYmdLocal };
