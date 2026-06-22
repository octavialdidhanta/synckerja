import { SALES_OPS_CARD_FOOTER } from '@/5-2-activities/layout/salesOperationsLayout';

interface SalesActivitiesTableFooterProps {
  totalActivities: number;
  closedWonActivities: number;
  filteredActivities?: number;
  selectedStatus?: string;
}

export const SalesActivitiesTableFooter = ({
  totalActivities,
  closedWonActivities,
  filteredActivities = totalActivities,
  selectedStatus,
}: SalesActivitiesTableFooterProps) => {
  const statusText =
    selectedStatus && selectedStatus !== 'all'
      ? ` in ${selectedStatus.replace('_', ' ')}`
      : '';

  return (
    <div className={SALES_OPS_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {filteredActivities} of {totalActivities} activities{statusText}
        </span>
        <span className="text-xs text-gray-400">
          Closed won: {closedWonActivities} · Total: {totalActivities}
        </span>
      </div>
    </div>
  );
};
