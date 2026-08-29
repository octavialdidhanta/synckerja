import { format, parseISO } from 'date-fns';
import { Frown, Smile } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import type { PosReceiptFeedbackRow } from '../types';

type Props = {
  rows: PosReceiptFeedbackRow[];
  selectedId: string | null;
  onSelect: (row: PosReceiptFeedbackRow) => void;
};

function formatFeedbackDate(value: string): string {
  try {
    return format(parseISO(value.slice(0, 10)), 'dd-MM-yyyy');
  } catch {
    return value.slice(0, 10) || '—';
  }
}

export function FeedbackTable({ rows, selectedId, onSelect }: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t('customers.feedback.empty', 'No Data To Display')}
        </p>
        <a
          href="https://help.synckerja.com"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {t('customers.feedback.learnMore', 'Learn more about View and Respond to Customer Feedback')}
        </a>
      </div>
    );
  }

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-gray-50">
          <TableRow>
            <TableHead>{t('customers.feedback.colDate', 'Date')}</TableHead>
            <TableHead>{t('customers.feedback.colName', 'Name')}</TableHead>
            <TableHead>{t('customers.feedback.colComment', 'Comment')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const Icon = row.sentiment === 'good' ? Smile : Frown;
            return (
              <TableRow
                key={row.id}
                className={cn('cursor-pointer', selectedId === row.id && 'bg-muted/50')}
                onClick={() => onSelect(row)}
              >
                <TableCell className="tabular-nums">{formatFeedbackDate(row.submittedAt)}</TableCell>
                <TableCell className="font-medium">{row.customerName}</TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        row.sentiment === 'good' ? 'text-primary' : 'text-muted-foreground',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {row.rating}/5 · {row.outletName}
                      </p>
                      {row.comment ? (
                        <p className="truncate text-sm">&ldquo;{row.comment}&rdquo;</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
