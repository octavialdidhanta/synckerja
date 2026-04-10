import React from 'react';
import { useDailyTaskReport } from '@/features/8-2-DailyTaskReport/context/ReportContext';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

export const OverviewCards = () => {
  const { filtered } = useDailyTaskReport();
  const { t } = useAppTranslation();
  const total = filtered.length;
  const completed = filtered.filter(p => p.isCompleted).length;
  const withDue = filtered.filter(p => p.dueDate).length;
  const ontime = filtered.filter(p => p.isOnTime === true).length;
  const late = filtered.filter(p => p.isOnTime === false).length;

  const Card = ({ title, value, color, icon }: { title: string; value: number; color: string; icon?: React.ReactNode }) => (
    <div className={`bg-white border rounded-lg p-2.5 md:p-3 w-full ${color}`.trim()}>
      <div className="flex items-center justify-between mb-1.5 md:mb-2">
        <h3 className="text-xs md:text-sm font-medium text-gray-700">{title}</h3>
        {icon}
      </div>
      <div className="space-y-0.5">
        <div className="text-xl md:text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-[10px] md:text-xs text-gray-500">{title}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-2 p-2 md:p-0">
      <Card title={t('dailyTaskReport.overview.totalAssignments', 'Total Assignments')} value={total} color="border-gray-200" />
      <Card title={t('dailyTaskReport.overview.completed', 'Completed')} value={completed} color="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50" />
      <Card title={t('dailyTaskReport.overview.onTime', 'On Time')} value={ontime} color="border-green-100 bg-gradient-to-br from-green-50 to-emerald-50" />
      <Card title={t('dailyTaskReport.overview.late', 'Late')} value={late} color="border-red-100 bg-gradient-to-br from-red-50 to-orange-50" />
      </div>
    </div>
  );
};

