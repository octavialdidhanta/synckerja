import { endOfDay } from "date-fns";
import { GoogleAdsDateRangePicker } from "@/6-0-google-ads/components/GoogleAdsDateRangePicker";
import {
  computePresetRange,
  parseYmdLocal,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { metaAdsAllTimeDateRange } from "@/meta-ads/lib/clampMetaAdsDateRange";
import { formatMetaAdsPickerButtonLabel } from "@/meta-ads/lib/formatMetaAdsPickerButtonLabel";

function metaAllTimeRangeDates(now: Date = new Date()) {
  const { start, end } = metaAdsAllTimeDateRange(now);
  const from = parseYmdLocal(start);
  const to = parseYmdLocal(end);
  if (!from || !to) return null;
  return { from, to: endOfDay(to) };
}

function resolveMetaPresetRange(
  preset: GoogleAdsDatePresetId,
  now: Date,
  opts?: {
    accountEarliestYmd?: string | null;
    rollingDays?: number;
    calendarYear?: number;
  },
) {
  if (preset === "all_time") {
    const range = metaAllTimeRangeDates(now);
    if (range) return range;
  }
  return computePresetRange(preset, now, opts);
}

type MetaAdsDateRangePickerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  className?: string;
  calendarYearPresetYears?: number[];
  calendarYearFilterHint?: string;
};

export function MetaAdsDateRangePicker({
  value,
  onChange,
  className,
  calendarYearPresetYears,
  calendarYearFilterHint,
}: MetaAdsDateRangePickerProps) {
  const handleChange = (next: GoogleAdsDateRangeSelection) => {
    if (next.preset === "calendar_year") {
      onChange(next);
      return;
    }
    if (next.preset === "all_time") {
      const range = metaAllTimeRangeDates();
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
      formatButtonLabel={formatMetaAdsPickerButtonLabel}
      resolvePresetRange={resolveMetaPresetRange}
      calendarYearPresetYears={calendarYearPresetYears}
      calendarYearFilterHint={calendarYearFilterHint}
      allTimePopoverHint="All time: last 37 months (Meta API limit) through today"
    />
  );
}
