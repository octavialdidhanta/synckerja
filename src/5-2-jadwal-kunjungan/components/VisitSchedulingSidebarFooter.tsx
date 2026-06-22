import { SALES_OPS_CARD_FOOTER } from '@/5-2-activities/layout/salesOperationsLayout';

interface VisitSchedulingSidebarFooterProps {
  totalStatuses: number;
  totalVisits: number;
}

export const VisitSchedulingSidebarFooter = ({ 
  totalStatuses, 
  totalVisits 
}: VisitSchedulingSidebarFooterProps) => {
  return (
    <div className={SALES_OPS_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Statuses: {totalStatuses}</span>
        <span className="text-xs text-gray-400">Total: {totalVisits}</span>
      </div>
    </div>
  );
};









