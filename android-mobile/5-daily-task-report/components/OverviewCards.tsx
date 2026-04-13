import React from 'react';
import { useDailyTaskReport } from '@/8-2-DailyTaskReport/context/ReportContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

export const OverviewCards = () => {
  const { filtered } = useDailyTaskReport();
  const { t } = useAppTranslation();
  const total = filtered.length;
  const completed = filtered.filter((p) => p.isCompleted).length;
  const ontime = filtered.filter((p) => p.isOnTime === true).length;
  const late = filtered.filter((p) => p.isOnTime === false).length;

  const Card = ({
    title,
    value,
    className,
    icon,
  }: {
    title: string;
    value: number;
    className: string;
    icon?: React.ReactNode;
  }) => (
    <div className={cn('w-full rounded-lg border p-2.5 md:p-3', className)}>
      <div className="mb-1.5 flex items-center justify-between md:mb-2">
        <h3 className="text-xs font-medium text-muted-foreground md:text-sm">{title}</h3>
        {icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-xl font-bold text-foreground md:text-2xl">{value}</div>
        <div className="text-[10px] text-muted-foreground md:text-xs">{title}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2 p-2 md:grid-cols-4 md:gap-2 md:p-0">
        <Card
          title={t('dailyTaskReport.overview.totalAssignments', 'Total Assignments')}
          value={total}
          className="border-border bg-primary/5"
        />
        <Card
          title={t('dailyTaskReport.overview.completed', 'Completed')}
          value={completed}
          className="border-primary/20 bg-primary/10"
        />
        <Card
          title={t('dailyTaskReport.overview.onTime', 'On Time')}
          value={ontime}
          className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-green-950/20"
        />
        <Card
          title={t('dailyTaskReport.overview.late', 'Late')}
          value={late}
          className="border-destructive/25 bg-gradient-to-br from-destructive/10 to-orange-50 dark:border-destructive/30 dark:from-destructive/15 dark:to-orange-950/20"
        />
      </div>
    </div>
  );
};
