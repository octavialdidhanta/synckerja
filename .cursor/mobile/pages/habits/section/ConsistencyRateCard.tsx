import React, { useMemo } from 'react';
import { useHabitTracker } from '@/features/8-2-HabitTracker/context/HabitTrackerContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isSameMonth } from 'date-fns';
import { isHabitActiveOnDay, isHabitCompletedOnDay } from '@/features/8-2-HabitTracker/utils/habitDayUtils';

const useCumulativeConsistency = (currentMonth: Date) => {
  const { filteredHabits, entries } = useHabitTracker();

  return useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const today = new Date();

    let totalCompleted = 0;
    let totalExpected = 0;

    monthDays.forEach((day) => {
      if (!isSameMonth(day, currentMonth) || isAfter(day, today)) return;
      const activeHabits = filteredHabits.filter((h) => isHabitActiveOnDay(h, day));
      const total = activeHabits.length;
      const done = activeHabits.filter((h) => isHabitCompletedOnDay(h, day, entries)).length;
      totalExpected += total;
      totalCompleted += done;
    });

    if (totalExpected === 0) return 0;
    return (totalCompleted / totalExpected) * 100;
  }, [filteredHabits, entries, currentMonth]);
};

export const ConsistencyRateCard = ({ currentMonth: monthProp }: { currentMonth?: Date }) => {
  const { t } = useAppTranslation();
  const currentMonth = monthProp ?? new Date();
  const rate = useCumulativeConsistency(currentMonth);

  return (
    <section className="bg-muted/40 rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground text-center">
          {t('habitTracker.consistencyRateHeader', 'Consistency Rate')}
        </h3>
      </div>
      <div className="p-6 flex flex-col items-center justify-center min-h-[72px]">
        <span className="text-3xl font-bold text-foreground tabular-nums">
          {Math.round(rate)}%
        </span>
      </div>
    </section>
  );
};
