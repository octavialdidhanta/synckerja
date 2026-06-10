import { endOfDay } from "date-fns";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import {
  computePresetRange,
  parseYmdLocal,
  formatGoogleAdsPickerButtonLabel,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { tiktokAdsAllTimeDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";

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
  },
) {
  if (preset === "all_time") {
    const range = tiktokAllTimeRangeDates(now);
    if (range) return range;
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
    if (next.preset === "calendar_year") {
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
      formatButtonLabel={formatGoogleAdsPickerButtonLabel}
      resolvePresetRange={resolveTikTokPresetRange}
      calendarYearPresetYears={calendarYearPresetYears}
      calendarYearFilterHint={calendarYearFilterHint}
      allTimePopoverHint="All time: last 365 days (TikTok API limit) through today"
    />
  );
}
