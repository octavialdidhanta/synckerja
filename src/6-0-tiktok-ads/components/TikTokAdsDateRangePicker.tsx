import { endOfDay } from "date-fns";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import {
  computePresetRange,
  dateSelectionForCalendarQuarter,
  parseYmdLocal,
  formatGoogleAdsPickerButtonLabel,
  type CalendarQuarter,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  tiktokAdsAllTimeDateRange,
  tiktokAdsEarliestAllowedStartYmd,
} from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

function tiktokAllTimeRangeDates(now: Date = new Date()) {
  const { start, end } = tiktokAdsAllTimeDateRange(now);
  const from = parseYmdLocal(start);
  const to = parseYmdLocal(end);
  if (!from || !to) return null;
  return { from, to: endOfDay(to) };
}

function resolveTikTokPresetRange(
  preset: GoogleAdsDatePresetId,
  now: Date,
  opts?: {
    accountEarliestYmd?: string | null;
    rollingDays?: number;
    calendarYear?: number;
    calendarQuarter?: CalendarQuarter;
  },
) {
  if (preset === "all_time") {
    const range = tiktokAllTimeRangeDates(now);
    if (range) return range;
  }
  if (
    preset === "calendar_quarter" &&
    opts?.calendarYear != null &&
    opts?.calendarQuarter != null
  ) {
    return dateSelectionForCalendarQuarter(
      opts.calendarYear,
      opts.calendarQuarter,
      now,
    ).range;
  }
  return computePresetRange(preset, now, opts);
}

type TikTokAdsDateRangePickerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  className?: string;
  calendarYearPresetYears?: number[];
  calendarYearFilterHint?: string;
};

export function TikTokAdsDateRangePicker({
  value,
  onChange,
  className,
  calendarYearPresetYears,
  calendarYearFilterHint,
}: TikTokAdsDateRangePickerProps) {
  const handleChange = (next: GoogleAdsDateRangeSelection) => {
    if (next.preset === "calendar_year" || next.preset === "calendar_quarter") {
      onChange(next);
      return;
    }
    if (next.preset === "all_time") {
      const range = tiktokAllTimeRangeDates();
      if (range) {
        onChange({ ...next, preset: "all_time", range });
        return;
      }
    }
    onChange(next);
  };

  return (
    <GoogleAdsDateRangePicker
      value={value}
      onChange={handleChange}
      className={className}
      accountEarliestYmd={tiktokAdsEarliestAllowedStartYmd()}
      formatButtonLabel={formatGoogleAdsPickerButtonLabel}
      resolvePresetRange={resolveTikTokPresetRange}
      calendarYearPresetYears={calendarYearPresetYears}
      calendarYearFilterHint={
        calendarYearFilterHint ??
        "Quarters: use Q1–Q4 per year; TikTok data is limited to the last 365 days"
      }
      allTimePopoverHint="All time: last 365 days (TikTok API limit) through today"
    />
  );
}
