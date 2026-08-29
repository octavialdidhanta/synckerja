import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  goodCount: number;
  badCount: number;
};

export function FeedbackSummaryCards({ goodCount, badCount }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('customers.feedback.goodFeedbacks', 'Good Feedbacks')}
        </p>
        <p className="text-3xl font-semibold tabular-nums">{goodCount}</p>
      </div>
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('customers.feedback.badFeedbacks', 'Bad Feedbacks')}
        </p>
        <p className="text-3xl font-semibold tabular-nums">{badCount}</p>
      </div>
    </div>
  );
}
