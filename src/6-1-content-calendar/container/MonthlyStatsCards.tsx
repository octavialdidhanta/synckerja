import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface MonthlyStatsCardsProps {
  monthlyStats: {
    total: number;
    red: number;
    orange: number;
    yellow: number;
    green: number;
    greenWithLate: number;
  };
}

export const MonthlyStatsCards: React.FC<MonthlyStatsCardsProps> = ({ monthlyStats }) => {
  const { t } = useAppTranslation();

  const cards = [
    { value: monthlyStats.total, color: 'text-blue-600', labelKey: 'contentCalendar.statsCards.total' as const },
    { value: monthlyStats.red, color: 'text-red-600', labelKey: 'contentCalendar.legend.notApproved' as const },
    { value: monthlyStats.orange, color: 'text-orange-600', labelKey: 'contentCalendar.legend.contentPlanApproved' as const },
    { value: monthlyStats.yellow, color: 'text-amber-600', labelKey: 'contentCalendar.legend.productionApproved' as const },
    { value: monthlyStats.green, color: 'text-green-600', labelKey: 'contentCalendar.legend.completed' as const },
    { value: monthlyStats.greenWithLate, color: 'text-green-700', labelKey: 'contentCalendar.legend.completedLate' as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <Card key={c.labelKey}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-muted-foreground">{t(c.labelKey)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
