import { GoogleAdsDateRangePicker } from '@/6-0-google-ads/components/GoogleAdsDateRangePicker';
import {
  computePresetRange,
  formatGoogleAdsPickerButtonLabel,
  type GoogleAdsDatePresetId,
  type GoogleAdsDateRangeSelection,
} from '@/6-0-google-ads/lib/googleAdsDatePresets';
import {
  buildThreadsCalendarYearPresetYears,
  THREADS_EARLIEST_YMD,
} from '@/threads-content/lib/toThreadsPostDateRangePayload';

function resolveThreadsPresetRange(
  preset: GoogleAdsDatePresetId,
  now: Date,
  opts?: {
    accountEarliestYmd?: string | null;
    rollingDays?: number;
    calendarYear?: number;
  },
) {
  return computePresetRange(preset, now, {
    ...opts,
    accountEarliestYmd: opts?.accountEarliestYmd ?? THREADS_EARLIEST_YMD,
  });
}

function formatThreadsPickerButtonLabel(selection: GoogleAdsDateRangeSelection): string {
  if (selection.preset === 'all_time') {
    return 'All time · all posts';
  }
  return formatGoogleAdsPickerButtonLabel(selection);
}

type ThreadsDateRangePickerProps = {
  value: GoogleAdsDateRangeSelection;
  onChange: (value: GoogleAdsDateRangeSelection) => void;
  className?: string;
  calendarYearPresetYears?: number[];
};

export function ThreadsDateRangePicker({
  value,
  onChange,
  className,
  calendarYearPresetYears,
}: ThreadsDateRangePickerProps) {
  return (
    <GoogleAdsDateRangePicker
      value={value}
      onChange={onChange}
      className={className}
      accountEarliestYmd={THREADS_EARLIEST_YMD}
      formatButtonLabel={formatThreadsPickerButtonLabel}
      resolvePresetRange={resolveThreadsPresetRange}
      calendarYearPresetYears={calendarYearPresetYears ?? buildThreadsCalendarYearPresetYears()}
      calendarYearFilterHint="Quarters: use Q1–Q4 per year; Threads posts back to 2022."
      allTimePopoverHint="All time: paginate through all Threads posts (no 365-day limit)."
    />
  );
}
