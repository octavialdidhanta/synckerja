import { useEffect } from 'react';
import { CheckSquare, Clock, AlertTriangle, Calendar, TrendingUp, Percent } from 'lucide-react';
import { useDailyTask } from '../context/DailyTaskContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import RecentUpdateSteps from './RecentUpdateSteps';
import { PendingApprovalSection } from './PendingApprovalSection';

interface SummaryData {
  labelKey: string;
  defaultLabel: string;
  count: number;
  color: string;
  icon: any;
  bgColor: string;
  textColor: string;
  borderColor: string;
  isPercent?: boolean;
}

interface TaskSummaryCardsProps {
  /** When provided, "View Content" in Pending Approval opens the preview modal (Task Summary desktop). */
  onOpenPreview?: (planId: string, callbacks?: { onClose: () => void }) => void;
}

const TaskSummaryCards = ({ onOpenPreview }: TaskSummaryCardsProps) => {
  const { t } = useAppTranslation();
  const { summaryData, isLoading, fetchRecentStepUpdates } = useDailyTask();

  // Lazy-load recent step updates when Summary tab is opened (avoids timeout on initial page load)
  useEffect(() => {
    fetchRecentStepUpdates().catch(() => {});
  }, [fetchRecentStepUpdates]);

  const summaryCards: SummaryData[] = [
    { labelKey: 'dailyTask.summary.pending', defaultLabel: 'Pending', count: summaryData.pending, color: 'gray', icon: Clock, bgColor: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
    { labelKey: 'dailyTask.summary.inProgress', defaultLabel: 'In Progress', count: summaryData.inProgress, color: 'blue', icon: CheckSquare, bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
    { labelKey: 'dailyTask.summary.completed', defaultLabel: 'Completed', count: summaryData.completed, color: 'green', icon: CheckSquare, bgColor: 'bg-green-50', textColor: 'text-green-600', borderColor: 'border-green-200' },
    { labelKey: 'dailyTask.summary.overdue', defaultLabel: 'Overdue', count: summaryData.overdue, color: 'red', icon: AlertTriangle, bgColor: 'bg-red-50', textColor: 'text-red-600', borderColor: 'border-red-200' },
    { labelKey: 'dailyTask.summary.totalSteps', defaultLabel: 'Total Steps', count: summaryData.totalSteps, color: 'purple', icon: TrendingUp, bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
    { labelKey: 'dailyTask.summary.completedSteps', defaultLabel: 'Completed Steps', count: summaryData.completedSteps, color: 'emerald', icon: CheckSquare, bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
    { labelKey: 'dailyTask.summary.plannedThisMonth', defaultLabel: 'Planned This Month', count: summaryData.tasksPlannedThisMonth, color: 'indigo', icon: Calendar, bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
    { labelKey: 'dailyTask.summary.completionRate', defaultLabel: 'Completion Rate', count: summaryData.totalSteps > 0 ? Math.round((summaryData.completedSteps / summaryData.totalSteps) * 100) : 0, color: 'teal', icon: Percent, bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200', isPercent: true },
  ];

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((item, index) => {
          const IconComponent = item.icon;
          const label = t(item.labelKey, item.defaultLabel);
          return (
            <div
              key={index}
              className={`${item.bgColor} ${item.borderColor} border rounded-lg p-3 flex items-center justify-between min-h-[60px]`}
            >
              <div className="flex items-center gap-2">
                <IconComponent className={`w-4 h-4 ${item.textColor}`} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <span className={`text-xl font-bold ${item.textColor}`}>
                {item.isPercent ? `${item.count}%` : item.count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pending your approval (assigner) + Rejected (assignee) */}
      <PendingApprovalSection onOpenPreview={onOpenPreview} />

      {/* Recent Step Updates */}
      <div className="mt-4">
        <RecentUpdateSteps />
      </div>
    </div>
  );
};

export default TaskSummaryCards;

