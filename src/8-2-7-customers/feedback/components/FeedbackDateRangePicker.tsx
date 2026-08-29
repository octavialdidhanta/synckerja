import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { FeedbackDatePresetId, FeedbackDateRange } from '../../lib/feedbackDatePresets';
import { computeFeedbackPresetRange, shiftFeedbackRangeByDay } from '../../lib/feedbackDatePresets';

const PRESETS: FeedbackDatePresetId[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
];

type Props = {
  value: FeedbackDateRange;
  onChange: (value: FeedbackDateRange) => void;
};

function presetLabel(preset: FeedbackDatePresetId, t: ReturnType<typeof useAppTranslation>['t']): string {
  const map: Record<FeedbackDatePresetId, string> = {
    today: t('customers.feedback.preset.today', 'Today'),
    yesterday: t('customers.feedback.preset.yesterday', 'Yesterday'),
    this_week: t('customers.feedback.preset.thisWeek', 'This Week'),
    last_week: t('customers.feedback.preset.lastWeek', 'Last Week'),
    this_month: t('customers.feedback.preset.thisMonth', 'This Month'),
    last_month: t('customers.feedback.preset.lastMonth', 'Last Month'),
    this_year: t('customers.feedback.preset.thisYear', 'This Year'),
    last_year: t('customers.feedback.preset.lastYear', 'Last Year'),
    custom: t('customers.feedback.preset.custom', 'Custom'),
  };
  return map[preset];
}

function formatRangeLabel(range: FeedbackDateRange): string {
  if (range.from === range.to) {
    try {
      return format(parseISO(range.from), 'd/M/yyyy');
    } catch {
      return range.from;
    }
  }
  try {
    return `${format(parseISO(range.from), 'd/M/yyyy')} – ${format(parseISO(range.to), 'd/M/yyyy')}`;
  } catch {
    return `${range.from} – ${range.to}`;
  }
}

export function FeedbackDateRangePicker({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset === 'custom' ? 'today' : value.preset}
        onValueChange={(preset) => {
          const next = computeFeedbackPresetRange(preset as FeedbackDatePresetId);
          onChange({ preset: preset as FeedbackDatePresetId, ...next });
        }}
      >
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder={t('customers.feedback.preset.today', 'Today')} />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {presetLabel(preset, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t('customers.feedback.prevPeriod', 'Previous period')}
          onClick={() => onChange(shiftFeedbackRangeByDay(value, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-9 min-w-[120px] items-center justify-center rounded-md border bg-background px-3 text-sm tabular-nums">
          {formatRangeLabel(value)}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={t('customers.feedback.nextPeriod', 'Next period')}
          onClick={() => onChange(shiftFeedbackRangeByDay(value, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
