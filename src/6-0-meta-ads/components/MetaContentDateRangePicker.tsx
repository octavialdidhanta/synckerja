import { GoogleAdsDateRangePicker } from '@/6-0-google-ads/components/GoogleAdsDateRangePicker';
import {
  computePresetRange,
  formatGoogleAdsPickerButtonLabel,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from '@/6-0-google-ads/lib/googleAdsDatePresets';
import { buildMetaContentCalendarYearPresetYears } from '@/meta-content/lib/clampMetaContentDateRange';

function resolveInstagramPresetRange(
  preset: GoogleAdsDatePresetId,
  now: Date,
  opts?: {
    accountEarliestYmd?: string | null;
    rollingDays?: number;
    calendarYear?: number;
  },
) {
  return computePresetRange(preset, now, opts);
}

function formatMetaContentPickerButtonLabel(selection: GoogleAdsDateRangeSelection): string {
  if (selection.preset === 'all_time') {
    return 'All time · all posts';
  }
  return formatGoogleAdsPickerButtonLabel(selection);
}

type MetaContentDateRangePickerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  className?: string;
  calendarYearPresetYears?: number[];
};

export function MetaContentDateRangePicker({
  value,
  onChange,
  className,
  calendarYearPresetYears,
}: MetaContentDateRangePickerProps) {
  return (
    <GoogleAdsDateRangePicker
      value={value}
      onChange={onChange}
      className={className}
      formatButtonLabel={formatMetaContentPickerButtonLabel}
      resolvePresetRange={resolveInstagramPresetRange}
      calendarYearPresetYears={calendarYearPresetYears ?? buildMetaContentCalendarYearPresetYears()}
      calendarYearFilterHint="Quarters: use Q1–Q4 per year."
      allTimePopoverHint="All time: paginate through all published posts (no publish-date filter). Per-post metrics are lifetime totals from Meta."
    />
  );
}
