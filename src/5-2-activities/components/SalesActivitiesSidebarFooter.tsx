import { SALES_OPS_CARD_FOOTER } from '@/5-2-activities/layout/salesOperationsLayout';

interface SalesActivitiesSidebarFooterProps {
  totalTypes: number;
  totalActivities: number;
}

export const SalesActivitiesSidebarFooter = ({
  totalTypes,
  totalActivities,
}: SalesActivitiesSidebarFooterProps) => {
  return (
    <div className={SALES_OPS_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Types: {totalTypes}</span>
        <span className="text-xs text-gray-400">Total: {totalActivities}</span>
      </div>
    </div>
  );
};
