import { useQuery } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import { usePosOutlets } from '@/8-2-2-outlets/hooks/usePosOutlets';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import type { FeedbackSentiment } from '../../lib/classifyFeedbackSentiment';
import type { FeedbackDateRange } from '../../lib/feedbackDatePresets';
import { FeedbackDateRangePicker } from './FeedbackDateRangePicker';

type Props = {
  outletId: string | null;
  employeeId: string | null;
  sentiment: FeedbackSentiment | null;
  dateRange: FeedbackDateRange;
  onOutletChange: (value: string | null) => void;
  onEmployeeChange: (value: string | null) => void;
  onSentimentChange: (value: FeedbackSentiment | null) => void;
  onDateRangeChange: (value: FeedbackDateRange) => void;
};

function useFeedbackEmployees() {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ['feedback-employees', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('organization_id', organizationId)
        .order('full_name');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.full_name ?? '—'),
      }));
    },
    staleTime: 60_000,
  });
}

export function FeedbackToolbar({
  outletId,
  employeeId,
  sentiment,
  dateRange,
  onOutletChange,
  onEmployeeChange,
  onSentimentChange,
  onDateRangeChange,
}: Props) {
  const { t } = useAppTranslation();
  const { rows: outlets } = usePosOutlets();
  const employeesQuery = useFeedbackEmployees();

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">{t('customers.tab.feedback', 'Feedback')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={outletId ?? 'all'}
          onValueChange={(v) => onOutletChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <Store className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder={t('customers.feedback.allOutlets', 'All outlets')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('customers.feedback.allOutlets', 'All outlets')}</SelectItem>
            {outlets.map((outlet) => (
              <SelectItem key={outlet.id} value={outlet.id}>
                {outlet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FeedbackDateRangePicker value={dateRange} onChange={onDateRangeChange} />

        <Select
          value={employeeId ?? 'all'}
          onValueChange={(v) => onEmployeeChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder={t('customers.feedback.allEmployees', 'All Employees')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('customers.feedback.allEmployees', 'All Employees')}</SelectItem>
            {(employeesQuery.data ?? []).map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sentiment ?? 'all'}
          onValueChange={(v) =>
            onSentimentChange(v === 'all' ? null : (v as FeedbackSentiment))
          }
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder={t('customers.feedback.allFeedbacks', 'All Feedbacks')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('customers.feedback.allFeedbacks', 'All Feedbacks')}</SelectItem>
            <SelectItem value="good">{t('customers.feedback.goodFeedbacks', 'Good Feedbacks')}</SelectItem>
            <SelectItem value="bad">{t('customers.feedback.badFeedbacks', 'Bad Feedbacks')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
