import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import type { FeedbackSentiment } from '../lib/classifyFeedbackSentiment';
import {
  computeFeedbackPresetRange,
  type FeedbackDateRange,
} from '../lib/feedbackDatePresets';
import { CustomersModuleShell } from '../layout/CustomersModuleShell';
import { CustomersWorkspace } from '../layout/CustomersWorkspace';
import { CustomersFeedbackPageSkeleton } from '../skeletons/CustomersFeedbackPageSkeleton';
import { FeedbackDetailDialog } from '../feedback/components/FeedbackDetailDialog';
import { FeedbackSummaryCards } from '../feedback/components/FeedbackSummaryCards';
import { FeedbackTable } from '../feedback/components/FeedbackTable';
import { FeedbackToolbar } from '../feedback/components/FeedbackToolbar';
import { usePosReceiptFeedback } from '../feedback/hooks/usePosReceiptFeedback';
import type { PosReceiptFeedbackRow } from '../feedback/types';

function parseFilters(searchParams: URLSearchParams): {
  outletId: string | null;
  employeeId: string | null;
  sentiment: FeedbackSentiment | null;
  dateRange: FeedbackDateRange;
} {
  const defaultRange = computeFeedbackPresetRange('today');
  const presetRaw = searchParams.get('preset');
  const preset =
    presetRaw === 'yesterday' ||
    presetRaw === 'this_week' ||
    presetRaw === 'last_week' ||
    presetRaw === 'this_month' ||
    presetRaw === 'last_month' ||
    presetRaw === 'this_year' ||
    presetRaw === 'last_year' ||
    presetRaw === 'custom'
      ? presetRaw
      : 'today';

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const computed = computeFeedbackPresetRange(preset);
  const dateRange: FeedbackDateRange = {
    preset,
    from: fromParam || computed.from,
    to: toParam || computed.to,
  };

  const sentimentRaw = searchParams.get('sentiment');
  const sentiment =
    sentimentRaw === 'good' || sentimentRaw === 'bad' ? sentimentRaw : null;

  return {
    outletId: searchParams.get('outlet') || null,
    employeeId: searchParams.get('employee') || null,
    sentiment,
    dateRange,
  };
}

export default function CustomersFeedbackPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const [selectedRow, setSelectedRow] = useState<PosReceiptFeedbackRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const feedbackQuery = usePosReceiptFeedback({
    outletId: filters.outletId,
    employeeId: filters.employeeId,
    sentiment: filters.sentiment,
    from: filters.dateRange.from,
    to: filters.dateRange.to,
  });

  const showContent = useDebouncedReady(!(orgBootstrapPending || feedbackQuery.isLoading), 200);

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  return (
    <CustomersModuleShell
      showContent={showContent}
      loadingSkeleton={<CustomersFeedbackPageSkeleton />}
    >
      <CustomersWorkspace count={feedbackQuery.data?.rows.length ?? 0}>
          <div className="flex-shrink-0 border-b px-4 py-3">
            <FeedbackToolbar
              outletId={filters.outletId}
              employeeId={filters.employeeId}
              sentiment={filters.sentiment}
              dateRange={filters.dateRange}
              onOutletChange={(outletId) => patchParams({ outlet: outletId })}
              onEmployeeChange={(employeeId) => patchParams({ employee: employeeId })}
              onSentimentChange={(sentiment) => patchParams({ sentiment })}
              onDateRangeChange={(dateRange) =>
                patchParams({
                  preset: dateRange.preset,
                  from: dateRange.from,
                  to: dateRange.to,
                })
              }
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
            {feedbackQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {feedbackQuery.error instanceof Error
                      ? feedbackQuery.error.message
                      : t('customers.feedback.loadError', 'Failed to load feedback.')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void feedbackQuery.refetch()}>
                    {t('common.retry', 'Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <FeedbackSummaryCards
              goodCount={feedbackQuery.data?.goodCount ?? 0}
              badCount={feedbackQuery.data?.badCount ?? 0}
            />

            <FeedbackTable
              rows={feedbackQuery.data?.rows ?? []}
              selectedId={selectedRow?.id ?? null}
              onSelect={(row) => {
                setSelectedRow(row);
                setDetailOpen(true);
              }}
            />
          </div>
      </CustomersWorkspace>

      <FeedbackDetailDialog
        row={selectedRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </CustomersModuleShell>
  );
}
